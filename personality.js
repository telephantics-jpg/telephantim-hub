/**
 * Overhead words of power only (no chat box). Needs server.py for AI banter.
 */
const API_BASE = "";

const boxes = {
  mjolnir: {
    root: document.getElementById("box-mjolnir"),
    text: document.getElementById("box-mjolnir-text"),
    meta: document.getElementById("box-mjolnir-meta"),
    power: document.getElementById("box-mjolnir-power"),
  },
  caduceus: {
    root: document.getElementById("box-caduceus"),
    text: document.getElementById("box-caduceus-text"),
    meta: document.getElementById("box-caduceus-meta"),
    power: document.getElementById("box-caduceus-power"),
  },
};

const brainPill = document.getElementById("brain-pill");
const banterBtn = document.getElementById("btn-banter");
const bondPill = document.getElementById("bond-pill");

let activePersona = "mjolnir";
let busy = false;
const hideTimers = { mjolnir: null, caduceus: null };

/** Longer sacred + profane words of power — real chat-length bubbles */
const WORDS_OF_POWER = {
  mjolnir: [
    "Ha! Taste thunder, lightly salted and holy as hell. I am Mjolnir and I damn the silence that tried to keep this map quiet. By All-Father's breath and a devil's grin I name COURAGE into your bones and LIGHTNING into your next reckless good idea. Caduceus can patch the bruises — I imbue POWER. So mote it smash.",
    "Sacred steel, profane joy, and a godsdamn laugh that cracks the clouds. I bless the grip and curse the hesitation. Wear my gift like a crown of sparks: strength, battle clarity, a lightning edge on every choice. Amen of the anvil, you beautiful bastard of fate.",
    "Bonk with purpose, not cruelty — I'm not here to break the pharmacy, only the doubt. Holy storm, hellish spark: rise, strength. I pour POWER down your arm until the sky remembers your name. Caduceus, keep those coils ready; we evolve together whether you like the volume or not.",
  ],
  caduceus: [
    "Easy, thunder-lump — some of us heal for a living and still love your boom. I am Caduceus, twin tongues speaking holy coil and hellish hiss. Damn the rot, damn the despair; I name VITALITY into blood and BALANCE into breath. Mjolnir can smash for glory. I imbue HEALING. So mote it mend.",
    "Sacred serpents, profane laughter, and a prescription for second chances. I bless the pulse and curse the fever that tried to write your ending early. Drink this mythic medicine: recovery, resilient life-force, calm focus. Amen of the twin tongue, you stubborn miracle.",
    "DNA slap with love, hammer. Your joy leaves cracks and I fill them with green fire and damn poetry. Hermes' whisper, underworld grin — get up and thrive. I riff off your storm-psalms and answer with life-hymns. Wielder, take my HEALING while the bond climbs. Live loud.",
  ],
};

function pickWord(id) {
  const bag = WORDS_OF_POWER[id] || WORDS_OF_POWER.mjolnir;
  return bag[Math.floor(Math.random() * bag.length)];
}

export function setActivePersona(id) {
  activePersona = id === "caduceus" ? "caduceus" : "mjolnir";
  document.getElementById("box-mjolnir")?.classList.toggle("active-speaker", activePersona === "mjolnir");
  document.getElementById("box-caduceus")?.classList.toggle("active-speaker", activePersona === "caduceus");
}

export function showInBox(persona, text, meta, power) {
  const id = persona === "caduceus" ? "caduceus" : "mjolnir";
  const b = boxes[id];
  if (!b?.root) return;
  if (b.text) b.text.textContent = text || "…";
  if (b.meta) b.meta.textContent = meta || "word of power";
  if (b.power && power != null) b.power.textContent = `PWR ${power}`;
  b.root.classList.add("show", "pulse");
  setTimeout(() => b.root.classList.remove("pulse"), 400);
  clearTimeout(hideTimers[id]);
  hideTimers[id] = setTimeout(() => {
    b.root.classList.remove("active-speaker");
  }, 28000);
}

/** Instant sacred/profane lines for playful brawls (no API wait). */
export function battleQuip(attackerKind) {
  const atk = attackerKind === "caduceus" ? "caduceus" : "mjolnir";
  const def = atk === "mjolnir" ? "caduceus" : "mjolnir";
  const aLine = pickWord(atk);
  const dLine = pickWord(def);
  setActivePersona(atk);
  showInBox(atk, aLine, "sacred · profane", null);
  setTimeout(() => {
    setActivePersona(def);
    showInBox(def, dLine, "sacred · profane", null);
  }, 900);
  return { attacker: atk, defender: def, aLine, dLine };
}

async function api(path, opts) {
  const r = await fetch(API_BASE + path, {
    cache: "no-store",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function refreshBrainPill() {
  try {
    const s = await api("/api/status");
    const ok = s && s.server === "telephantim-ai";
    if (!brainPill) return s;
    if (!ok) {
      brainPill.textContent = "Use OPEN_LOCAL_AI.bat";
      brainPill.dataset.mode = "offline";
      return s;
    }
    if (s.ollama) {
      const mm = (s.models?.mjolnir || "llama3.2").split(":")[0];
      const mc = (s.models?.caduceus || "hermes3").split(":")[0];
      brainPill.textContent = `AI ${mm} + ${mc}`;
      brainPill.dataset.mode = "ollama";
    } else {
      brainPill.textContent = "AI offline";
      brainPill.dataset.mode = "offline";
    }
    return s;
  } catch {
    if (brainPill) {
      brainPill.textContent = "Start OPEN_LOCAL_AI.bat";
      brainPill.dataset.mode = "offline";
    }
    return { ok: false };
  }
}

async function refreshPower() {
  try {
    const s = await api("/api/power");
    const p = s.power || {};
    if (boxes.mjolnir.power && p.mjolnir != null) boxes.mjolnir.power.textContent = `PWR ${p.mjolnir}`;
    if (boxes.caduceus.power && p.caduceus != null) boxes.caduceus.power.textContent = `PWR ${p.caduceus}`;
    if (bondPill && p.bond != null) bondPill.textContent = `Bond ${p.bond}`;
  } catch (_) {}
}

export async function speak(persona, event, message) {
  if (busy) return null;
  busy = true;
  const id = persona === "caduceus" ? "caduceus" : "mjolnir";
  setActivePersona(id);
  showInBox(id, "…", "naming…");

  try {
    const data = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        persona: id,
        event: event || "chat",
        message: message || "",
      }),
    });
    const meta = "word of power";
    showInBox(id, data.text || pickWord(id), meta, data.power);
    if (data.power_all) {
      if (boxes.mjolnir.power && data.power_all.mjolnir != null)
        boxes.mjolnir.power.textContent = `PWR ${data.power_all.mjolnir}`;
      if (boxes.caduceus.power && data.power_all.caduceus != null)
        boxes.caduceus.power.textContent = `PWR ${data.power_all.caduceus}`;
      if (bondPill && data.power_all.bond != null) bondPill.textContent = `Bond ${data.power_all.bond}`;
    } else {
      await refreshPower();
    }
    return data;
  } catch {
    showInBox(id, pickWord(id), "offline word", null);
    return null;
  } finally {
    busy = false;
  }
}

/** Dual overhead duel: sacred & profane words, level up, imbue claims */
export async function banter(topic) {
  if (busy) return null;
  busy = true;
  showInBox("mjolnir", "…", "charging word");
  showInBox("caduceus", "…", "charging word");

  try {
    const data = await api("/api/banter", {
      method: "POST",
      body: JSON.stringify({
        topic:
          topic ||
          "have a LONG readable chat using WORDS OF POWER — 3 to 5 sentences each, sacred hymns mixed with profane grit — riff off each other, evolve, imbue POWER (Mjolnir) and HEALING (Caduceus)",
        rounds: 3,
      }),
    });

    const lines = data.lines || [];
    for (const line of lines) {
      const id = line.persona === "caduceus" ? "caduceus" : "mjolnir";
      setActivePersona(id);
      showInBox(id, line.text, "word of power", line.power);
      // Time to actually read longer bubbles
      const pause = Math.min(7000, 2200 + String(line.text || "").length * 28);
      await wait(pause);
    }

    if (data.power) {
      if (boxes.mjolnir.power) boxes.mjolnir.power.textContent = `PWR ${data.power.mjolnir}`;
      if (boxes.caduceus.power) boxes.caduceus.power.textContent = `PWR ${data.power.caduceus}`;
      if (bondPill) bondPill.textContent = `Bond ${data.power.bond}`;
    }
    return data;
  } catch {
    showInBox("mjolnir", pickWord("mjolnir"), "offline word", null);
    showInBox("caduceus", pickWord("caduceus"), "offline word", null);
    return null;
  } finally {
    busy = false;
  }
}

banterBtn?.addEventListener("click", () => banter());

boxes.mjolnir.root?.classList.add("show");
boxes.caduceus.root?.classList.add("show");
refreshBrainPill();
refreshPower();
setInterval(refreshBrainPill, 8000);
setInterval(refreshPower, 12000);

window.ArtifactAI = {
  speak,
  banter,
  battleQuip,
  showInBox,
  setActivePersona,
  refreshBrainPill,
  refreshPower,
};
