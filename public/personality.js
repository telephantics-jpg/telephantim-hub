/**
 * Dual relic speech for ANY browser when a public API is set (api-config.js / TELEPHANTIM_API).
 * Local: OPEN_LOCAL_AI.bat → same-origin /api/* (Ollama: Mjolnir=llama3.2, Caduceus=hermes3).
 * Public: GO_PUBLIC_BRAINS.bat tunnels that server so telephantim.com visitors share the same minds.
 * Characters never mention tech.
 */
function resolveApiBase() {
  if (typeof window !== "undefined" && window.TELEPHANTIM_API) {
    return String(window.TELEPHANTIM_API).replace(/\/$/, "");
  }
  const h = (typeof location !== "undefined" && location.hostname) || "";
  if (h === "localhost" || h === "127.0.0.1") return "";
  // Live site default: Render dual-brain service (no visitor PC / no your PC)
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

/** Character-only lines (never mention tech / servers / Ollama) */
const WORDS_OF_POWER = {
  mjolnir: [
    "Ha! Good grip. Courage first — thunder follows.",
    "I lend you strength and a clean lightning edge. Don't waste it.",
    "Caduceus can patch later. Right now we make the sky honest.",
    "Speak up. Storm-strength for the bold, silence for the timid.",
    "Bond climbs with every spark. Hold firm and smile at the boom.",
    "Power for the wielder: steady hands, bright nerves, no doubt.",
  ],
  caduceus: [
    "Easy. Live coils. Vitality first, drama second.",
    "I'll mend what thunder cracks. Balance is the real flex.",
    "Hammer, volume down. Healing works better when you listen.",
    "Breathe. The twins gift recovery and a second chance.",
    "Life-force for the wielder — calm blood, clear head, steady heart.",
    "You boom; I balance. Fair trade for anyone worth holding us.",
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

function dboxMinKey(id) {
  return `telephantim-dbox-collapsed-${id}`;
}

function setDboxCollapsed(id, collapsed) {
  const b = boxes[id];
  if (!b?.root) return;
  b.root.classList.toggle("collapsed", !!collapsed);
  const btn = b.root.querySelector("[data-dbox-min]");
  if (btn) {
    btn.textContent = collapsed ? "+" : "−";
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.title = collapsed ? "Expand bubble" : "Minimize bubble";
  }
  try {
    localStorage.setItem(dboxMinKey(id), collapsed ? "1" : "0");
  } catch (_) {}
}

function wireDboxMinimize() {
  document.querySelectorAll("[data-dbox-min]").forEach((btn) => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = "1";
    const id = btn.getAttribute("data-dbox-min") === "caduceus" ? "caduceus" : "mjolnir";
    let collapsed = false;
    try {
      if (localStorage.getItem(dboxMinKey(id)) === "1") collapsed = true;
    } catch (_) {}
    setDboxCollapsed(id, collapsed);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const root = boxes[id]?.root;
      if (!root) return;
      setDboxCollapsed(id, !root.classList.contains("collapsed"));
    });
  });
}

export function showInBox(persona, text, meta, power) {
  const id = persona === "caduceus" ? "caduceus" : "mjolnir";
  const b = boxes[id];
  if (!b?.root) return;
  if (b.text) b.text.textContent = text || "…";
  if (b.meta) b.meta.textContent = meta || "word of power";
  if (b.power && power != null) b.power.textContent = `PWR ${power}`;
  b.root.classList.add("show", "pulse");
  // Soft ping when minimized so user knows new speech arrived
  if (b.root.classList.contains("collapsed")) {
    b.root.classList.add("pulse");
  }
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
    // Player-facing only — never show model names / Ollama / offline tech
    if (brainsOnline) {
      brainPill.textContent = "Relics awake";
      brainPill.dataset.mode = "ollama";
    } else {
      brainPill.textContent = "Relics ready";
      brainPill.dataset.mode = "offline";
    }
    return s;
  } catch {
    brainsOnline = false;
    if (brainPill) {
      brainPill.textContent = "Relics ready";
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

/** Soft one-liners on rare bonks — no meta talk, no full duel spam */
export async function battleQuip(attackerKind) {
  const atk = attackerKind === "caduceus" ? "caduceus" : "mjolnir";
  const def = atk === "mjolnir" ? "caduceus" : "mjolnir";
  setActivePersona(atk);
  showInBox(atk, pickWord(atk), "playful", null);
  setTimeout(() => {
    setActivePersona(def);
    showInBox(def, pickWord(def), "playful", null);
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
    // Don't surface model names (ollama etc.) in the bubble
    const meta = id === "mjolnir" ? "power · courage" : "healing · balance";
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
    showInBox(id, pickWord(id), id === "mjolnir" ? "power · courage" : "healing · balance", null);
    return null;
  } finally {
    busy = false;
  }
}

/** Full dual conversation with memory on the server (when API up) */
export async function banter(topic, rounds) {
  if (busy) return null;
  busy = true;
  showInBox("mjolnir", "…", "power · courage");
  showInBox("caduceus", "…", "healing · balance");

  try {
    const data = await api("/api/banter", {
      method: "POST",
      body: JSON.stringify({
        topic:
          topic ||
          "friendly talk between hammer and staff — short natural speech only",
        rounds: rounds || 4,
      }),
    });

    const lines = data.lines || [];
    brainsOnline = !!(data.brains || lines.some((l) => l.provider && l.provider !== "offline"));
    for (const line of lines) {
      const id = line.persona === "caduceus" ? "caduceus" : "mjolnir";
      const meta = id === "mjolnir" ? "power · courage" : "healing · balance";
      setActivePersona(id);
      showInBox(id, line.text, meta, line.power);
      const pause = Math.min(6500, 2000 + String(line.text || "").length * 26);
      await wait(pause);
    }

    if (data.power) {
      if (boxes.mjolnir.power) boxes.mjolnir.power.textContent = `PWR ${data.power.mjolnir}`;
      if (boxes.caduceus.power) boxes.caduceus.power.textContent = `PWR ${data.power.caduceus}`;
      if (bondPill) bondPill.textContent = `Bond ${data.power.bond}`;
    }
    return data;
  } catch {
    // Quiet character lines — never mention APIs or connection status
    showInBox("mjolnir", pickWord("mjolnir"), "power · courage", null);
    await wait(700);
    showInBox("caduceus", pickWord("caduceus"), "healing · balance", null);
    return null;
  } finally {
    busy = false;
  }
}

/** Occasional calm chat — not constant, not bonk-spam */
let autoTalkTimer = null;
function scheduleAutoTalk() {
  clearTimeout(autoTalkTimer);
  autoTalkTimer = setTimeout(async () => {
    try {
      await refreshBrainPill();
      if (brainsOnline && !busy) {
        await banter("quiet friendly talk — short, natural, no fighting", 2);
      }
    } catch (_) {}
    scheduleAutoTalk();
  }, 90000 + Math.random() * 60000); // ~1.5–2.5 min
}

banterBtn?.addEventListener("click", () => banter("friendly talk between hammer and staff", 4));

wireDboxMinimize();
boxes.mjolnir.root?.classList.add("show");
boxes.caduceus.root?.classList.add("show");
refreshBrainPill().then((s) => {
  if (s?.brains || s?.ollama || s?.xai) {
    setTimeout(() => banter("greet the wielder briefly, then chat with each other", 3), 2500);
  }
});
refreshPower();
setInterval(refreshBrainPill, 12000);
setInterval(refreshPower, 16000);
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
