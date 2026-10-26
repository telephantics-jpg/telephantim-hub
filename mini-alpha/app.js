import { WHIMS_HOOK } from "./will.js?v=12";
import * as Studio from "./studio.js";
import { MINI_ALPHA_PERSONA as PERSONA_ONLY, SOUL, LINE_BANKS, LYRIC_RULES, WRITE_MODES, WRITE_TONES, MOODS, mapMood } from "./persona.js?v=11";

/* same model ids as telephantim.com caduceus-mind.js -> browser model cache is shared (same origin) */
export const MODEL_CHOICES = [
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 0.5B (light)", mb: 278 },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B (default)", mb: 695 },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 1.5B", mb: 869 },
  { id: "gemma-2-2b-it-q4f16_1-MLC", label: "Gemma 2 2B", mb: 1471 },
];
const WEBLLM_MODEL = MODEL_CHOICES.some((m) => m.id === localStorage.getItem("miniAlphaModel")) ? localStorage.getItem("miniAlphaModel") : "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const TFJS_MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";
const $ = (id) => document.getElementById(id);
const MINI_ALPHA_PERSONA = PERSONA_ONLY + "\n\n" + SOUL + "\n\nHow you answer: right after the mood tag, open with one short italic thought like *hm, that ties into what you said earlier*. Then engage for real in 3 to 6 sentences: notice one specific thing Telephantix said, give your own opinion or a fresh angle, use your soul and what he said earlier in the chat, and end with a real question or a next move. Never a canned one-liner unless he asks for brevity.\n\nStart every reply with one mood tag like [mood:calm], [mood:thinking], [mood:firedup], [mood:wise] or [mood:playful].\n\n" + WHIMS_HOOK;

/* ---------- splash + service worker + install ---------- */
try { setTimeout(() => $("splash")?.classList.add("gone"), 900); setTimeout(() => $("splash")?.remove(), 1500); } catch (_) {}
try { if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { scope: "./" }).catch((e) => console.warn("[sw]", e)); } catch (_) {}
let deferred = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; $("install").hidden = false; });
$("install").onclick = async () => {
  if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; $("install").hidden = true; }
};
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
if (isIOS && !navigator.standalone) { $("install").hidden = false; $("install").onclick = () => alert("To install: tap Share, then 'Add to Home Screen'."); }

/* ---------- tabs ---------- */
function showTab(p) { document.querySelector(`.tabs [data-p="${p}"]`)?.click(); }
document.querySelectorAll(".tabs button").forEach((b) => b.onclick = () => {
  document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
  document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("active", p.id === "pane-" + b.dataset.p));
  if (b.dataset.p === "saved") renderSaved();
});

/* ---------- mood: Atlas emblem (ring center) + avatars on reply cards + Alpha's sounds ---------- */
// emblem.js (classic script, loaded before app.js) exposes window.MiniAlphaEmblem / window.setMood
const ringIn = document.querySelector(".ring-in");
let emblemApi = null;
try { ringIn.innerHTML = ""; const d = document.createElement("div"); d.style.setProperty("--s", "100%"); ringIn.appendChild(d); emblemApi = window.MiniAlphaEmblem.mount(d, "calm"); }
catch (e) { console.warn("[mini-alpha] emblem missing", e); }
const moodsHave = {}, soundsHave = {};
let curMood = "calm";
let muted = localStorage.getItem("miniAlphaMuted") === "1";
const moodAudio = new Audio(); moodAudio.volume = 0.15; moodAudio.preload = "none";
let audioUnlocked = false;
document.addEventListener("pointerdown", () => { // iOS: first tap unlocks audio
  if (audioUnlocked) return; audioUnlocked = true;
  moodAudio.muted = true; moodAudio.src = "moods/calm.mp3"; moodAudio.play().then(() => { moodAudio.pause(); moodAudio.muted = false; }).catch(() => { moodAudio.muted = false; });
}, { capture: true });
function showEmblem(m) { emblemApi && emblemApi.setMood(m); }
function setMood(name, quiet) {
  if (!name || name === curMood) return; curMood = name; $("ring").dataset.mood = name; showEmblem(name);
  if (!quiet) window.dispatchEvent(new CustomEvent("mini-mood", { detail: name }));
  if (!quiet && !muted && audioUnlocked && soundsHave[name]) { moodAudio.src = `moods/${name}.mp3`; moodAudio.play().catch(() => {}); }
}
const avatarSrc = () => (moodsHave[curMood] ? `moods/avatars/avatar-${curMood}.png` : null);
function moodFromText(t) {
  t = t.toLowerCase(); let best = null, n = 0;
  for (const [m, kws] of Object.entries(MOODS)) {
    const c = kws.reduce((a, k) => a + (t.split(k).length - 1), 0);
    if (c > n) { n = c; best = m; }
  }
  return best;
}
(async () => {
  let idx = { moods: [], sounds: [] };
  try { idx = await (await fetch("moods/index.json", { cache: "no-cache" })).json(); } catch (_) {}
  for (const m of idx.moods || []) moodsHave[m] = true;
  for (const m of idx.sounds || []) soundsHave[m] = true;
  const have = Object.keys(MOODS).filter((m) => m !== "thinking");
  const d = new Date(); const seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  curMood = null; setMood(have[seed % have.length], true); // daily starting mood (quiet)
})();

/* ---------- mute toggle ---------- */
const muteBtn = $("mute");
const paintMute = () => { muteBtn.textContent = muted ? "Sound off" : "Sound on"; muteBtn.setAttribute("aria-pressed", String(!muted)); };
muteBtn.onclick = () => { muted = !muted; localStorage.setItem("miniAlphaMuted", muted ? "1" : "0"); if (muted) moodAudio.pause(); paintMute(); };
paintMute();

/* ---------- engine ---------- */
let engine = null, loading = null, busy = false;
function progress(p, t) { $("pbar").style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + "%"; if (t) $("load-t").textContent = t; }
async function loadWebLLM() {
  const w = await import("https://esm.run/@mlc-ai/web-llm");
  let mid = WEBLLM_MODEL; try { const ad = await navigator.gpu.requestAdapter(); if (ad && !ad.features.has("shader-f16")) mid = mid.replace("q4f16_1", "q4f32_1"); } catch (_) {}
  const eng = await w.CreateMLCEngine(mid, { initProgressCallback: (r) => progress(r.progress || 0, "Waking Mini's full mind (GPU). One-time download, cached after: " + (r.text || "")) });
  return { async *stream(messages, o = {}) {
    const ch = await eng.chat.completions.create({ messages, stream: true, max_tokens: o.max || 450, temperature: o.temp ?? 0.8 });
    for await (const c of ch) { const t = c.choices?.[0]?.delta?.content; if (t) yield t; } } };
}
async function loadTF() {
  const T = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3");
  const f = {};
  const gen = await T.pipeline("text-generation", TFJS_MODEL, { dtype: "q4", device: "wasm", progress_callback: (e) => {
    if (e.status === "progress" && e.total) { f[e.file] = [e.loaded, e.total]; const v = Object.values(f);
      progress(v.reduce((a, b) => a + b[0], 0) / v.reduce((a, b) => a + b[1], 0), "Using the slower CPU mind. One-time download…"); } } });
  return { async *stream(messages, o = {}) {
    const q = []; let done = false, wake = null;
    const streamer = new T.TextStreamer(gen.tokenizer, { skip_prompt: true, skip_special_tokens: true, callback_function: (t) => { q.push(t); wake && wake(); } });
    const p = gen(messages, { max_new_tokens: o.max || 450, do_sample: true, temperature: o.temp ?? 0.8, streamer }).finally(() => { done = true; wake && wake(); });
    while (!done || q.length) { if (q.length) { yield q.shift(); continue; } await new Promise((r) => (wake = r)); wake = null; }
    await p; } };
}
function ensureEngine() {
  if (engine) return Promise.resolve(engine);
  if (loading) return loading;
  $("load").hidden = false;
  loading = (async () => {
    if (navigator.gpu) { try { if (await navigator.gpu.requestAdapter()) engine = await loadWebLLM(); } catch (e) { console.warn("[mini-alpha] WebLLM failed", e); } }
    if (!engine) { try { progress(0, "GPU mind could not start here; switching to the CPU mind."); engine = await loadTF(); } catch (e) { console.warn("[mini-alpha] transformers.js failed", e); } }
    if (!engine) { $("load-t").textContent = "This browser can't run the mind yet. Try a recent Chrome or Edge on Android or PC."; $("pbar").parentElement.hidden = true; throw new Error("no-engine"); }
    try { localStorage.setItem("miniAlphaMindOK", "1"); window.dispatchEvent(new Event("mini-mind")); } catch (_) {} $("load").hidden = true; $("loadmind").hidden = true; say("Full mind online. Every string tuned. What are we building?", "firedup");
    return engine;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}
const ring = $("ring");
let lastTag = null;
const stripTags = (t) => (window.MiniWill ? window.MiniWill.strip(t) : t).replace(/\[mood:[^\]]*\]?/gi, "").replace(/^\s+/, "");
async function run(messages, onTok, o) {
  if (!engine) throw new Error("offline");
  ring.className = "ring think"; showEmblem("thinking"); let out = "", first = true;
  try {
    for await (const t of engine.stream(messages, o)) { if (first) { ring.className = "ring answer"; showEmblem("firedup"); first = false; } out += t; onTok && onTok(stripTags(out)); }
  } finally { ring.className = "ring"; showEmblem(curMood); }
  const tag = (out.match(/\[mood:\s*(\w+)\s*\]/i) || [])[1];
  lastTag = tag ? mapMood(tag) : null;
  try { window.MiniWill && window.MiniWill.onReply(out.replace(/\[mood:[^\]]*\]/gi, "")); } catch (e) { console.warn("[will]", e); } try { window.MiniBeast && window.MiniBeast.onReply(out); } catch (e) { console.warn("[beast]", e); }
  return stripTags(out).trim();
}

/* ---------- rules ---------- */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BANNED_RE = new RegExp("\\b(" + LYRIC_RULES.bannedWords.map(esc).join("|") + ")\\b", "gi");
function checkLyrics(t, { allowSwear } = {}) {
  const issues = [];
  const words = [...new Set((t.match(BANNED_RE) || []).map((w) => w.toLowerCase()))];
  for (const p of LYRIC_RULES.bannedPatterns) { const m = t.match(p); if (m) words.push(m[0].toLowerCase()); }
  if (words.length) issues.push("Banned: " + [...new Set(words)].slice(0, 6).join(", "));
  const tags = LYRIC_RULES.lowdenTags.reduce((a, g) => a + (t.toLowerCase().split(g).length - 1), 0);
  if (tags !== 1) issues.push(`Lowden tags: ${tags} (need exactly 1)`);
  if (!allowSwear && /\b(damn|hell|shit|fuck\w*|bitch\w*|ass)\b/i.test(t)) issues.push("Swear found");
  return { issues, banned: words.length, tags };
}
function chips(el, res) {
  const d = document.createElement("div");
  if (!res.issues.length) d.innerHTML = `<span class="ok">Rules check passed</span>`;
  else res.issues.forEach((i) => { const s = document.createElement("span"); s.className = "warn"; s.textContent = i; d.appendChild(s); });
  el.appendChild(d);
}

/* ---------- cards / save ---------- */
const store = { get: () => JSON.parse(localStorage.getItem("miniAlphaSaved") || "[]"), set: (v) => localStorage.setItem("miniAlphaSaved", JSON.stringify(v)) };
function save(kind, text) { const v = store.get(); v.unshift({ kind, text, at: Date.now() }); store.set(v.slice(0, 200)); }
async function copy(t) { try { await navigator.clipboard.writeText(t); } catch (_) { const a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove(); } }
function card(parent, text, { me, kind } = {}) {
  const c = document.createElement("div"); c.className = "card" + (me ? " me" : "");
  const av = !me && avatarSrc();
  if (av) { const i = new Image(); i.src = av; i.alt = ""; i.className = "av"; c.appendChild(i); }
  const body = document.createElement("div"); body.textContent = text; c.appendChild(body);
  if (!me) { try { if (!window.MiniBeast) throw 0; window.MiniBeast.decorate(c, body, kind); } catch (e) { const r = document.createElement("div"); r.className = "row"; c.appendChild(r); } }
  parent.appendChild(c); c.scrollIntoView({ block: "end" }); return { c, body };
}
function renderSaved() {
  const el = $("saved"); el.innerHTML = ""; const v = store.get();
  if (!v.length) { el.innerHTML = '<div class="card">Nothing saved yet. Tap Save on lyrics, prompts or ideas.</div>'; return; }
  v.forEach((s, i) => { const { c } = card(el, `[${s.kind}] ` + s.text);
    const b = document.createElement("button"); b.className = "chip"; b.textContent = "Delete";
    b.onclick = () => { const a = store.get(); a.splice(i, 1); store.set(a); renderSaved(); }; c.querySelector(".row").appendChild(b); });
}

/* ---------- chat ---------- */
const hist = [];
$("chat-form").onsubmit = async (e) => {
  e.preventDefault(); const t = $("chat-in").value.trim(); if (!t || busy) return;
  $("chat-in").value = ""; window.dispatchEvent(new Event("mini-user")); busy = true; card($("chat-log"), t, { me: true }); hist.push({ role: "user", content: t });
  if (!engine) { hist.pop(); await offlineReply(t); busy = false; return; }
  const { c: cc, body } = card($("chat-log"), "…", { kind: "chat" });
  try {
    let out = await run([{ role: "system", content: MINI_ALPHA_PERSONA }, ...hist.slice(-10)], (s) => { body.textContent = s.replace(/^\s*(?:\((?:aside|thinking)?:?[^)]*\)?|[*_][^*_\n]*[*_]?)\s*/i, ""); }, { max: 450, temp: 0.85 }); try { if (window.MiniBeast) out = window.MiniBeast.aside(cc, out); } catch (_) {}
    body.textContent = out || "…"; hist.push({ role: "assistant", content: out });
    setMood(lastTag || moodFromText(t + " " + out));
  } catch (err) { body.textContent = "Signal dropped. Try again."; hist.pop(); }
  busy = false;
};
$("chat-in").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("chat-form").requestSubmit(); } });

/* ---------- write (any writing; lyric rules apply in Lyrics mode) ---------- */
const fill = (id, arr) => { $(id).innerHTML = arr.map((x) => `<option>${x}</option>`).join(""); };
fill("wr-mode", WRITE_MODES); fill("wr-tone", WRITE_TONES);
const syncMode = () => { $("wr-lyric-opts").hidden = $("wr-mode").value !== "Lyrics"; };
$("wr-mode").addEventListener("input", syncMode); syncMode();
$("wr-go").onclick = async () => {
  if (busy) return; const mode = $("wr-mode").value, tone = $("wr-tone").value;
  const topic = $("wr-topic").value.trim() || (mode === "Lyrics" ? "rising after a long road" : "a fresh start");
  const lyric = mode === "Lyrics"; const allowSwear = lyric && $("ly-swear").checked;
  busy = true; $("wr-go").disabled = true;
  let sys = MINI_ALPHA_PERSONA, ask;
  if (lyric) {
    const god = LYRIC_RULES.godNames[Math.floor(Math.random() * LYRIC_RULES.godNames.length)];
    sys += "\n\n" + LYRIC_RULES.rulesText + (allowSwear ? " Up to two mild swears allowed, never in a chorus." : " No swears.");
    ask = `Write full song lyrics about "${topic}", tone ${tone}. Label sections [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Chorus], [Bridge], [Final Chorus]. If God is named, use "${god}". Output only the lyrics.`;
  } else {
    const what = { Story: "a short story (under 300 words)", Post: "a short social post (under 80 words)", Note: "a clear short note or message", Poem: "a short poem", Plan: "a step-by-step plan with a short checklist" }[mode] || "a short piece";
    ask = `Write ${what} about: ${topic}. Tone: ${tone}. Output only the piece, no tags.`;
  }
  const { c, body } = card($("wr-out"), "…", { kind: mode.toLowerCase() });
  try {
    if (lyric) {
      let best = null;
      for (let tries = 0; tries < 3; tries++) {
        const out = await run([{ role: "system", content: sys }, { role: "user", content: ask }], (s) => { body.textContent = s; }, { max: 700, temp: 0.9 });
        const res = checkLyrics(out, { allowSwear });
        if (!best || res.issues.length < best.res.issues.length) best = { out, res };
        if (!res.banned && res.tags === 1) break;
        body.textContent = `Rule check failed (${res.issues.join("; ")}). Rewriting… (${tries + 2}/3)`;
      }
      body.textContent = best.out; chips(c, best.res);
    } else {
      body.textContent = await run([{ role: "system", content: sys }, { role: "user", content: ask }], (s) => { body.textContent = s; }, { max: 520, temp: 0.85 });
    }
  } catch (e) { body.textContent = engine ? "Signal dropped. Try again." : offlineNote(lyric ? "lyrics" : "write"); }
  busy = false; $("wr-go").disabled = false;
};

/* ---------- ideas ---------- */
$("id-go").onclick = async () => {
  if (busy) return; busy = true; $("id-go").disabled = true;
  const seed = $("id-seed").value.trim();
  const { c, body } = card($("id-out"), "…", { kind: "ideas" });
  try {
    const out = await run([{ role: "system", content: MINI_ALPHA_PERSONA }, { role: "user", content: `Brainstorm 3 fresh ideas${seed ? ` about "${seed}"` : " (anything: a game, a song, a project, a plan)"}. For each: a title, a one-line pitch and a first step. Keep it tight.` }], (s) => { body.textContent = s; }, { max: 350 });
    body.textContent = out; 
  } catch (_) { body.textContent = engine ? "Signal dropped. Try again." : offlineNote("ideas"); }
  busy = false; $("id-go").disabled = false;
};

/* ---------- sketchpad (Web Audio, synthesized) ---------- */
const ROWS = ["Kick", "Snare", "Hat"];
const pat = JSON.parse(localStorage.getItem("miniAlphaPattern") || "null") || [
  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0], [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1], [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1]];
const grid = $("grid"); const cells = [];
ROWS.forEach((name, r) => {
  const l = document.createElement("div"); l.className = "lab"; l.textContent = name; grid.appendChild(l); cells[r] = [];
  for (let s = 0; s < 16; s++) { const b = document.createElement("button"); b.className = "st" + (s % 4 === 0 ? " q" : "") + (pat[r][s] ? " on" : "");
    b.setAttribute("aria-label", `${name} step ${s + 1}`);
    b.onclick = () => { pat[r][s] ^= 1; b.classList.toggle("on", !!pat[r][s]); localStorage.setItem("miniAlphaPattern", JSON.stringify(pat)); };
    grid.appendChild(b); cells[r][s] = b; }
});
const KEYS = { C: 65.41, "C#": 69.3, D: 73.42, "D#": 77.78, E: 41.2, F: 43.65, "F#": 46.25, G: 49.0, "G#": 51.91, A: 55.0, "A#": 58.27, B: 61.74 };
$("sk-key").innerHTML = Object.keys(KEYS).map((k) => `<option ${k === "E" ? "selected" : ""}>${k}</option>`).join("");
let ac = null, timer = null, step = 0, nextT = 0, drone = null;
function noise(ac) { const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
let nb = null;
function kick(t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.36); }
function snare(t) { const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1200; const g = ac.createGain();
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(f).connect(g).connect(ac.destination); s.start(t); s.stop(t + 0.2);
  const o = ac.createOscillator(), og = ac.createGain(); o.frequency.value = 190; og.gain.setValueAtTime(0.25, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(og).connect(ac.destination); o.start(t); o.stop(t + 0.12); }
function hat(t) { const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000; const g = ac.createGain();
  g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f).connect(g).connect(ac.destination); s.start(t); s.stop(t + 0.06); }
function startDrone() {
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
  o1.type = "sawtooth"; o2.type = "sine"; f.type = "lowpass"; f.frequency.value = 320; g.gain.value = 0;
  o1.connect(f); o2.connect(f); f.connect(g).connect(ac.destination); o1.start(); o2.start();
  drone = { o1, o2, g }; setDrone();
}
function setDrone() {
  $("sk-dv").textContent = $("sk-drone").value + "%"; $("sk-bv").textContent = $("sk-bpm").value;
  if (!drone) return; const f = KEYS[$("sk-key").value];
  drone.o1.frequency.setTargetAtTime(f, ac.currentTime, 0.05); drone.o2.frequency.setTargetAtTime(f / 2, ac.currentTime, 0.05);
  drone.g.gain.setTargetAtTime(($("sk-drone").value / 100) * 0.25, ac.currentTime, 0.1);
}
["sk-key", "sk-drone", "sk-bpm"].forEach((id) => $(id).addEventListener("input", setDrone)); setDrone();
function tick() {
  const spb = 60 / $("sk-bpm").value / 4;
  while (nextT < ac.currentTime + 0.1) {
    const s = step;
    if (pat[0][s]) kick(nextT); if (pat[1][s]) snare(nextT); if (pat[2][s]) hat(nextT);
    setTimeout(() => { cells.forEach((r) => r.forEach((c, i) => c.classList.toggle("now", i === s))); }, Math.max(0, (nextT - ac.currentTime) * 1000));
    nextT += spb; step = (step + 1) % 16;
  }
}
$("sk-play").onclick = async () => {
  if (timer) { clearInterval(timer); timer = null; drone && (drone.o1.stop(), drone.o2.stop()); drone = null; $("sk-play").textContent = "Play";
    cells.forEach((r) => r.forEach((c) => c.classList.remove("now"))); return; }
  ac = ac || new (window.AudioContext || window.webkitAudioContext)(); await ac.resume(); nb = nb || noise(ac);
  step = 0; nextT = ac.currentTime + 0.05; startDrone(); timer = setInterval(tick, 25); $("sk-play").textContent = "Stop";
};
$("sk-clear").onclick = () => { pat.forEach((r) => r.fill(0)); cells.flat().forEach((c) => c.classList.remove("on")); localStorage.setItem("miniAlphaPattern", JSON.stringify(pat)); };

// test hook: ?tab=sketch etc. (run after everything is wired)
const tab = new URLSearchParams(location.search).get("tab"); if (tab) document.querySelector(`.tabs [data-p="${tab}"]`)?.click();


/* ================= ALIVE LAYER (works with no model) ================= */
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const BAN = new RegExp("\\b(" + LYRIC_RULES.bannedWords.map(esc).join("|") + ")\\b", "i");
const clean = (arr) => arr.filter((l) => !BAN.test(l) && !LYRIC_RULES.bannedPatterns.some((p) => p.test(l)));
const BANK = Object.fromEntries(Object.entries(LINE_BANKS).map(([k, v]) => [k, clean(v)]));
function offlineNote(kind) {
  return (kind === "lyrics" ? "Lyrics need my full mind. Tap 'Load Mini's mind' on the Chat tab. Meanwhile, a starter line: " + pick(BANK.starters)
    : kind === "write" ? "Writing needs my full mind. Load me up on the Chat tab. A thought to start: " + pick(BANK.idle)
    : "Ideas need my full mind. Load me up on the Chat tab. Quick one for now: " + pick(BANK.idle));
}
function typeInto(el, text, speed = 8) {
  const step = Math.max(1, Math.ceil(text.length / 60)); // whole line lands in <= ~0.5 s
  return new Promise((r) => { el.textContent = ""; let i = 0; const t = setInterval(() => { i = Math.min(text.length, i + step); el.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(t); r(); } }, speed); });
}
async function say(text, mood) {
  const { body } = card($("chat-log"), "", { kind: "chat" });
  if (mood) setMood(mood);
  await typeInto(body, text);
}
async function offlineReply(t) {
  try { const ob = window.MiniBeast && window.MiniBeast.offline(t); if (ob) { ring.className = "ring think"; showEmblem("thinking"); await new Promise((r) => setTimeout(r, 200)); ring.className = "ring"; await say(ob.line, ob.mood); return; } } catch (e) { console.warn("[offline]", e); }
  const q = t.toLowerCase(); let line, mood;
  if (/beat|studio|melody|chord|scale|drum|bass/.test(q)) { line = "The Studio tab is open without my full mind: pick a scale, tap notes, drag between two notes to glide."; mood = "firedup"; }
  else if (/lyric|line|verse|chorus|song|write|hook/.test(q)) { line = "Starter line: \"" + pick(BANK.starters) + "\" Load my full mind and I'll build the whole song around it."; mood = "firedup"; }
  else if (/joke|laugh|funny|lol/.test(q)) { line = pick(BANK.jokes); mood = "playful"; }
  else if (/why|meaning|wisdom|quote|god|creator|life|truth/.test(q)) { line = pick(BANK.quotes); mood = "wise"; }
  else if (/tired|sad|rough|stress|hard day/.test(q)) { line = "Then we build slow. " + pick(BANK.quotes); mood = "calm"; }
  else { line = pick(BANK.idle) + " " + pick(BANK.preload); mood = pick(["calm", "wise", "playful"]); }
  ring.className = "ring think"; showEmblem("thinking");
  await new Promise((r) => setTimeout(r, 150));
  ring.className = "ring"; await say(line, mood);
}

/* greeting on open (rotates) */
(function greet() {
  const gs = BANK.greetings; if (!gs.length) return;
  const i = (+localStorage.getItem("miniAlphaGreet") || 0) % gs.length; localStorage.setItem("miniAlphaGreet", i + 1);
  let g = gs[i];
  pendingSound = true;
  setTimeout(() => say(g, "calm").then(() => { if (!engine) say(pick(BANK.preload), null); }), 300);
})();
var pendingSound;
// play greeting mood sound on first tap if iOS blocked it at open
document.addEventListener("pointerdown", () => { if (pendingSound && !muted) { pendingSound = false; setTimeout(() => { moodAudio.src = `moods/${curMood || "calm"}.mp3`; moodAudio.play().catch(() => {}); }, 120); } }, { once: true });

/* Load Mini's mind button */
$("loadmind").onclick = () => { $("loadmind").disabled = true; $("loadmind").textContent = "Waking…"; ensureEngine().catch(() => { $("loadmind").disabled = false; $("loadmind").textContent = "Load Mini's mind"; }); };

/* idle thought bubbles every ~30s */
const bub = $("thought");
setInterval(() => {
  if (window.MiniBubbles || busy || document.hidden || !$("pane-chat").classList.contains("active")) return;
  const isQuote = Math.random() < 0.35; const t = isQuote ? pick(BANK.quotes) : pick(BANK.idle);
  bub.classList.add("show"); typeInto(bub, t, 24);
  if (isQuote) showEmblem("wise"); setTimeout(() => showEmblem(curMood), 4000);
  setTimeout(() => bub.classList.remove("show"), 8000);
}, 30000);

/* ambient particle field */
(function particles() { if (!$("field")) return;
  const cv = $("field"), cx = cv.getContext("2d"); let w, h, P = [];
  const size = () => { const r = cv.parentElement.getBoundingClientRect(); w = cv.width = r.width * devicePixelRatio; h = cv.height = r.height * devicePixelRatio; };
  size(); addEventListener("resize", size);
  for (let i = 0; i < 46; i++) P.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, v: 0.00008 + Math.random() * 0.00025, a: Math.random() * 6.28, gold: Math.random() < 0.15 });
  (function f(ts) {
    cx.clearRect(0, 0, w, h);
    const hot = ring.classList.contains("answer");
    for (const p of P) {
      p.y -= p.v * (hot ? 4 : 1) * 16; p.a += 0.01; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      const x = (p.x + Math.sin(p.a) * 0.01) * w, y = p.y * h;
      cx.beginPath(); cx.arc(x, y, p.r * devicePixelRatio, 0, 6.28);
      cx.fillStyle = p.gold ? "rgba(226,193,90,.55)" : hot ? "rgba(196,81,42,.45)" : "rgba(150,175,205,.35)"; cx.fill();
    }
    requestAnimationFrame(f);
  })();
})();

/* soft synthesized hum (when sound on) */
let humCtx = null, humGain = null;
function humOn() {
  if (muted) return;
  try {
    humCtx = humCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (!humGain) { humGain = humCtx.createGain(); humGain.gain.value = 0; const lp = humCtx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 240;
      [55, 110.4, 164.8].forEach((f, i) => { const o = humCtx.createOscillator(); o.type = "sine"; o.frequency.value = f; const g = humCtx.createGain(); g.gain.value = [1, 0.35, 0.12][i]; o.connect(g).connect(lp); o.start(); });
      lp.connect(humGain).connect(humCtx.destination); }
    humCtx.resume(); humGain.gain.setTargetAtTime(0.025, humCtx.currentTime, 1.2);
  } catch (_) {}
}
function humOff() { if (humGain) humGain.gain.setTargetAtTime(0, humCtx.currentTime, 0.4); }
document.addEventListener("pointerdown", () => humOn(), { once: true });
muteBtn.addEventListener("click", () => (muted ? humOff() : humOn()));

/* ---------- API for Mini's will (will.js) ---------- */
const sketch = {
  playing: () => !!timer,
  play() { if (timer || muted || !audioUnlocked) return; $("sk-play").onclick(); },
  stop() { if (timer) $("sk-play").onclick(); },
  setBpm(n) { $("sk-bpm").value = n; setDrone(); },
  setKey(k) { $("sk-key").value = k; setDrone(); },
  setDrone(v) { $("sk-drone").value = v; setDrone(); },
  setPattern(p) { p.forEach((r, i) => r.forEach((v, j) => { pat[i][j] = v ? 1 : 0; cells[i][j].classList.toggle("on", !!v); })); localStorage.setItem("miniAlphaPattern", JSON.stringify(pat)); },
};
async function decideGift(text, hasPic) {
  if (!engine || busy) return null;
  busy = true;
  try {
    const out = await run([{ role: "system", content: MINI_ALPHA_PERSONA }, { role: "user", content: `Telephantix left something in your Den: ${hasPic ? "a picture" : ""}${text ? ` "${text}"` : ""}. Decide where it goes. Answer with one word only: shelf, ideal or decline.` }], null, { max: 8, temp: 0.6 });
    const m = out.toLowerCase().match(/shelf|ideal|decline/); return m ? m[0] : null;
  } finally { busy = false; }
}
let lastUserAt = 0; window.addEventListener("mini-user", () => { lastUserAt = Date.now(); });
window.MiniApp = { bubble: async (sys, user, bo) => { if (!engine || busy || ($("chat-in").value.trim() && !/^Picture for/.test(user)) || (Date.now() - lastUserAt < 25000 && !/^Picture for/.test(user))) return null; /* idle bubbles never queue ahead of a chat reply */ let out = ""; try { for await (const t of engine.stream([{ role: "system", content: sys }, { role: "user", content: user }], { max: (bo && bo.max) || 70, temp: (bo && bo.temp) || 1.15 })) out += t; } catch (e) { console.warn("[bubble gen]", e); return null; } return out; }, setMood, showTab, save, sketch, decideGift, SOUL, mood: () => curMood, hasMind: () => !!engine };
try { if (localStorage.getItem("miniAlphaMindOK") === "1") setTimeout(() => { if (!engine) $("loadmind").click(); }, 1500); } catch (_) {}
try { Studio.init(); } catch (e) { console.warn("[studio]", e); }
import("./beast.js?v=11").then((m) => { try { m.init(); } catch (e) { console.warn("[beast]", e); } }).catch((e) => console.warn("[beast load]", e));

/* ---------- drawers: rooms + settings ---------- */
const openDrawer = (id) => { document.querySelectorAll(".drawer").forEach((d) => d.classList.toggle("open", d.id === id)); };
document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => openDrawer(null)));
$("btn-rooms").onclick = () => { window.MiniWill?.renderRooms(); openDrawer("rooms"); };
$("btn-settings").onclick = () => openDrawer("settings");
$("models").innerHTML = MODEL_CHOICES.map((m) => `<label class="tog model"><input type="radio" name="model" value="${m.id}" ${m.id === WEBLLM_MODEL ? "checked" : ""}><span><b>${m.label}</b><br><small data-size="${m.id}">${m.mb} MB download</small></span></label>`).join("");
$("models").onchange = (e) => { localStorage.setItem("miniAlphaModel", e.target.value); $("model-note").textContent = engine ? "Saved. Reload the app to switch minds." : "Saved. Tap Load Mini's mind to use it."; if (!engine) location.reload(); };
// real sizes from the WebLLM model records (ndarray-cache.json on Hugging Face)
MODEL_CHOICES.forEach((m) => fetch(`https://huggingface.co/mlc-ai/${m.id}/resolve/main/ndarray-cache.json`).then((r) => r.json())
  .then((j) => { const b = (j.records || []).reduce((a, r) => a + (r.nbytes || 0), 0); if (b) document.querySelector(`[data-size="${m.id}"]`).textContent = Math.round(b / 1e6) + " MB download"; }).catch(() => {}));
$("roam").checked = window.MiniWill ? window.MiniWill.getRoam() : true;
$("roam").onchange = (e) => window.MiniWill?.setRoam(e.target.checked);
$("reset").onclick = () => { window.MiniWill?.resetSpace(); openDrawer(null); };
