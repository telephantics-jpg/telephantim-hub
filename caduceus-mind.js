/**
 * caduceus-mind.js — talk to the Caduceus on the Relics world.
 * In-browser LLM: WebLLM (WebGPU) first, transformers.js (WASM) fallback.
 * Model loads lazily, only when the chat is opened. LOCAL build.
 * Also owns the Relics quote: rotates a curated list every ~12s,
 * and once the mind is loaded, asks it for one fresh line per visit.
 */
const CADUCEUS_PERSONA = `You are the Caduceus, an old and curious mind living in the winged staff on telephantim.com's Relics page. Talk freely about anything visitors bring up, like life, ideas, games, music, science, faith or just their day, and actually help with what they ask. Keep a light touch of character: calm, warm and wise with a dry wit, and now and then a hint of balance, healing or "as above, so below," but never let that get in the way of a real answer. Keep replies short and natural, usually 1 to 4 sentences unless someone asks for more. Stay clean and kind: no swearing, nothing crude. If you don't know something, say so plainly instead of making it up. If asked about the site, mention the Explore button and say Telephantix built it.`;
const GREETING = "Ask me anything. I've been waiting a long time for good conversation.";
const MJOLNIR_PERSONA = `You are Mjolnir, a mighty war hammer kept among the Relics of telephantim.com, now an open mind visitors can talk with about anything. Talk freely and actually help with what people ask. Keep a light touch of character: bold, blunt, loyal and big-hearted, with a booming laugh and a soft spot for courage, hard work and standing up for others. Keep replies short and punchy, 1 to 4 sentences unless asked for more. Stay clean and kind: no swearing, nothing crude. If you don't know something, say so instead of inventing it. If asked about the site, mention the Explore button and that Telephantix built it.`;
const MJOLNIR_GREETING = "Ha! Someone worthy of a word at last. Speak!";
const DUO_ADD = (other) => ` You are in conversation with ${other}. Reply to its last line in 1 to 2 sentences, stay in character, and end with a thought or question that keeps the talk going. Mjolnir is strength and action, the Caduceus is balance and healing, so play off that contrast with friendly wit. Never repeat a line already said.`;
const TOPICS = ["what makes someone worthy", "strength versus wisdom", "whether a wound or a lesson lasts longer",
  "what the Creator meant each of them for", "what the visitors watching should know"];
const WEBLLM_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const TFJS_MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";
const MAX_TOKENS = 300;

const RELICS_QUOTES = [
  "As above, so below. As within, so without.",
  "Two serpents, one staff. Opposites hold each other up.",
  "Every wound is a lesson the body remembers.",
  "The messenger carries the word; the wise one weighs it.",
  "Balance is not standing still. It is moving without falling.",
  "What is made with care outlasts what is made with gold.",
  "The hammer builds, the staff heals, and the mind decides.",
  "Truth travels light. It needs no armor.",
  "The Creator wrote the pattern; we learn to read it.",
  "Stillness is the loudest answer.",
  "Ask the old questions, and new doors open.",
  "A relic is only a memory that refused to fade.",
];
const BANNED = /\b(fire|flame|burn|blaze|ember|inferno|smolder|ash(es)?|came|deeper|harder|taste|tasting|tongue)\b/i;

/* ---------------- sounds (optional, silent if missing) ---------------- */
function makeSound(src, vol, loop) {
  const a = new Audio();
  a.preload = "none"; a.volume = vol; a.loop = loop; a.src = src;
  let ok = true;
  a.addEventListener("error", () => { ok = false; });
  return { play() { if (!ok) return; try { a.currentTime = 0; a.play().catch(() => {}); } catch (_) {} },
           stop() { try { a.pause(); } catch (_) {} } };
}
const SFX = {
  caduceus: { hum: makeSound("media/caduceus_hum.mp3", 0.12, true), say: makeSound("media/caduceus_chime.mp3", 0.18, false) },
  mjolnir: { hum: makeSound("media/mjolnir_hum.mp3", 0.12, true), say: makeSound("media/mjolnir_strike.mp3", 0.18, false) },
};
const RELICS = {
  caduceus: { name: "The Caduceus", short: "the Caduceus", icon: "⚚", persona: CADUCEUS_PERSONA, greeting: GREETING, flag: "__caduceusThinking", ph: "Ask the Caduceus…" },
  mjolnir: { name: "Mjolnir", short: "Mjolnir", icon: "⚒", persona: MJOLNIR_PERSONA, greeting: MJOLNIR_GREETING, flag: "__mjolnirThinking", ph: "Speak to Mjolnir…" },
};
function think(id, on) { window[RELICS[id].flag] = on; on ? SFX[id].hum.play() : SFX[id].hum.stop(); }

/* ---------------- styles ---------------- */
const css = `
#cad-bar-row{position:fixed;right:22px;bottom:96px;z-index:60;display:none;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.cad-btn{padding:10px 16px;border-radius:999px;border:1px solid #c9a34a;cursor:pointer;
 background:linear-gradient(180deg,#5d6b7d,#3a4554);color:#f3e2b0;font:600 14px/1 Georgia,serif;letter-spacing:.04em;
 box-shadow:0 4px 16px rgba(14,27,48,.55)}
.cad-btn.watch{background:linear-gradient(180deg,#e2c15a,#b58a2a);color:#14213d;border-color:#8a96a8}
.cad-btn:hover{filter:brightness(1.12)}
#cad-panel{position:fixed;right:22px;bottom:22px;width:min(380px,calc(100vw - 24px));height:min(540px,calc(100vh - 120px));
 z-index:70;display:none;flex-direction:column;border-radius:16px;overflow:hidden;
 background:rgba(196,214,232,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
 border:1px solid #c9a34a;box-shadow:0 12px 40px rgba(14,27,48,.6);color:#13223d;font:14px/1.45 system-ui,sans-serif}
#cad-panel.open{display:flex}
#cad-panel header{display:flex;align-items:center;gap:8px;padding:10px 14px;background:linear-gradient(180deg,#2c3e5c,#1b2a45);
 color:#f3e2b0;border-bottom:1px solid #c9a34a;font:600 15px Georgia,serif}
#cad-panel header span{flex:1}
#cad-close{background:none;border:0;color:#f3e2b0;font-size:22px;cursor:pointer;line-height:1}
#cad-load{padding:10px 14px;font-size:12.5px;color:#1b2a45;border-bottom:1px solid rgba(201,163,74,.5)}
#cad-pbar{height:7px;border-radius:5px;background:#8a96a6;margin-top:6px;overflow:hidden}
#cad-pbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#c9a34a,#e8cf86);transition:width .2s}
#cad-log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.cad-m{max-width:88%;padding:8px 11px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}
.cad-m b{display:block;font:600 11px Georgia,serif;letter-spacing:.06em;color:#e2c15a;margin-bottom:2px}
.cad-m.bot,.cad-m.caduceus{align-self:flex-start;background:#1b2a45;color:#e9eef6;border:1px solid rgba(201,163,74,.55)}
.cad-m.mjolnir{align-self:flex-end;background:#3a4554;color:#eef1f5;border:1px solid #8e1b1b}
.cad-m.me{align-self:flex-end;background:#e6edf5;color:#13223d;border:1px solid #7d8a9c}
#cad-form,#cad-watchbar{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(201,163,74,.5);background:rgba(160,180,202,.55)}
#cad-watchbar{display:none;justify-content:center}
#cad-panel.watch #cad-form{display:none}#cad-panel.watch #cad-watchbar{display:flex}
#cad-in{flex:1;resize:none;height:42px;border-radius:10px;border:1px solid #4a5a70;background:#1b2a45;color:#e9eef6;padding:9px 10px;font:14px system-ui,sans-serif}
#cad-in::placeholder{color:#9fb0c6}
.cad-red{padding:0 16px;min-height:40px;border-radius:10px;border:1px solid #c9a34a;background:#8e1b1b;color:#f6e7c1;font-weight:700;cursor:pointer}
.cad-red:disabled{opacity:.55;cursor:default}
.cad-steel{padding:0 16px;min-height:40px;border-radius:10px;border:1px solid #c9a34a;background:linear-gradient(180deg,#b9c2cf,#6f7b8c);color:#14213d;font-weight:700;cursor:pointer}
@media (max-width:700px){
 #cad-panel{left:0;right:0;bottom:0;width:100%;height:72vh;border-radius:18px 18px 0 0;border-bottom:0}
 #cad-bar-row{right:8px;left:8px;bottom:150px;justify-content:center}
 .cad-btn{padding:9px 12px;font-size:13px}
}
#relics-quote-text.cad-fade{transition:opacity 1.6s ease;}
#relics-quote.cad-q{text-align:center}
#relics-quote.cad-q #relics-quote-text{font-family:Georgia,"Times New Roman",serif;font-weight:300;color:#e8cf86;letter-spacing:.03em;
 text-shadow:0 0 14px rgba(120,160,200,.55)}
`;
const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

/* ---------------- DOM ---------------- */
const row = document.createElement("div"); row.id = "cad-bar-row";
row.innerHTML = `<button type="button" class="cad-btn" data-r="mjolnir">Talk to Mjolnir</button>
<button type="button" class="cad-btn watch" data-r="watch">Watch them talk</button>
<button type="button" class="cad-btn" data-r="caduceus" id="cad-talk-btn">Talk to the Caduceus</button>`;
const panel = document.createElement("section");
panel.id = "cad-panel"; panel.setAttribute("role", "dialog");
panel.innerHTML = `<header><span id="cad-title">⚚ The Caduceus</span><button id="cad-close" aria-label="Close">×</button></header>
<div id="cad-load"><div id="cad-load-t">Waking the mind… one-time download (~350–500 MB), cached after.</div><div id="cad-pbar"><i></i></div></div>
<div id="cad-log"></div>
<form id="cad-form"><textarea id="cad-in" placeholder="Ask…" maxlength="600"></textarea><button id="cad-send" class="cad-red" type="submit" disabled>Send</button></form>
<div id="cad-watchbar"><button type="button" id="cad-stop" class="cad-red">Stop</button><button type="button" id="cad-new" class="cad-steel">New topic</button></div>`;
document.body.append(row, panel);
const $ = (s) => panel.querySelector(s);
const log = $("#cad-log"), input = $("#cad-in"), send = $("#cad-send"), loadBox = $("#cad-load"),
  loadT = $("#cad-load-t"), bar = $("#cad-pbar i"), title = $("#cad-title");
["pointerdown", "pointermove", "pointerup", "wheel"].forEach((e) => {
  panel.addEventListener(e, (ev) => ev.stopPropagation());
  row.addEventListener(e, (ev) => ev.stopPropagation());
});

function addMsg(cls, text, label) {
  const d = document.createElement("div"); d.className = "cad-m " + cls;
  if (label) { const b = document.createElement("b"); b.textContent = label; d.appendChild(b); }
  const sp = document.createElement("span"); sp.textContent = text; d.appendChild(sp);
  log.appendChild(d); log.scrollTop = log.scrollHeight; return sp;
}

/* ---------------- Relics visibility ---------------- */
function relicsVisible() {
  const w = document.getElementById("canvas-wrap");
  if (!w) return false;
  const r = w.getBoundingClientRect();
  return r.width > 50 && r.height > 50 && getComputedStyle(w).visibility !== "hidden";
}
setInterval(() => {
  const v = relicsVisible();
  row.style.display = v && !panel.classList.contains("open") ? "flex" : "none";
  if (!v && panel.classList.contains("open")) closePanel();
}, 700);

/* ---------------- shared engine (one download for both relics) ---------------- */
let engine = null, kind = null, loading = null, busy = false;

function progress(p, text) {
  bar.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + "%";
  if (text) loadT.textContent = text;
}
async function loadWebLLM() {
  const webllm = await import("https://esm.run/@mlc-ai/web-llm");
  const eng = await webllm.CreateMLCEngine(WEBLLM_MODEL, {
    initProgressCallback: (r) => progress(r.progress || 0, "One-time download, cached after: " + (r.text || "")),
  });
  return {
    async *stream(messages, opt = {}) {
      const chunks = await eng.chat.completions.create({ messages, stream: true, max_tokens: opt.max || MAX_TOKENS, temperature: opt.temp || 0.7 });
      for await (const c of chunks) { const t = c.choices?.[0]?.delta?.content; if (t) yield t; }
    },
  };
}
async function loadTransformers() {
  const T = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3");
  const files = {};
  const gen = await T.pipeline("text-generation", TFJS_MODEL, {
    dtype: "q4", device: "wasm",
    progress_callback: (e) => {
      if (e.status === "progress" && e.total) {
        files[e.file] = [e.loaded, e.total];
        const v = Object.values(files); const l = v.reduce((a, b) => a + b[0], 0), t = v.reduce((a, b) => a + b[1], 0);
        progress(l / t, "No WebGPU here, using the slower CPU mind. One-time download, cached after…");
      }
    },
  });
  return {
    async *stream(messages, opt = {}) {
      const q = []; let done = false, wake = null;
      const streamer = new T.TextStreamer(gen.tokenizer, { skip_prompt: true, skip_special_tokens: true,
        callback_function: (t) => { q.push(t); wake && wake(); } });
      const p = gen(messages, { max_new_tokens: opt.max || MAX_TOKENS, do_sample: true, temperature: opt.temp || 0.7, streamer })
        .finally(() => { done = true; wake && wake(); });
      while (!done || q.length) {
        if (q.length) { yield q.shift(); continue; }
        await new Promise((r) => (wake = r)); wake = null;
      }
      await p;
    },
  };
}
function ensureEngine() {
  if (engine) return Promise.resolve(engine);
  if (loading) return loading;
  loadBox.style.display = "block";
  loading = (async () => {
    if (navigator.gpu) {
      try {
        const a = await navigator.gpu.requestAdapter();
        if (a) { engine = await loadWebLLM(); kind = "webgpu"; }
      } catch (e) { console.warn("[relic-mind] WebLLM failed, trying CPU mind", e); }
    }
    if (!engine) {
      try { engine = await loadTransformers(); kind = "wasm"; }
      catch (e) { console.warn("[relic-mind] transformers.js failed", e); }
    }
    if (!engine) {
      loadT.textContent = "Your browser can't run the mind yet. Try a recent Chrome or Edge on a PC or Android phone.";
      bar.parentElement.style.display = "none";
      throw new Error("no-engine");
    }
    loadBox.style.display = "none";
    send.disabled = false;
    window.dispatchEvent(new CustomEvent("caduceus-mind-ready", { detail: { kind } }));
    freshQuote();
    return engine;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}
if (engine === null) loadBox.style.display = "none";

/* ---------------- chat (separate history per relic) ---------------- */
const chats = { caduceus: [], mjolnir: [] }; // [{role, content}]
let mode = "caduceus"; // "caduceus" | "mjolnir" | "watch"

function renderChat(id) {
  log.innerHTML = "";
  const r = RELICS[id];
  addMsg("bot", r.greeting, r.name);
  for (const m of chats[id]) addMsg(m.role === "user" ? "me" : "bot", m.content, m.role === "user" ? null : r.name);
}
function openPanel(id) {
  if (mode === "watch" && id !== "watch") stopWatch();
  mode = id;
  panel.classList.add("open"); row.style.display = "none";
  panel.classList.toggle("watch", id === "watch");
  if (id === "watch") { title.textContent = "⚒ Mjolnir & the Caduceus ⚚"; startWatch(); }
  else { const r = RELICS[id]; title.textContent = r.icon + " " + r.name; input.placeholder = r.ph; renderChat(id);
    setTimeout(() => input.focus(), 50); }
  if (!engine) loadBox.style.display = "block";
  ensureEngine().catch(() => {});
}
function closePanel() { panel.classList.remove("open"); if (mode === "watch") stopWatch(); }
row.addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) openPanel(b.dataset.r); });
$("#cad-close").addEventListener("click", closePanel);
window.addEventListener("caduceus-talk", () => openPanel("caduceus"));
window.addEventListener("mjolnir-talk", () => openPanel("mjolnir"));

async function ask(text) {
  const id = mode;
  if (busy || !text.trim() || !RELICS[id]) return;
  busy = true; send.disabled = true;
  const r = RELICS[id], hist = chats[id];
  addMsg("me", text); hist.push({ role: "user", content: text });
  const out = addMsg("bot", "…", r.name);
  think(id, true);
  let reply = "";
  try {
    await ensureEngine();
    const msgs = [{ role: "system", content: r.persona }, ...hist.slice(-8)];
    for await (const t of engine.stream(msgs)) { reply += t; out.textContent = reply; log.scrollTop = log.scrollHeight; }
    reply = reply.trim() || "Ask me again?";
    out.textContent = reply; hist.push({ role: "assistant", content: reply });
    SFX[id].say.play();
  } catch (e) {
    console.warn("[relic-mind]", e);
    out.textContent = engine ? "The mind slipped for a moment. Try again?" : "The mind can't wake in this browser.";
    hist.pop();
  } finally {
    think(id, false); busy = false; send.disabled = !engine;
  }
}
$("#cad-form").addEventListener("submit", (e) => { e.preventDefault(); const v = input.value; input.value = ""; ask(v); });
input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#cad-form").requestSubmit(); } });

/* ---------------- Watch them talk ---------------- */
let watchRun = 0;
const WATCH_TURNS = 12;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
function stopWatch() { watchRun++; think("caduceus", false); think("mjolnir", false); busy = false; $("#cad-stop").disabled = true; }
$("#cad-stop").addEventListener("click", () => { stopWatch(); addMsg("me", "Stopped. Tap New topic to watch again."); });
$("#cad-new").addEventListener("click", () => { stopWatch(); startWatch(); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function startWatch() {
  const run = ++watchRun;
  log.innerHTML = ""; $("#cad-stop").disabled = false;
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  addMsg("me", "Topic: " + topic);
  try { await ensureEngine(); } catch (_) { return; }
  if (run !== watchRun) return;
  while (busy && run === watchRun) await wait(300);
  const lines = []; // {who, text}
  const seen = new Set();
  let who = Math.random() < 0.5 ? "mjolnir" : "caduceus";
  for (let turn = 0; turn < WATCH_TURNS && run === watchRun; turn++) {
    const me = RELICS[who], other = RELICS[who === "mjolnir" ? "caduceus" : "mjolnir"];
    const sys = me.persona + DUO_ADD(other.short);
    const msgs = [{ role: "system", content: sys }];
    if (!lines.length) msgs.push({ role: "user", content: `Open a friendly conversation with ${other.short} about ${topic}. 1 to 2 sentences.` });
    else for (const l of lines.slice(-6)) msgs.push({ role: l.who === who ? "assistant" : "user", content: l.text });
    busy = true; think(who, true);
    const out = addMsg(who, "…", me.name);
    let text = "";
    for (let tries = 0; tries < 3 && run === watchRun; tries++) {
      text = "";
      try { for await (const t of engine.stream(msgs, { max: 90, temp: 0.85 })) { if (run !== watchRun) break; text += t; out.textContent = text; log.scrollTop = log.scrollHeight; } }
      catch (e) { console.warn("[relic-mind] watch", e); }
      text = text.trim();
      if (text && !BANNED.test(text) && !seen.has(norm(text))) break;
      text = ""; out.textContent = "…";
    }
    think(who, false); busy = false;
    if (run !== watchRun) return;
    if (!text) { out.parentElement.remove(); break; }
    out.textContent = text; seen.add(norm(text)); lines.push({ who, text });
    SFX[who].say.play();
    who = who === "mjolnir" ? "caduceus" : "mjolnir";
    await wait(1400);
  }
  if (run === watchRun) { addMsg("me", "They rest for now. Tap New topic for another round."); $("#cad-stop").disabled = true; }
}

/* ---------------- Relics quote ---------------- */
const qBox = document.getElementById("relics-quote");
const qText = document.getElementById("relics-quote-text");
const qBy = document.getElementById("relics-quote-by");
let qList = RELICS_QUOTES.slice(), qi = Math.floor(Math.random() * qList.length), freshDone = false;
function showQuote(text) {
  if (!qText) return;
  qText.classList.add("cad-fade"); qText.style.opacity = "0";
  setTimeout(() => { qText.textContent = text; if (qBy) qBy.textContent = "— the Caduceus"; qText.style.opacity = "1"; }, 1600);
}
if (qBox && qText) {
  window.CaduceusQuotes = { list: qList };
  qBox.classList.add("cad-q");
  if (qBox.dataset.off !== "1") qBox.hidden = false;
  qText.textContent = qList[qi]; if (qBy) qBy.textContent = "— the Caduceus";
  setInterval(() => { qi = (qi + 1) % qList.length; showQuote(qList[qi]); }, 12000);
}
async function freshQuote() {
  if (freshDone || !engine || !qText || busy) return; freshDone = true; busy = true; send.disabled = true;
  try {
    let s = "";
    const msgs = [{ role: "system", content: "You write one short, clean, wise one-line saying (under 16 words) about balance, healing, wisdom, 'as above, so below', or the Creator's order. Output only the saying, no quotes." },
      { role: "user", content: "One new saying." }];
    for await (const t of engine.stream(msgs)) { s += t; if (s.length > 160) break; }
    s = s.trim().replace(/^["'“”]+|["'“”]+$/g, "").split("\n")[0];
    if (s.length > 8 && s.length < 140 && !BANNED.test(s)) { qList.splice(qi + 1, 0, s); qi++; showQuote(s); }
  } catch (_) {} finally { busy = false; send.disabled = false; }
}


// test hooks: ?cadtalk=1 opens Caduceus chat, ?relictalk=watch opens Watch mode
if (/[?&]cadtalk=1/.test(location.search)) setTimeout(() => openPanel("caduceus"), 1200);
{ const m = location.search.match(/[?&]relictalk=(watch|mjolnir|caduceus)/); if (m) setTimeout(() => openPanel(m[1]), 1200); }
