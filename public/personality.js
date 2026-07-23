/**
 * Dual relic speech — same free-mind pattern as Luna Camp 2D:
 *   1) telephanti.com free_minds (Grok when available + aether native offline) — no visitor keys
 *   2) Local/cloud telephantim API when present
 *   3) Browser WebLLM / Chrome AI
 *   4) Scripted dual duel
 * Characters never mention tech.
 */
import { nativeBanter, nativeSpeak, ensureNativeBrain, getNativeStatus } from "./native-brain.js";
import {
  freeMindsBanter,
  freeMindsSpeak,
  freeMindsHealth,
  sceneSeed,
  looksLikePromptLeak,
  isStrongLine,
} from "./free-minds.js";
import {
  pickWord as pickCachedWord,
  pickInteractLine,
  pickFreshPhrase,
  buildOfflineBanter,
  warmSayingsCache,
} from "./relic-sayings.js";

function resolveApiBase() {
  if (typeof window !== "undefined" && window.TELEPHANTIM_API) {
    const v = String(window.TELEPHANTIM_API).replace(/\/$/, "");
    // empty string = same-origin (local server.py)
    if (window.TELEPHANTIM_API === "" || window.TELEPHANTIM_API === "same") return "";
    return v;
  }
  const h = (typeof location !== "undefined" && location.hostname) || "";
  if (h === "localhost" || h === "127.0.0.1") return "";
  // Live site default: Render dual-brain service (optional; native brain works without it)
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
/** "free" | "cloud" | "native" | "script" */
let brainMode = "script";
const hideTimers = { mjolnir: null, caduceus: null };

function setBrainPill(mode, label) {
  brainMode = mode || "script";
  brainsOnline = mode === "free" || mode === "cloud" || mode === "native";
  if (!brainPill) return;
  const defaults = {
    free: "Free minds",
    cloud: "Relics awake",
    native: "Local mind",
    script: "Relics ready",
  };
  brainPill.textContent = label || defaults[mode] || "Relics ready";
  brainPill.dataset.mode = mode;
}

async function playBanterLines(lines, metaPulse) {
  let pMj = 1;
  let pCad = 1;
  let bond = 1;
  for (const line of lines) {
    const pid =
      line.persona === "caduceus" || line.id === "caduceus" ? "caduceus" : "mjolnir";
    const text = line.text || line.t || "";
    if (pid === "mjolnir") pMj = Math.min(99, pMj + 1);
    else pCad = Math.min(99, pCad + 1);
    bond = Math.min(99, bond + 1);
    let meta = pid === "mjolnir" ? "power · courage" : "healing · balance";
    if (metaPulse) meta = pid === "mjolnir" ? "power · pulse" : "healing · pulse";
    setActivePersona(pid);
    showInBox(pid, text, meta, line.power != null ? line.power : pid === "mjolnir" ? pMj : pCad);
    if (boxes.mjolnir.power) boxes.mjolnir.power.textContent = `PWR ${pMj}`;
    if (boxes.caduceus.power) boxes.caduceus.power.textContent = `PWR ${pCad}`;
    if (bondPill) bondPill.textContent = `Bond ${bond}`;
    await wait(Math.min(12000, 2800 + String(text).length * 36));
  }
  await wait(2500);
  for (const id of ["mjolnir", "caduceus"]) {
    boxes[id]?.root?.classList.remove("active-speaker", "has-new", "show");
  }
}

/** Cached offline sayings live in relic-sayings.js (warmed into localStorage) */

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

function pickWord(id, event) {
  if (event) return pickInteractLine(id, event);
  return pickCachedWord(id === "caduceus" ? "caduceus" : "mjolnir");
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
  b.root.classList.toggle("docked", !!collapsed);
  const btn = b.root.querySelector("[data-dbox-min]");
  if (btn) {
    btn.textContent = collapsed ? "+" : "−";
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.title = collapsed ? "Expand bubble" : "Minimize bubble";
  }
  if (!collapsed) b.root.classList.remove("has-new");
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

/** Per-relic speech generation — late free-mind replies must not overwrite a newer click. */
const speechGen = { mjolnir: 0, caduceus: 0 };
const stickyText = { mjolnir: "", caduceus: "" };

function speechHoldMs(text, opts = {}) {
  const len = String(text || "").length;
  // Readable hold — min ~14s, scales with length, max ~48s (was flashing away ~6–16s)
  const base = opts.thinking ? 8000 : 14000;
  const scaled = base + len * 55;
  return Math.min(opts.maxMs || 48000, Math.max(opts.minMs || 12000, scaled));
}

export function showInBox(persona, text, meta, power, opts = {}) {
  const id = persona === "caduceus" ? "caduceus" : "mjolnir";
  const b = boxes[id];
  if (!b?.root) return;
  // Optional: refuse overwrite of sticky line unless same gen or force
  if (
    opts.onlyIfGen != null &&
    opts.onlyIfGen !== speechGen[id]
  ) {
    return;
  }
  if (b.text) b.text.textContent = text || "…";
  if (b.meta) b.meta.textContent = meta || "word of power";
  if (b.power && power != null) b.power.textContent = `PWR ${power}`;
  if (text && text !== "…") stickyText[id] = text;
  b.root.classList.add("show", "pulse");
  const collapsed = b.root.classList.contains("collapsed");
  // Soft ping when minimized — mind is still talking, stage stays clear
  if (collapsed) {
    b.root.classList.add("has-new", "pulse");
  } else {
    b.root.classList.remove("has-new");
  }
  setTimeout(() => b.root.classList.remove("pulse"), 450);
  clearTimeout(hideTimers[id]);
  if (opts.sticky) {
    // Stay until next speech / banter end — don't auto-hide
    hideTimers[id] = null;
    return;
  }
  // Collapsed chips stay while the mind is active (don't vanish mid-banter)
  if (collapsed) {
    hideTimers[id] = setTimeout(() => {
      b.root.classList.remove("active-speaker");
      // keep .show so the chip remains until banter ends / user hides
    }, speechHoldMs(text, opts));
    return;
  }
  // Expanded: hold long enough to read; don't flash-switch
  const hold = speechHoldMs(text, opts);
  hideTimers[id] = setTimeout(() => {
    b.root.classList.remove("active-speaker", "show");
  }, hold);
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
  // 1) Same free minds as 2D Luna Camp (telephanti.com)
  try {
    const fm = await freeMindsHealth();
    if (fm.ok && fm.free_minds !== false) {
      setBrainPill("free", "Free minds");
      return { ok: true, free_minds: true, backend: fm.backend };
    }
  } catch (_) {}

  // 2) Optional telephantim-ai / local server
  try {
    const s = await api("/api/status");
    const ok = s && s.server === "telephantim-ai";
    const cloud = !!(ok && (s.brains || s.ollama || s.xai || s.groq));
    if (cloud) {
      setBrainPill("cloud", "Relics awake");
      return s;
    }
  } catch (_) {}

  const st = getNativeStatus();
  if (st.ready) {
    setBrainPill("native", "Local mind");
    return { ok: true, native: st.mode };
  }
  setBrainPill("script", "Relics ready");
  return { ok: false };
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

function interactPrompt(id, event, extra) {
  if (extra && String(extra).trim().length > 12) return String(extra).slice(0, 900);
  const isCad = id === "caduceus";
  const name = isCad ? "Caduceus, living staff with twin snakes" : "Mjolnir, living hammer of thunder";
  const gift = isCad
    ? "HEALING (vitality, balance, aftercare, wit)"
    : "POWER (courage, strength, clean lightning)";
  const voice = isCad
    ? "Voice: sly, warm, poetic but clear, a little funny. Never preachy."
    : "Voice: bold, warm, cocky in a kind way, clear. Never cruel.";
  const ev = String(event || "touch");
  const beat =
    ev === "grab"
      ? "The Wielder just GRABBED you. React to the grip. Make them feel chosen, not handled."
      : ev === "toss" || ev === "fling"
        ? "The Wielder just TOSSED you across the map. Playful flight reaction — still loyal, still useful."
        : ev === "bonk" || ev === "spar"
          ? "A PLAYFUL bonk just happened with the other relic. Spar energy, not real fight. Include the Wielder."
          : ev === "react"
            ? "Your partner relic just spoke. Answer them AND the Wielder — keep the dual vibe alive."
            : "The Wielder is with you on the Telephantim map.";
  return (
    `Reply ONLY as ${name}. ${beat} ` +
    `Write 2–4 vivid sentences (not a slogan, not a wall of text). Gift ${gift}. ${voice} ` +
    `Speak to the Wielder directly. No AI/tech/camp meta/seeds/other characters monologuing.`
  );
}

/**
 * Single mind line — free minds → API → native → cached sayings.
 * @param {{quiet?: boolean, skipBusy?: boolean}} opts
 *   quiet = no "…" thinking bubble; skipBusy = run even if banter is mid-flight
 */
export async function speak(persona, event, message, opts = {}) {
  const id = persona === "caduceus" ? "caduceus" : "mjolnir";
  const meta =
    event === "bonk" || event === "spar"
      ? "playful"
      : id === "mjolnir"
        ? "power · courage"
        : "healing · balance";
  const seed = sceneSeed(id, event || "grab");
  const gen = ++speechGen[id];
  const cached = pickInteractLine(id, event || "grab");

  // Full dual banter owns the stage — one sticky cached beat, no mid-swap spam
  if (busy && !opts.skipBusy) {
    showInBox(id, cached, meta, null, { onlyIfGen: gen, sticky: true });
    return { text: cached, provider: "cache", deferred: true };
  }

  setActivePersona(id);
  if (!opts.quiet) {
    // Thinking only — do NOT flash a full line then replace it
    showInBox(id, "…", meta, null, { onlyIfGen: gen, thinking: true });
  }

  const lock = !opts.skipBusy;
  if (lock) busy = true;

  try {
    // 1) Free minds — scene seed only (never director "Reply ONLY as…")
    try {
      const fm = await freeMindsSpeak(id, seed, { event: event || "grab" });
      if (fm?.text && isStrongLine(fm.text) && !looksLikePromptLeak(fm.text) && gen === speechGen[id]) {
        setBrainPill("free", "Free minds");
        showInBox(id, fm.text, meta, null, { onlyIfGen: gen, sticky: true });
        return fm;
      }
    } catch (_) {}

    // 2) Local/optional telephantim API
    try {
      const data = await api("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          persona: id,
          event: event || "chat",
          message: message || prompt,
        }),
      });
      let line = (data.text && String(data.text).trim().length > 30 ? data.text : null) || cached;
      if (looksLikePromptLeak(line)) line = cached;
      if (gen === speechGen[id]) {
        showInBox(id, line, meta, data.power, { onlyIfGen: gen, sticky: true });
      }
      if (data.power_all) {
        if (boxes.mjolnir.power && data.power_all.mjolnir != null)
          boxes.mjolnir.power.textContent = `PWR ${data.power_all.mjolnir}`;
        if (boxes.caduceus.power && data.power_all.caduceus != null)
          boxes.caduceus.power.textContent = `PWR ${data.power_all.caduceus}`;
        if (bondPill && data.power_all.bond != null)
          bondPill.textContent = `Bond ${data.power_all.bond}`;
      } else {
        await refreshPower();
      }
      if (data.provider && data.provider !== "offline") setBrainPill("cloud", "Relics awake");
      return { ...data, text: line };
    } catch (_) {}

    // 3) Browser-native free mind
    try {
      if (!opts.quiet) setBrainPill("native", "Waking mind…");
      const m = await ensureNativeBrain((msg) => {
        if (!opts.quiet) setBrainPill("native", String(msg || "").slice(0, 22));
      });
      if (m !== "none") {
        const text = await nativeSpeak(id, prompt);
        if (text && text.length > 30 && gen === speechGen[id]) {
          setBrainPill("native", "Local mind");
          showInBox(id, text, meta, null, { onlyIfGen: gen, sticky: true });
          return { text, provider: m };
        }
      }
    } catch (_) {}

    // 4) One sticky cached line (never a second swap after a brain line)
    if (gen === speechGen[id]) {
      setBrainPill("script", "Relics ready");
      showInBox(id, cached, meta, null, { onlyIfGen: gen, sticky: true });
    }
    return { text: cached, provider: "cache" };
  } finally {
    if (lock) busy = false;
  }
}

/**
 * Click / press a relic → ONE stable phrase (no flash-swap).
 * Free minds may answer first; cache is fallback only — never "line A then line B".
 */
const _phraseCooldown = { mjolnir: 0, caduceus: 0 };

export function speakPhrase(persona, event = "press") {
  const id = persona === "caduceus" ? "caduceus" : "mjolnir";
  const now = Date.now();
  // Debounce double-fire (pointer + toss, or multi-touch)
  if (now - (_phraseCooldown[id] || 0) < 420) return null;
  _phraseCooldown[id] = now;

  const ev = event === "toss" || event === "bonk" || event === "grab" ? event : "press";
  const meta =
    ev === "bonk"
      ? "playful"
      : id === "mjolnir"
        ? "power · courage"
        : "healing · balance";

  const gen = ++speechGen[id];
  const fallback = pickFreshPhrase(id, ev);
  setActivePersona(id);
  // Soft thinking — single final line lands once (never a prompt leak)
  showInBox(id, "…", meta, null, { onlyIfGen: gen, thinking: true });

  // Short scene seed only — never send "Reply ONLY as…" (that was echoing into the bubble)
  const seed = sceneSeed(id, ev === "press" ? "grab" : ev);
  let settled = false;
  const settle = (text) => {
    if (settled || gen !== speechGen[id]) return;
    settled = true;
    let line = String(text || "").trim();
    if (!line || looksLikePromptLeak(line) || !isStrongLine(line)) {
      line = fallback;
    }
    showInBox(id, line, meta, null, { onlyIfGen: gen, sticky: true });
  };

  // Give free minds a real window; fall back to quality cached saying (not a prompt)
  const failSafe = setTimeout(() => {
    if (!settled) settle(fallback);
  }, 4200);

  freeMindsSpeak(id, seed, { event: ev === "press" ? "grab" : ev })
    .then((fm) => {
      clearTimeout(failSafe);
      if (fm?.text && isStrongLine(fm.text) && !looksLikePromptLeak(fm.text)) {
        setBrainPill("free", "Free minds");
        settle(fm.text);
      } else {
        settle(fallback);
      }
    })
    .catch(() => {
      clearTimeout(failSafe);
      settle(fallback);
    });

  return { text: fallback, provider: "phrase", persona: id, gen };
}

/**
 * Richer dual interaction (Talk path / bonks) — partner may answer.
 */
export async function onRelicInteract(persona, event = "grab") {
  const id = persona === "caduceus" ? "caduceus" : "mjolnir";
  // Click-style: new phrase first
  const first = speakPhrase(id, event) || { text: pickFreshPhrase(id, event) };

  if (event === "bonk" || event === "spar") {
    await wait(700);
    speakPhrase(id === "mjolnir" ? "caduceus" : "mjolnir", "bonk");
  }
  return first;
}

/** Soft dual quips on rare bonks — still mindable when free minds answer */
export async function battleQuip(attackerKind) {
  const atk = attackerKind === "caduceus" ? "caduceus" : "mjolnir";
  // Fire-and-forget so duel animation never waits on network
  onRelicInteract(atk, "bonk").catch(() => {
    showInBox(atk, pickWord(atk), "playful", null);
    const def = atk === "mjolnir" ? "caduceus" : "mjolnir";
    setTimeout(() => showInBox(def, pickWord(def), "playful", null), 900);
  });
  return { attacker: atk, defender: atk === "mjolnir" ? "caduceus" : "mjolnir" };
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

  const topicLine =
    topic ||
    "lively multi-round talk between hammer and staff — longer natural exchange, gift power and healing, banter and bond";

  // Default longer talks (8 lines) — free minds / native / cached offline
  const nRounds = Math.max(4, Math.min(12, rounds || 8));

  try {
    // 1) Same free minds as Luna Camp 2D (secure public API, no visitor keys)
    try {
      setBrainPill("free", "Free minds…");
      const fmTopic = headline
        ? `${topicLine} (half-notice world pulse: ${String(headline).slice(0, 120)})`
        : topicLine;
      const fm = await freeMindsBanter(fmTopic, Math.min(4, Math.ceil(nRounds / 2)));
      if (fm?.lines?.length) {
        setBrainPill("free", "Free minds");
        // If free minds returned a short burst, extend with cached native beats
        let lines = fm.lines;
        if (lines.length < nRounds - 1) {
          const extra = buildOfflineBanter(nRounds - lines.length, { headline: null });
          lines = [
            ...lines,
            ...extra.map((l) => ({
              persona: l.id,
              text: l.t,
              name: l.id === "mjolnir" ? "Mjolnir" : "Caduceus",
            })),
          ].slice(0, nRounds + 2);
        }
        await playBanterLines(lines, !!headline);
        return fm;
      }
    } catch (_) {}

    // 2) Optional telephantim-ai / local Ollama server
    try {
      const body = {
        topic: topicLine,
        rounds: nRounds,
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
      if (lines.length) {
        setBrainPill("cloud", "Relics awake");
        await playBanterLines(lines, !!(data.pulse?.text));
        if (data.power) {
          if (boxes.mjolnir.power) boxes.mjolnir.power.textContent = `PWR ${data.power.mjolnir}`;
          if (boxes.caduceus.power) boxes.caduceus.power.textContent = `PWR ${data.power.caduceus}`;
          if (bondPill) bondPill.textContent = `Bond ${data.power.bond}`;
        }
        return data;
      }
    } catch (_) {}

    // 3) Browser-native free mind (WebLLM / Chrome AI)
    try {
      setBrainPill("native", "Waking mind…");
      const nativeLines = await nativeBanter(
        topicLine,
        nRounds,
        (msg) => setBrainPill("native", String(msg || "Local mind").slice(0, 22))
      );
      if (nativeLines?.length) {
        setBrainPill("native", "Local mind");
        let lines = nativeLines;
        if (lines.length < 4) {
          const extra = buildOfflineBanter(nRounds, { headline: null });
          lines = extra.map((l) => ({
            persona: l.id,
            text: l.t,
            name: l.id === "mjolnir" ? "Mjolnir" : "Caduceus",
          }));
        }
        await playBanterLines(lines, false);
        return { ok: true, brains: true, provider: "native", lines };
      }
    } catch (_) {}

    // 4) Cached native sayings — long dynamic multi-turn (always works offline)
    setBrainPill("script", "Relics ready");
    await offlineBanterShow(usePulse ? headline : null, nRounds);
    return null;
  } finally {
    busy = false;
  }
}

/** Multi-round offline duel from cached sayings bank (local, free, dynamic) */
async function offlineBanterShow(headline, rounds) {
  const lines = buildOfflineBanter(rounds || 8, { headline: headline || null });
  await playBanterLines(
    lines.map((l) => ({
      persona: l.id,
      text: l.t,
      name: l.id === "mjolnir" ? "Mjolnir" : "Caduceus",
    })),
    !!headline
  );
}

/** Rare calm chat only — stage stays clear most of the time */
let autoTalkTimer = null;
function scheduleAutoTalk() {
  clearTimeout(autoTalkTimer);
  autoTalkTimer = setTimeout(async () => {
    try {
      if (!busy && brainsOnline && document.visibilityState === "visible") {
        await banter(
          "one short friendly exchange — gift power and healing, keep it brief",
          2,
          { pulse: false }
        );
      }
    } catch (_) {}
    scheduleAutoTalk();
  }, 4 * 60 * 1000 + Math.random() * 3 * 60 * 1000); // ~4–7 min
}

banterBtn?.addEventListener("click", () =>
  banter(
    "longer lively talk between hammer and staff — several rounds, natural banter, gift power and healing, bond climbs",
    8,
    { pulse: Math.random() < 0.25 }
  )
);

wireDboxMinimize();
// Stage starts clean — bubbles only appear on Talk / grab
warmSayingsCache();
refreshBrainPill();
refreshPower();
setInterval(refreshBrainPill, 20000);
setInterval(refreshPower, 30000);
// Quiet ambient chat is rare so the 3D stage stays open
scheduleAutoTalk();

window.ArtifactAI = {
  speak,
  speakPhrase,
  banter,
  battleQuip,
  onRelicInteract,
  showInBox,
  setActivePersona,
  refreshBrainPill,
  refreshPower,
  get apiBase() {
    return API_BASE;
  },
  get brainMode() {
    return brainMode;
  },
};
