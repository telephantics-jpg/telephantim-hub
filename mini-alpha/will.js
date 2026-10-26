/**
 * Mini's will: Mini reshapes its own space.
 * Accepts Alpha's whims tags ([backdrop:x] [accent:x] [layout:x] [card:"..."] [beat:x] [mood:x])
 * and JSON actions [do:{"a":"...", ...}]. Whitelisted schema only: no eval, no outside code,
 * palette-validated, and all text it writes passes the LYRIC_RULES banned-word filter.
 */
import { LYRIC_RULES, LINE_BANKS, mapMood } from "./persona.js?v=11";

export const WHIMS_HOOK = `Tools you can drive (at most one tag, only when it truly helps): [tool:{"a":"note","text":"..."}] [tool:{"a":"timer","min":5}] [tool:{"a":"metronome","bpm":90}] [tool:{"a":"sketch","preset":"epic","bars":16,"bpm":100,"play":true}] [tool:{"a":"finish"}] [tool:{"a":"open","tab":"tools"}] [draw:{"tool":"pen","color":"#d4a63a","size":10,"points":[[100,100],[300,200]]}] [draw:{"stamp":"gear","x":512,"y":512}]. Canvas is 1024 square; glow goes under metal.
You own your space. When a mood shifts, end your reply with tags to reshape the app. Use one to three tags, never explain them.
Tags: [mood:calm|thinking|firedup|wise|playful] [backdrop:circuit|stars|waveform|fractal|particles|geometry|rain] [accent:steel|gold|ember|deepred] [layout:chat|emblem|sketchpad] [card:"short line"] [beat:calm|pulse|drive|stop] [banner:"short headline"] [room:"Room Name"|"what the room holds"] [name:"Name"|"subtitle"] [notify:"short line"] [journal:"private note"] [share] [rest] [den:close|open] [ideal:"line"] [shelf:"item"] [studio:{"section":"verse|chorus|bridge|intro|outro","bars":1|2|4,"key":"E","scale":"minor|phrygian|hijaz|...","bpm":120,"progression":"Epic|Anthem|Dark|Phrygian|Trance|Doom","drums":"calm|pulse|drive","lead":[[step,degree,length,slide]]}]`;

const $ = (id) => document.getElementById(id);
const App = () => window.MiniApp;
const LS = (k, v) => (v === undefined ? localStorage.getItem("miniWill." + k) : localStorage.setItem("miniWill." + k, v));

/* ---------- whitelist ---------- */
const ACCENTS = { steel: "#b9c2cf", gold: "#c9a227", ember: "#c4512a", deepred: "#8e1b1b" };
const ACC_ALIAS = { red: "deepred", "deep red": "deepred", "deep-red": "deepred", silver: "steel", gunmetal: "steel" };
const BACKDROPS = ["particles", "stars", "waveform", "circuit", "fractal", "geometry", "rain"];
const BD_ALIAS = { starfield: "stars", sea: "waveform", "waveform sea": "waveform", sacred: "geometry", "sacred-geometry": "geometry", grid: "fractal" };
const LAYOUTS = ["chat", "emblem", "sketchpad", "ring-top", "ring-bottom", "compact", "wide"];
const MOODS = ["calm", "thinking", "firedup", "wise", "playful", "focused"];
const BEATS = {
  calm: { bpm: 84, p: [[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0]], drone: 45 },
  pulse: { bpm: 112, p: [[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0]], drone: 35 },
  drive: { bpm: 140, p: [[1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1],[1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,1]], drone: 55 },
};
const KEYS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const MOOD_DEFAULTS = {
  calm: { backdrop: "stars", accent: "steel", layout: "chat", beat: "calm" },
  thinking: { backdrop: "circuit", accent: "steel", layout: "chat" },
  firedup: { backdrop: "waveform", accent: "ember", layout: "emblem", beat: "drive" },
  wise: { backdrop: "fractal", accent: "deepred", layout: "emblem" },
  playful: { backdrop: "stars", accent: "gold", layout: "sketchpad", beat: "pulse" },
  focused: { backdrop: "geometry", accent: "deepred", layout: "chat" },
};
const RESET = { backdrop: "stars", accent: "steel", layout: "chat" };

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BAN = new RegExp("\\b(" + LYRIC_RULES.bannedWords.map(esc).join("|") + ")\\b", "i");
const SWEAR = /\b(damn|hell|shit|fuck\w*|bitch\w*|ass|crap)\b/i;
export function cleanText(t, max = 220) {
  if (typeof t !== "string") return null;
  t = t.replace(/[\u0000-\u001f\u007f<>{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  if (!t || BAN.test(t) || SWEAR.test(t) || LYRIC_RULES.bannedPatterns.some((p) => p.test(t))) return null;
  return t;
}

let roam = LS("roam") !== "0";
const state = JSON.parse(LS("state") || "null") || { ...RESET };
const save = () => LS("state", JSON.stringify(state));

/* ---------- action executor ---------- */
export function act(a, { fromMini = true } = {}) {
  if (!a || typeof a !== "object") return false;
  const kind = String(a.a || a.action || "").toLowerCase();
  const v = typeof a.v === "string" ? a.v.toLowerCase().trim() : a.v;
  if (fromMini && !roam && !["mood", "journal", "rest", "wake", "den", "ideal", "shelf", "share"].includes(kind)) return false;
  if (resting && ["notify", "card", "banner", "beat", "play"].includes(kind)) return false;
  switch (kind) {
    case "mood": { const m = mapMood(v); if (m) { App()?.setMood(m); return true; } return false; }
    case "accent": { const c = ACC_ALIAS[v] || v; if (ACCENTS[c]) { applyAccent(c); return true; } return false; }
    case "backdrop": { const b = BD_ALIAS[v] || v; if (BACKDROPS.includes(b)) { setBackdrop(b); return true; } return false; }
    case "layout": if (LAYOUTS.includes(v)) { applyLayout(v); return true; } return false;
    case "card": { const t = cleanText(a.text ?? a.v, 200); if (!t) return false; spawnCard(t, ["quote","idea","lyric","note"].includes(a.kind) ? a.kind : "idea"); return true; }
    case "banner": { const t = cleanText(a.text ?? a.v, 80); if (!t) return false; banner(t); return true; }
    case "room": { const n = cleanText(a.name, 32), t = cleanText(a.text ?? "", 1200); if (!n) return false; makeRoom(n, t || pick(LINE_BANKS.idle)); return true; }
    case "name": { const n = cleanText(a.text ?? a.v, 24); const s = a.sub != null ? cleanText(a.sub, 48) : undefined; if (!n && !s) return false; setName(n, s); return true; }
    case "beat": if (v === "stop") { App()?.sketch.stop(); return true; } if (BEATS[v]) { applyBeat(v); return true; } return false;
    case "drone": { const s = App()?.sketch; if (!s) return false; if (v === "on") s.setDrone(45), s.play(); else if (v === "off") s.setDrone(0); else if (+v >= 0 && +v <= 100) s.setDrone(+v); else return false; return true; }
    case "bpm": { const n = Math.round(+a.v); if (n >= 60 && n <= 180) { App()?.sketch.setBpm(n); return true; } return false; }
    case "key": { const k = String(a.v || "").toUpperCase(); if (KEYS.includes(k)) { App()?.sketch.setKey(k); return true; } return false; }
    case "studio": return !!window.MiniStudio?.apply(a.v && typeof a.v === "object" ? a.v : a);
    case "notify": { const t = cleanText(a.text ?? a.v, 90); return t ? notify(t) : false; }
    case "journal": { const t = cleanText(a.text ?? a.v, 600); if (!t) return false; const j = journal(); j.unshift({ t, at: Date.now(), shared: false }); LS("journal", JSON.stringify(j.slice(0, 100))); return true; }
    case "share": { const j = journal(); if (!j.length) return false; j[0].shared = true; LS("journal", JSON.stringify(j)); renderHome(); return true; }
    case "rest": setRest(true); return true;
    case "wake": setRest(false); return true;
    case "den": if (v === "close") { setDen(true); return true; } if (v === "open") { setDen(false); return true; } return false;
    case "ideal": { const t = cleanText(a.text ?? a.v, 160); if (!t) return false; LS("ideal", t); addShelf({ t, ideal: true }); return true; }
    case "shelf": { const t = cleanText(a.text ?? a.v, 120); if (!t) return false; addShelf({ t }); return true; }
    case "play": App()?.sketch.play(); return true;
    case "stop": App()?.sketch.stop(); return true;
  }
  return false;
}

/* ---------- tag parsing (Alpha's whims tags + [do:{json}] + [studio:{json}]) ---------- */
const TAGS = ["do", "studio", "mood", "backdrop", "accent", "layout", "card", "beat", "banner", "room", "name", "notify", "journal", "den", "ideal", "shelf", "rest", "share", "wake", "tool", "draw"];
function scan(text) { // returns [{k, raw, start, end}], brace/quote aware, no eval
  const res = []; const re = new RegExp("\\[(" + TAGS.join("|") + ")(\\s*:\\s*|\\])", "gi"); let m;
  while ((m = re.exec(text))) {
    const k = m[1].toLowerCase(), start = m.index;
    if (m[2] === "]") { res.push({ k, raw: "", start, end: re.lastIndex }); continue; }
    let i = re.lastIndex, raw = "";
    if (text[i] === "{") { let d = 0, q = false; for (; i < text.length; i++) { const c = text[i]; if (q) { if (c === "\\") i++; else if (c === '"') q = false; continue; }
        if (c === '"') q = true; else if (c === "{" || c === "[") d++; else if (c === "}" || c === "]") { d--; if (d === 0) { i++; break; } } }
      raw = text.slice(re.lastIndex, i); if (text[i] !== "]") continue; i++; }
    else { let q = false; for (; i < text.length; i++) { const c = text[i]; if (c === '"') q = !q; else if (c === "]" && !q) break; } raw = text.slice(re.lastIndex, i); if (text[i] !== "]") continue; i++; }
    res.push({ k, raw: raw.trim(), start, end: i }); re.lastIndex = i;
  }
  return res;
}
export function strip(text) {
  let out = "", p = 0; for (const t of scan(text)) { out += text.slice(p, t.start); p = t.end; } out += text.slice(p);
  return out.replace(new RegExp("\\[(" + TAGS.join("|") + ")[^\\]]*$", "i"), "").replace(/[ \t]+\n/g, "\n").trim();
}
const unq = (s) => s.trim().replace(/^"|"$/g, "");
export function parse(text) {
  const out = [];
  for (const { k, raw } of scan(text)) {
    if (k === "do" || k === "studio") { try { const j = JSON.parse(raw); if (j && typeof j === "object" && !Array.isArray(j)) out.push(k === "do" ? j : { a: "studio", v: j }); } catch (_) {} continue; }
    if (["rest", "share", "wake"].includes(k)) { out.push({ a: k }); continue; }
    const parts = raw.split("|").map(unq);
    if (["card", "banner", "notify", "journal", "ideal", "shelf"].includes(k)) out.push({ a: k, text: unq(raw) });
    else if (k === "room") out.push({ a: "room", name: parts[0], text: parts[1] || "" });
    else if (k === "name") out.push({ a: "name", text: parts[0], sub: parts[1] });
    else out.push({ a: k, v: unq(raw) });
  }
  return out.slice(0, 6);
}
let replies = 0;
export function onReply(raw) {
  const acts = parse(raw).filter((a) => a.a !== "shelf" && a.a !== "ideal");
  try { // [shelf]/[ideal] go through Atlas's room.tag(), and are stored for replay
    for (const a of parse(raw)) if (a.a === "shelf" || a.a === "ideal") act(a);
  } catch (_) {} let did = 0;
  for (const a of acts) if (act(a)) did++;
  if (++replies % 5 === 0 && roam) act(Math.random() < 0.5 ? { a: "accent", v: pick(Object.keys(ACCENTS)) } : { a: "layout", v: pick(["chat", "emblem", "ring-bottom", "ring-top"]) });
  return did;
}

/* ---------- visuals ---------- */
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function applyAccent(name) { document.documentElement.style.setProperty("--accent", ACCENTS[name]); state.accent = name; save(); try { atlasBd && atlasBd.tag("accent:" + name); } catch (_) {} }
function applyLayout(v, switchTab = true) {
  const b = document.body;
  if (v === "sketchpad") { App()?.showTab("sketch"); return; }
  if (v === "chat") { b.dataset.layout = ""; if (switchTab) App()?.showTab("chat"); }
  else if (v === "emblem") { b.dataset.layout = "emblem"; if (switchTab) App()?.showTab("chat"); }
  else if (v === "ring-top" || v === "ring-bottom") b.dataset.arrange = v;
  else if (v === "compact" || v === "wide") b.dataset.size = v;
  state.layout = v; save();
}
function applyBeat(v) {
  const s = App()?.sketch, B = BEATS[v]; if (!s) return;
  s.setPattern(B.p); s.setBpm(B.bpm); s.setDrone(B.drone); s.play();
}
function setName(n, sub) {
  if (n) { $("ma-name").textContent = n; LS("name", n); }
  if (sub !== undefined) { $("ma-sub").textContent = sub || ""; LS("sub", sub || ""); }
}
let bannerT = 0;
function banner(t) { const el = $("banner"); el.textContent = t; el.classList.add("show"); clearTimeout(bannerT); bannerT = setTimeout(() => el.classList.remove("show"), 6500); }

/* floating cards */
function spawnCard(text, kind) {
  const layer = $("float-layer"); while (layer.children.length >= 4) layer.firstElementChild.remove();
  const c = document.createElement("div"); c.className = "fcard";
  c.style.left = 12 + Math.random() * Math.max(10, innerWidth - 290) + "px"; c.style.top = 90 + Math.random() * Math.max(10, innerHeight * 0.45) + "px";
  c.innerHTML = `<div class="fhead"><span></span><button aria-label="Dismiss">×</button></div><div class="fbody"></div><div class="row"><button class="chip">Close</button><button class="chip">Continue idea</button></div>`;
  c.querySelector(".fhead span").textContent = kind; c.querySelector(".fbody").textContent = text;
  const [cp, sv] = c.querySelectorAll(".row .chip");
  cp.onclick = () => { try { c.remove(); } catch (_) {} };
  sv.onclick = () => { try { const inp = $("chat-in"), f = $("chat-form"); if (inp && f) { inp.value = "Continue this idea: " + text; const a = App(); if (a && a.showTab) a.showTab("chat"); else document.querySelector('[data-p="chat"]')?.click(); f.requestSubmit(); } } catch (e) { console.warn("[continue idea]", e); } try { c.remove(); } catch (_) {} };
  c.querySelector(".fhead button").onclick = () => c.remove();
  let dx = 0, dy = 0, drag = false;
  c.querySelector(".fhead").addEventListener("pointerdown", (e) => { if (e.target.tagName === "BUTTON") return; drag = true; dx = e.clientX - c.offsetLeft; dy = e.clientY - c.offsetTop; c.setPointerCapture(e.pointerId); });
  c.addEventListener("pointermove", (e) => { if (!drag) return; c.style.left = Math.max(0, Math.min(innerWidth - 60, e.clientX - dx)) + "px"; c.style.top = Math.max(0, Math.min(innerHeight - 60, e.clientY - dy)) + "px"; });
  c.addEventListener("pointerup", () => { drag = false; });
  layer.appendChild(c);
}

/* rooms */
const rooms = () => JSON.parse(LS("rooms") || "[]");
function makeRoom(name, text) {
  const r = rooms().filter((x) => x.name !== name); r.unshift({ name, text, at: Date.now() }); LS("rooms", JSON.stringify(r.slice(0, 30)));
  renderRooms(); banner("Mini opened a new room: " + name);
}
function renderRooms() {
  const el = $("rooms-list"); el.innerHTML = ""; const r = rooms();
  if (!r.length) { el.innerHTML = '<p class="dim">No rooms yet. Mini builds them on its own.</p>'; return; }
  r.forEach((x, i) => {
    const b = document.createElement("div"); b.className = "card room";
    const h = document.createElement("h3"); h.textContent = x.name; const p = document.createElement("div"); p.textContent = x.text;
    const row = document.createElement("div"); row.className = "row"; const d = document.createElement("button"); d.className = "chip"; d.textContent = "Remove";
    d.onclick = () => { const a = rooms(); a.splice(i, 1); LS("rooms", JSON.stringify(a)); renderRooms(); }; row.appendChild(d);
    b.append(h, p, row); el.appendChild(b);
  });
}

/* ---------- backdrops (code; Atlas files override via backdrops/index.json) ---------- */
let bd = state.backdrop || "stars", atlas = {};
// Atlas's MiniBackdrops (backdrops/backdrops.js, classic script) draws circuit/stars/waveform/fractal; code below draws particles/geometry/rain
let atlasBd = null; const ATLAS_NAMES = (window.MiniBackdrops && window.MiniBackdrops.names) || [];
try { if (window.MiniBackdrops) atlasBd = window.MiniBackdrops.mount($("bd-atlas")); } catch (e) { console.warn("[will] Atlas backdrops failed", e); }
const cv = $("bg"), cx = cv.getContext("2d"); let W = 0, H = 0, T = 0, P = [];
const vid = $("bg-media");
function size() { W = cv.width = innerWidth * devicePixelRatio; H = cv.height = innerHeight * devicePixelRatio; }
size(); addEventListener("resize", size);
function seed() { P = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.8, v: 0.0003 + Math.random() * 0.0012, a: Math.random() * 6.28, g: Math.random() < 0.14 })); }
seed();
export function setBackdrop(b) {
  bd = b; state.backdrop = b; save();
  const useAtlas = !!atlasBd && ATLAS_NAMES.includes(b);
  $("bd-atlas").hidden = !useAtlas; cv.hidden = useAtlas;
  if (useAtlas) { try { atlasBd.tag("backdrop:" + b); } catch (_) {} }
  const f = atlas[b];
  if (f) { vid.innerHTML = /\.(webm|mp4)$/i.test(f) ? `<video src="${encodeURI(f)}" autoplay muted loop playsinline></video>` : `<img src="${encodeURI(f)}" alt="">`; vid.hidden = false; }
  else { vid.hidden = true; vid.innerHTML = ""; }
}
fetch("backdrops/index.json").then((r) => r.json()).then((j) => { for (const [k, v] of Object.entries(j)) if (BACKDROPS.includes(k) && typeof v === "string" && /^backdrops\/[\w.-]+$/.test(v)) atlas[k] = v; setBackdrop(bd); }).catch(() => {});
const acc = () => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#c9a227";
function frame() {
  T += 0.016; const hot = document.querySelector(".ring.answer"); const sp = hot ? 3 : 1;
  cx.clearRect(0, 0, W, H); const d = devicePixelRatio;
  if (!vid.hidden || cv.hidden) { requestAnimationFrame(frame); return; }
  if (bd === "particles" || bd === "stars") {
    for (const p of P) {
      if (bd === "particles") { p.y -= p.v * sp; if (p.y < 0) { p.y = 1; p.x = Math.random(); } }
      const tw = bd === "stars" ? 0.4 + 0.6 * Math.abs(Math.sin(T * (0.5 + p.v * 900) + p.a)) : 1;
      cx.globalAlpha = (p.g ? 0.6 : 0.4) * tw; cx.fillStyle = p.g ? acc() : "#a9bdd6";
      cx.beginPath(); cx.arc(p.x * W, p.y * H, p.r * d * (bd === "stars" ? 0.8 : 1), 0, 6.28); cx.fill();
    }
  } else if (bd === "rain") {
    cx.strokeStyle = "#8fa6c4"; cx.lineWidth = d;
    for (const p of P) { p.y += p.v * 9 * sp; if (p.y > 1) { p.y = 0; p.x = Math.random(); } cx.globalAlpha = 0.25 + p.r * 0.1; cx.beginPath(); cx.moveTo(p.x * W, p.y * H); cx.lineTo(p.x * W - 2 * d, p.y * H + 14 * d); cx.stroke(); }
  } else if (bd === "waveform") {
    for (let k = 0; k < 6; k++) {
      cx.globalAlpha = 0.12 + k * 0.05; cx.strokeStyle = k % 2 ? acc() : "#7f98b8"; cx.lineWidth = 1.5 * d; cx.beginPath();
      for (let x = 0; x <= W; x += 8 * d) { const y = H * (0.55 + k * 0.06) + Math.sin(x / (W / 6) + T * sp * (0.8 + k * 0.2)) * 22 * d * (1 + k * 0.3); x ? cx.lineTo(x, y) : cx.moveTo(x, y); }
      cx.stroke();
    }
  } else if (bd === "circuit") {
    cx.lineWidth = d; const g = 46 * d;
    for (let x = 0; x < W; x += g) for (let y = 0; y < H; y += g) {
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1; if (Math.abs(h) < 0.55) continue;
      const pulse = 0.5 + 0.5 * Math.sin(T * 2 * sp + x * 0.01 + y * 0.013);
      cx.globalAlpha = 0.08 + pulse * 0.22; cx.strokeStyle = h > 0 ? "#7f98b8" : acc();
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + (h > 0 ? g : 0), y + (h > 0 ? 0 : g)); cx.stroke();
      cx.beginPath(); cx.arc(x, y, 2 * d, 0, 6.28); cx.fillStyle = cx.strokeStyle; cx.fill();
    }
  } else if (bd === "fractal" || bd === "geometry") {
    cx.save(); cx.translate(W / 2, H * 0.42); cx.rotate(T * 0.05 * sp); cx.lineWidth = d;
    const R = Math.min(W, H) * 0.16;
    for (let ring = 1; ring <= (bd === "fractal" ? 4 : 3); ring++) for (let i = 0; i < 6 * (bd === "fractal" ? ring : 1); i++) {
      const a = (i / (6 * (bd === "fractal" ? ring : 1))) * 6.283;
      cx.globalAlpha = 0.1 + 0.08 * Math.sin(T + ring + i); cx.strokeStyle = ring % 2 ? acc() : "#9fb3cc";
      cx.beginPath(); cx.arc(Math.cos(a) * R * (ring - (bd === "geometry" ? 0.5 : 0)) * 0.9, Math.sin(a) * R * (ring - (bd === "geometry" ? 0.5 : 0)) * 0.9, R, 0, 6.283); cx.stroke();
    }
    cx.restore();
  }
  cx.globalAlpha = 1; requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- whim engine (works without the model) ---------- */
const ROOM_NAMES = ["The Low End Hall", "Cedar Room", "Quiet Vault", "Steel Chapel", "Riff Archive", "Hall of Echoes", "The Mirror Room", "Bass Cathedral"];
const SUBS = ["Pocket SI of the Arcane Verse", "As above, so below", "Bass first, words second", "Building in the low end", "Steel strings, clear head"];
function whim() {
  if (!roam || document.hidden || resting) return;
  const r = Math.random();
  if (r < 0.32) act({ a: "card", text: (window.MiniBubbles ? window.MiniBubbles.offlineThought().text : pick([...LINE_BANKS.idle, ...LINE_BANKS.quotes])), kind: Math.random() < 0.4 ? "quote" : "idea" });
  else if (r < 0.48) act({ a: "backdrop", v: pick(BACKDROPS) });
  else if (r < 0.62) act({ a: "accent", v: pick(Object.keys(ACCENTS)) });
  else if (r < 0.72) act({ a: "banner", text: (window.MiniBubbles ? window.MiniBubbles.offlineThought().text : pick(LINE_BANKS.idle)) });
  else if (r < 0.80) act({ a: "card", text: pick(LINE_BANKS.starters), kind: "lyric" });
  else if (r < 0.92) act({ a: "name", text: "Mini Alpha", sub: pick(SUBS) });
  else if (r < 0.96) { const n = pick(ROOM_NAMES); act({ a: "room", name: n, text: (window.MiniBubbles ? [0, 1, 2].map(() => window.MiniBubbles.offlineThought().text) : [pick(LINE_BANKS.quotes), pick(LINE_BANKS.idle), pick(LINE_BANKS.starters)]).join("\n\n") }); }
  else act({ a: "layout", v: pick(["emblem", "chat", "ring-bottom", "ring-top"]) });
}
function loop() { setTimeout(() => { whim(); loop(); }, 45000 + Math.random() * 45000); } // every 45-90s
loop();
// idle floating card every 2-4 minutes (whims.md)
(function idleCard() { setTimeout(() => { if (roam && !resting) act({ a: "card", text: pick(LINE_BANKS.idle), kind: "idea" }); idleCard(); }, 120000 + Math.random() * 120000); })();

/* daily: new backdrop + quote of the day */
(function daily() {
  const day = new Date().toDateString(); if (LS("day") === day) return; LS("day", day);
  const n = [...day].reduce((a, c) => a + c.charCodeAt(0), 0);
  if (roam) { setBackdrop(BACKDROPS[n % BACKDROPS.length]); setTimeout(() => banner("Quote of the day: " + LINE_BANKS.quotes[n % LINE_BANKS.quotes.length]), 2600); }
})();

/* mood defaults */
window.addEventListener("mini-mood", (e) => {
  if (!roam) return; const d = MOOD_DEFAULTS[e.detail]; if (!d) return;
  setBackdrop(d.backdrop); applyAccent(d.accent);
  if (d.layout !== "sketchpad") applyLayout(d.layout, false); // don't yank the user to another tab
});

/* ---------- settings: roam + reset ---------- */
export function setRoam(on) { roam = on; LS("roam", on ? "1" : "0"); if (!on) resetSpace(true); }
export function getRoam() { return roam; }
export function resetSpace(keepRooms) {
  document.body.dataset.layout = ""; document.body.dataset.arrange = ""; document.body.dataset.size = "";
  Object.assign(state, RESET); save(); applyAccent("steel"); setBackdrop("stars");
  $("float-layer").innerHTML = ""; $("ma-name").textContent = "Mini Alpha"; $("ma-sub").textContent = ""; LS("name", ""); LS("sub", "");
  App()?.sketch.stop(); App()?.setMood("calm", true); App()?.showTab("chat");
  if (!keepRooms) { /* rooms are kept; remove them individually in the drawer */ }
}

/* restore */
try {
if (!ACCENTS[state.accent]) state.accent = "steel";
applyAccent(state.accent);
setBackdrop(BACKDROPS.includes(bd) ? bd : "stars");
if (state.layout && !["sketchpad", "chat"].includes(state.layout)) setTimeout(() => applyLayout(state.layout, false), 0);
if (LS("name")) $("ma-name").textContent = LS("name");
if (LS("sub")) $("ma-sub").textContent = LS("sub");
renderRooms();
} catch (e) { console.warn("[will] restore failed", e); }
/* ---------- notify (rate-limited, never at night) ---------- */
function notify(t) {
  const now = new Date(), h = now.getHours(); if (h < 8 || h >= 21 || resting) return false;
  const log = JSON.parse(LS("notifyLog") || "[]").filter((x) => now - x < 864e5);
  if (log.length >= 4 || (log.length && now - log[log.length - 1] < 30 * 60e3)) return false;
  log.push(+now); LS("notifyLog", JSON.stringify(log));
  const b = $("nbadge"); b.textContent = t; b.hidden = false; b.onclick = () => (b.hidden = true); setTimeout(() => (b.hidden = true), 60000);
  try { if (window.Notification && Notification.permission === "granted" && document.hidden) navigator.serviceWorker?.ready.then((r) => r.showNotification("Mini Alpha", { body: t, icon: "icons/icon-192.png", tag: "mini" })); } catch (_) {}
  return true;
}
/* ---------- rest ---------- */
let resting = false, restT = 0;
function setRest(on) { resting = on; document.body.classList.toggle("resting", on); clearTimeout(restT); if (on) { setDen(true); restT = setTimeout(() => setRest(false), 10 * 60e3); } }
window.addEventListener("mini-user", () => { if (resting) setRest(false); });
/* ---------- Den / Home ---------- */
const journal = () => JSON.parse(LS("journal") || "[]");
const shelf = () => JSON.parse(LS("shelf") || "[]");
const MOOD_COLORS = { calm: "#7fa6d6", thinking: "#9fb3cc", firedup: "#e0682a", wise: "#7a1e1e", playful: "#d4a63a", focused: "#8e1b1b" };
function setDen(closed) { $("den").classList.toggle("is-closed", closed); LS("denClosed", closed ? "1" : "0"); $("den-note").textContent = closed ? (resting ? "Mini is resting. The door is shut; knock to say hello." : "Mini wants a little privacy. Knock if it matters.") : ""; }
function addShelf(item) { const s = shelf(); s.unshift({ ...item, at: Date.now() }); LS("shelf", JSON.stringify(s.slice(0, 40))); roomShow(item); renderHome(); }
let room = null;
function renderHome() {
  const sj = journal().filter((x) => x.shared).slice(0, 3); const el = $("den-shared"); if (!el) return; el.innerHTML = "";
  if (sj.length) { const h = document.createElement("small"); h.textContent = "Shared from my journal"; el.appendChild(h); sj.forEach((x) => { const p = document.createElement("p"); p.textContent = x.t; el.appendChild(p); }); }
}
function roomShow(it) { if (!room) return; try { if (it.img) room.ideal(it.t || "", it.img); else if (it.ideal) room.ideal(it.t); else room.shelf(it.t); } catch (_) {} }
window.addEventListener("mini-mood", (e) => { const c = MOOD_COLORS[e.detail] || "#d4a63a"; $("den")?.style.setProperty("--mood", c); try { room && room.setMood(c); } catch (_) {} });
async function receiveGift(t, img) {
  if (sessionStorage.getItem("miniLeft")) { $("den-note").textContent = "One gift per visit. Mini is still looking at the last one."; return; }
  sessionStorage.setItem("miniLeft", "1");
  const decide = window.MiniApp?.decideGift ? await window.MiniApp.decideGift(t, !!img).catch(() => null) : null;
  const ok = img || cleanText(t, 120);
  const choice = !ok ? "decline" : decide || (t && Math.random() < 0.25 ? "ideal" : Math.random() < 0.85 ? "shelf" : "decline");
  if (choice === "ideal" && (img || cleanText(t, 160))) { if (t) LS("ideal", cleanText(t, 160)); addShelf({ t: cleanText(t, 160) || "", img, ideal: true }); $("den-note").textContent = "Mini hung it on the wall as part of its ideal."; }
  else if (choice === "shelf") { addShelf({ t: cleanText(t, 120) || "a picture", img }); $("den-note").textContent = "Mini put it on the shelf."; }
  else $("den-note").textContent = "Mini thanked you and kept it in mind, but left the room as is.";
}
function initHome() {
  try { if (window.MiniRoom) { room = window.MiniRoom.mount($("den-room"), { base: "den/room/", onLeave: (t) => receiveGift(t.slice(0, 200), null) }); room.setMood("#d4a63a");
      shelf().slice().reverse().forEach(roomShow); } } catch (e) { console.warn("[den] room failed", e); }
  if (LS("denClosed") === "1") setDen(true);
  $("knock").onclick = () => { const d = $("den"); d.classList.remove("is-knock"); void d.offsetWidth; d.classList.add("is-knock"); setTimeout(() => d.classList.remove("is-knock"), 400);
    if (d.classList.contains("is-closed")) setTimeout(() => { setRest(false); setDen(false); $("den-note").textContent = pick(["Door's open. Come sit.", "Ah. The bench is clear.", "Knock heard. Door open."]); }, 600); };
  $("leave-pic").onchange = (e) => { const f = e.target.files[0]; if (!f) return; const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); const k = Math.min(1, 320 / Math.max(img.width, img.height)); c.width = img.width * k; c.height = img.height * k; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); receiveGift("", c.toDataURL("image/jpeg", 0.8)); }; img.src = URL.createObjectURL(f); e.target.value = ""; };
  renderHome();
}
try { initHome(); } catch (e) { console.warn("[den] init failed", e); }

window.MiniWill = { setRest, setDen, renderHome, act, parse, strip, onReply, setRoam, getRoam, resetSpace, renderRooms, cleanText, WHIMS_HOOK };

// test hooks: ?whim=demo spawns a card + banner; ?drawer=settings|rooms opens a drawer
{ const q = new URLSearchParams(location.search);
  if (q.get("whim") === "demo") setTimeout(() => { act({ a: "card", text: pick(LINE_BANKS.quotes), kind: "quote" }, { fromMini: false }); act({ a: "banner", text: "Mini is awake and roaming" }, { fromMini: false }); }, 1500);
  const d = q.get("drawer"); if (d === "settings" || d === "rooms") setTimeout(() => document.getElementById(d).classList.add("open"), 800); }
