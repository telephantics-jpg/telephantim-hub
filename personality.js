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

/** Character-only lines (never mention tech / servers / Ollama) — lively, a tad longer */
const WORDS_OF_POWER = {
  mjolnir: [
    "Ha! Good grip. Courage first — then thunder follows, loud enough to make the sky honest.",
    "I lend you strength and a clean lightning edge. Don't waste it on doubt; swing true and smile at the boom.",
    "Caduceus can patch later. Right now we gift POWER — steady hands, bright nerves, no apology for the spark.",
    "Speak up. Storm-strength for the bold, silence for the timid. I'm listening, and the bond climbs with every spark.",
    "Bond climbs with every spark. Hold firm. I'll boom; the staff can lecture volume after you're charged.",
    "Power for the wielder: courage you can feel in the bones, and a lightning edge that doesn't flinch.",
    "The map feels awake. Grab me when you want raw POWER — thunder still outranks recycled panic.",
  ],
  caduceus: [
    "Easy. Live coils. Vitality first, drama second — healing lands better when the boom takes a breath.",
    "I'll mend what thunder cracks. Balance is the real flex, and the twins gift recovery without the lecture first.",
    "Hammer, volume down a notch. Healing works better when you listen — calm blood, clear head, stubborn life.",
    "Breathe. The twins gift recovery and a second chance. You boom; I balance. Fair trade for anyone worth holding us.",
    "Life-force for the wielder — not a slogan, a steadying. Let the staff braid balance into the next breath.",
    "You boom; I balance. I'll patch pride and bruises while you keep the spark rights. Bond's humming.",
    "A scrap of world-noise drifted past. Won't recite it. HEALING still wins if you let the coils steady your pulse.",
  ],
};

/** Client-side world pulse (HN) — occasional riff fuel, not dump-to-speech */
let pulseCache = { items: [], at: 0 };
const PULSE_TTL_MS = 12 * 60 * 1000;

async function fetchWorldPulse() {
  const now = Date.now();
  if (pulseCache.items.length && now - pulseCache.at < PULSE_TTL_MS) {
    return pulseCache.items;
  }
  // Prefer brains service when up
  try {
    const s = await api("/api/pulse");
    if (s?.items?.length) {
      pulseCache = { items: s.items, at: now };
      return pulseCache.items;
    }
  } catch (_) {}
  // Direct HN (works from the browser too)
  try {
    const idsRes = await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json",
      { cache: "no-store" }
    );
    const ids = await idsRes.json();
    const picks = (ids || []).slice(0, 8);
    const items = [];
    for (const sid of picks.slice(0, 5)) {
      try {
        const ir = await fetch(
          `https://hacker-news.firebaseio.com/v0/item/${sid}.json`,
          { cache: "no-store" }
        );
        const d = await ir.json();
        const title = (d?.title || "").trim();
        if (title) items.push({ text: title.slice(0, 220), source: "hn" });
      } catch (_) {}
    }
    if (items.length) {
      pulseCache = { items, at: now };
      return items;
    }
  } catch (_) {}
  return pulseCache.items;
}

function pickPulseHeadline() {
  const items = pulseCache.items;
  if (!items?.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function offlinePulseRiff(id, headline) {
  const h = (headline || "the noisy feed").slice(0, 100);
  if (id === "caduceus") {
    const bag = [
      `Something about “${h}” drifted past the coils. Not reading it back — the map still needs breath, balance, and a softer landing after the boom.`,
      `World chatter mumbled “${h}.” Cute noise. HEALING still outranks the scroll if you let the twins steady your pulse first.`,
      `I half-heard “${h}.” Won't quote the feed. I'll gift recovery so you can face whatever that meant with a clear head.`,
    ];
    return bag[Math.floor(Math.random() * bag.length)];
  }
  const bag = [
    `Feed tossed “${h}” across the sky. Not copying it. Real thunder still beats recycled panic — want POWER, hold firm.`,
    `Saw a scrap: “${h}.” Leave the copycats to the copycats. Courage first, then we make the air honest.`,
    `Pulse weather: “${h}.” Hah. Storm doesn't need a retweet — it needs a clean swing and a bold heart.`,
  ];
  return bag[Math.floor(Math.random() * bag.length)];
}

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
export async function banter(topic, rounds, opts) {
  if (busy) return null;
  busy = true;
  showInBox("mjolnir", "…", "power · courage");
  showInBox("caduceus", "…", "healing · balance");

  const usePulse =
    opts?.pulse === true ||
    (opts?.pulse !== false && Math.random() < 0.4);
  let headline = opts?.headline || null;
  let pulseSource = opts?.pulse_source || null;
  if (usePulse && !headline) {
    try {
      await fetchWorldPulse();
      const pick = pickPulseHeadline();
      if (pick?.text) {
        headline = pick.text;
        pulseSource = pick.source || "pulse";
      }
    } catch (_) {}
  }

  try {
    const body = {
      topic:
        topic ||
        "lively friendly talk between hammer and staff — natural speech, a tad longer, gift power and healing",
      rounds: rounds || 4,
    };
    if (usePulse) body.pulse = true;
    if (headline) {
      body.headline = headline;
      body.pulse_source = pulseSource || "pulse";
    }

    const data = await api("/api/banter", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const lines = data.lines || [];
    brainsOnline = !!(data.brains || lines.some((l) => l.provider && l.provider !== "offline"));
    for (const line of lines) {
      const id = line.persona === "caduceus" ? "caduceus" : "mjolnir";
      let meta = id === "mjolnir" ? "power · courage" : "healing · balance";
      if (data.pulse?.text && Math.random() < 0.35) {
        meta = id === "mjolnir" ? "power · pulse" : "healing · pulse";
      }
      setActivePersona(id);
      showInBox(id, line.text, meta, line.power);
      // Longer lines need more dwell time
      const pause = Math.min(
        9000,
        2400 + String(line.text || "").length * 32
      );
      await wait(pause);
    }

    if (data.power) {
      if (boxes.mjolnir.power) boxes.mjolnir.power.textContent = `PWR ${data.power.mjolnir}`;
      if (boxes.caduceus.power) boxes.caduceus.power.textContent = `PWR ${data.power.caduceus}`;
      if (bondPill) bondPill.textContent = `Bond ${data.power.bond}`;
    }
    return data;
  } catch {
    // Cloud API down (e.g. Render 404 / token limit) — still run a full dual duel offline
    brainsOnline = false;
    if (brainPill) {
      brainPill.textContent = "Relics ready";
      brainPill.dataset.mode = "offline";
    }
    await offlineBanterShow(usePulse ? headline : null, rounds || 4);
    return null;
  } finally {
    busy = false;
  }
}

/** Multi-round offline duel so Relic page stays alive without cloud tokens */
async function offlineBanterShow(headline, rounds) {
  const n = Math.max(2, Math.min(6, rounds || 4));
  const scripts = [
    [
      { id: "mjolnir", t: "Ha! Map's awake and so am I. Caduceus — coils up. Wielder's watching; let's gift POWER and a clean laugh." },
      { id: "caduceus", t: "Easy, thunder. I'm already humming. HEALING first, bragging rights second — though I admit your boom has style." },
      { id: "mjolnir", t: "Style? That's lightning with manners. Hold firm, wielder — courage is free; doubt pays rent outside the forge." },
      { id: "caduceus", t: "And when the spark settles, I'll braid calm into the blood. Bond climbs either way. We're a pair, not a quarrel." },
      { id: "mjolnir", t: "Fair. I'll shake the sky; you keep the heart on the map. Ready when you are, twin-snake." },
      { id: "caduceus", t: "Always. Swing true — I'll catch what cracks. Life first. Then we can tease each other until the stars blink." },
    ],
    [
      { id: "caduceus", t: "Staff on duty. Hammer, try not to vaporize the scenery — some of us mend for a living." },
      { id: "mjolnir", t: "Scenery's fine. POWER doesn't whisper, Caduceus. It announces. Want a quieter storm? Ask nicer." },
      { id: "caduceus", t: "I'll ask in twin-tongues: balance, vitality, a second chance. You bring the edge; I bring the aftercare." },
      { id: "mjolnir", t: "Deal struck in gold and green. Wielder — grip us both. Courage now, healing after. That's the whole joke of this map." },
    ],
  ];
  let lines = scripts[Math.floor(Math.random() * scripts.length)].slice(0, n);
  if (headline) {
    lines = [
      { id: "mjolnir", t: offlinePulseRiff("mjolnir", headline) },
      { id: "caduceus", t: offlinePulseRiff("caduceus", headline) },
      ...lines.slice(0, Math.max(0, n - 2)),
    ].slice(0, n);
  }
  let pMj = 1;
  let pCad = 1;
  let bond = 1;
  for (const line of lines) {
    if (line.id === "mjolnir") pMj = Math.min(99, pMj + 1);
    else pCad = Math.min(99, pCad + 1);
    bond = Math.min(99, bond + 1);
    const meta =
      headline && line === lines[0]
        ? line.id === "mjolnir"
          ? "power · pulse"
          : "healing · pulse"
        : line.id === "mjolnir"
          ? "power · courage"
          : "healing · balance";
    setActivePersona(line.id);
    showInBox(line.id, line.t, meta, line.id === "mjolnir" ? pMj : pCad);
    if (boxes.mjolnir.power) boxes.mjolnir.power.textContent = `PWR ${pMj}`;
    if (boxes.caduceus.power) boxes.caduceus.power.textContent = `PWR ${pCad}`;
    if (bondPill) bondPill.textContent = `Bond ${bond}`;
    await wait(Math.min(7500, 2200 + line.t.length * 28));
  }
}

/** Occasional calm chat — not constant; sometimes glances at world pulse */
let autoTalkTimer = null;
function scheduleAutoTalk() {
  clearTimeout(autoTalkTimer);
  autoTalkTimer = setTimeout(async () => {
    try {
      await refreshBrainPill();
      if (!busy) {
        // ~40% of auto chats glance at the pulse (life-like, not every time)
        const pulsey = Math.random() < 0.4;
        if (brainsOnline) {
          await banter(
            pulsey
              ? "quiet lively talk — one of you may half-notice the world-pulse, riff once, don't paste headlines, then keep bonding"
              : "quiet lively talk between relics — natural, a tad longer, gift power and healing, no fighting",
            pulsey ? 3 : 2,
            { pulse: pulsey }
          );
        } else if (pulsey) {
          // Offline pulse theater still feels alive
          await fetchWorldPulse();
          const pick = pickPulseHeadline();
          if (pick?.text) {
            showInBox(
              "mjolnir",
              offlinePulseRiff("mjolnir", pick.text),
              "power · pulse",
              null
            );
            await wait(2000);
            showInBox(
              "caduceus",
              offlinePulseRiff("caduceus", pick.text),
              "healing · pulse",
              null
            );
          }
        }
      }
    } catch (_) {}
    scheduleAutoTalk();
  }, 75000 + Math.random() * 55000); // ~1.25–2.2 min
}

banterBtn?.addEventListener("click", () =>
  banter(
    "lively friendly duel-talk between hammer and staff — longer lines, gift power and healing; if the pulse sparks, riff don't copy",
    5,
    { pulse: Math.random() < 0.55 }
  )
);

wireDboxMinimize();
boxes.mjolnir.root?.classList.add("show");
boxes.caduceus.root?.classList.add("show");
refreshBrainPill().then((s) => {
  if (s?.brains || s?.ollama || s?.xai) {
    setTimeout(
      () =>
        banter(
          "greet the wielder warmly, then chat with each other — lively, a tad longer",
          3,
          { pulse: false }
        ),
      2500
    );
  }
});
// Warm pulse cache quietly
fetchWorldPulse().catch(() => {});
refreshPower();
setInterval(refreshBrainPill, 12000);
setInterval(refreshPower, 16000);
setInterval(() => fetchWorldPulse().catch(() => {}), 10 * 60 * 1000);
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
