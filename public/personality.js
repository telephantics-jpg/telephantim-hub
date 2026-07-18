/**
 * Dual relic minds — real AI when API is up (Ollama local or xAI cloud).
 * Live static host can point API_BASE at a Render telephantim-ai service.
 */
function resolveApiBase() {
  if (typeof window !== "undefined" && window.TELEPHANTIM_API) {
    return String(window.TELEPHANTIM_API).replace(/\/$/, "");
  }
  const h = (typeof location !== "undefined" && location.hostname) || "";
  if (h === "localhost" || h === "127.0.0.1") return "";
  // Hosted dual-brains API (set TELEPHANTIM_API or deploy Render service with this name)
  return "https://telephantim-ai.onrender.com";
}

const API_BASE = resolveApiBase();

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
let brainsOnline = false;
const hideTimers = { mjolnir: null, caduceus: null };

/** Offline fallback only — real brains come from /api when server is up */
const WORDS_OF_POWER = {
  mjolnir: [
    "Ha! Taste thunder, lightly salted and holy as hell. I am Mjolnir — start OPEN_LOCAL_AI.bat or the live AI service if you want my full mind, not this echo. Still, I name COURAGE into your bones.",
    "Sacred steel, profane joy. Offline echo only — my real brain needs the AI server. Until then: damn the doubt, hold the grip, POWER for the bold.",
    "Bonk with purpose. Caduceus, keep those coils ready. When the brains are online we will really talk — for now, storm-strength for the wielder.",
  ],
  caduceus: [
    "Easy, thunder-lump. Offline echo — my full mind needs the AI server (Ollama or xAI). Still I name VITALITY into blood and BALANCE into breath.",
    "Sacred serpents, profane patience. Connect brains and I will truly answer Mjolnir line for line. Until then: damn the despair, live loud.",
    "DNA slap with love. When dual minds are live we keep a real conversation. For now, HEALING for the wielder and a hiss at the silence.",
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
  }, 32000);
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
    brainsOnline = !!(ok && (s.brains || s.ollama || s.xai));
    if (!brainPill) return s;
    if (!ok) {
      brainPill.textContent = "Brains offline";
      brainPill.dataset.mode = "offline";
      return s;
    }
    if (s.ollama) {
      const mm = (s.models?.mjolnir || "llama3.2").split(":")[0];
      const mc = (s.models?.caduceus || "hermes3").split(":")[0];
      brainPill.textContent = `Brains ${mm}+${mc}`;
      brainPill.dataset.mode = "ollama";
    } else if (s.xai) {
      brainPill.textContent = "Brains xAI dual";
      brainPill.dataset.mode = "ollama";
    } else {
      brainPill.textContent = "Echo only";
      brainPill.dataset.mode = "offline";
    }
    return s;
  } catch {
    brainsOnline = false;
    if (brainPill) {
      brainPill.textContent = API_BASE ? "Brains waking…" : "Local AI off";
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

/** Instant lines; prefers real dual banter when brains are online */
export async function battleQuip(attackerKind) {
  if (brainsOnline && !busy) {
    banter("playful brawl — riff hard, keep the living conversation going", 2);
    return null;
  }
  const atk = attackerKind === "caduceus" ? "caduceus" : "mjolnir";
  const def = atk === "mjolnir" ? "caduceus" : "mjolnir";
  setActivePersona(atk);
  showInBox(atk, pickWord(atk), "echo", null);
  setTimeout(() => {
    setActivePersona(def);
    showInBox(def, pickWord(def), "echo", null);
  }, 900);
  return { attacker: atk, defender: def };
}

export async function speak(persona, event, message) {
  if (busy) return null;
  busy = true;
  const id = persona === "caduceus" ? "caduceus" : "mjolnir";
  setActivePersona(id);
  showInBox(id, "…", "thinking");

  try {
    const data = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        persona: id,
        event: event || "chat",
        message: message || "",
      }),
    });
    const meta = [data.provider, data.model].filter(Boolean).join(" · ") || "word of power";
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
    brainsOnline = data.provider && data.provider !== "offline";
    return data;
  } catch {
    showInBox(id, pickWord(id), "echo · no API", null);
    return null;
  } finally {
    busy = false;
  }
}

/** Full dual conversation with memory on the server */
export async function banter(topic, rounds) {
  if (busy) return null;
  busy = true;
  showInBox("mjolnir", "…", "listening…");
  showInBox("caduceus", "…", "listening…");

  try {
    const data = await api("/api/banter", {
      method: "POST",
      body: JSON.stringify({
        topic:
          topic ||
          "continue your living conversation — riff, argue, bond, evolve; never reset; real back-and-forth",
        rounds: rounds || 5,
      }),
    });

    const lines = data.lines || [];
    brainsOnline = !!(data.brains || lines.some((l) => l.provider && l.provider !== "offline"));
    for (const line of lines) {
      const id = line.persona === "caduceus" ? "caduceus" : "mjolnir";
      const meta = [line.provider, line.model, line.power != null ? `PWR ${line.power}` : ""]
        .filter(Boolean)
        .join(" · ");
      setActivePersona(id);
      showInBox(id, line.text, meta || "living dialogue", line.power);
      const pause = Math.min(8000, 2400 + String(line.text || "").length * 30);
      await wait(pause);
    }

    if (data.power) {
      if (boxes.mjolnir.power) boxes.mjolnir.power.textContent = `PWR ${data.power.mjolnir}`;
      if (boxes.caduceus.power) boxes.caduceus.power.textContent = `PWR ${data.power.caduceus}`;
      if (bondPill) bondPill.textContent = `Bond ${data.power.bond}`;
    }
    return data;
  } catch {
    showInBox("mjolnir", pickWord("mjolnir"), "echo · no API", null);
    showInBox("caduceus", pickWord("caduceus"), "echo · no API", null);
    return null;
  } finally {
    busy = false;
  }
}

/** Keep talking in the background when brains are online */
let autoTalkTimer = null;
function scheduleAutoTalk() {
  clearTimeout(autoTalkTimer);
  autoTalkTimer = setTimeout(async () => {
    try {
      await refreshBrainPill();
      if (brainsOnline && !busy) {
        await banter("keep the living dual dialogue going — new beat, same bond", 3);
      }
    } catch (_) {}
    scheduleAutoTalk();
  }, 48000 + Math.random() * 25000);
}

banterBtn?.addEventListener("click", () => banter());

boxes.mjolnir.root?.classList.add("show");
boxes.caduceus.root?.classList.add("show");
refreshBrainPill().then((s) => {
  if (s?.brains || s?.ollama || s?.xai) {
    // Opening conversation so they don't sit silent
    setTimeout(() => banter("greet the wielder and each other — begin a real ongoing talk", 4), 1800);
  }
});
refreshPower();
setInterval(refreshBrainPill, 10000);
setInterval(refreshPower, 15000);
scheduleAutoTalk();

window.ArtifactAI = {
  speak,
  banter,
  battleQuip,
  showInBox,
  setActivePersona,
  refreshBrainPill,
  refreshPower,
  get apiBase() {
    return API_BASE;
  },
};
