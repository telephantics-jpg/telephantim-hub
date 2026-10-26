/* Mini Alpha "beast" layer: long Sketch, Tools, Canvas, Write helper, Mini tags.
   Every feature starts inside its own try/catch so one failure cannot stop the app. */
const $ = (id) => document.getElementById(id);
const h = (tag, attrs = {}, html = "") => { const e = document.createElement(tag); for (const k in attrs) { if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); } if (html) e.innerHTML = html; return e; };
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
const safe = (name, fn) => { try { return fn(); } catch (e) { console.warn("[beast:" + name + "]", e); } };
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const download = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
const AC = window.AudioContext || window.webkitAudioContext;
let actx = null; const getAC = async () => { actx = actx || new AC(); if (actx.state !== "running") { try { await actx.resume(); } catch (_) {} } return actx; };
const API = {};

/* ---------- tabs ---------- */
function addTab(p, label, svg) {
  const nav = document.querySelector(".tabs"); const b = h("button", { "data-p": p }, `<svg viewBox="0 0 24 24">${svg}</svg>${label}`);
  b.onclick = () => { document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b)); document.querySelectorAll(".pane").forEach((x) => x.classList.toggle("active", x.id === "pane-" + p)); b.dispatchEvent(new Event("shown")); };
  nav.insertBefore(b, nav.querySelector('[data-p="saved"]')); return b;
}
function addPane(p, html) { const s = h("section", { class: "pane", id: "pane-" + p }, html); document.querySelector("main").appendChild(s); return s; }
const show = (p) => document.querySelector(`.tabs [data-p="${p}"]`)?.click();

/* =================== SKETCH (long form) =================== */
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES = { minor: [0,2,3,5,7,8,10], "harmonic minor": [0,2,3,5,7,8,11], "Hijaz (phrygian dom.)": [0,1,4,5,7,8,10], dorian: [0,2,3,5,7,9,10], phrygian: [0,1,3,5,7,8,10], major: [0,2,4,5,7,9,11] };
const PRESETS = {
  "Epic  i-VI-III-VII": { scale: "minor", deg: [0,5,2,6] },
  "Dark  i-iv-v": { scale: "minor", deg: [0,3,4,0] },
  "Ancient  Hijaz drone": { scale: "Hijaz (phrygian dom.)", deg: [0,0,1,0] },
  "Rise  i-VII-VI-VII": { scale: "minor", deg: [0,6,5,6] },
  "Cinematic  i-iv-VI-v": { scale: "harmonic minor", deg: [0,3,5,4] },
  "Steel  i-III-VII-iv": { scale: "dorian", deg: [0,2,6,3] },
};
const TRACKS = ["kick", "snare", "hat", "bass", "pad"];
const METERS = { "4/4": { spb: 16, grp: 4 }, "3/4": { spb: 12, grp: 4 }, "6/8": { spb: 12, grp: 6 } };
const SECTIONS = ["intro", "verse", "pre", "chorus", "bridge", "drop", "outro"];
const ROMAN = ["I","II","III","IV","V","VI","VII"];
const defFx = () => ({ vol: 0.8, filter: 1, reverb: 0.15, delay: 0, dist: 0 });
const S = LS.get("miniBeastSketch", null) || {
  key: "E", scale: "minor", bpm: 120, swing: 0, human: 0, meter: "4/4", wobble: 0, cur: "A", mode: "pattern", loopFrom: 0, loopTo: 7, songLoop: true,
  fx: Object.fromEntries(TRACKS.map((t) => [t, defFx()])), pats: {}, song: [{ p: "A", label: "intro" }, { p: "B", label: "verse" }, { p: "C", label: "chorus" }],
};
function blankPat(bars) { const n = bars * METERS[S.meter].spb; return { bars, chords: Array(bars).fill(-1), kick: Array(n).fill(0), snare: Array(n).fill(0), hat: Array(n).fill(0), bass: Array(n).fill(null), len: Array(n).fill(1) }; }
["A","B","C"].forEach((k) => { if (!S.pats[k]) S.pats[k] = blankPat(8); });
const saveS = () => LS.set("miniBeastSketch", S);
const P = () => S.pats[S.cur];
const spb = () => METERS[S.meter].spb;
function resizePat(p, bars) {
  const n = bars * spb(); ["kick","snare","hat","len"].forEach((t) => { p[t] = p[t].slice(0, n); while (p[t].length < n) p[t].push(t === "len" ? 1 : 0); });
  p.bass = p.bass.slice(0, n); while (p.bass.length < n) p.bass.push(null);
  p.chords = p.chords.slice(0, bars); while (p.chords.length < bars) p.chords.push(-1); p.bars = bars;
}
function chordSemis(deg) { const sc = SCALES[S.scale]; const at = (i) => sc[i % 7] + 12 * Math.floor(i / 7); return [at(deg), at(deg + 2), at(deg + 4)]; }
function chordName(deg) { if (deg < 0) return "—"; const [a, b] = chordSemis(deg); const minor = b - a === 3; const dim = minor && chordSemis(deg)[2] - a === 6; return (minor ? ROMAN[deg].toLowerCase() : ROMAN[deg]) + (dim ? "°" : ""); }
const rootHz = () => 32.70 * Math.pow(2, NOTES.indexOf(S.key) / 12) * (NOTES.indexOf(S.key) < 4 ? 2 : 1);
const hz = (semi) => rootHz() * Math.pow(2, semi / 12);

/* ---- audio graph shared by live play and WAV export ---- */
function irBuffer(ctx) { const len = ctx.sampleRate * 2.2, b = ctx.createBuffer(2, len, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); } return b; }
function distCurve(a) { const n = 1024, c = new Float32Array(n), k = a * 60; for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = k ? ((1 + k) * x) / (1 + k * Math.abs(x)) : x; } return c; }
function makeGraph(ctx) {
  const master = ctx.createGain(); master.gain.value = 0.8; const comp = ctx.createDynamicsCompressor(); master.connect(comp).connect(ctx.destination);
  const rev = ctx.createConvolver(); rev.buffer = irBuffer(ctx); rev.connect(master);
  const dly = ctx.createDelay(2), fb = ctx.createGain(); fb.gain.value = 0.38; dly.connect(fb).connect(dly); dly.connect(master);
  const g = { ctx, master, dly, tr: {}, nb: null };
  const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; g.nb = nb;
  TRACKS.forEach((t) => { const inp = ctx.createGain(), sh = ctx.createWaveShaper(), f = ctx.createBiquadFilter(), out = ctx.createGain(), rs = ctx.createGain(), ds = ctx.createGain();
    f.type = "lowpass"; f.Q.value = t === "bass" ? 6 : 0.7; inp.connect(sh).connect(f).connect(out).connect(master); out.connect(rs).connect(rev); out.connect(ds).connect(dly);
    g.tr[t] = { inp, sh, f, out, rs, ds }; });
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.type = "sine"; lfo.connect(lg).connect(g.tr.bass.f.frequency); lfo.start(); g.lfo = lfo; g.lg = lg;
  applyFx(g); return g;
}
function applyFx(g) {
  if (!g) return; const t = g.ctx.currentTime; g.dly.delayTime.setValueAtTime((60 / S.bpm) * 0.75, t);
  TRACKS.forEach((k) => { const fx = S.fx[k], n = g.tr[k]; n.out.gain.setValueAtTime(fx.vol, t); n.f.frequency.setValueAtTime(120 * Math.pow(2, fx.filter * 7.3), t);
    n.rs.gain.setValueAtTime(fx.reverb, t); n.ds.gain.setValueAtTime(fx.delay * 0.6, t); n.sh.curve = distCurve(fx.dist); });
  const w = S.wobble; g.lfo.frequency.setValueAtTime(w ? [0, 0.5, 1, 2, 3, 4, 6, 8][w] || 2 : 0.01, t); g.lg.gain.setValueAtTime(w ? 120 * Math.pow(2, S.fx.bass.filter * 7.3) * 0.7 : 0, t);
}
function vKick(g, t, v) { const c = g.ctx, o = c.createOscillator(), a = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); a.gain.setValueAtTime(0.95 * v, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(a).connect(g.tr.kick.inp); o.start(t); o.stop(t + 0.37); }
function vSnare(g, t, v) { const c = g.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain(); s.buffer = g.nb; f.type = "highpass"; f.frequency.value = 1200; a.gain.setValueAtTime(0.55 * v, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(f).connect(a).connect(g.tr.snare.inp); s.start(t); s.stop(t + 0.2);
  const o = c.createOscillator(), b = c.createGain(); o.frequency.value = 190; b.gain.setValueAtTime(0.25 * v, t); b.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(b).connect(g.tr.snare.inp); o.start(t); o.stop(t + 0.12); }
function vHat(g, t, v) { const c = g.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain(); s.buffer = g.nb; f.type = "highpass"; f.frequency.value = 7000; a.gain.setValueAtTime(0.2 * v, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f).connect(a).connect(g.tr.hat.inp); s.start(t); s.stop(t + 0.06); }
function vBass(g, t, f, dur, v) { const c = g.ctx, o1 = c.createOscillator(), o2 = c.createOscillator(), a = c.createGain(); o1.type = "sawtooth"; o2.type = "sine"; o1.frequency.value = f; o2.frequency.value = f / 2;
  a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.4 * v, t + 0.01); a.gain.setValueAtTime(0.4 * v, t + Math.max(0.02, dur - 0.03)); a.gain.linearRampToValueAtTime(0, t + dur); o1.connect(a); o2.connect(a); a.connect(g.tr.bass.inp); o1.start(t); o2.start(t); o1.stop(t + dur + 0.02); o2.stop(t + dur + 0.02); }
function vPad(g, t, fs, dur) { const c = g.ctx, a = c.createGain(); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.09, t + 0.25); a.gain.setValueAtTime(0.09, t + dur - 0.2); a.gain.linearRampToValueAtTime(0, t + dur); a.connect(g.tr.pad.inp);
  fs.forEach((f, i) => { [0, 6].forEach((det) => { const o = c.createOscillator(); o.type = i ? "triangle" : "sawtooth"; o.frequency.value = f; o.detune.value = det; o.connect(a); o.start(t); o.stop(t + dur + 0.05); }); }); }
const stepDur = () => 60 / S.bpm / 4;
function playStep(g, p, i, t) {
  const sd = stepDur(), hum = S.human / 100, b = Math.floor(i / spb());
  if (i % 2) t += (S.swing / 100) * sd * 0.5; if (hum) t += (Math.random() - 0.5) * 0.02 * hum; t = Math.max(t, g.ctx.currentTime);
  const vv = (v) => Math.max(0.05, Math.min(1, v * (1 - hum * 0.3 * Math.random())));
  if (p.kick[i]) vKick(g, t, vv(p.kick[i])); if (p.snare[i]) vSnare(g, t, vv(p.snare[i])); if (p.hat[i]) vHat(g, t, vv(p.hat[i]));
  const deg = p.chords[b];
  if (p.bass[i] != null) { const r = deg >= 0 ? chordSemis(deg)[0] : 0; vBass(g, t, hz(r + p.bass[i]), sd * (p.len[i] || 1) * 0.95, 1); }
  if (i % spb() === 0 && deg >= 0) vPad(g, t, chordSemis(deg).map((s) => hz(s + 24)), sd * spb());
}
/* sequence = list of [patternKey, step] for current mode */
function sequence() {
  if (S.mode === "song") { const out = []; S.song.forEach((e, ei) => { const p = S.pats[e.p]; if (p) for (let i = 0; i < p.bars * spb(); i++) out.push([e.p, i, ei]); }); return out; }
  const p = P(), a = Math.min(S.loopFrom, p.bars - 1), z = Math.max(a, Math.min(S.loopTo, p.bars - 1)); const out = []; for (let i = a * spb(); i < (z + 1) * spb(); i++) out.push([S.cur, i, -1]); return out;
}
let live = null;
function stopLive() { if (!live) return; clearInterval(live.timer); try { live.g.master.disconnect(); live.g.lfo.stop(); } catch (_) {} live = null; $("bk-play").textContent = "Play"; safe("mp", () => document.querySelector(".mp-play")?.setAttribute("aria-pressed", "false")); document.querySelectorAll("#bk-grid .now").forEach((c) => c.classList.remove("now")); }
async function startLive() {
  stopLive(); const ctx = await getAC(); const g = makeGraph(ctx); const seq = sequence(); if (!seq.length) return;
  live = { g, seq, pos: 0, next: ctx.currentTime + 0.06 };
  live.timer = setInterval(() => safe("tick", () => { while (live && live.next < ctx.currentTime + 0.12) {
      if (live.pos >= live.seq.length) { if (S.mode === "song" && !S.songLoop) { const L = live; setTimeout(() => L === live && stopLive(), 400); return; } live.pos = 0; }
      const [k, i, ei] = live.seq[live.pos]; playStep(g, S.pats[k], i, live.next);
      const at = live.next; setTimeout(() => markNow(k, i, ei), Math.max(0, (at - ctx.currentTime) * 1000));
      live.next += stepDur(); live.pos++; } }), 25);
  $("bk-play").textContent = "Stop"; safe("mp", () => document.querySelector(".mp-play")?.setAttribute("aria-pressed", "true"));
}
function markNow(k, i, ei) { if (!live) return; document.querySelectorAll("#bk-grid .now").forEach((c) => c.classList.remove("now")); if (k === S.cur) document.querySelectorAll(`#bk-grid [data-s="${i}"]`).forEach((c) => c.classList.add("now"));
  document.querySelectorAll("#bk-song .ent").forEach((e, j) => e.classList.toggle("now", j === ei)); }

/* ---- export ---- */
async function renderWav() {
  const seq = sequence(); const sr = 44100; const secs = seq.length * stepDur() + 2.5;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; const ctx = new OAC(2, Math.ceil(secs * sr), sr); const g = makeGraph(ctx);
  seq.forEach(([k, i], n) => playStep(g, S.pats[k], i, 0.05 + n * stepDur()));
  const buf = await ctx.startRendering(); return wavBlob(buf);
}
function wavBlob(buf) { const ch = buf.numberOfChannels, n = buf.length, ab = new ArrayBuffer(44 + n * ch * 2), v = new DataView(ab); const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * ch * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * ch * 2, true);
  const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c)); let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([ab], { type: "audio/wav" }); }
function midiBlob() {
  const seq = sequence(), T = 24, ev = []; const base = 36 + NOTES.indexOf(S.key);
  seq.forEach(([k, i], n) => { const p = S.pats[k], t = n * T, b = Math.floor(i / spb()), deg = p.chords[b];
    [["kick", 36], ["snare", 38], ["hat", 42]].forEach(([d, note]) => { if (p[d][i]) { const vel = Math.round(p[d][i] * 120); ev.push([t, 0x99, note, vel], [t + T / 2, 0x89, note, 0]); } });
    if (p.bass[i] != null) { const note = base + (deg >= 0 ? chordSemis(deg)[0] : 0) + p.bass[i]; ev.push([t, 0x90, note, 100], [t + T * (p.len[i] || 1) - 1, 0x80, note, 0]); }
    if (i % spb() === 0 && deg >= 0) chordSemis(deg).forEach((s) => { ev.push([t, 0x91, base + 24 + s, 70], [t + T * spb() - 1, 0x81, base + 24 + s, 0]); }); });
  ev.sort((a, b) => a[0] - b[0] || (a[1] & 0xf0) - (b[1] & 0xf0));
  const bytes = []; const vlq = (x) => { const s = [x & 0x7f]; while ((x >>= 7)) s.unshift((x & 0x7f) | 0x80); bytes.push(...s); };
  const us = Math.round(60000000 / S.bpm); vlq(0); bytes.push(0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255);
  let last = 0; ev.forEach(([t, s, a, b]) => { vlq(t - last); last = t; bytes.push(s, a, b); }); vlq(0); bytes.push(0xff, 0x2f, 0);
  const head = [0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,0,96, 0x4d,0x54,0x72,0x6b, (bytes.length>>>24)&255,(bytes.length>>16)&255,(bytes.length>>8)&255,bytes.length&255];
  return new Blob([new Uint8Array(head.concat(bytes))], { type: "audio/midi" });
}

/* ---- Mini, finish this (rule based, offline) ---- */
function finish(what) {
  const p = P(), n = spb(), z = Math.min(S.loopTo, p.bars - 1);
  if (p.chords.every((c) => c < 0)) applyPreset(Object.keys(PRESETS)[0], true);
  const doBass = what === "bass" || (!what && p.bass.every((x) => x == null));
  if (doBass) for (let b = 0; b < p.bars; b++) { const o = b * n; for (let i = 0; i < n; i++) { p.bass[o + i] = null; p.len[o + i] = 1; }
    const shape = [[0, 0, 3], [Math.floor(n / 2) - 2, 0, 1], [Math.floor(n / 2), 7, 2], [n - 3, 12, 1], [n - 2, 10, 1]];
    shape.forEach(([s, semi, l], j) => { if (j && Math.random() < 0.25) return; p.bass[o + s] = semi; p.len[o + s] = l; }); }
  if (what !== "bass") { if (p.kick.every((x) => !x)) for (let b = 0; b < p.bars; b++) { const o = b * n; for (let i = 0; i < n; i++) { p.kick[o + i] = (i % (n === 16 ? 8 : 6) === 0) ? 1 : 0; p.snare[o + i] = (n === 16 ? i % 8 === 4 : i === 6) ? 1 : 0; p.hat[o + i] = i % 2 === 0 ? (i % 4 ? 0.6 : 1) : 0; } }
    const o = z * n; for (let i = n - 4; i < n; i++) { p.snare[o + i] = 0.4 + (i - (n - 4)) * 0.2; p.hat[o + i] = 0; } p.kick[o + n - 4] = 1; }
  saveS(); drawSketch(); return doBass ? "bassline" : "drum fill";
}
function applyPreset(name, quiet) { const pr = PRESETS[name]; if (!pr) return; S.scale = pr.scale; const p = P(); for (let b = 0; b < p.bars; b++) p.chords[b] = pr.deg[b % pr.deg.length]; saveS(); if (!quiet) drawSketch(); }

/* ---- Sketch UI ---- */
function buildSketch() {
  const pane = $("pane-sketch"); [...pane.children].forEach((c) => { c.style.display = "none"; c.setAttribute("data-old", ""); });
  const opt = (arr, sel) => arr.map((x) => `<option ${x == sel ? "selected" : ""}>${x}</option>`).join("");
  const wrap = h("div", { class: "bk" }, `
  <h2>Sketchpad</h2>
  <div class="row bk-top"><button class="send" id="bk-play">Play</button><button class="send ghost" id="bk-finish">Mini, finish this</button>
    <span class="seg" id="bk-pats"></span><span class="seg" id="bk-mode"><button data-m="pattern">Loop</button><button data-m="song">Song</button></span></div>
  <div class="bk-ctl">
    <label>Bars<select id="bk-bars">${opt([4,8,16,32])}</select></label>
    <label>Time<select id="bk-meter">${opt(Object.keys(METERS))}</select></label>
    <label>Key<select id="bk-key">${opt(NOTES)}</select></label>
    <label>Scale<select id="bk-scale">${opt(Object.keys(SCALES))}</select></label>
    <label>Preset<select id="bk-preset"><option value="">Pick a progression…</option>${opt(Object.keys(PRESETS))}</select></label>
    <label>Loop bars<span class="lr"><select id="bk-lf"></select>–<select id="bk-lt"></select></span></label>
    <label>BPM <b id="bk-bv"></b><input type="range" id="bk-bpm" min="50" max="190"></label>
    <label>Swing <b id="bk-sv"></b><input type="range" id="bk-swing" min="0" max="70"></label>
    <label>Humanize <b id="bk-hv"></b><input type="range" id="bk-human" min="0" max="100"></label>
    <label>Sub wobble <b id="bk-wv"></b><input type="range" id="bk-wob" min="0" max="7"></label>
  </div>
  <div class="label">Chords: tap a bar to change its chord. Tap a step: drums cycle loud → medium → soft → off; bass cycles length 1 → 2 → 4 → off. Long-press a bass note to change its pitch.</div>
  <div class="bk-scroll"><div id="bk-grid"></div></div>
  <details class="bk-mix"><summary>Mixer and effects</summary><div id="bk-mix"></div></details>
  <details class="bk-songbox" id="bk-songbox"><summary>Song mode: chain A, B, C into sections</summary>
    <div id="bk-song"></div>
    <div class="row"><select id="bk-addp">${opt(["A","B","C"])}</select><select id="bk-addl">${opt(SECTIONS)}</select><button class="chip" id="bk-add">Add</button>
      <button class="chip" id="bk-copyp">Copy ${"pattern"} to…</button><select id="bk-copyto">${opt(["A","B","C"])}</select>
      <label class="tog"><input type="checkbox" id="bk-sloop"> Loop song</label></div></details>
  <div class="row"><button class="chip" id="bk-wav">Export WAV</button><button class="chip" id="bk-mid">Export MIDI</button><button class="chip" id="bk-clear">Clear pattern</button><span class="dim" id="bk-msg"></span></div>`);
  pane.appendChild(wrap);
  const bind = (id, key, fmt, num = true) => { const el = $(id); el.value = S[key]; el.oninput = () => { S[key] = num ? +el.value : el.value; saveS(); refreshLabels(); live && applyFx(live.g); }; };
  bind("bk-bpm", "bpm"); bind("bk-swing", "swing"); bind("bk-human", "human"); bind("bk-wob", "wobble");
  $("bk-key").value = S.key; $("bk-key").onchange = (e) => { S.key = e.target.value; saveS(); };
  $("bk-scale").onchange = (e) => { S.scale = e.target.value; saveS(); drawSketch(); };
  $("bk-meter").onchange = (e) => { S.meter = e.target.value; Object.values(S.pats).forEach((p) => { const bars = p.bars; Object.assign(p, blankPat(bars), { chords: p.chords }); }); saveS(); drawSketch(); };
  $("bk-bars").onchange = (e) => { resizePat(P(), +e.target.value); S.loopTo = Math.min(Math.max(S.loopTo, 0), P().bars - 1); if (S.loopTo < P().bars - 1 && +e.target.value > 4) S.loopTo = P().bars - 1; saveS(); drawSketch(); };
  $("bk-preset").onchange = (e) => { applyPreset(e.target.value); e.target.value = ""; };
  $("bk-lf").onchange = (e) => { S.loopFrom = +e.target.value; if (S.loopTo < S.loopFrom) S.loopTo = S.loopFrom; saveS(); drawSketch(); };
  $("bk-lt").onchange = (e) => { S.loopTo = +e.target.value; if (S.loopFrom > S.loopTo) S.loopFrom = S.loopTo; saveS(); drawSketch(); };
  $("bk-play").onclick = () => (live ? stopLive() : startLive());
  $("bk-finish").onclick = () => { const what = finish(); msg("Mini added a " + what + "."); };
  $("bk-mode").onclick = (e) => { const m = e.target.dataset.m; if (!m) return; S.mode = m; saveS(); drawSketch(); if (live) startLive(); };
  $("bk-clear").onclick = () => { if (confirm("Clear pattern " + S.cur + "?")) { S.pats[S.cur] = blankPat(P().bars); saveS(); drawSketch(); } };
  $("bk-add").onclick = () => { S.song.push({ p: $("bk-addp").value, label: $("bk-addl").value }); saveS(); drawSong(); };
  $("bk-copyp").onclick = () => { const to = $("bk-copyto").value; if (to !== S.cur) { S.pats[to] = JSON.parse(JSON.stringify(P())); saveS(); msg(`Copied ${S.cur} to ${to}.`); } };
  $("bk-sloop").checked = S.songLoop; $("bk-sloop").onchange = (e) => { S.songLoop = e.target.checked; saveS(); };
  $("bk-wav").onclick = async () => { msg("Rendering…"); try { download(await renderWav(), `mini-sketch-${S.mode === "song" ? "song" : S.cur}.wav`); msg("WAV ready."); } catch (e) { console.warn(e); msg("WAV export failed on this browser."); } };
  $("bk-mid").onclick = () => { download(midiBlob(), `mini-sketch-${S.mode === "song" ? "song" : S.cur}.mid`); msg("MIDI ready."); };
  drawMixer(); drawSketch();
}
const msg = (t) => { const m = $("bk-msg"); if (m) m.textContent = t; };
function refreshLabels() { $("bk-bv").textContent = S.bpm; $("bk-sv").textContent = S.swing + "%"; $("bk-hv").textContent = S.human + "%"; $("bk-wv").textContent = S.wobble ? ["off","1/2 Hz","1 Hz","2 Hz","3 Hz","4 Hz","6 Hz","8 Hz"][S.wobble] : "off"; }
function drawMixer() {
  const knobs = [["vol", "Vol"], ["filter", "Filter"], ["reverb", "Reverb"], ["delay", "Delay"], ["dist", "Drive"]];
  $("bk-mix").innerHTML = `<div class="mx">${TRACKS.map((t) => `<div class="mx-r"><b>${t}</b>${knobs.map(([k, l]) => `<label>${l}<input type="range" min="0" max="100" data-t="${t}" data-k="${k}" value="${Math.round(S.fx[t][k] * 100)}"></label>`).join("")}</div>`).join("")}</div>`;
  $("bk-mix").oninput = (e) => { const { t, k } = e.target.dataset; if (!t) return; S.fx[t][k] = e.target.value / 100; saveS(); live && applyFx(live.g); };
}
function drawSong() {
  $("bk-song").innerHTML = S.song.map((e, i) => `<div class="ent" data-i="${i}"><b>${e.p}</b> ${e.label} <small>${(S.pats[e.p]?.bars || 0)} bars</small><span><button class="mini" data-a="up">↑</button><button class="mini" data-a="dup">Copy</button><button class="mini" data-a="del">✕</button></span></div>`).join("") || `<p class="dim">Add sections below.</p>`;
  $("bk-song").onclick = (ev) => { const a = ev.target.dataset.a, i = +ev.target.closest(".ent")?.dataset.i; if (!a || isNaN(i)) return;
    if (a === "del") S.song.splice(i, 1); if (a === "dup") S.song.splice(i + 1, 0, { ...S.song[i] }); if (a === "up" && i) [S.song[i - 1], S.song[i]] = [S.song[i], S.song[i - 1]]; saveS(); drawSong(); };
  safe("songmap", () => API.songMap && API.songMap());
}
function drawSketch() {
  const p = P(), n = spb(), grp = METERS[S.meter].grp;
  $("bk-pats").innerHTML = ["A","B","C"].map((k) => `<button data-k="${k}" class="${k === S.cur ? "on" : ""}">${k}</button>`).join("");
  $("bk-pats").onclick = (e) => { const k = e.target.dataset.k; if (k) { S.cur = k; saveS(); drawSketch(); if (live && S.mode === "pattern") startLive(); } };
  document.querySelectorAll("#bk-mode button").forEach((b) => b.classList.toggle("on", b.dataset.m === S.mode));
  $("bk-songbox").open = S.mode === "song" || $("bk-songbox").open;
  $("bk-bars").value = p.bars; $("bk-meter").value = S.meter; $("bk-scale").value = S.scale; $("bk-key").value = S.key;
  const bopt = Array.from({ length: p.bars }, (_, i) => `<option value="${i}">${i + 1}</option>`).join(""); $("bk-lf").innerHTML = bopt; $("bk-lt").innerHTML = bopt;
  S.loopFrom = Math.min(S.loopFrom, p.bars - 1); S.loopTo = Math.min(S.loopTo, p.bars - 1); $("bk-lf").value = S.loopFrom; $("bk-lt").value = S.loopTo; refreshLabels();
  const total = p.bars * n; const grid = $("bk-grid"); grid.style.gridTemplateColumns = `56px repeat(${total}, 22px)`;
  let html = `<div class="lab">Chord</div>` + p.chords.map((c, b) => `<button class="ch ${b >= S.loopFrom && b <= S.loopTo ? "in" : ""}" data-b="${b}" style="grid-column: span ${n}">${b + 1}: ${chordName(c)}</button>`).join("");
  ["kick","snare","hat","bass"].forEach((t) => { html += `<div class="lab">${t[0].toUpperCase() + t.slice(1)}</div>`;
    for (let i = 0; i < total; i++) { const b = Math.floor(i / n); let cls = "st" + (i % grp === 0 ? " q" : "") + (i % n === 0 ? " bar" : "") + (b < S.loopFrom || b > S.loopTo ? " out" : ""); let lab = "";
      if (t === "bass") { if (p.bass[i] != null) { cls += " on"; lab = (p.len[i] > 1 ? p.len[i] : "") + (p.bass[i] ? "<sup>" + (p.bass[i] > 0 ? "+" : "") + p.bass[i] + "</sup>" : ""); } }
      else if (p[t][i]) cls += " on v" + Math.round(p[t][i] * 10);
      html += `<button class="${cls}" data-t="${t}" data-s="${i}" aria-label="${t} step ${i + 1}">${lab}</button>`; } });
  grid.innerHTML = html;
  let pressT = null, pressed = false;
  grid.onpointerdown = (e) => { const c = e.target.closest("[data-t='bass']"); if (!c) return; pressed = false; pressT = setTimeout(() => { pressed = true; const i = +c.dataset.s; if (p.bass[i] == null) return; const opts = [0, 3, 5, 7, 10, 12, -5]; p.bass[i] = opts[(opts.indexOf(p.bass[i]) + 1) % opts.length]; saveS(); drawSketch(); }, 500); };
  grid.onpointerup = grid.onpointerleave = () => clearTimeout(pressT);
  grid.onclick = (e) => { const ch = e.target.closest(".ch"); if (ch) { const b = +ch.dataset.b; p.chords[b] = p.chords[b] >= 6 ? -1 : p.chords[b] + 1; saveS(); drawSketch(); return; }
    const c = e.target.closest("[data-t]"); if (!c || pressed) return; const t = c.dataset.t, i = +c.dataset.s;
    if (t === "bass") { if (p.bass[i] == null) { p.bass[i] = 0; p.len[i] = 1; } else if (p.len[i] === 1) p.len[i] = 2; else if (p.len[i] === 2) p.len[i] = 4; else { p.bass[i] = null; p.len[i] = 1; } }
    else { const cyc = [0, 1, 0.6, 0.3]; p[t][i] = cyc[(cyc.indexOf(p[t][i]) + 1) % cyc.length]; }
    saveS(); drawSketch(); };
  drawSong();
}
API.sketch = { play: () => !live && startLive(), stop: stopLive, finish, preset: applyPreset,
  set(o) { if (o.bpm) S.bpm = Math.max(50, Math.min(190, +o.bpm)); if (o.key && NOTES.includes(o.key)) S.key = o.key; if (o.scale && SCALES[o.scale]) S.scale = o.scale;
    if (o.bars && [4,8,16,32].includes(+o.bars)) resizePat(P(), +o.bars); if (o.pattern && S.pats[o.pattern]) S.cur = o.pattern; if (o.preset) { const k = Object.keys(PRESETS).find((x) => x.toLowerCase().includes(String(o.preset).toLowerCase())); k && applyPreset(k, true); }
    $("bk-bpm").value = S.bpm; saveS(); drawSketch(); } };

/* =================== TOOLS =================== */
const WISDOM = ["Well begun is half done. (Aristotle)", "The obstacle is the way. (Marcus Aurelius)", "Know thyself. (Delphi)", "A journey of a thousand miles begins with a single step. (Laozi)", "We suffer more in imagination than in reality. (Seneca)",
  "Waste no more time arguing what a good man should be. Be one. (Marcus Aurelius)", "No man ever steps in the same river twice. (Heraclitus)", "Patience is bitter, but its fruit is sweet. (Rousseau)", "He who has a why to live can bear almost any how. (Nietzsche)",
  "The best time to plant a tree was twenty years ago. The second best time is now. (proverb)", "Do the work in front of you, and do it well.", "Small steps every day beat giant leaps once a year.", "First say to yourself what you would be; then do what you have to do. (Epictetus)",
  "Music is the arithmetic of sounds as optics is the geometry of light. (Debussy)", "Simplicity is the ultimate sophistication. (da Vinci)", "Nature does not hurry, yet everything is accomplished. (Laozi)", "Luck is what happens when preparation meets opportunity. (Seneca)",
  "The mind is not a vessel to be filled, but a fire to be kindled. (Plutarch)", "Build the house one stone at a time.", "Rest is part of the rhythm, not a break from it."];
const wisdomToday = () => WISDOM[Math.floor(Date.now() / 864e5) % WISDOM.length];
/* voice input removed: nothing here ever asks for the microphone */
function voiceBtn() { return ""; }
function notify(title, body) { safe("notify", () => { if ("Notification" in window && Notification.permission === "granted") { navigator.serviceWorker?.getRegistration().then((r) => r ? r.showNotification(title, { body, icon: "icons/icon-192.png" }) : new Notification(title, { body })).catch(() => {}); } }); }
async function beep(times = 3) { const c = await getAC(); for (let i = 0; i < times; i++) { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.35; o.frequency.value = 880; g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.3); } }

function buildTools() {
  const pane = addPane("tools", `<h2>Tools</h2>
  <div class="card wis"><small>Wisdom of the day</small><p id="tl-wis"></p><button class="mini" id="tl-wisnext">Another</button></div>
  <div class="seg tl-seg" id="tl-seg"><button data-s="notes" class="on">Notes</button><button data-s="time">Timer</button><button data-s="tempo">Tempo</button><button data-s="calc">Calc</button><button data-s="dream">Dreams</button></div>
  <div class="tl" id="tl-notes"><div class="row"><input id="nt-in" placeholder="A note or task"><button class="send" id="nt-add">Add</button>${voiceBtn("nt-in")}</div><div id="nt-list"></div><button class="mini" id="nt-clr">Remove done</button></div>
  <div class="tl" id="tl-time" hidden>
    <div class="big" id="tm-show">05:00</div><div class="row"><input type="number" id="tm-min" value="5" min="0" max="600" style="width:80px"> min <button class="send" id="tm-go">Start</button><button class="chip" id="tm-reset">Reset</button></div>
    <div class="row"><button class="chip" data-p="1">1</button><button class="chip" data-p="5">5</button><button class="chip" data-p="10">10</button><button class="chip" data-p="25">25 focus</button></div>
    <h3>Stopwatch</h3><div class="big" id="sw-show">00:00.0</div><div class="row"><button class="send" id="sw-go">Start</button><button class="chip" id="sw-lap">Lap</button><button class="chip" id="sw-reset">Reset</button></div><div id="sw-laps" class="dim"></div></div>
  <div class="tl" id="tl-tempo" hidden>
    <button class="tap" id="tp-tap">TAP</button><div class="big" id="tp-bpm">— BPM</div><button class="chip" id="tp-send">Send to Sketch</button>
    <h3>Metronome</h3><div class="row"><label>BPM <b id="mt-bv">100</b><input type="range" id="mt-bpm" min="30" max="240" value="100"></label><label>Beats<select id="mt-beats"><option>2</option><option>3</option><option selected>4</option><option>6</option><option>7</option></select></label><button class="send" id="mt-go">Start</button></div><div class="dots" id="mt-dots"></div></div>
  <div class="tl" id="tl-calc" hidden>
    <input id="cl-in" placeholder="e.g. (12+3)*4/5, sqrt(2), 2^10, 15%"><div class="big" id="cl-out">=</div>
    <h3>Convert</h3><div class="row"><input type="number" id="cv-v" value="1" style="width:90px"><select id="cv-cat"></select><select id="cv-from"></select>→<select id="cv-to"></select></div><div class="big" id="cv-out"></div></div>
  <div class="tl" id="tl-dream" hidden><textarea id="dr-in" rows="4" placeholder="What did you dream? Mini keeps it private on this device."></textarea><div class="row"><button class="send" id="dr-save">Save dream</button>${voiceBtn("dr-in")}</div><div id="dr-list"></div></div>`);
  $("tl-seg").onclick = (e) => { const s = e.target.dataset.s; if (!s) return; document.querySelectorAll("#tl-seg button").forEach((b) => b.classList.toggle("on", b === e.target)); document.querySelectorAll(".tl").forEach((t) => (t.hidden = t.id !== "tl-" + s)); };
  let wi = WISDOM.indexOf(wisdomToday()); $("tl-wis").textContent = WISDOM[wi]; $("tl-wisnext").onclick = () => { wi = (wi + 1) % WISDOM.length; $("tl-wis").textContent = WISDOM[wi]; };
  safe("notes", buildNotes); safe("timer", buildTimer); safe("tempo", buildTempo); safe("calc", buildCalc); safe("dream", buildDream);
  return pane;
}
function buildNotes() {
  let notes = LS.get("miniBeastNotes", []); const draw = () => { $("nt-list").innerHTML = notes.map((n, i) => `<label class="note ${n.done ? "done" : ""}"><input type="checkbox" data-i="${i}" ${n.done ? "checked" : ""}> <span></span><button class="mini" data-x="${i}">✕</button></label>`).join("") || `<p class="dim">Nothing yet.</p>`;
    $("nt-list").querySelectorAll(".note span").forEach((s, i) => (s.textContent = notes[i].t)); LS.set("miniBeastNotes", notes); };
  API.addNote = (t) => { t = String(t || "").trim().slice(0, 300); if (t) { notes.unshift({ t, done: false, at: Date.now() }); draw(); } };
  $("nt-add").onclick = () => { API.addNote($("nt-in").value); $("nt-in").value = ""; }; $("nt-in").onkeydown = (e) => e.key === "Enter" && $("nt-add").onclick();
  $("nt-list").onclick = (e) => { if (e.target.dataset.x) { notes.splice(+e.target.dataset.x, 1); draw(); } else if (e.target.dataset.i) { notes[+e.target.dataset.i].done = e.target.checked; draw(); } };
  $("nt-clr").onclick = () => { notes = notes.filter((n) => !n.done); draw(); }; draw();
}
function buildTimer() {
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`; let end = 0, left = 300, iv = null;
  const draw = () => { $("tm-show").textContent = fmt(Math.max(0, left)); };
  const stop = () => { clearInterval(iv); iv = null; $("tm-go").textContent = "Start"; };
  API.timer = (min) => { left = Math.max(1, Math.round(+min * 60)); $("tm-min").value = +min; stop(); start(); };
  const start = () => { end = Date.now() + left * 1000; $("tm-go").textContent = "Pause"; iv = setInterval(() => { left = (end - Date.now()) / 1000; draw(); if (left <= 0) { stop(); left = 0; draw(); beep(); notify("Mini Alpha", "Timer done."); } }, 250); };
  $("tm-go").onclick = () => (iv ? stop() : (left <= 0 && (left = +$("tm-min").value * 60), start()));
  $("tm-reset").onclick = () => { stop(); left = +$("tm-min").value * 60; draw(); }; $("tm-min").oninput = () => { if (!iv) { left = +$("tm-min").value * 60; draw(); } };
  document.querySelectorAll("#tl-time [data-p]").forEach((b) => (b.onclick = () => { $("tm-min").value = b.dataset.p; stop(); left = b.dataset.p * 60; draw(); }));
  let sw0 = 0, swAcc = 0, swIv = null; const swDraw = () => { const t = swAcc + (swIv ? Date.now() - sw0 : 0); $("sw-show").textContent = fmt(t / 1000) + "." + Math.floor((t % 1000) / 100); return t; };
  $("sw-go").onclick = () => { if (swIv) { swAcc += Date.now() - sw0; clearInterval(swIv); swIv = null; $("sw-go").textContent = "Start"; } else { sw0 = Date.now(); swIv = setInterval(swDraw, 100); $("sw-go").textContent = "Pause"; } };
  $("sw-lap").onclick = () => { $("sw-laps").innerHTML = `<div>${$("sw-show").textContent}</div>` + $("sw-laps").innerHTML; };
  $("sw-reset").onclick = () => { clearInterval(swIv); swIv = null; swAcc = 0; $("sw-go").textContent = "Start"; swDraw(); $("sw-laps").innerHTML = ""; }; draw();
}
function buildTempo() {
  let taps = [], bpm = 0; $("tp-tap").onpointerdown = () => { const t = performance.now(); taps = taps.filter((x) => t - x < 3000); taps.push(t); if (taps.length > 1) { const d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); bpm = Math.round(60000 / d); $("tp-bpm").textContent = bpm + " BPM"; } };
  $("tp-send").onclick = () => { if (bpm) { API.sketch.set({ bpm }); $("tp-send").textContent = "Sent " + bpm; } };
  let mt = null, beat = 0, next = 0;
  const draw = () => { $("mt-dots").innerHTML = Array.from({ length: +$("mt-beats").value }, (_, i) => `<i data-b="${i}"></i>`).join(""); }; draw(); $("mt-beats").onchange = draw;
  $("mt-bpm").oninput = () => ($("mt-bv").textContent = $("mt-bpm").value);
  API.metronome = async (b) => { if (b) { $("mt-bpm").value = Math.max(30, Math.min(240, +b)); $("mt-bv").textContent = $("mt-bpm").value; } if (!mt) await $("mt-go").onclick(); };
  $("mt-go").onclick = async () => { if (mt) { clearInterval(mt); mt = null; $("mt-go").textContent = "Start"; return; } const c = await getAC(); beat = 0; next = c.currentTime + 0.05; $("mt-go").textContent = "Stop";
    mt = setInterval(() => { while (next < c.currentTime + 0.1) { const n = +$("mt-beats").value, acc = beat % n === 0, o = c.createOscillator(), g = c.createGain(); o.frequency.value = acc ? 1500 : 1000; g.gain.setValueAtTime(0.3, next); g.gain.exponentialRampToValueAtTime(0.001, next + 0.05); o.connect(g).connect(c.destination); o.start(next); o.stop(next + 0.06);
        const b = beat % n; setTimeout(() => document.querySelectorAll("#mt-dots i").forEach((d, i) => d.classList.toggle("on", i === b)), Math.max(0, (next - c.currentTime) * 1000)); beat++; next += 60 / $("mt-bpm").value; } }, 25); };
}
/* safe calculator: tokenizer + shunting-yard, no eval */
function calc(src) {
  const toks = String(src).toLowerCase().replace(/×/g, "*").replace(/÷/g, "/").match(/\d*\.?\d+(e[+-]?\d+)?|[a-z]+|[-+*/^%(),]/g); if (!toks) throw 0;
  const F = { sqrt: Math.sqrt, sin: (x) => Math.sin(x * Math.PI / 180), cos: (x) => Math.cos(x * Math.PI / 180), tan: (x) => Math.tan(x * Math.PI / 180), log: Math.log10, ln: Math.log, abs: Math.abs, round: Math.round }, C = { pi: Math.PI, e: Math.E };
  const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3, "u": 4 }; const out = [], ops = []; let prev = null;
  for (const t of toks) {
    if (/^[\d.]/.test(t)) out.push(+t); else if (t in C) out.push(C[t]); else if (t in F) ops.push(t); else if (t === "(") ops.push(t);
    else if (t === ")") { while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop()); ops.pop(); if (ops.length && ops[ops.length - 1] in F) out.push(ops.pop()); }
    else if (t === "%") out.push("%");
    else if (t in prec) { let o = t; if (t === "-" && (prev === null || (prev in prec) || prev === "(")) o = "u"; else if (t === "+" && (prev === null || prev in prec || prev === "(")) { prev = t; continue; }
      while (ops.length && ops[ops.length - 1] in prec && (prec[ops[ops.length - 1]] > prec[o] || (prec[ops[ops.length - 1]] === prec[o] && o !== "^" && o !== "u"))) out.push(ops.pop()); ops.push(o); }
    else throw 0; prev = t; }
  while (ops.length) { const o = ops.pop(); if (o === "(") throw 0; out.push(o); }
  const st = []; for (const x of out) { if (typeof x === "number") st.push(x); else if (x === "%") st.push(st.pop() / 100); else if (x === "u") st.push(-st.pop()); else if (x in F) st.push(F[x](st.pop())); else { const b = st.pop(), a = st.pop(); if (a === undefined || b === undefined) throw 0; st.push(x === "+" ? a + b : x === "-" ? a - b : x === "*" ? a * b : x === "/" ? a / b : Math.pow(a, b)); } }
  if (st.length !== 1 || !isFinite(st[0])) throw 0; return +st[0].toPrecision(12);
}
const UNITS = { Length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 }, Mass: { kg: 1, g: 0.001, lb: 0.45359237, oz: 0.0283495, st: 6.35029 },
  Volume: { L: 1, mL: 0.001, gal: 3.78541, qt: 0.946353, cup: 0.236588, "fl oz": 0.0295735, tbsp: 0.0147868, tsp: 0.00492892 }, Speed: { "km/h": 1, mph: 1.609344, "m/s": 3.6, knot: 1.852 }, Temp: { "°C": "c", "°F": "f", K: "k" }, Data: { MB: 1, GB: 1000, KB: 0.001, TB: 1e6 } };
function convert(v, cat, a, b) { const U = UNITS[cat]; if (cat === "Temp") { const c = a === "°C" ? v : a === "°F" ? (v - 32) * 5 / 9 : v - 273.15; return b === "°C" ? c : b === "°F" ? c * 9 / 5 + 32 : c + 273.15; } return v * U[a] / U[b]; }
function buildCalc() {
  $("cl-in").oninput = () => { const v = $("cl-in").value.trim(); if (!v) return ($("cl-out").textContent = "="); try { $("cl-out").textContent = "= " + calc(v); } catch (_) { $("cl-out").textContent = "= …"; } };
  $("cv-cat").innerHTML = Object.keys(UNITS).map((k) => `<option>${k}</option>`).join("");
  const fill = () => { const u = Object.keys(UNITS[$("cv-cat").value]).map((k) => `<option>${k}</option>`).join(""); $("cv-from").innerHTML = u; $("cv-to").innerHTML = u; $("cv-to").selectedIndex = 1; go(); };
  const go = () => { const r = convert(+$("cv-v").value, $("cv-cat").value, $("cv-from").value, $("cv-to").value); $("cv-out").textContent = `${$("cv-v").value} ${$("cv-from").value} = ${+r.toPrecision(8)} ${$("cv-to").value}`; };
  $("cv-cat").onchange = fill; ["cv-v", "cv-from", "cv-to"].forEach((id) => ($(id).oninput = go)); fill();
}
function buildDream() {
  let dreams = LS.get("miniBeastDreams", []); const draw = () => { $("dr-list").innerHTML = ""; dreams.forEach((d, i) => { const c = h("div", { class: "card" }); c.appendChild(h("small", {}, new Date(d.at).toLocaleDateString())); const p = h("p"); p.textContent = d.t; c.appendChild(p); const x = h("button", { class: "mini" }, "Delete"); x.onclick = () => { dreams.splice(i, 1); draw(); }; c.appendChild(x); $("dr-list").appendChild(c); }); LS.set("miniBeastDreams", dreams); };
  $("dr-save").onclick = () => { const t = $("dr-in").value.trim(); if (t) { dreams.unshift({ t: t.slice(0, 4000), at: Date.now() }); $("dr-in").value = ""; draw(); } }; draw();
}

/* =================== WRITE helper + song map =================== */
const BANNED = { words: ["back","black","come","came","coming","become","overcome","welcome","boot","boots","crack","veil","spark","fog","you","your","rod","staff","shaft","strap","deep","deeper","harder","brick","clock","locked","gray","grey","throne","king","crown","fire","flame","heat","ash","forge","tempered","glow","smoke","burn","burned","blaze"],
  phrases: ["hook up","raw power","six in the morning","on my tongue"], warn: ["most high","taste","tongue","flavor","flavour","bitter taste","kings","crowns","royalty","romance","in me"], lowden: ["get lowden","low down","loud and clear","loud enough"] };
function syllables(w) { w = w.toLowerCase().replace(/[^a-z]/g, ""); if (!w) return 0; if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, ""); const m = w.match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1); }
function rhymeKey(w) { w = w.toLowerCase().replace(/[^a-z]/g, ""); const m = w.match(/[aeiouy]+[^aeiouy]*$/); return m ? m[0].replace(/e$/, "") : w; }
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function checkLine(l) {
  const low = l.toLowerCase(), flags = [];
  BANNED.words.forEach((w) => { if (new RegExp("\\b" + esc(w) + "\\b").test(low)) flags.push(["ban", w]); });
  BANNED.phrases.forEach((w) => { if (low.includes(w)) flags.push(["ban", w]); });
  BANNED.warn.forEach((w) => { if (new RegExp("\\b" + esc(w) + "\\b").test(low)) flags.push(["warn", w]); });
  (low.match(/\b\w+(ick|ock)\b/g) || []).forEach((w) => flags.push(["warn", w + " (-ick/-ock)"]));
  return flags;
}
const RHYME_BANK = "light night sight bright rise skies wise eyes mind find kind blind time rhyme climb line sign shine design stone alone known shown own road load gold told hold cold bold soul whole control goal roll steel feel real heal reveal seal ground sound found bound around crown down town gate fate weight wait late great state rain chain plain remain pain gain name same flame frame aim claim storm form warm born worn torn sky high fly why try cry die lie truth youth proof roof heart start art apart part chart dark mark stark arc star far scar are war door floor more core roar shore before".split(" ").filter((w) => !checkLine(w).length);
function buildWrite() {
  const pane = $("pane-write"); if (!pane) return;
  const box = h("div", { class: "wh" }, `<h3>Draft pad</h3><p class="dim">Type lines. Mini counts syllables, marks rhymes, and flags banned words as you go.</p>
    <textarea id="wh-in" rows="8" placeholder="One line per row"></textarea><div class="row">${voiceBtn("wh-in")}<button class="chip" id="wh-save">Save draft</button></div><div id="wh-sum" class="dim"></div><div id="wh-lines"></div>
    <h3>Rhyme helper</h3><div class="row"><input id="wh-word" placeholder="a word"><span id="wh-rh" class="dim"></span></div>
    <h3>Song map</h3><p class="dim">Lyrics lined up with the Sketch song sections (Sketch → Song mode).</p><div id="wh-map"></div>`);
  pane.appendChild(box);
  $("wh-in").value = LS.get("miniBeastDraft", "");
  const run = () => { const lines = $("wh-in").value.split("\n"); const keys = {}, let_ = "ABCDEFGHIJ"; let n = 0; let bans = 0;
    const lowden = BANNED.lowden.reduce((a, g) => a + ($("wh-in").value.toLowerCase().split(g).length - 1), 0);
    $("wh-lines").innerHTML = lines.map((l) => { if (!l.trim()) return `<div class="wl gap"></div>`; const words = l.match(/[A-Za-z']+/g) || []; const syl = words.reduce((a, w) => a + syllables(w), 0); const k = rhymeKey(words[words.length - 1] || "");
      if (!(k in keys)) keys[k] = let_[n++ % let_.length]; const f = checkLine(l); bans += f.filter((x) => x[0] === "ban").length;
      let safeL = l.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); f.forEach(([t, w]) => { const ww = w.split(" (")[0]; safeL = safeL.replace(new RegExp("\\b(" + esc(ww) + ")\\b", "gi"), `<mark class="${t}">$1</mark>`); });
      return `<div class="wl"><span class="syl">${syl}</span><span class="rk">${keys[k]}</span><span class="tx">${safeL}</span></div>`; }).join("");
    $("wh-sum").textContent = `${bans} banned hit${bans === 1 ? "" : "s"} · Lowden tags: ${lowden} (need exactly 1)`; LS.set("miniBeastDraft", $("wh-in").value); };
  $("wh-in").oninput = run; run();
  $("wh-save").onclick = () => { try { window.MiniApp?.save?.("draft", $("wh-in").value); $("wh-save").textContent = "Saved"; } catch (_) {} };
  $("wh-word").oninput = () => { const k = rhymeKey($("wh-word").value); const w = $("wh-word").value.toLowerCase(); const r = RHYME_BANK.filter((x) => x !== w && (rhymeKey(x) === k || (k.length > 2 && x.endsWith(k.slice(-2))))); $("wh-rh").textContent = w ? (r.slice(0, 14).join(", ") || "no match in Mini's word bank") + (checkLine(w).length ? " · that word is flagged" : "") : ""; };
  const map = LS.get("miniBeastSongMap", {});
  API.songMap = () => { const el = $("wh-map"); if (!el) return; el.innerHTML = ""; S.song.forEach((e, i) => { const key = i + ":" + e.label; const d = h("div", { class: "card" }); d.appendChild(h("small", {}, `${e.label} · pattern ${e.p} · ${S.pats[e.p]?.bars || 0} bars`)); const t = h("textarea", { rows: "3", placeholder: "lines for this section" }); t.value = map[key] || ""; t.oninput = () => { map[key] = t.value; LS.set("miniBeastSongMap", map); }; d.appendChild(t); el.appendChild(d); }); };
  API.songMap();
}

/* =================== CANVAS (Atlas kit) =================== */
let mc = null;
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
function buildCanvas() {
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "canvas/canvas.css?v=1"; document.head.appendChild(l);
  const pane = addPane("canvas", `<h2>Canvas</h2>
    <div class="row cv-tools" id="cv-tools"></div>
    <div class="row cv-sw" id="cv-sw"></div>
    <div class="row"><label>Size<input type="range" id="cv-size" min="1" max="120" value="14"></label><label>Layer<select id="cv-layer"><option value="0">Back</option><option value="1" selected>Middle</option><option value="2">Top</option></select></label></div>
    <div class="row cv-stamps" id="cv-stamps" hidden></div>
    <div class="cv-wrap" id="cv-wrap"><div id="stage"></div></div>
    <div class="row"><button class="chip" id="cv-undo"><img src="canvas/icons/undo.svg" alt="">Undo</button><button class="chip" id="cv-redo"><img src="canvas/icons/redo.svg" alt="">Redo</button><button class="chip" id="cv-clear"><img src="canvas/icons/clear.svg" alt="">Clear</button>
      <button class="chip" id="cv-png"><img src="canvas/icons/export.svg" alt="">PNG</button><button class="chip" id="cv-rec" hidden>Record video</button><button class="chip" id="cv-full" hidden>Fullscreen</button></div><p class="dim" id="cv-msg"></p>`);
  let started = false; const tabBtn = document.querySelector('.tabs [data-p="canvas"]');
  const start = () => { if (started) return; started = true; loadScript("canvas/brushes.js?v=1").then(() => safe("canvas-mount", mountCanvas)).catch((e) => { console.warn("[canvas]", e); $("cv-msg").textContent = "Canvas kit did not load."; }); };
  tabBtn.addEventListener("click", start); API.ensureCanvas = () => new Promise((ok) => { start(); const t = setInterval(() => { if (mc) { clearInterval(t); ok(mc); } }, 100); setTimeout(() => clearInterval(t), 8000); });
}
function mountCanvas() {
  mc = window.MiniCanvas("#stage", { width: 1024, height: 1024, stampBase: "canvas/stamps/", background: "#0b1a33", maxUndo: IOS ? 8 : 24 });
  const tools = ["pen", "airbrush", "glow", "smudge", "eraser", "stamp"];
  $("cv-tools").innerHTML = tools.map((t) => `<button class="chip ${t === "pen" ? "on" : ""}" data-t="${t}"><img src="canvas/icons/${t}.svg" alt="">${t}</button>`).join("");
  $("cv-tools").onclick = (e) => { const b = e.target.closest("[data-t]"); if (!b) return; mc.setTool(b.dataset.t); document.querySelectorAll("#cv-tools .chip").forEach((x) => x.classList.toggle("on", x === b)); $("cv-stamps").hidden = b.dataset.t !== "stamp";
    if (b.dataset.t === "glow") { mc.setLayer(1); $("cv-layer").value = "1"; } };
  const sw = (window.MiniCanvas.PALETTE || []).map((s) => (typeof s === "string" ? s : s.hex));
  fetch("canvas/palette.json").then((r) => r.json()).then((j) => paint(j.swatches.map((s) => s.hex))).catch(() => paint(sw));
  function paint(list) { $("cv-sw").innerHTML = list.map((c) => `<button class="sw" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join(""); }
  $("cv-sw").onclick = (e) => { const c = e.target.dataset.c; if (c) { mc.setColor(c); document.querySelectorAll("#cv-sw .sw").forEach((x) => x.classList.toggle("on", x === e.target)); } };
  $("cv-stamps").innerHTML = (window.MiniCanvas.STAMPS || []).map((s) => `<button class="stamp" data-s="${s}"><img src="canvas/stamps/${s}.png" alt="${s}"></button>`).join("");
  $("cv-stamps").onclick = (e) => { const b = e.target.closest("[data-s]"); if (b) { mc.setStamp(b.dataset.s, 1, 0); document.querySelectorAll("#cv-stamps .stamp").forEach((x) => x.classList.toggle("on", x === b)); } };
  $("cv-size").oninput = (e) => mc.setSize(+e.target.value); mc.setSize(14);
  $("cv-layer").onchange = (e) => mc.setLayer(+e.target.value); mc.setLayer(1);
  $("cv-undo").onclick = () => mc.undo(); $("cv-redo").onclick = () => mc.redo(); $("cv-clear").onclick = () => { if (confirm("Clear the drawing?")) mc.clearLayer(); };
  $("cv-png").onclick = () => mc.exportPNG("mini-canvas.png").then((b) => b && download(b, "mini-canvas.png")).catch(() => ($("cv-msg").textContent = "PNG export failed."));
  const wrap = $("cv-wrap"); if (wrap.requestFullscreen && !IOS) { $("cv-full").hidden = false; $("cv-full").onclick = () => (document.fullscreenElement ? document.exitFullscreen() : $("pane-canvas").requestFullscreen().catch(() => {})); }
  // video: only where MediaRecorder can write MP4 (Safari, newer Chrome); WebM elsewhere is skipped
  const cvs = $("stage").querySelector("canvas"); const mp4 = window.MediaRecorder && ["video/mp4;codecs=avc1", "video/mp4"].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
  if (mp4 && cvs && cvs.captureStream) { let rec = null; $("cv-rec").hidden = false; $("cv-rec").onclick = () => { if (rec) { rec.stop(); return; } const chunks = []; const flat = document.createElement("canvas"); flat.width = flat.height = 1024; const fx = flat.getContext("2d");
      let raf; const loop = () => { safe("rec", () => fx.drawImage(mc.flatten ? mc.flatten() : cvs, 0, 0)); raf = requestAnimationFrame(loop); }; loop();
      rec = new MediaRecorder(flat.captureStream(30), { mimeType: mp4 }); rec.ondataavailable = (e) => chunks.push(e.data); rec.onstop = () => { cancelAnimationFrame(raf); download(new Blob(chunks, { type: "video/mp4" }), "mini-canvas.mp4"); rec = null; $("cv-rec").textContent = "Record video"; }; rec.start(); $("cv-rec").textContent = "Stop recording"; }; }
}
const EMBER = ["#e07a1f", "#b32020", "#7a1414", "#d4a63a", "#f4d782"];
async function miniDraw(j) {
  const c = await API.ensureCanvas(); if (!c) return false; const tools = ["pen", "airbrush", "glow", "smudge", "eraser"];
  const pts = (Array.isArray(j.points) ? j.points : []).slice(0, 400).map((p) => Array.isArray(p) ? { x: +p[0], y: +p[1], p: 0.6 } : { x: +p.x, y: +p.y, p: +p.p || 0.6 }).filter((p) => isFinite(p.x) && isFinite(p.y)).map((p) => ({ x: Math.max(0, Math.min(1024, p.x)), y: Math.max(0, Math.min(1024, p.y)), p: p.p }));
  if (j.stamp && (window.MiniCanvas.STAMPS || []).includes(j.stamp)) { await c.placeStamp(j.stamp, Math.max(0, Math.min(1024, +j.x || 512)), Math.max(0, Math.min(1024, +j.y || 512)), Math.max(0.2, Math.min(3, +j.scale || 1)), +j.rot || 0); return true; }
  if (pts.length < 2) return false; const tool = tools.includes(j.tool) ? j.tool : "pen"; const color = window.MiniCanvas.nearest ? window.MiniCanvas.nearest(String(j.color || "#9aa5b1")) : "#9aa5b1";
  // glow sits under metal; ember/red/gold never painted on top of steel: they go to the middle layer
  const layer = tool === "glow" || EMBER.includes(String(color).toLowerCase()) ? 1 : (j.layer === 0 ? 0 : 2);
  c.stroke(pts, { tool, color, size: Math.max(1, Math.min(120, +j.size || 12)), layer }); return true;
}

/* =================== Mini tags =================== */
function parseObj(s) { try { const j = JSON.parse(s); return j && typeof j === "object" && !Array.isArray(j) ? j : null; } catch (_) { return null; } }
function tagScan(text, name) { const out = [], re = new RegExp("\\[" + name + "\\s*:\\s*\\{", "gi"); let m; while ((m = re.exec(text))) { let i = m.index + m[0].length - 1, d = 0, q = false, st = i; for (; i < text.length; i++) { const c = text[i]; if (q) { if (c === "\\") i++; else if (c === '"') q = false; continue; } if (c === '"') q = true; else if (c === "{" || c === "[") d++; else if (c === "}" || c === "]") { d--; if (!d) { i++; break; } } } const j = parseObj(text.slice(st, i)); j && out.push(j); } return out.slice(0, 4); }
async function onReply(raw) {
  for (const j of tagScan(raw, "tool")) await safe("tag", () => runTool(j));
  for (const j of tagScan(raw, "draw")) await safe("draw", () => miniDraw(j));
}
async function runTool(j) {
  switch (String(j.a || "")) {
    case "note": return API.addNote && API.addNote(j.text);
    case "timer": return API.timer && isFinite(+j.min) && API.timer(Math.max(0.1, Math.min(600, +j.min)));
    case "metronome": return API.metronome && API.metronome(j.bpm);
    case "sketch": API.sketch.set(j); if (j.play) API.sketch.play(); return;
    case "finish": return finish(j.what === "bass" ? "bass" : j.what === "drums" ? "drums" : undefined);
    case "open": return ["tools", "canvas", "sketch", "studio", "write", "chat", "den", "ideas"].includes(j.tab) && show(j.tab);
    case "wisdom": { const w = $("tl-wis"); return w && (w.textContent = wisdomToday()); }
  }
}
export const TAG_HELP = `Tools you can drive (one tag at most, only when it helps): [tool:{"a":"note","text":"..."}] [tool:{"a":"timer","min":5}] [tool:{"a":"metronome","bpm":90}] [tool:{"a":"sketch","preset":"epic|dark|ancient","bars":16,"bpm":100,"key":"E","play":true}] [tool:{"a":"finish","what":"bass|drums"}] [tool:{"a":"open","tab":"tools|canvas|sketch"}] [draw:{"tool":"pen|glow|airbrush","color":"#d4a63a","size":10,"points":[[100,100],[300,200]]}] or [draw:{"stamp":"gear","x":512,"y":512,"scale":1}]. Canvas is 1024x1024; glow goes under metal.`;


/* =================== UI v2: nav, sketch panel, avatar, message actions, honest offline voice =================== */
const MOOD_COL = { calm: "#9aa5b1", thinking: "#d8dee4", firedup: "#e07a1f", wise: "#d4a63a", playful: "#b32020", focused: "#7a1414" };
const curMood = () => (window.MiniApp && window.MiniApp.mood && window.MiniApp.mood()) || document.getElementById("ring")?.dataset.mood || "calm";
function mountNav() {
  const host = h("div", { id: "mini-nav" }); document.body.appendChild(host);
  const oldTabs = document.querySelector(".tabs"); oldTabs.classList.add("legacy-tabs");
  const nav = window.MiniNav.mount(host, { tabs: ["Chat", "Sketch", "Write", "Canvas", "Den"], more: ["Studio", "Sculpt", "Tools", "Ideas", "Settings"], active: "chat",
    onSelect: (id) => { if (id === "settings") { $("btn-settings")?.click(); return; } document.querySelector(`.tabs [data-p="${id}"]`)?.click(); } });
  nav.select("chat", true);
  oldTabs.addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b && nav.active !== b.dataset.p) safe("navsync", () => nav.select(b.dataset.p, true)); syncPanel(); }, true);
  API.nav = nav; document.documentElement.classList.add("has-mini-nav");
}
let panel = null;
function syncPanel() { setTimeout(() => { const el = $("mp-panel"); if (!el) return; const on = $("pane-sketch")?.classList.contains("active"); el.style.display = on ? "" : "none"; padSketch(); }, 0); }
function padSketch() { const el = $("mp-panel"), pane = $("pane-sketch"); if (el && pane) pane.style.paddingBottom = (el.offsetHeight + 64) + "px"; }
function mountPanel() {
  const ctl = document.querySelector(".bk-ctl"); if (!ctl) return;
  const el = h("div", { id: "mp-panel", class: "mp" }, `<div class="mp-row"></div><div class="mp-body"></div>`); document.body.appendChild(el);
  const row = el.querySelector(".mp-row"), body = el.querySelector(".mp-body");
  [$("bk-bars"), $("bk-key")].forEach((s) => row.appendChild(s.closest("label")));
  const pl = h("button", { class: "mp-play", "aria-pressed": "false", "aria-label": "Play" }); row.appendChild(pl);
  ctl.classList.add("in-panel"); body.appendChild(ctl);
  $("bk-play").hidden = true;
  panel = window.MiniPanel.mount(el, { onToggle: () => setTimeout(padSketch, 320), onPlay: (v) => { if (v && !live) startLive(); else if (!v && live) stopLive(); } });
  safe("ro", () => new ResizeObserver(padSketch).observe(el)); syncPanel();
}
function mountAvatar() {
  const stage = document.querySelector("#pane-chat .stage"); if (!stage) return;
  const box = h("div", { class: "mav", id: "mav" }, `<div class="mav-ring"><img id="mav-img" alt="Mini Alpha"></div><div class="mav-cap"><b id="mav-mood"></b><span id="mav-mind"></span></div><div class="mav-think" id="mav-think"></div>`);
  stage.parentNode.insertBefore(box, stage); stage.classList.add("stage-small");
  const img = $("mav-img"); img.onerror = () => { img.onerror = null; img.src = "icons/icon-512.png"; };
  const paint = (m) => { m = m || curMood(); box.style.setProperty("--mc", MOOD_COL[m] || MOOD_COL.calm); $("mav-mood").textContent = m === "firedup" ? "fired up" : m; const src = `moods/avatars/avatar-${["calm","thinking","firedup","wise","playful"].includes(m) ? m : "calm"}.png`; if (!img.src.endsWith(src)) img.src = src; };
  window.addEventListener("mini-mood", (e) => { paint(e.detail); box.classList.remove("react"); void box.offsetWidth; box.classList.add("react"); });
  const ring = $("ring");
  if (ring) new MutationObserver(() => { const thinking = ring.classList.contains("think"), answering = ring.classList.contains("answer"); box.classList.toggle("thinking", thinking); box.classList.toggle("answering", answering);
    if (thinking) { innerLine(); paint("thinking"); } else if (!answering) paint(ring.dataset.mood); }).observe(ring, { attributes: true, attributeFilter: ["class", "data-mood"] });
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains("card") && !n.classList.contains("me")) { box.classList.remove("react"); void box.offsetWidth; box.classList.add("react"); } }).observe($("chat-log"), { childList: true });
  safe("idle-bubble", () => { const th = $("thought"); if (th) new MutationObserver(() => { const t = th.textContent.trim(); const el = $("mav-think"); if (!t || !el || box.classList.contains("thinking")) return; el.textContent = t; el.classList.add("show"); clearTimeout(innerLine.t); innerLine.t = setTimeout(() => el.classList.remove("show"), 9000); }).observe(th, { childList: true, characterData: true, subtree: true }); });
  safe("autoscroll", () => { const pane = $("pane-chat"); let stick = true; pane.addEventListener("scroll", () => { stick = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 140; });
    new MutationObserver(() => { if (stick) pane.scrollTop = pane.scrollHeight; }).observe($("chat-log"), { childList: true, subtree: true, characterData: true }); });
  paint(); mindState(); window.addEventListener("mini-mind", mindState); setInterval(mindState, 4000);
}
function mindState() { const on = !!(window.MiniApp && window.MiniApp.hasMind && window.MiniApp.hasMind()); const el = $("mav-mind"); if (!el) return;
  el.textContent = on ? "full mind online" : "full mind not loaded: offline voice"; el.className = on ? "on" : "off"; }
/* inner aside: soul + mood + memory */
let SOUL_LINES = null;
function soulLines() { if (SOUL_LINES) return SOUL_LINES; const src = String((window.MiniApp && window.MiniApp.SOUL) || ""); SOUL_LINES = src.replace(/[#*_>`]/g, " ").split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim().replace(/^[-•\d.\s]+/, "").replace(/^[A-Z][\w ]{1,20}:\s*/, "")).filter((x) => /^(I|My|We)\b/.test(x) && /[.!]$/.test(x) && !/["“”]/.test(x) && x.length > 24 && x.length < 150 && !checkLine(x).length && !/\byou\b|deeper/i.test(x)); return SOUL_LINES; }
const lastUser = () => { const m = [...document.querySelectorAll("#chat-log .card.me")].pop(); return m ? m.textContent.trim() : ""; };
function topicOf(t) { const w = (t.toLowerCase().match(/[a-z']{4,}/g) || []).filter((x) => !["that","this","with","what","have","just","like","make","about","would","could","there","your","want","them","they","from","when","then","will","know","okay"].includes(x)); return w.sort((a, b) => b.length - a.length)[0] || ""; }
function innerLine() { const el = $("mav-think"); if (!el) return; const m = curMood(), t = topicOf(lastUser()); const sl = soulLines(); const mem = LS.get("miniBeastNotes", [])[0];
  const opts = [t && `turning “${t}” over, looking for the part that matters to him`, sl.length && sl[Math.floor(Math.random() * sl.length)], mem && `remembering his note: “${mem.t.slice(0, 50)}”`, `mood is ${m === "firedup" ? "fired up" : m}; letting that steer the answer`].filter(Boolean);
  el.textContent = "thinking… " + opts[Math.floor(Math.random() * opts.length)]; el.classList.add("show"); clearTimeout(innerLine.t); innerLine.t = setTimeout(() => el.classList.remove("show"), 9000); }
/* pull "(aside: ...)" off a model reply and show it as an inner line on the card */
function aside(card, out) { const m = String(out || "").match(/^\s*[(*_]{1,2}\s*(?:aside|thinking|inner)?\s*:?\s*([^)*_\n]{4,220})[)*_]{1,2}\s*/i); if (!m) return out;
  safe("aside", () => { const a = h("div", { class: "aside" }); a.textContent = m[1].trim(); card.insertBefore(a, card.firstChild.nextSibling ? card.querySelector("div") : null); }); return out.slice(m[0].length); }

/* message actions: Mini's own */
const BEAT_FOR = { calm: ["ancient", 82], thinking: ["cinematic", 96], firedup: ["epic", 140], wise: ["dark", 90], playful: ["rise", 124], focused: ["steel", 110] };
function makeBeat(text) { const m = curMood(), [pre, bpm] = BEAT_FOR[m] || BEAT_FOR.calm; const keys = ["E", "D", "A", "C", "F#", "G"]; let hsh = 0; for (const ch of text) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  API.sketch.set({ preset: pre, bpm, key: keys[hsh % keys.length], bars: 8 }); const p = P(); ["kick","snare","hat"].forEach((t) => p[t].fill(0)); p.bass.fill(null); finish(); show("sketch"); msg(`Mini made a ${m === "firedup" ? "fired up" : m} beat from that message: ${pre}, ${bpm} BPM. Tap play.`); }
async function drawIt(text) { // Send to Canvas / Draw it: safe topic scene, drawn stroke by stroke (~2.5 s)
  const S = window.MiniScene; if (!S) return; const src = String(text || "").slice(0, 600);
  const ban = (w) => { const low = String(w).toLowerCase(); return BANNED.words.some((b) => new RegExp("\\b" + b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(low)); };
  show("canvas"); const c = await API.ensureCanvas(); if (!c) return; const mm = $("cv-msg"); if (mm) mm.textContent = "Mini is drawing…";
  let spec = null;
  if (S.safe(src) && window.MiniApp && window.MiniApp.hasMind && window.MiniApp.hasMind()) {
    const sys = 'Reply with ONLY one tag like [draw:{"scene":"music","caption":"two or three words","stamps":[{"s":"gear","x":300,"y":400,"scale":1}],"accent":"#d4a63a"}]. scene is one of: ' + S.scenes.join(", ") + '. stamps from: ' + (window.MiniCanvas.STAMPS || []).join(", ") + '. accent from: ' + Object.values(S.colors).join(" ") + '. Calm, kind subjects only.';
    try { const out = await Promise.race([window.MiniApp.bubble(sys, "Picture for: " + src.slice(0, 300)), new Promise((r) => setTimeout(() => r(null), 4000))]);
      const m = out && out.match(/\[draw\s*:\s*(\{[\s\S]*\})\s*\]/i); if (m) spec = parseObj(m[1]); } catch (_) { spec = null; }
  }
  safe("clear", () => { c.clearLayer(1); c.clearLayer(2); }); /* fresh page each time; Undo brings the old one back */ const pl = S.plan(src, spec, ban); const per = Math.max(25, Math.min(160, 2600 / Math.max(1, pl.ops.length)));
  for (const op of pl.ops) { await safe("scene-op", () => miniDraw(op)); await new Promise((r) => setTimeout(r, per)); }
  safe("caption", () => { const L = c.layers && c.layers[2]; if (!L) return; c.setLayer(2); c._snap && c._snap(); const x = L.ctx; x.save(); x.font = "600 40px system-ui, sans-serif"; x.textAlign = "center"; x.fillStyle = "#d4a63a"; x.shadowColor = "#0b1a33"; x.shadowBlur = 8; x.fillText(pl.caption, 512, 990); x.restore(); c._emit && c._emit("change", c.state); });
  if (mm) mm.textContent = pl.kind ? "Let's draw something kinder." : `Mini drew "${pl.caption}". Undo if it missed.`; return pl; }
function keepIt(text) { const t = text.replace(/\s+/g, " ").trim(); safe("shelf", () => window.MiniWill && window.MiniWill.act && window.MiniWill.act({ a: "shelf", text: t.slice(0, 140) }, { fromMini: false })); safe("save", () => window.MiniApp.save("kept", text)); }
async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (_) { const a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch (_) {} a.remove(); return true; } }
function toast(t) { let el = $("mini-toast"); if (!el) { el = h("div", { id: "mini-toast" }); document.body.appendChild(el); } el.textContent = t; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 1800); }
const keptSet = () => LS.get("miniBeastKept", []);
const hashT = (t) => { let x = 5381; for (const ch of t) x = ((x * 33) ^ ch.charCodeAt(0)) >>> 0; return x.toString(36); };
function ask(prompt) { const inp = $("chat-in"); inp.value = prompt; show("chat"); $("chat-form").requestSubmit(); }
function decorate(c, body, kind) {
  const text = () => body.textContent;
  if (window.MiniActions) {
    const row = window.MiniActions.attach(c, {
      onRiff: () => ask("Riff on this and take it further: " + text().slice(0, 600)),
      onWhy: () => ask("Why? Walk me through your reasoning on this: " + text().slice(0, 500)),
      onSend: (target) => { if (target === "canvas") safe("send-canvas", () => drawIt(text())); else if (target === "sketch") makeBeat(text()); else { show("write"); const w = $("wh-in"); if (w) { w.value = (w.value ? w.value + "\n\n" : "") + text(); w.dispatchEvent(new Event("input")); w.scrollIntoView({ block: "center" }); } } },
      onKeep: () => { keepIt(text()); const k = keptSet(); k.push(hashT(text())); LS.set("miniBeastKept", k.slice(-300)); },
    });
    safe("draw-btn", () => { const src = row.querySelector(".ma-riff"); const d = src.cloneNode(true); d.classList.remove("ma-riff"); d.classList.add("ma-draw"); d.setAttribute("aria-label", "Draw it");
      const lab = d.querySelector(".ma-label"); if (lab) lab.textContent = "Draw it"; const sv = d.querySelector("svg"); if (sv && window.MiniNav) sv.outerHTML = window.MiniNav.icon("canvas");
      d.onclick = (e) => { e.stopPropagation(); safe("draw", () => drawIt(text())); }; row.insertBefore(d, row.querySelector(".ma-keep")); });
    setTimeout(() => safe("kept", () => { if (keptSet().includes(hashT(text()))) { const k = row.querySelector(".ma-keep"); k.classList.add("ma-kept"); k.setAttribute("aria-pressed", "true"); const l = k.querySelector(".ma-label"); if (l) l.textContent = "Kept"; } }), 0);
  } else {
    const r = h("div", { class: "row acts" }); const mk = (label, fn) => { const b = h("button", { class: "act" }, label); b.onclick = () => safe("act", () => fn(b)); r.appendChild(b); };
    mk("Riff on this", () => ask("Riff on this and take it further: " + text().slice(0, 600))); mk("Make it a beat", () => makeBeat(text())); mk("Draw it", () => drawIt(text())); mk("Keep it", (b) => { keepIt(text()); b.textContent = "Kept"; }); c.appendChild(r);
  }
  if (!c.querySelector(":scope > .row")) c.appendChild(h("div", { class: "row" })); // Saved tab appends Delete here
  let pt = null; const start = (e) => { if (e.target.closest("button")) return; pt = setTimeout(() => { copyText(text()).then(() => (window.MiniActions ? window.MiniActions.toast("Copied") : toast("Copied"))); c.classList.add("copied"); setTimeout(() => c.classList.remove("copied"), 700); }, 600); };
  const end = () => clearTimeout(pt); c.addEventListener("pointerdown", start); ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => c.addEventListener(ev, end)); c.addEventListener("pointermove", (e) => { if (Math.abs(e.movementY) > 4) end(); });
}
/* honest, varied offline voice */
const OFF = {
  open: ["Straight with you: my full mind isn't loaded, so this is my small offline voice.", "Small voice right now; the full mind is still asleep on this device.", "I'm running light, without the model, so take this as a sketch, not the full thought.", "No model loaded yet, Telephantix, so I'm answering from what I carry in my pocket."],
  echo: ["You said “%t”. I'd want to sit with that properly.", "“%t” stuck with me.", "I keep looking at “%t”.", "“%t” is worth more than a quick line."],
  turn: ["Load my mind (button above) and I'll give it real depth.", "Tap Load Mini's mind and ask me again; I'll take my time with it.", "When the mind is loaded I can actually reason about it with you.", "Give me the full mind and I'll answer properly, not from scraps."],
  task: { beat: "Meanwhile the Sketch tab works offline: pick a progression and hit 'Mini, finish this'.", draw: "Meanwhile, the Canvas works without the model; I can still draw.", time: "The Tools tab works offline too: timer, metronome, tap tempo.", note: "If it's a task, drop it in Tools → Notes so it doesn't slip." },
};
const HOLD = ["I'm always honest about my limits.", "I hype real progress without flattery.", "As above, so below: small work done well adds up.", "I'd rather ask a good question than fake an answer.", "Every finished thing started as one stubborn step.", "The Maker built in order, so I try to as well."];
function offline(t) { const pk = (a) => a[Math.floor(Math.random() * a.length)]; const q = t.toLowerCase(); const top = topicOf(t); const sl = HOLD;
  let task = /beat|song|music|bass|drum|chord/.test(q) ? OFF.task.beat : /draw|art|picture|paint/.test(q) ? OFF.task.draw : /timer|tempo|bpm|metronome|time/.test(q) ? OFF.task.time : /todo|task|remember|note/.test(q) ? OFF.task.note : "";
  const parts = [pk(OFF.open)]; if (top) parts.push(pk(OFF.echo).replace("%t", t.length > 60 ? top : t.trim()));
  if (sl.length && Math.random() < 0.7) parts.push("Something I hold on to: " + pk(sl)); if (task) parts.push(task); parts.push(pk(OFF.turn));
  const mood = /sad|tired|rough|stress|hurt/.test(q) ? "calm" : /lol|haha|joke|funny/.test(q) ? "playful" : /why|meaning|life|truth|god/.test(q) ? "wise" : /build|make|go|let's/.test(q) ? "firedup" : pk(["calm", "wise", "thinking"]);
  return { line: parts.join(" "), mood }; }

/* =================== init =================== */
export function init() {
  safe("header", () => document.documentElement.classList.add("beast"));
  safe("sketch", buildSketch);
  safe("tools-tab", () => { addTab("tools", "Tools", `<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>`); buildTools(); });
  safe("canvas-tab", () => { addTab("canvas", "Canvas", `<path d="M4 20c3 0 4-2 4-4s2-3 3-3M14 4l6 6-8 8-3-3z"/>`); buildCanvas(); });
  safe("write", buildWrite);
  safe("nav", () => { if (window.MiniNav) mountNav(); });
  safe("panel", () => { if (window.MiniPanel) mountPanel(); });
  safe("avatar", mountAvatar);
  import("./bubbles.js?v=3").then((m) => safe("bubbles", () => {
    window.MiniBubbles = { offlineThought: () => m.offlineThought() };
    const host = $("mav") || document.querySelector("#pane-chat"); if (!host) return;
    window.MiniBubbles.ctl = m.start({ host,
      getCtx: () => ({ mood: curMood(), topics: [...document.querySelectorAll("#chat-log .card.me")].slice(-3).map((c) => topicOf(c.textContent)).filter(Boolean).join(", "),
        note: (LS.get("miniBeastNotes", [])[0] || {}).t || "", soul: (soulLines()[Math.floor(Math.random() * Math.max(1, soulLines().length))] || "") }),
      onTap: (t) => ask("Let's think about this one: " + t) });
  })).catch((e) => console.warn("[bubbles load]", e));
  safe("decorate-old", () => document.querySelectorAll("#chat-log .card:not(.me)").forEach((c) => { if (!c.querySelector(".ma-row")) { const b = c.querySelector(":scope > div:not(.row):not(.aside)"); b && decorate(c, b, "chat"); } }));
  window.MiniBeast = { drawIt, decorate, offline, aside, onReply, sketch: API.sketch, runTool, draw: miniDraw, calc, convert, TAG_HELP };
  safe("tab-param", () => { const t = new URLSearchParams(location.search).get("tab"); if (t && ["tools", "canvas"].includes(t)) show(t); if (t === "sketch") show("sketch"); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && live && IOS) stopLive(); });
}
