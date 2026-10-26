/**
 * Mini Alpha Studio: multi-track pattern sequencer + song timeline (Web Audio, all synthesized).
 * Tracks: kick, snare, hats (drums) / sub bass, power chords, lead (melodic) / drone (held root).
 * Blocks: 16/32/64 steps, labeled verse/chorus/bridge/intro/outro, copy + chain on an 8-32 bar timeline.
 * Glide: drag from one note to another (sub + lead) or use the Slide tool; Bend tool cycles pitch bend.
 * Mini can fill a section with a whitelisted [studio:{json}] tag via MiniStudio.apply(obj).
 */
const $ = (id) => document.getElementById(id);
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  "pentatonic major": [0, 2, 4, 7, 9], "pentatonic minor": [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10],
  "harmonic minor": [0, 2, 3, 5, 7, 8, 11], hijaz: [0, 1, 4, 5, 7, 8, 10], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE = (m) => KEYS[m % 12] + (Math.floor(m / 12) - 1);
const TRACKS = [
  { id: "kick", name: "Kick", type: "drum" }, { id: "snare", name: "Snare", type: "drum" }, { id: "hats", name: "Hats", type: "drum" },
  { id: "sub", name: "Sub bass", type: "mel", oct: 1, glide: true }, { id: "chords", name: "Power chords", type: "mel", oct: 2 },
  { id: "lead", name: "Lead", type: "mel", oct: 4, glide: true }, { id: "drone", name: "Drone", type: "drone" },
];
const LABELS = ["intro", "verse", "pre", "chorus", "bridge", "outro"];
// starter progressions: scale degrees (0-based) per bar
export const PROGRESSIONS = {
  "Epic i-VI-III-VII": [0, 5, 2, 6], "Anthem I-V-vi-IV": [0, 4, 5, 3], "Dark i-iv-v-i": [0, 3, 4, 0],
  "Phrygian i-II-i-VII": [0, 1, 0, 6], "Trance i-VII-VI-VII": [0, 6, 5, 6], "Doom i-i-VI-V": [0, 0, 5, 4],
};
const DRUMS = {
  calm: { kick: [0, 8], snare: [12], hats: [0, 4, 8, 12] }, pulse: { kick: [0, 4, 8, 12], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14] },
  drive: { kick: [0, 3, 6, 8, 11, 14], snare: [4, 12, 15], hats: [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15] },
};

/* ---------- state ---------- */
const blank = (label = "verse", steps = 16) => ({ id: Math.random().toString(36).slice(2, 8), label, steps, drums: { kick: [], snare: [], hats: [] }, notes: { sub: [], chords: [], lead: [] } });
function defaultSong() {
  const v = blank("verse", 16), c = blank("chorus", 16);
  v.drums = { kick: [0, 8], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14] };
  c.drums = JSON.parse(JSON.stringify(DRUMS.drive));
  const song = { key: "E", scale: "minor", bpm: 120, swing: 0, glideMs: 90, octs: 3, blocks: [v, c], arr: [v.id, v.id, c.id, c.id],
    mix: Object.fromEntries(TRACKS.map((t) => [t.id, { vol: t.id === "drone" ? 0.35 : 0.8, mute: false, solo: false }])) };
  fillProgression(song, v, "Dark i-iv-v-i"); fillProgression(song, c, "Epic i-VI-III-VII");
  return song;
}
let S = null;
let cur = null, track = "lead", tool = "draw", playMode = "block";
function load(k) { try { const s = JSON.parse(localStorage.getItem(k) || "null"); return s && s.blocks && s.blocks.length ? s : null; } catch (_) { return null; } }
const persist = () => localStorage.setItem("miniStudio.current", JSON.stringify(S));
const blk = () => S.blocks.find((b) => b.id === cur) || S.blocks[0];
const rootPc = () => KEYS.indexOf(S.key);
const scale = () => SCALES[S.scale] || SCALES.minor;
function degMidi(deg, oct) { const sc = scale(); const o = Math.floor(deg / sc.length); return 12 * (oct + 1 + o) + rootPc() + sc[((deg % sc.length) + sc.length) % sc.length]; }
function rowsFor(t) { // highest first
  const tr = TRACKS.find((x) => x.id === t), rows = [];
  for (let o = tr.oct + S.octs - 1; o >= tr.oct; o--) for (let i = scale().length - 1; i >= 0; i--) rows.push(12 * (o + 1) + rootPc() + scale()[i]);
  return rows;
}
function fillProgression(song, b, name) {
  const prog = PROGRESSIONS[name]; if (!prog) return; const bars = b.steps / 16; const sc0 = S || song;
  const save = S; S = song; // degMidi uses S
  b.notes.chords = []; b.notes.sub = [];
  for (let bar = 0; bar < bars; bar++) for (let i = 0; i < prog.length; i++) {
    const step = bar * 16 + i * 4; const d = prog[i];
    b.notes.chords.push({ s: step, n: degMidi(d, 2), len: 4 });
    b.notes.sub.push({ s: step, n: degMidi(d, 1), len: 2 }, { s: step + 2, n: degMidi(d, 1), len: 2, slide: i === prog.length - 1 });
  }
  S = save || song; void sc0;
}
function barsTotal() { return S.arr.reduce((a, id) => a + ((S.blocks.find((b) => b.id === id) || { steps: 16 }).steps / 16), 0); }

/* ---------- audio ---------- */
let ac = null, master = null, nb = null, shaper = null;
function audio() {
  if (ac) return ac;
  ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.8;
  const comp = ac.createDynamicsCompressor(); master.connect(comp).connect(ac.destination);
  nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  shaper = new Float32Array(1024).map((_, i) => { const x = i / 512 - 1; return Math.tanh(x * 3); });
  return ac;
}
const audible = (id) => { const anySolo = TRACKS.some((t) => S.mix[t.id].solo); const m = S.mix[id]; return !m.mute && (!anySolo || m.solo); };
const out = (id) => { const g = ac.createGain(); g.gain.value = S.mix[id].vol; g.connect(master); return g; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function kick(t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.13);
  g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4); o.connect(g).connect(out("kick")); o.start(t); o.stop(t + 0.42); }
function snare(t) { const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1300; const g = ac.createGain();
  g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); const o = out("snare"); s.connect(f).connect(g).connect(o); s.start(t); s.stop(t + 0.22);
  const b = ac.createOscillator(), bg = ac.createGain(); b.frequency.value = 185; bg.gain.setValueAtTime(0.3, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 0.1); b.connect(bg).connect(o); b.start(t); b.stop(t + 0.12); }
function hat(t) { const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7500; const g = ac.createGain();
  g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f).connect(g).connect(out("hats")); s.start(t); s.stop(t + 0.06); }
function voice(id, n, next, t, dur) {
  const o = out(id), g = ac.createGain(); const f = ac.createBiquadFilter();
  const oscs = [];
  if (id === "sub") { const a = ac.createOscillator(); a.type = "sine"; const b = ac.createOscillator(); b.type = "triangle"; oscs.push(a, b); f.type = "lowpass"; f.frequency.value = 400; }
  else if (id === "chords") { [0, 7, 12].forEach((iv, k) => { const a = ac.createOscillator(); a.type = "sawtooth"; a.detune.value = (k - 1) * 6; a._iv = iv; oscs.push(a); }); f.type = "lowpass"; f.frequency.value = 1800; }
  else { const a = ac.createOscillator(); a.type = "sawtooth"; const b = ac.createOscillator(); b.type = "square"; b.detune.value = 7; oscs.push(a, b); f.type = "lowpass"; f.frequency.value = 2600; f.Q.value = 3; }
  let chain = f;
  if (id === "chords") { const ws = ac.createWaveShaper(); ws.curve = shaper; f.connect(ws); chain = ws; }
  oscs.forEach((a) => { const base = hz(n.n + (a._iv || 0)); a.frequency.setValueAtTime(base, t);
    if (n.bend) a.frequency.linearRampToValueAtTime(hz(n.n + n.bend + (a._iv || 0)), t + dur * 0.9);
    if (next) { const gt = Math.min(dur * 0.95, (S.glideMs || 90) / 1000); a.frequency.setValueAtTime(n.bend ? hz(n.n + n.bend + (a._iv || 0)) : base, t + dur - gt); a.frequency.linearRampToValueAtTime(hz(next.n + (a._iv || 0)), t + dur); }
    a.connect(f); a.start(t); a.stop(t + dur + 0.08); });
  const lvl = id === "chords" ? 0.12 : id === "sub" ? 0.5 : 0.16;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + 0.01);
  g.gain.setValueAtTime(lvl, t + Math.max(0.02, dur - (next ? 0 : 0.05))); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + (next ? 0.03 : 0.07));
  chain.connect(g).connect(o);
}
let drone = null;
function droneOn(midi) {
  if (!audible("drone")) { droneOff(); return; }
  if (!drone) { const g = ac.createGain(); g.gain.value = 0; const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 300;
    const a = ac.createOscillator(), b = ac.createOscillator(); a.type = "sawtooth"; b.type = "sawtooth"; b.detune.value = 9; a.connect(f); b.connect(f); f.connect(g).connect(master); a.start(); b.start(); drone = { a, b, g }; }
  drone.a.frequency.setTargetAtTime(hz(midi), ac.currentTime, 0.2); drone.b.frequency.setTargetAtTime(hz(midi - 12), ac.currentTime, 0.2);
  drone.g.gain.setTargetAtTime(0.12 * S.mix.drone.vol, ac.currentTime, 0.3);
}
function droneOff() { if (drone) { drone.g.gain.setTargetAtTime(0, ac.currentTime, 0.1); const d = drone; drone = null; setTimeout(() => { try { d.a.stop(); d.b.stop(); } catch (_) {} }, 600); } }

/* ---------- transport ---------- */
let timer = null, nextT = 0, pos = 0, seq = [];
function sequence() { // flat list of {block, offset}
  if (playMode === "block") return [blk()];
  return S.arr.map((id) => S.blocks.find((b) => b.id === id)).filter(Boolean);
}
function stepAt(i) { let o = i; for (const b of seq) { if (o < b.steps) return { b, s: o }; o -= b.steps; } return null; }
const totalSteps = () => seq.reduce((a, b) => a + b.steps, 0);
function tick() {
  const spb = 60 / S.bpm / 4;
  while (nextT < ac.currentTime + 0.12) {
    const at = stepAt(pos % totalSteps()); if (!at) break; const { b, s } = at;
    const sw = s % 2 ? spb * (S.swing / 100) * 0.5 : 0; const t = nextT + sw;
    if (audible("kick") && b.drums.kick.includes(s)) kick(t);
    if (audible("snare") && b.drums.snare.includes(s)) snare(t);
    if (audible("hats") && b.drums.hats.includes(s)) hat(t);
    for (const id of ["sub", "chords", "lead"]) {
      if (!audible(id)) continue;
      const list = b.notes[id];
      for (const n of list) if (n.s === s) {
        const tr = TRACKS.find((x) => x.id === id);
        const next = n.slide && tr.glide ? list.filter((m) => m.s >= n.s + n.len).sort((x, y) => x.s - y.s)[0] : null;
        voice(id, n, next && next.s === n.s + n.len ? next : next, t, n.len * spb);
      }
    }
    if (s % 16 === 0) { const ch = b.notes.chords.find((n) => n.s === s) || b.notes.sub.find((n) => n.s === s); droneOn(ch ? (ch.n % 12) + 36 : 36 + rootPc()); }
    const p = pos; setTimeout(() => playhead(at, p), Math.max(0, (nextT - ac.currentTime) * 1000));
    nextT += spb; pos++;
  }
}
function playhead(at, p) {
  document.querySelectorAll("#st-grid .now").forEach((e) => e.classList.remove("now"));
  if (at.b.id === cur) document.querySelectorAll(`#st-grid [data-s="${at.s}"]`).forEach((e) => e.classList.add("now"));
  document.querySelectorAll("#st-arr .chipb").forEach((e, i) => e.classList.toggle("now", playMode === "song" && seqIndex(p) === i));
}
function seqIndex(p) { let o = p % Math.max(1, totalSteps()); for (let i = 0; i < seq.length; i++) { if (o < seq[i].steps) return i; o -= seq[i].steps; } return -1; }
export async function play(mode) {
  stop(); audio(); await ac.resume(); playMode = mode || playMode; seq = sequence(); if (!totalSteps()) return;
  pos = 0; nextT = ac.currentTime + 0.06; timer = setInterval(tick, 25); paintTransport();
}
export function stop() { if (timer) clearInterval(timer); timer = null; if (ac) droneOff(); document.querySelectorAll("#st-grid .now,#st-arr .now").forEach((e) => e.classList.remove("now")); paintTransport(); }
function paintTransport() { $("st-play").textContent = timer && playMode === "block" ? "Stop" : "Play block"; $("st-song").textContent = timer && playMode === "song" ? "Stop" : "Play song"; }

/* ---------- UI ---------- */
function opt(sel, arr, v) { sel.innerHTML = arr.map((x) => `<option ${x == v ? "selected" : ""}>${x}</option>`).join(""); }
function render() {
  const b = blk();
  opt($("st-key"), KEYS, S.key); opt($("st-scale"), Object.keys(SCALES), S.scale); opt($("st-len"), [16, 32, 64], b.steps); opt($("st-label"), LABELS, b.label);
  opt($("st-oct"), [3, 4], S.octs); opt($("st-prog"), ["Starter progression…", ...Object.keys(PROGRESSIONS)], "");
  $("st-bpm").value = S.bpm; $("st-bv").textContent = S.bpm; $("st-swing").value = S.swing; $("st-sv").textContent = S.swing + "%"; $("st-glide").value = S.glideMs; $("st-gv").textContent = S.glideMs + "ms";
  // tracks + mixer
  $("st-tracks").innerHTML = TRACKS.map((t) => `<div class="trk ${t.id === track ? "on" : ""}" data-t="${t.id}"><button class="tname" data-sel="${t.id}">${t.name}</button>
    <input type="range" min="0" max="100" value="${Math.round(S.mix[t.id].vol * 100)}" data-vol="${t.id}" aria-label="${t.name} volume">
    <button class="ms ${S.mix[t.id].mute ? "act" : ""}" data-mute="${t.id}">M</button><button class="ms ${S.mix[t.id].solo ? "act" : ""}" data-solo="${t.id}">S</button></div>`).join("");
  // timeline
  $("st-arr").innerHTML = S.arr.map((id, i) => { const x = S.blocks.find((q) => q.id === id); return x ? `<button class="chipb ${id === cur ? "sel" : ""} l-${x.label}" data-ai="${i}">${x.label}<small>${x.steps / 16} bar</small></button>` : ""; }).join("") || '<span class="dim">Empty song. Tap Chain to add the current block.</span>';
  $("st-bars").textContent = `${barsTotal()} / 32 bars`;
  $("st-blocks").innerHTML = S.blocks.map((x, i) => `<button class="chipb ${x.id === cur ? "sel" : ""} l-${x.label}" data-bi="${i}">${x.label} ${i + 1}</button>`).join("");
  renderGrid();
  persist();
}
function renderGrid() {
  const b = blk(), tr = TRACKS.find((t) => t.id === track), g = $("st-grid");
  let html = "";
  if (tr.type === "drone") { g.innerHTML = '<p class="dim pad">The drone holds the root of each bar\'s chord. Set its volume, mute or solo on the left.</p>'; return; }
  if (tr.type === "drum") {
    for (const d of ["kick", "snare", "hats"]) { html += `<div class="gr"><span class="gl">${d}</span>`; for (let s = 0; s < b.steps; s++) html += `<button class="gc ${s % 4 ? "" : "q"} ${b.drums[d].includes(s) ? "on" : ""}" data-d="${d}" data-s="${s}"></button>`; html += "</div>"; }
  } else {
    const rows = rowsFor(track), list = b.notes[track];
    for (const m of rows) {
      html += `<div class="gr"><span class="gl ${m % 12 === rootPc() ? "root" : ""}">${NOTE(m)}</span>`;
      for (let s = 0; s < b.steps; s++) {
        const head = list.find((n) => n.n === m && n.s === s), tie = list.find((n) => n.n === m && s > n.s && s < n.s + n.len);
        const cls = head ? "on head" + (head.slide ? " slide" : "") + (head.bend ? " bend" : "") : tie ? "on tie" : "";
        html += `<button class="gc ${s % 4 ? "" : "q"} ${cls}" data-n="${m}" data-s="${s}">${head && head.bend ? (head.bend > 0 ? "↑" : "↓") : ""}</button>`;
      }
      html += "</div>";
    }
  }
  g.innerHTML = html;
}
function noteAt(list, m, s) { return list.find((n) => n.n === m && s >= n.s && s < n.s + n.len); }
let dragFrom = null;
function onGridDown(e) {
  const c = e.target.closest(".gc"); if (!c) return; const b = blk(), s = +c.dataset.s;
  if (c.dataset.d) { const arr = b.drums[c.dataset.d]; const i = arr.indexOf(s); i >= 0 ? arr.splice(i, 1) : arr.push(s); render(); return; }
  const m = +c.dataset.n, list = b.notes[track], hit = noteAt(list, m, s);
  if (tool === "draw") { if (hit) { dragFrom = hit; } else { list.push({ s, n: m, len: track === "chords" ? 4 : 1 }); dragFrom = list[list.length - 1]; renderGrid(); } }
  else if (tool === "erase") { if (hit) list.splice(list.indexOf(hit), 1); render(); }
  else if (tool === "length") { if (hit) { hit.len = hit.len >= 8 ? 1 : hit.len + 1; if (hit.s + hit.len > b.steps) hit.len = b.steps - hit.s; } render(); }
  else if (tool === "slide") { if (hit) hit.slide = !hit.slide; render(); }
  else if (tool === "bend") { if (hit) { const cyc = [0, 1, 2, -1, -2]; hit.bend = cyc[(cyc.indexOf(hit.bend || 0) + 1) % cyc.length]; } render(); }
}
function onGridUp(e) {
  if (!dragFrom) return; const from = dragFrom; dragFrom = null;
  const el = document.elementFromPoint(e.clientX, e.clientY); const c = el && el.closest && el.closest(".gc");
  const tr = TRACKS.find((t) => t.id === track);
  if (c && c.dataset.n && tr.glide) {
    const m = +c.dataset.n, s = +c.dataset.s, list = blk().notes[track];
    if (s > from.s && !(m === from.n && s < from.s + from.len)) { // dragged to another spot: glide into a note there
      let to = noteAt(list, m, s); if (!to) { to = { s, n: m, len: 1 }; list.push(to); }
      from.len = Math.max(1, to.s - from.s); from.slide = true;
    }
  }
  render();
}
function wire() {
  const g = $("st-grid");
  g.addEventListener("pointerdown", (e) => { onGridDown(e); if (dragFrom) { try { g.setPointerCapture(e.pointerId); } catch (_) {} } });
  g.addEventListener("pointerup", onGridUp); g.addEventListener("pointercancel", () => { dragFrom = null; });
  $("st-tools").onclick = (e) => { const b = e.target.closest("[data-tool]"); if (!b) return; tool = b.dataset.tool; document.querySelectorAll("#st-tools button").forEach((x) => x.classList.toggle("on", x === b)); };
  $("st-tracks").onclick = (e) => {
    const t = e.target;
    if (t.dataset.sel) { track = t.dataset.sel; render(); }
    if (t.dataset.mute) { S.mix[t.dataset.mute].mute = !S.mix[t.dataset.mute].mute; render(); }
    if (t.dataset.solo) { S.mix[t.dataset.solo].solo = !S.mix[t.dataset.solo].solo; render(); }
  };
  $("st-tracks").oninput = (e) => { const id = e.target.dataset.vol; if (id) { S.mix[id].vol = e.target.value / 100; persist(); } };
  const num = (id, k, lab, suf = "") => $(id).addEventListener("input", (e) => { S[k] = +e.target.value; $(lab).textContent = S[k] + suf; persist(); });
  num("st-bpm", "bpm", "st-bv"); num("st-swing", "swing", "st-sv", "%"); num("st-glide", "glideMs", "st-gv", "ms");
  $("st-key").oninput = (e) => { S.key = e.target.value; render(); };
  $("st-scale").oninput = (e) => { S.scale = e.target.value; render(); };
  $("st-oct").oninput = (e) => { S.octs = +e.target.value; render(); };
  $("st-len").oninput = (e) => { const b = blk(), n = +e.target.value; if (n > b.steps) { // extend by repeating
      const k = n / b.steps; for (const d in b.drums) b.drums[d] = [...Array(k).keys()].flatMap((r) => b.drums[d].map((s) => s + r * b.steps));
      for (const t in b.notes) b.notes[t] = [...Array(k).keys()].flatMap((r) => b.notes[t].map((x) => ({ ...x, s: x.s + r * b.steps }))); }
    else { for (const d in b.drums) b.drums[d] = b.drums[d].filter((s) => s < n); for (const t in b.notes) b.notes[t] = b.notes[t].filter((x) => x.s < n).map((x) => ({ ...x, len: Math.min(x.len, n - x.s) })); }
    b.steps = n; render(); };
  $("st-label").oninput = (e) => { blk().label = e.target.value; render(); };
  $("st-prog").oninput = (e) => { if (PROGRESSIONS[e.target.value]) { fillProgression(S, blk(), e.target.value); render(); } };
  $("st-play").onclick = () => (timer && playMode === "block" ? stop() : play("block"));
  $("st-song").onclick = () => (timer && playMode === "song" ? stop() : play("song"));
  $("st-new").onclick = () => { const b = blank("chorus", 16); S.blocks.push(b); cur = b.id; render(); };
  $("st-copy").onclick = () => { const b = JSON.parse(JSON.stringify(blk())); b.id = Math.random().toString(36).slice(2, 8); S.blocks.push(b); cur = b.id; render(); };
  $("st-chain").onclick = () => { if (barsTotal() + blk().steps / 16 > 32) return alert("The song timeline holds 32 bars."); S.arr.push(cur); render(); };
  $("st-unchain").onclick = () => { const i = S.arr.lastIndexOf(cur); if (i >= 0) S.arr.splice(i, 1); render(); };
  $("st-del").onclick = () => { if (S.blocks.length < 2) return; S.arr = S.arr.filter((x) => x !== cur); S.blocks = S.blocks.filter((x) => x.id !== cur); cur = S.blocks[0].id; render(); };
  $("st-clear").onclick = () => { const b = blk(), tr = TRACKS.find((t) => t.id === track); if (tr.type === "drum") b.drums = { kick: [], snare: [], hats: [] }; else if (b.notes[track]) b.notes[track] = []; render(); };
  $("st-arr").onclick = (e) => { const c = e.target.closest("[data-ai]"); if (c) { cur = S.arr[+c.dataset.ai]; render(); } };
  $("st-blocks").onclick = (e) => { const c = e.target.closest("[data-bi]"); if (c) { cur = S.blocks[+c.dataset.bi].id; render(); } };
  $("st-save").onclick = () => { const n = (prompt("Name this song:", "Song " + new Date().toLocaleDateString()) || "").trim().slice(0, 40); if (!n) return;
    const all = JSON.parse(localStorage.getItem("miniStudio.songs") || "{}"); all[n] = S; localStorage.setItem("miniStudio.songs", JSON.stringify(all)); fillLoad(); };
  $("st-load").oninput = (e) => { const all = JSON.parse(localStorage.getItem("miniStudio.songs") || "{}"); const s = all[e.target.value]; if (s) { stop(); S = s; cur = S.blocks[0].id; render(); } e.target.selectedIndex = 0; };
  $("st-reset").onclick = () => { if (confirm("Start a fresh song?")) { stop(); S = defaultSong(); cur = S.blocks[0].id; render(); } };
  fillLoad();
}
function fillLoad() { const all = JSON.parse(localStorage.getItem("miniStudio.songs") || "{}"); $("st-load").innerHTML = `<option>Load song…</option>` + Object.keys(all).map((k) => `<option>${k.replace(/</g, "")}</option>`).join(""); }

/* ---------- Mini's [studio:{json}] tag (whitelisted, validated) ---------- */
export function apply(o) {
  if (!S) return false;
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  const label = LABELS.includes(o.section) ? o.section : "verse";
  const bars = [1, 2, 4].includes(+o.bars) ? +o.bars : 1;
  if (typeof o.key === "string" && KEYS.includes(o.key.toUpperCase().replace("B", "B"))) S.key = o.key.toUpperCase();
  if (typeof o.scale === "string" && SCALES[o.scale.toLowerCase()]) S.scale = o.scale.toLowerCase();
  if (Number.isFinite(+o.bpm) && +o.bpm >= 60 && +o.bpm <= 180) S.bpm = Math.round(+o.bpm);
  if (Number.isFinite(+o.swing) && +o.swing >= 0 && +o.swing <= 60) S.swing = Math.round(+o.swing);
  const b = blank(label, bars * 16);
  const prog = typeof o.progression === "string" ? Object.keys(PROGRESSIONS).find((k) => k.toLowerCase().includes(o.progression.toLowerCase())) : null;
  fillProgression(S, b, prog || "Dark i-iv-v-i");
  const dr = DRUMS[o.drums] || DRUMS.pulse; for (let r = 0; r < bars; r++) for (const d in dr) b.drums[d].push(...dr[d].map((s) => s + r * 16));
  if (Array.isArray(o.lead)) for (const x of o.lead.slice(0, 64)) {
    if (!Array.isArray(x)) continue; const [st, deg, len = 1, slide = 0] = x.map(Number);
    if (st >= 0 && st < b.steps && deg >= -7 && deg <= 21 && len >= 1 && len <= 16) b.notes.lead.push({ s: st, n: degMidi(deg, 4), len: Math.min(len, b.steps - st), slide: !!slide });
  }
  S.blocks.push(b); cur = b.id; if (barsTotal() + bars <= 32) S.arr.push(b.id);
  render(); return true;
}
export function init() { if (!S) { S = load("miniStudio.current") || defaultSong(); cur = S.blocks[0].id; } wire(); render(); }
window.MiniStudio = { apply, play, stop, init, SCALES, PROGRESSIONS };
