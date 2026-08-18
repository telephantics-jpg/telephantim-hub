/**
 * Telephantix Music Studio — full-tab synth lab + free generative AI jam.
 * Mobile-safe FAB · dedicated #studio scene · hi-fi Web Audio · free AI patterns.
 * Full-song type-beat render + optional Suno API when SUNO_API_KEY is set.
 *
 * window.TelephantixStudio.open() | .aiJam() | .renderFullSong() | .sunoGenerate()
 */

import * as Beats from "./studio-beats.js?v=v1-beats";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const STEPS = 16;
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  mystic: [0, 3, 5, 7, 10],
};

const INSTRUMENTS = [
  { id: "keys", label: "🎹 Keys", color: "#a78bfa", kind: "keys" },
  { id: "guitar", label: "🎸 Guitar", color: "#f59e0b", kind: "pluck" },
  { id: "bass", label: "🎸 Bass", color: "#22d3ee", kind: "bass" },
  { id: "pad", label: "🌌 Pad", color: "#818cf8", kind: "pad" },
  { id: "lead", label: "✨ Lead", color: "#f472b6", kind: "lead" },
  { id: "flute", label: "🎶 Flute", color: "#6ee7b7", kind: "flute" },
  { id: "drums", label: "🥁 Drums", color: "#fb923c", kind: "drums" },
  { id: "bells", label: "🔔 Bells", color: "#fde68a", kind: "bell" },
  { id: "organ", label: "⛪ Organ", color: "#c4b5fd", kind: "organ" },
  { id: "strings", label: "🎻 Strings", color: "#fda4af", kind: "strings" },
];

const DRUM_MAP = { 0: "kick", 1: "snare", 2: "hat", 3: "clap", 4: "tom", 5: "ride", 6: "perc", 7: "fx" };
const GUITAR_OPEN = [40, 45, 50, 55, 59, 64];

const CHORD_PROG = [
  [0, 4, 5, 3], // I V vi IV
  [0, 5, 3, 4], // I vi IV V
  [0, 3, 4, 4], // I IV V V
  [5, 3, 0, 4], // vi IV I V
];

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}
function noteToMidi(note) {
  if (typeof note === "number") return note;
  const m = String(note).trim().match(/^([A-G]#?)(-?\d+)$/i);
  if (!m) return 60;
  const idx = NOTE_NAMES.indexOf(m[1].toUpperCase());
  return idx < 0 ? 60 : (parseInt(m[2], 10) + 1) * 12 + idx;
}
function emptyTrack(instrumentId) {
  return { instrument: instrumentId, mute: false, steps: Array.from({ length: STEPS }, () => null) };
}
function defaultSong() {
  return {
    bpm: 100,
    name: "Untitled jam",
    scale: "minor",
    root: 0,
    tracks: [
      emptyTrack("drums"),
      emptyTrack("bass"),
      emptyTrack("keys"),
      emptyTrack("pad"),
      emptyTrack("guitar"),
      emptyTrack("lead"),
      emptyTrack("bells"),
      emptyTrack("strings"),
    ],
  };
}

let audioCtx = null;
let masterGain = null;
let dryGain = null;
let wetGain = null;
let convolver = null;
let compressor = null;
let analyser = null;
let impulseCache = null;
let song = defaultSong();
let playing = false;
let liveAi = false;
let liveAiTimer = null;
let stepIndex = 0;
let timerId = null;
let nextStepTime = 0;
let activeInstrument = "keys";
let octave = 4;
let panelOpen = false;
let studioMinimized = false;
let vizRaf = null;
let seededRng = null;

function rng() {
  if (typeof seededRng === "function") return seededRng();
  return Math.random();
}
function seedRng(seed) {
  let s = (Number(seed) || Date.now()) >>> 0;
  seededRng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function $(id) {
  return document.getElementById(id);
}

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC({ latencyHint: "interactive" });
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.7;
    dryGain = audioCtx.createGain();
    dryGain.gain.value = 0.76;
    wetGain = audioCtx.createGain();
    wetGain.gain.value = 0.34;
    convolver = audioCtx.createConvolver();
    convolver.buffer = makeImpulse(2.6, 2.2);
    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 20;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.16;
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;

    const delay = audioCtx.createDelay(1);
    delay.delayTime.value = 0.2;
    const delayFb = audioCtx.createGain();
    delayFb.gain.value = 0.24;
    const delayLp = audioCtx.createBiquadFilter();
    delayLp.type = "lowpass";
    delayLp.frequency.value = 4500;
    delay.connect(delayLp);
    delayLp.connect(delayFb);
    delayFb.connect(delay);

    masterGain.connect(dryGain);
    masterGain.connect(convolver);
    masterGain.connect(delay);
    convolver.connect(wetGain);
    delayLp.connect(wetGain);
    const mix = audioCtx.createGain();
    dryGain.connect(mix);
    wetGain.connect(mix);
    mix.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function makeImpulse(seconds = 2.4, decay = 2) {
  const ctx = audioCtx || ensureAudio();
  if (impulseCache && impulseCache.sampleRate === ctx.sampleRate) return impulseCache;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (c ? 0.94 : 1);
    }
  }
  impulseCache = buf;
  return buf;
}

function noiseBuffer(duration = 0.2, color = "white") {
  const ctx = ensureAudio();
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (color === "pink") {
      b0 = 0.99765 * b0 + white * 0.099046;
      data[i] = b0 * 3.5;
    } else data[i] = white;
  }
  return buf;
}

function playKarplusStrong(freq, when, duration = 0.85, vel = 0.55) {
  const ctx = ensureAudio();
  const t0 = when ?? ctx.currentTime;
  const period = Math.max(2, Math.floor(ctx.sampleRate / freq));
  const buf = ctx.createBuffer(1, period, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < period; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.min(9000, freq * 9), t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(350, freq * 2), t0 + duration);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vel * 0.85, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter);
  filter.connect(g);
  g.connect(masterGain);
  src.start(t0);
  src.stop(t0 + duration + 0.05);
}

function playDrum(kind, when, vel = 0.8) {
  const ctx = ensureAudio();
  const t0 = when ?? ctx.currentTime;
  const g = ctx.createGain();
  const pan = ctx.createStereoPanner?.();
  if (pan) {
    pan.pan.value = kind === "hat" ? 0.3 : kind === "ride" ? -0.25 : 0;
    g.connect(pan);
    pan.connect(masterGain);
  } else g.connect(masterGain);

  if (kind === "kick") {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(170, t0);
    o.frequency.exponentialRampToValueAtTime(36, t0 + 0.18);
    g.gain.setValueAtTime(vel, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + 0.42);
  } else if (kind === "snare" || kind === "clap") {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.2, "pink");
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = kind === "clap" ? 1800 : 1350;
    g.gain.setValueAtTime(vel * 0.7, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
    src.connect(f);
    f.connect(g);
    src.start(t0);
    src.stop(t0 + 0.22);
  } else if (kind === "hat" || kind === "ride") {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(kind === "ride" ? 0.35 : 0.09);
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = kind === "ride" ? 5200 : 7800;
    g.gain.setValueAtTime(vel * 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (kind === "ride" ? 0.38 : 0.06));
    src.connect(f);
    f.connect(g);
    src.start(t0);
    src.stop(t0 + 0.4);
  } else {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(kind === "tom" ? 210 : 360, t0);
    o.frequency.exponentialRampToValueAtTime(70, t0 + 0.16);
    g.gain.setValueAtTime(vel * 0.55, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + 0.28);
  }
}

function playTone(instrumentId, midi, when, duration = 0.45, vel = 0.55) {
  const inst = INSTRUMENTS.find((i) => i.id === instrumentId) || INSTRUMENTS[0];
  if (inst.kind === "drums") {
    playDrum(DRUM_MAP[midi % 8] || "kick", when, vel);
    return;
  }
  const ctx = ensureAudio();
  const t0 = when ?? ctx.currentTime;
  const freq = midiToFreq(midi);
  const dur = Math.max(0.08, duration);

  if (inst.kind === "pluck" || inst.id === "guitar") {
    playKarplusStrong(freq, t0, Math.max(0.5, dur * 1.5), vel);
    return;
  }

  const voice = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  const pan = ctx.createStereoPanner?.();
  if (pan) {
    pan.pan.value = ((midi % 12) - 6) * 0.05;
    filter.connect(voice);
    voice.connect(pan);
    pan.connect(masterGain);
  } else {
    filter.connect(voice);
    voice.connect(masterGain);
  }

  const addOsc = (type, detune, gainMul, freqMul = 1) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq * freqMul, t0);
    if (o.detune) o.detune.setValueAtTime(detune, t0);
    const lg = ctx.createGain();
    lg.gain.value = gainMul;
    o.connect(lg);
    lg.connect(filter);
    o.start(t0);
    o.stop(t0 + dur + 0.7);
  };

  if (inst.kind === "bass") {
    filter.frequency.setValueAtTime(320, t0);
    filter.frequency.exponentialRampToValueAtTime(110, t0 + dur);
    addOsc("sine", 0, 0.7, 0.5);
    addOsc("sawtooth", -5, 0.2, 0.5);
    addOsc("triangle", 4, 0.15);
    voice.gain.setValueAtTime(0.0001, t0);
    voice.gain.exponentialRampToValueAtTime(vel * 0.95, t0 + 0.01);
    voice.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.08);
  } else if (inst.kind === "pad" || inst.kind === "strings") {
    filter.frequency.setValueAtTime(800, t0);
    filter.frequency.linearRampToValueAtTime(2800, t0 + dur * 0.5);
    addOsc("sine", -10, 0.3);
    addOsc("sine", 10, 0.3);
    addOsc("triangle", -16, 0.2);
    addOsc("triangle", 16, 0.2);
    if (inst.kind === "strings") addOsc("sawtooth", 0, 0.1);
    voice.gain.setValueAtTime(0.0001, t0);
    voice.gain.linearRampToValueAtTime(vel * 0.4, t0 + 0.4);
    voice.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.9);
  } else if (inst.kind === "lead") {
    filter.frequency.setValueAtTime(3600, t0);
    filter.Q.value = 2;
    addOsc("sawtooth", -8, 0.35);
    addOsc("sawtooth", 8, 0.35);
    addOsc("square", 0, 0.1);
    voice.gain.setValueAtTime(0.0001, t0);
    voice.gain.exponentialRampToValueAtTime(vel * 0.55, t0 + 0.02);
    voice.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.1);
  } else if (inst.kind === "flute") {
    filter.frequency.setValueAtTime(3000, t0);
    addOsc("sine", 0, 0.55);
    addOsc("sine", 3, 0.18, 2);
    addOsc("triangle", -3, 0.15);
    voice.gain.setValueAtTime(0.0001, t0);
    voice.gain.linearRampToValueAtTime(vel * 0.5, t0 + 0.05);
    voice.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.12);
  } else if (inst.kind === "bell") {
    [1, 2, 2.4, 3.1, 4.2].forEach((p, i) => addOsc("sine", 0, [0.5, 0.25, 0.14, 0.1, 0.06][i], p));
    filter.frequency.setValueAtTime(7000, t0);
    voice.gain.setValueAtTime(0.0001, t0);
    voice.gain.exponentialRampToValueAtTime(vel * 0.5, t0 + 0.004);
    voice.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(1.4, dur * 2.5));
  } else if (inst.kind === "organ") {
    filter.frequency.setValueAtTime(5000, t0);
    [1, 2, 3, 4, 6].forEach((p, i) => addOsc("sine", 0, 0.35 / (i + 1), p));
    voice.gain.setValueAtTime(0.0001, t0);
    voice.gain.linearRampToValueAtTime(vel * 0.55, t0 + 0.03);
    voice.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.2);
  } else {
    filter.frequency.setValueAtTime(4500, t0);
    filter.frequency.exponentialRampToValueAtTime(1200, t0 + Math.min(1, dur + 0.3));
    addOsc("sine", 0, 0.42);
    addOsc("triangle", -6, 0.28);
    addOsc("sine", 10, 0.14, 2);
    addOsc("sawtooth", 0, 0.06);
    voice.gain.setValueAtTime(0.0001, t0);
    voice.gain.exponentialRampToValueAtTime(vel * 0.7, t0 + 0.008);
    voice.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.35);
  }
}

function stepDuration() {
  return 60 / Math.max(40, Math.min(200, song.bpm || 100)) / 4;
}

function scheduleAhead(until) {
  const ctx = ensureAudio();
  const dur = stepDuration();
  while (nextStepTime < until) {
    const step = stepIndex % STEPS;
    for (const track of song.tracks) {
      if (track.mute) continue;
      const cell = track.steps[step];
      if (cell == null) continue;
      if (track.instrument === "drums") playDrum(DRUM_MAP[cell % 8] || "kick", nextStepTime, 0.85);
      else playTone(track.instrument, cell, nextStepTime, dur * 0.95, 0.52);
    }
    highlightStep(step);
    nextStepTime += dur;
    stepIndex += 1;
  }
}

function loopTick() {
  if (!playing) return;
  scheduleAhead(audioCtx.currentTime + 0.12);
  timerId = requestAnimationFrame(loopTick);
}

function startLoop() {
  ensureAudio();
  if (playing) return;
  playing = true;
  stepIndex = 0;
  nextStepTime = audioCtx.currentTime + 0.05;
  loopTick();
  startViz();
  updateTransportUi();
}

function stopLoop() {
  playing = false;
  if (timerId) cancelAnimationFrame(timerId);
  timerId = null;
  highlightStep(-1);
  updateTransportUi();
}

function highlightStep(step) {
  document.querySelectorAll(".stu-step").forEach((el) => {
    el.classList.toggle("on-playhead", Number(el.dataset.step) === step);
  });
}

/* ── Free generative AI (client-side, no paid API) ───────────────── */

function scaleDegrees() {
  return SCALES[song.scale] || SCALES.minor;
}
function rootMidi(oct = 4) {
  return 12 * (oct + 1) + (song.root || 0);
}

function aiGenerateDrums() {
  const t = song.tracks.find((x) => x.instrument === "drums") || song.tracks[0];
  t.steps = Array.from({ length: STEPS }, () => null);
  for (let s = 0; s < STEPS; s++) {
    if (s % 4 === 0) t.steps[s] = 0; // kick
    else if (s % 8 === 4) t.steps[s] = 1; // snare
    else if (s % 2 === 0 && rng() > 0.25) t.steps[s] = 2; // hat
    else if (rng() > 0.88) t.steps[s] = 3;
  }
  if (rng() > 0.4) t.steps[14] = 1;
}

function aiGenerateBass() {
  let t = song.tracks.find((x) => x.instrument === "bass");
  if (!t) {
    t = emptyTrack("bass");
    song.tracks.push(t);
  }
  const deg = scaleDegrees();
  const prog = CHORD_PROG[Math.floor(rng() * CHORD_PROG.length)];
  t.steps = Array.from({ length: STEPS }, () => null);
  for (let s = 0; s < STEPS; s++) {
    if (s % 2 !== 0 && rng() > 0.55) continue;
    const chord = prog[Math.floor(s / 4) % prog.length];
    const d = deg[chord % deg.length];
    t.steps[s] = rootMidi(2) + d + (rng() > 0.7 ? 12 : 0);
  }
}

function aiGenerateMelody(instrument = "keys") {
  let t = song.tracks.find((x) => x.instrument === instrument);
  if (!t) {
    t = emptyTrack(instrument);
    song.tracks.push(t);
  }
  const deg = scaleDegrees();
  let pos = Math.floor(rng() * deg.length);
  t.steps = Array.from({ length: STEPS }, () => null);
  for (let s = 0; s < STEPS; s++) {
    if (rng() > 0.62) continue;
    pos = Math.max(0, Math.min(deg.length - 1, pos + Math.floor(rng() * 5) - 2));
    const oct = rng() > 0.75 ? 1 : 0;
    t.steps[s] = rootMidi(3 + oct) + deg[pos];
  }
}

function aiGeneratePad() {
  let t = song.tracks.find((x) => x.instrument === "pad" || x.instrument === "strings");
  if (!t) {
    t = emptyTrack("pad");
    song.tracks.push(t);
  }
  const deg = scaleDegrees();
  const prog = CHORD_PROG[Math.floor(rng() * CHORD_PROG.length)];
  t.steps = Array.from({ length: STEPS }, () => null);
  for (let bar = 0; bar < 4; bar++) {
    const chord = prog[bar % prog.length];
    t.steps[bar * 4] = rootMidi(3) + deg[chord % deg.length];
  }
}

function aiJam(opts = {}) {
  seedRng(opts.seed || Date.now());
  if (opts.bpm) song.bpm = opts.bpm;
  else song.bpm = 88 + Math.floor(rng() * 40);
  song.scale = opts.scale || ["minor", "dorian", "mystic", "pentatonic"][Math.floor(rng() * 4)];
  song.root = opts.root != null ? opts.root : Math.floor(rng() * 12);
  song.name = opts.name || `AI jam · ${song.scale} · ${song.bpm}bpm`;
  aiGenerateDrums();
  aiGenerateBass();
  aiGeneratePad();
  aiGenerateMelody("keys");
  if (rng() > 0.4) aiGenerateMelody("lead");
  if (rng() > 0.55) aiGenerateMelody("guitar");
  const bpmEl = $("stu-bpm");
  if (bpmEl) bpmEl.value = String(song.bpm);
  const scaleEl = $("stu-scale");
  if (scaleEl) scaleEl.value = song.scale;
  renderSeq();
  renderMeta();
  showToast(`✦ Free AI jam · ${song.scale} @ ${song.bpm}`);
  return getSong();
}

function aiEvolve() {
  // Mutate ~25% of steps for live evolution
  seedRng(Date.now());
  const deg = scaleDegrees();
  for (const track of song.tracks) {
    if (track.instrument === "drums") {
      for (let s = 0; s < STEPS; s++) {
        if (rng() > 0.78) track.steps[s] = rng() > 0.5 ? Math.floor(rng() * 4) : null;
      }
      continue;
    }
    for (let s = 0; s < STEPS; s++) {
      if (rng() > 0.75) {
        if (rng() > 0.45) track.steps[s] = null;
        else {
          const d = deg[Math.floor(rng() * deg.length)];
          track.steps[s] = rootMidi(track.instrument === "bass" ? 2 : 3) + d;
        }
      }
    }
  }
  renderSeq();
  showToast("✦ AI evolved the pattern");
}

function startLiveAi() {
  ensureAudio();
  liveAi = true;
  if (!playing) startLoop();
  const tick = () => {
    if (!liveAi) return;
    aiEvolve();
    liveAiTimer = setTimeout(tick, (60 / song.bpm) * 16 * 1000); // every bar loop
  };
  liveAiTimer = setTimeout(tick, (60 / song.bpm) * 16 * 1000);
  updateTransportUi();
  showToast("✦ Live AI render ON — free generative jam");
}

function stopLiveAi() {
  liveAi = false;
  if (liveAiTimer) clearTimeout(liveAiTimer);
  liveAiTimer = null;
  updateTransportUi();
  showToast("Live AI off");
}

/* ── Viz ──────────────────────────────────────────────────────────── */

function startViz() {
  const canvas = $("stu-viz");
  if (!canvas || !analyser) return;
  const ctx2 = canvas.getContext("2d");
  const data = new Uint8Array(analyser.frequencyBinCount);
  const draw = () => {
    if (!playing && !panelOpen && !isStudioScene()) return;
    vizRaf = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(data);
    const w = (canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1));
    const h = (canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1));
    ctx2.clearRect(0, 0, w, h);
    const bars = 48;
    const step = Math.floor(data.length / bars);
    const bw = w / bars;
    for (let i = 0; i < bars; i++) {
      const v = data[i * step] / 255;
      const bh = v * h * 0.9;
      const hue = 260 + i * 2;
      ctx2.fillStyle = `hsla(${hue}, 80%, ${45 + v * 30}%, 0.85)`;
      ctx2.fillRect(i * bw + 1, h - bh, bw - 2, bh);
    }
  };
  if (vizRaf) cancelAnimationFrame(vizRaf);
  draw();
}

function isStudioScene() {
  return document.body?.dataset?.scene === "studio";
}

/* ── UI mount ─────────────────────────────────────────────────────── */

function studioShellHtml(fullPage) {
  const vibes = Beats.TYPE_BEATS.map(
    (t) => `<button type="button" class="stu-vibe" data-beat="${t.id}" title="${t.tags}">${t.label}</button>`,
  ).join("");
  return `
    <div class="tx-studio-panel${fullPage ? " tx-studio-full" : ""}" role="dialog" aria-label="Create music">
      <header class="tx-studio-head">
        <div>
          <strong>✦ Create</strong>
          <span class="tx-studio-sub">dream it · play it · save it</span>
        </div>
        <div class="tx-studio-head-actions">
          ${fullPage ? "" : `<button type="button" class="tx-stu-icon" id="stu-min" title="Minimize">−</button>
          <button type="button" class="tx-stu-icon" id="stu-close" title="Close">×</button>`}
        </div>
      </header>
      <canvas id="stu-viz" class="tx-stu-viz" aria-hidden="true"></canvas>
      <div class="tx-studio-body" id="stu-body">

        <!-- CREATIVE HERO -->
        <section class="stu-hero">
          <p class="stu-hero-label">What do you want to hear?</p>
          <div class="stu-hero-row">
            <input type="text" id="stu-suno-prompt" class="tx-stu-prompt stu-hero-prompt" maxlength="500"
              placeholder="dark mystical trap anthem with vocals… soft rain piano ballad…" />
            <button type="button" class="stu-create-btn" id="stu-musicgen-go" title="Full song with vocals via open-source ACE-Step (up to 10 min)">
              ✦ Create
            </button>
          </div>
          <textarea id="stu-lyrics" class="stu-lyrics" rows="3" maxlength="4000"
            placeholder="Optional lyrics (leave blank — we'll write a verse/chorus). Tip: [Verse] / [Chorus] tags help."></textarea>
          <div class="stu-vibe-row" id="stu-vibes">${vibes}</div>
          <div class="stu-hero-meta">
            <label class="tx-stu-bpm">Length
              <select id="stu-beat-style" hidden>
                ${Beats.TYPE_BEATS.map((t) => `<option value="${t.id}">${t.label}</option>`).join("")}
              </select>
              <select id="stu-mg-secs" title="Song length">
                <option value="60">1 min</option>
                <option value="120">2 min</option>
                <option value="180" selected>3 min</option>
                <option value="300">5 min</option>
                <option value="480">8 min</option>
                <option value="600">10 min ★</option>
              </select>
            </label>
            <label class="tx-stu-bpm stu-check">
              <input type="checkbox" id="stu-vocals" checked /> vocals
            </label>
            <span class="tx-stu-suno-status" id="stu-suno-status">ready</span>
          </div>
          <div class="stu-player" id="stu-song-actions" hidden>
            <audio id="stu-gen-audio" class="tx-stu-gen-audio" preload="metadata"></audio>
            <div class="stu-player-row">
              <button type="button" class="stu-player-btn" id="stu-audio-play" title="Play / pause">▶</button>
              <button type="button" class="stu-player-btn ghost" id="stu-audio-back" title="Back 10 seconds">−10s</button>
              <button type="button" class="stu-player-btn ghost" id="stu-audio-fwd" title="Forward 10 seconds">+10s</button>
              <button type="button" class="stu-player-btn ghost" id="stu-audio-repeat" title="Repeat song" aria-pressed="false">↻</button>
              <span class="stu-player-time" id="stu-audio-time">0:00 / 0:00</span>
            </div>
            <label class="stu-seek-wrap" title="Scrub to any part of the song">
              <span class="stu-muted stu-seek-label">seek</span>
              <input type="range" id="stu-audio-seek" class="stu-seek" min="0" max="0" step="0.1" value="0" />
            </label>
            <div class="stu-player-marks" id="stu-player-marks">
              <button type="button" class="btn-chip ghost stu-mark" data-pct="0">start</button>
              <button type="button" class="btn-chip ghost stu-mark" data-pct="0.25">¼</button>
              <button type="button" class="btn-chip ghost stu-mark" data-pct="0.5">½</button>
              <button type="button" class="btn-chip ghost stu-mark" data-pct="0.75">¾</button>
              <button type="button" class="btn-chip ghost stu-mark" data-pct="1">end</button>
            </div>
            <div class="stu-song-actions-row">
              <a class="btn-chip ghost" id="stu-song-download" href="#" download>⬇ Download</a>
              <button type="button" class="btn-chip ghost" id="stu-song-keep" title="Keep this song in the library">📌 Keep</button>
            </div>
          </div>
          <div class="stu-library" id="stu-library">
            <p class="stu-section-label">Your songs <span class="stu-muted">re-open anytime · scrub · repeat</span></p>
            <div class="stu-library-list" id="stu-library-list"></div>
          </div>
        </section>

        <!-- SIMPLE PLAY CONTROLS -->
        <section class="stu-playbar">
          <button type="button" class="stu-big-play" id="stu-play" title="Play loop">▶</button>
          <button type="button" class="btn-chip ghost" id="stu-stop" title="Stop">■</button>
          <button type="button" class="btn-chip stu-ai" id="stu-ai-jam" title="Instant jam idea">✦ Surprise me</button>
          <button type="button" class="btn-chip ghost" id="stu-ai-evolve" title="Evolve the idea">↻ Twist</button>
          <button type="button" class="btn-chip ghost" id="stu-render-full" title="Download full song">⬇ Save song</button>
        </section>

        <!-- PLAY SURFACE -->
        <section class="stu-make">
          <p class="stu-section-label">Touch an instrument</p>
          <div class="tx-studio-insts" id="stu-insts"></div>
          <div class="tx-studio-play" id="stu-play-surface"></div>
        </section>

        <!-- PATTERN (simple) -->
        <section class="stu-pattern">
          <p class="stu-section-label">Paint the beat <span class="stu-muted">tap squares · drag frets</span></p>
          <div class="tx-studio-seq" id="stu-seq"></div>
          <p class="tx-studio-meta" id="stu-meta"></p>
        </section>

        <!-- CRAFT (advanced, collapsed) -->
        <details class="tx-studio-ai stu-craft">
          <summary>Craft &amp; export</summary>
          <div class="tx-studio-transport" style="margin-top:10px">
            <label class="tx-stu-bpm">BPM <input type="number" id="stu-bpm" min="40" max="200" value="100" /></label>
            <label class="tx-stu-bpm">Scale
              <select id="stu-scale">
                <option value="minor">Minor</option>
                <option value="major">Major</option>
                <option value="dorian">Dorian</option>
                <option value="pentatonic">Pentatonic</option>
                <option value="mystic">Mystic</option>
              </select>
            </label>
            <label class="tx-stu-bpm">Length
              <select id="stu-bars">
                <option value="32">short</option>
                <option value="48">medium</option>
                <option value="64" selected>full</option>
                <option value="80">long</option>
                <option value="96">epic</option>
              </select>
            </label>
            <button type="button" class="btn-chip ghost" id="stu-typebeat">Build type beat</button>
            <button type="button" class="btn-chip ghost" id="stu-ai-drums">Fill drums</button>
            <button type="button" class="btn-chip ghost" id="stu-ai-melody">Fill melody</button>
            <button type="button" class="btn-chip ghost" id="stu-ai-live">◉ Live evolve</button>
            <button type="button" class="btn-chip ghost" id="stu-clear">Clear</button>
            <button type="button" class="btn-chip ghost" id="stu-demo">Demo</button>
            <button type="button" class="btn-chip ghost" id="stu-export">24-bit WAV</button>
            <button type="button" class="btn-chip ghost" id="stu-json">Copy JSON</button>
            <button type="button" class="btn-chip ghost" id="stu-suno-go">Suno API</button>
          </div>
          <p class="tx-studio-hint">Paste song JSON from a chat, or export yours.</p>
          <textarea id="stu-ai-json" rows="3" placeholder='{"bpm":100,"scale":"minor","tracks":[...]}'></textarea>
          <div class="tx-studio-ai-actions">
            <button type="button" class="btn-chip ghost" id="stu-ai-load">Load JSON</button>
            <button type="button" class="btn-chip ghost" id="stu-ai-fill">Seed template</button>
          </div>
        </details>
      </div>
    </div>`;
}

function buildFloatingPanel() {
  if ($("tx-studio")) return;
  const wrap = document.createElement("div");
  wrap.id = "tx-studio";
  wrap.className = "tx-studio";
  wrap.hidden = true;
  wrap.innerHTML = studioShellHtml(false);
  document.body.appendChild(wrap);
  wireStudioControls(wrap);
  renderAll();
}

function mountFullPageStudio() {
  const stage = $("stage-studio");
  if (!stage) return;
  let host = $("studio-mount");
  if (!host) {
    host = document.createElement("div");
    host.id = "studio-mount";
    host.className = "studio-mount";
    stage.appendChild(host);
  }
  if (!host.dataset.ready) {
    host.innerHTML = studioShellHtml(true);
    host.dataset.ready = "1";
    wireStudioControls(host);
  }
  renderAll();
  startViz();
}

function wireStudioControls(root) {
  if (root.dataset.wired === "1") return;
  root.dataset.wired = "1";
  const on = (id, fn) => root.querySelector(`#${id}`)?.addEventListener("click", fn);

  root.querySelector("#stu-close")?.addEventListener("click", () => closeStudio());
  root.querySelector("#stu-min")?.addEventListener("click", (e) => {
    e.preventDefault();
    setStudioMinimized(!studioMinimized);
  });
  root.querySelector(".tx-studio-head")?.addEventListener("click", (e) => {
    if (e.target?.closest?.("button")) return;
    if (studioMinimized) setStudioMinimized(false);
  });

  on("stu-play", () => {
    ensureAudio();
    if (playing) stopLoop();
    else startLoop();
  });
  on("stu-stop", () => {
    stopLoop();
    stopLiveAi();
  });
  root.querySelector("#stu-bpm")?.addEventListener("change", (e) => {
    song.bpm = Math.max(40, Math.min(200, Number(e.target.value) || 100));
  });
  root.querySelector("#stu-scale")?.addEventListener("change", (e) => {
    song.scale = e.target.value || "minor";
    renderMeta();
  });
  on("stu-clear", () => {
    song.tracks.forEach((t) => {
      t.steps = Array.from({ length: STEPS }, () => null);
    });
    renderSeq();
  });
  on("stu-demo", () => {
    loadDemo();
    renderAll();
    showToast("Demo beat loaded");
  });
  on("stu-export", () => exportWav());
  on("stu-json", () => {
    const json = JSON.stringify(getSong(), null, 2);
    navigator.clipboard?.writeText(json).then(
      () => showToast("Song JSON copied"),
      () => {
        const ta = root.querySelector("#stu-ai-json");
        if (ta) ta.value = json;
        showToast("JSON in AI box");
      },
    );
  });
  on("stu-ai-jam", () => {
    ensureAudio();
    aiJam();
    startLoop();
  });
  on("stu-ai-drums", () => {
    aiGenerateDrums();
    renderSeq();
    showToast("AI drums");
  });
  on("stu-ai-melody", () => {
    aiGenerateMelody(activeInstrument === "drums" ? "keys" : activeInstrument);
    renderSeq();
    showToast("AI melody");
  });
  on("stu-ai-evolve", () => aiEvolve());
  on("stu-ai-live", () => {
    if (liveAi) stopLiveAi();
    else startLiveAi();
  });
  on("stu-ai-load", () => {
    try {
      const ta = root.querySelector("#stu-ai-json");
      loadSong(JSON.parse(ta?.value || "{}"));
      renderAll();
      showToast("Pattern loaded");
    } catch (err) {
      showToast("Bad JSON");
    }
  });
  on("stu-ai-fill", () => {
    const ta = root.querySelector("#stu-ai-json");
    if (ta) ta.value = JSON.stringify(aiJam({ seed: 42 }), null, 2);
    showToast("Seed filled — Load JSON");
  });
  on("stu-typebeat", () => {
    ensureAudio();
    applyTypeBeat();
    startLoop();
  });
  on("stu-render-full", () => {
    void renderFullSongWav();
  });
  on("stu-musicgen-go", () => {
    void musicgenGenerate(root);
  });
  on("stu-suno-go", () => {
    void sunoOrFreeGenerate(root);
  });
  on("stu-song-keep", () => {
    showToast("Kept — re-open anytime under Your songs");
    void refreshSongLibrary(root);
  });
  wireSongPlayerControls(root);
  void refreshSongLibrary(root);
  void refreshSunoStatus(root);
  // Restore last song path so refresh doesn't lose the file
  try {
    const last = JSON.parse(localStorage.getItem("txStudioLastSong") || "null");
    if (last?.url) bindSongResult(last.url, { name: last.name, duration_sec: last.duration_sec });
  } catch (_) {}
  // Vibe chips → set hidden style select + highlight
  root.querySelectorAll(".stu-vibe").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.beat;
      const sel = root.querySelector("#stu-beat-style");
      if (sel && id) sel.value = id;
      root.querySelectorAll(".stu-vibe").forEach((b) => b.classList.toggle("on", b === btn));
      // soft fill prompt if empty
      const prompt = root.querySelector("#stu-suno-prompt");
      const meta = Beats.TYPE_BEATS.find((t) => t.id === id);
      if (prompt && meta && !(prompt.value || "").trim()) {
        prompt.placeholder = meta.tags;
      }
      showToast(meta?.label || "Vibe set");
    });
  });
  // default highlight first vibe
  root.querySelector(".stu-vibe")?.classList.add("on");
  refreshSunoStatus(root);
}

function applyTypeBeat() {
  const style = $("stu-beat-style")?.value || "telephantix";
  const bars = Number($("stu-bars")?.value || 64);
  const beat = Beats.generateTypeBeat(style, { bars, seed: Date.now() });
  loadSong(beat);
  song.bars = beat.bars;
  song.sections = beat.sections;
  song.tags = beat.tags;
  song.name = beat.name;
  renderAll();
  const sec = Beats.barsToApproxSeconds(beat.bars, beat.bpm);
  showToast(`🎛 Type beat · ${beat.bars} bars · ~${Math.round(sec)}s`);
  return beat;
}

/**
 * Free full-song render — loops the 16-step pattern across N bars with section density.
 * Studio-grade length (2–4 min) without any paid API.
 */
async function renderFullSongWav() {
  ensureAudio();
  const bars = Math.max(32, Math.min(96, Number($("stu-bars")?.value || song.bars || 64)));
  const bpm = song.bpm || 100;
  const stepDur = 60 / bpm / 4;
  const totalSteps = bars * 16;
  const duration = totalSteps * stepDur + 2.0;
  const approx = Beats.barsToApproxSeconds(bars, bpm);
  showToast(`Rendering ~${Math.round(approx)}s song…`);

  // Use section density if we have a type-beat arrangement
  const sections = song.sections || null;
  const rate = audioCtx.sampleRate || 48000;
  let offline;
  try {
    offline = new OfflineAudioContext(2, Math.ceil(rate * duration), rate);
  } catch (err) {
    showToast("Browser blocked long render — try fewer bars");
    return;
  }

  const real = { audioCtx, masterGain, dryGain, wetGain, convolver, compressor, analyser, impulseCache };
  try {
    audioCtx = offline;
    impulseCache = null;
    masterGain = offline.createGain();
    masterGain.gain.value = 0.68;
    dryGain = offline.createGain();
    dryGain.gain.value = 0.78;
    wetGain = offline.createGain();
    wetGain.gain.value = 0.3;
    convolver = offline.createConvolver();
    convolver.buffer = makeImpulse(2.2, 2.1);
    compressor = offline.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 2.6;
    masterGain.connect(dryGain);
    masterGain.connect(convolver);
    convolver.connect(wetGain);
    const mix = offline.createGain();
    dryGain.connect(mix);
    wetGain.connect(mix);
    mix.connect(compressor);
    compressor.connect(offline.destination);

    let t = 0.1;
    for (let step = 0; step < totalSteps; step++) {
      const s = step % STEPS;
      const bar = Math.floor(step / 16);
      const sec = sections?.[bar];
      const density = sec?.density ?? 1;
      // Skip some non-kick hits in sparse sections
      for (const track of song.tracks) {
        if (track.mute) continue;
        const cell = track.steps[s];
        if (cell == null) continue;
        if (density < 0.5 && track.instrument !== "drums" && track.instrument !== "pad" && s % 4 !== 0) {
          if (Math.random() > density + 0.2) continue;
        }
        if (track.instrument === "drums") {
          // intro/outro: mostly kick+hat
          if (density < 0.4 && cell === 1 && s !== 4 && s !== 12) continue;
          playDrum(DRUM_MAP[cell % 8] || "kick", t, 0.82 * Math.min(1, 0.5 + density));
        } else {
          playTone(track.instrument, cell, t, stepDur * (track.instrument === "pad" || track.instrument === "strings" ? 1.6 : 1.0), 0.5);
        }
      }
      t += stepDur;
    }

    const rendered = await offline.startRendering();
    const wav = audioBufferToWav(rendered, 24);
    const a = document.createElement("a");
    const safe = (song.name || "type-beat").replace(/[^\w\-]+/g, "-").toLowerCase();
    a.href = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
    a.download = `${safe}-${bars}bars-24bit.wav`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`⬇ Full song ready · ~${Math.round(approx)}s · 24-bit`);
  } catch (err) {
    console.error(err);
    showToast("Full render failed — try 32–64 bars");
  } finally {
    audioCtx = real.audioCtx;
    masterGain = real.masterGain;
    dryGain = real.dryGain;
    wetGain = real.wetGain;
    convolver = real.convolver;
    compressor = real.compressor;
    analyser = real.analyser;
    impulseCache = real.impulseCache;
  }
}

function studioApiBase() {
  try {
    if (typeof window !== "undefined" && window.TELEPHANTIM_API != null) {
      const v = String(window.TELEPHANTIM_API).replace(/\/$/, "");
      if (v === "" || v === "same") return "";
      return v;
    }
  } catch (_) {}
  return "";
}
function studioApi(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${studioApiBase()}${p}`;
}

let createInFlight = false;
let activePollToken = 0;

async function refreshSunoStatus(root) {
  const el = root?.querySelector?.("#stu-suno-status") || $("stu-suno-status");
  try {
    const r = await fetch(studioApi("/api/studio/suno-status"));
    const j = await r.json();
    const ace = j.acestep || {};
    const mg = j.musicgen || {};
    if (el) {
      if (ace.ok) {
        el.textContent = ace.warming
          ? `ACE-Step warming (first-run model download) · vocals soon`
          : `ACE-Step live · vocals · up to ${ace.maxSeconds || 600}s`;
        el.dataset.ready = "1";
        el.dataset.vocals = "1";
      } else if (mg.ok) {
        el.textContent = mg.loaded
          ? `MusicGen ready (instrumental) · ACE-Step offline`
          : `MusicGen free · start ACE-Step for vocals / 10-min`;
        el.dataset.ready = "1";
        el.dataset.vocals = "0";
      } else if (j.sunoConfigured) {
        el.textContent = "Suno API ready · ACE-Step offline";
        el.dataset.ready = "0";
      } else {
        el.textContent = ace.error
          ? `Start ACE-Step for vocals (${String(ace.error).slice(0, 60)})`
          : "Start ACE-Step (START_ACE_STEP.bat) for vocal songs";
        el.dataset.ready = "0";
      }
    }
  } catch (_) {
    if (el) el.textContent = "Free type-beat mode";
  }
}

async function musicgenGenerate(root) {
  // Primary Create path: ACE-Step vocals (up to 10 min) → MusicGen fallback
  // One Create at a time — never auto-queue the next song
  if (createInFlight) {
    showToast("Already creating — wait for this one (or play a saved song below)");
    return;
  }
  ensureAudio();
  const promptEl = root?.querySelector?.("#stu-suno-prompt") || $("stu-suno-prompt");
  const lyricsEl = root?.querySelector?.("#stu-lyrics") || $("stu-lyrics");
  const statusEl = root?.querySelector?.("#stu-suno-status") || $("stu-suno-status");
  const vocalsEl = root?.querySelector?.("#stu-vocals") || $("stu-vocals");
  const createBtn = root?.querySelector?.("#stu-musicgen-go") || $("stu-musicgen-go");
  const secs = Number(
    (root?.querySelector?.("#stu-mg-secs") || $("stu-mg-secs"))?.value || 180,
  );
  const style = (root?.querySelector?.("#stu-beat-style") || $("stu-beat-style"))?.value || "telephantix";
  const beatMeta = Beats.TYPE_BEATS.find((t) => t.id === style) || Beats.TYPE_BEATS[0];
  const wantVocals = vocalsEl ? !!vocalsEl.checked : true;
  const prompt =
    (promptEl?.value || "").trim() ||
    `${beatMeta.tags}, ${wantVocals ? "full song with vocals" : "instrumental"}, high quality studio mix`;
  const lyrics = (lyricsEl?.value || "").trim();

  createInFlight = true;
  activePollToken += 1;
  const myToken = activePollToken;
  if (createBtn) createBtn.disabled = true;
  if (statusEl) {
    statusEl.textContent = wantVocals
      ? `Creating ${Math.round(secs / 60)}-min vocal song…`
      : `Creating ${Math.round(secs / 60)}-min track…`;
  }
  showToast(wantVocals ? "✦ Full song with vocals — ACE-Step" : "✦ Instrumental — ACE-Step / MusicGen");

  try {
    const r = await fetch(studioApi("/api/studio/song-generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        lyrics,
        tags: beatMeta.tags,
        seconds: secs,
        instrumental: !wantVocals,
      }),
    });
    const j = await r.json();
    if (!j.ok || !j.job_id) {
      const msg = j.hint || j.error || "Song engine unavailable";
      showToast(msg);
      if (statusEl) statusEl.textContent = msg;
      return;
    }
    const provider = j.provider || "song";
    try {
      sessionStorage.setItem(
        "txStudioSongJob",
        JSON.stringify({ job_id: j.job_id, ace_task_id: j.ace_task_id || null, at: Date.now() }),
      );
    } catch (_) {}
    if (statusEl) {
      statusEl.textContent =
        provider === "ace-step"
          ? `ACE-Step generating${j.vocals ? " + vocals" : ""}…`
          : `${provider} generating (instrumental fallback)…`;
    }
    await pollSongJob(j.job_id, statusEl, secs, myToken, root);
  } catch (err) {
    console.error(err);
    showToast("Song generate error — is the hub up?");
    if (statusEl) statusEl.textContent = "error";
  } finally {
    if (myToken === activePollToken) createInFlight = false;
    if (createBtn) createBtn.disabled = false;
  }
}

function formatSongTime(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

function syncSongPlayerUi() {
  const audio = $("stu-gen-audio");
  const seek = $("stu-audio-seek");
  const timeEl = $("stu-audio-time");
  const playBtn = $("stu-audio-play");
  if (!audio) return;
  const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
  const cur = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  if (seek && !seek.matches(":active")) {
    seek.max = dur > 0 ? String(dur) : "0";
    seek.value = String(cur);
  }
  if (timeEl) timeEl.textContent = `${formatSongTime(cur)} / ${formatSongTime(dur)}`;
  if (playBtn) playBtn.textContent = audio.paused ? "▶" : "❚❚";
}

function seekSongTo(seconds) {
  const audio = $("stu-gen-audio");
  if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  const t = Math.max(0, Math.min(audio.duration, Number(seconds) || 0));
  audio.currentTime = t;
  syncSongPlayerUi();
}

function seekSongBy(deltaSec) {
  const audio = $("stu-gen-audio");
  if (!audio) return;
  seekSongTo((audio.currentTime || 0) + deltaSec);
}

function seekSongPct(pct) {
  const audio = $("stu-gen-audio");
  if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  const p = Math.max(0, Math.min(1, Number(pct) || 0));
  // "end" mark lands just before the finish so repeat/play still works
  const t = p >= 1 ? Math.max(0, audio.duration - 0.05) : audio.duration * p;
  seekSongTo(t);
}

let songPlayerWired = false;
function wireSongPlayerControls(root) {
  if (songPlayerWired) return;
  const scope = root || document;
  const audio = scope.querySelector?.("#stu-gen-audio") || $("stu-gen-audio");
  if (!audio) return;
  songPlayerWired = true;

  const playBtn = scope.querySelector?.("#stu-audio-play") || $("stu-audio-play");
  const backBtn = scope.querySelector?.("#stu-audio-back") || $("stu-audio-back");
  const fwdBtn = scope.querySelector?.("#stu-audio-fwd") || $("stu-audio-fwd");
  const repeatBtn = scope.querySelector?.("#stu-audio-repeat") || $("stu-audio-repeat");
  const seek = scope.querySelector?.("#stu-audio-seek") || $("stu-audio-seek");

  playBtn?.addEventListener("click", () => {
    if (!audio.src) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
    syncSongPlayerUi();
  });
  backBtn?.addEventListener("click", () => seekSongBy(-10));
  fwdBtn?.addEventListener("click", () => seekSongBy(10));
  repeatBtn?.addEventListener("click", () => {
    audio.loop = !audio.loop;
    repeatBtn.setAttribute("aria-pressed", audio.loop ? "true" : "false");
    repeatBtn.classList.toggle("on", audio.loop);
    try {
      localStorage.setItem("txStudioRepeat", audio.loop ? "1" : "0");
    } catch (_) {}
    showToast(audio.loop ? "Repeat on" : "Repeat off");
  });
  seek?.addEventListener("input", () => {
    seekSongTo(Number(seek.value) || 0);
  });
  seek?.addEventListener("change", () => {
    seekSongTo(Number(seek.value) || 0);
  });

  (scope.querySelectorAll?.(".stu-mark") || []).forEach((btn) => {
    btn.addEventListener("click", () => {
      const pct = Number(btn.getAttribute("data-pct"));
      seekSongPct(pct);
      showToast(`Jumped to ${btn.textContent.trim()}`);
    });
  });

  audio.addEventListener("timeupdate", syncSongPlayerUi);
  audio.addEventListener("loadedmetadata", syncSongPlayerUi);
  audio.addEventListener("durationchange", syncSongPlayerUi);
  audio.addEventListener("play", syncSongPlayerUi);
  audio.addEventListener("pause", syncSongPlayerUi);
  audio.addEventListener("ended", () => {
    // If loop is off, snap UI to end — do not auto-start another generation
    syncSongPlayerUi();
  });

  // Restore repeat preference
  try {
    if (localStorage.getItem("txStudioRepeat") === "1") {
      audio.loop = true;
      repeatBtn?.setAttribute("aria-pressed", "true");
      repeatBtn?.classList.add("on");
    }
  } catch (_) {}
}

function bindSongResult(url, meta = {}) {
  const audio = $("stu-gen-audio");
  const actions = $("stu-song-actions");
  const dl = $("stu-song-download");
  wireSongPlayerControls(document);
  if (audio && url) {
    const abs = url.startsWith("http") ? url : studioApi(url);
    const prev = audio.getAttribute("data-src") || "";
    if (prev !== abs) {
      audio.setAttribute("data-src", abs);
      audio.src = abs;
      audio.load();
    }
    audio.play().catch(() => {});
  }
  if (actions) actions.hidden = false;
  if (dl && url) {
    const abs = url.startsWith("http") ? url : studioApi(url);
    dl.href = abs;
    dl.download = meta.name || abs.split("/").pop() || "telephantix-song.wav";
  }
  syncSongPlayerUi();
  try {
    localStorage.setItem(
      "txStudioLastSong",
      JSON.stringify({ url, name: meta.name || "", at: Date.now(), duration_sec: meta.duration_sec }),
    );
  } catch (_) {}
}

async function refreshSongLibrary(root) {
  const list = root?.querySelector?.("#stu-library-list") || $("stu-library-list");
  if (!list) return;
  try {
    const r = await fetch(studioApi("/api/studio/library"));
    const j = await r.json();
    const tracks = Array.isArray(j.tracks) ? j.tracks : [];
    if (!tracks.length) {
      list.innerHTML = `<p class="stu-muted">No saved songs yet — hit ✦ Create</p>`;
      return;
    }
    list.innerHTML = tracks
      .slice(0, 24)
      .map((t) => {
        const title = (t.title || t.name || t.id || "song").replace(/[<>&]/g, "");
        const dur = t.duration_sec ? `${Math.round(t.duration_sec / 60)}m` : "";
        const url = t.url || "";
        return `<button type="button" class="stu-lib-item" data-url="${url}" data-name="${title}" title="${title}">
          <span>♪ ${title}</span><small>${dur}</small>
        </button>`;
      })
      .join("");
    list.querySelectorAll(".stu-lib-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-url");
        const name = btn.getAttribute("data-name") || "song";
        if (!url) return;
        // Re-open only — never kicks off a new generation
        bindSongResult(url, { name });
        showToast(`Playing saved · ${name}`);
        const statusEl = $("stu-suno-status");
        if (statusEl) statusEl.textContent = `Playing saved · ${name}`;
      });
    });
  } catch (_) {
    list.innerHTML = `<p class="stu-muted">Library offline</p>`;
  }
}

async function pollSongJob(jobId, statusEl, secsHint = 180, pollToken = 0, root = null) {
  // 10-min songs on laptop GPU can take a while — poll up to ~25 min
  // Gentle interval: aggressive polling exhausted Windows socket buffers (WinError 10055)
  const maxTries = Math.max(90, Math.ceil((Number(secsHint) || 180) / 4) + 40);
  for (let i = 0; i < maxTries; i++) {
    if (pollToken && pollToken !== activePollToken) return; // superseded — do not start another gen
    await new Promise((r) => setTimeout(r, i < 5 ? 5000 : 7000));
    try {
      const r = await fetch(studioApi(`/api/studio/song-job/${encodeURIComponent(jobId)}`));
      const j = await r.json();
      if (!j.ok && j.error === "unknown_job") {
        // Try resume from session (hub restart mid-song)
        let aceId = null;
        try {
          const saved = JSON.parse(sessionStorage.getItem("txStudioSongJob") || "{}");
          if (saved.job_id === jobId) aceId = saved.ace_task_id;
        } catch (_) {}
        if (aceId) {
          const rr = await fetch(studioApi("/api/studio/song-resume"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: jobId, ace_task_id: aceId }),
          });
          const rj = await rr.json();
          if (rj.ok) {
            if (statusEl) statusEl.textContent = "reconnected to GPU job…";
            continue;
          }
        }
        const msg = j.hint || "Hub restarted — hit ✦ Create again";
        if (statusEl) statusEl.textContent = msg;
        showToast(msg);
        return;
      }
      if (j.ace_task_id) {
        try {
          sessionStorage.setItem(
            "txStudioSongJob",
            JSON.stringify({ job_id: jobId, ace_task_id: j.ace_task_id, at: Date.now() }),
          );
        } catch (_) {}
      }
      const st = j.status || "";
      if (statusEl) {
        const bits = [st];
        if (j.provider) bits.push(j.provider);
        if (j.vocals) bits.push("vocals");
        if (j.queue_position) bits.push(`q${j.queue_position}`);
        bits.push(String(i + 1));
        statusEl.textContent = bits.join(" · ");
      }
      if (st === "complete" && j.url) {
        const label = `Ready · ${j.duration_sec || "?"}s · ${j.provider || "song"}${j.vocals ? " · vocals" : ""}`;
        if (statusEl) statusEl.textContent = label;
        showToast("✦ Song ready — playing (saved in Your songs)");
        const name = `acestep-${jobId}`;
        bindSongResult(j.url, { name, duration_sec: j.duration_sec });
        try {
          sessionStorage.removeItem("txStudioSongJob");
        } catch (_) {}
        // Refresh library only — never auto-start another generation
        void refreshSongLibrary(root);
        return;
      }
      if (st === "error") {
        const msg = j.hint || j.error || "Song error";
        showToast(msg);
        if (statusEl) statusEl.textContent = msg;
        return;
      }
    } catch (_) {
      if (statusEl && i % 3 === 0) statusEl.textContent = "waiting for hub…";
    }
  }
  if (statusEl) statusEl.textContent = "timeout — try 3 min first";
  showToast("Song timed out — try a shorter length");
}

/** @deprecated name kept — Create button still calls musicgenGenerate */
async function pollMusicgenJob(jobId, statusEl) {
  return pollSongJob(jobId, statusEl, 90, activePollToken, null);
}

async function sunoOrFreeGenerate(root) {
  ensureAudio();
  const promptEl = root?.querySelector?.("#stu-suno-prompt") || $("stu-suno-prompt");
  const statusEl = root?.querySelector?.("#stu-suno-status") || $("stu-suno-status");
  const style = $("stu-beat-style")?.value || "telephantix";
  const beatMeta = Beats.TYPE_BEATS.find((t) => t.id === style) || Beats.TYPE_BEATS[0];
  const prompt =
    (promptEl?.value || "").trim() ||
    `${beatMeta.tags}, instrumental type beat, studio quality, no vocals`;

  if (statusEl) statusEl.textContent = "Generating…";
  showToast("✦ Generating song…");

  try {
    const r = await fetch(studioApi("/api/studio/suno-generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        tags: beatMeta.tags,
        instrumental: true,
      }),
    });
    const j = await r.json();
    if (j.ok && j.job_id) {
      if (statusEl) statusEl.textContent = "Suno running…";
      showToast("Suno job started — polling…");
      await pollSunoJob(j.job_id, statusEl);
      return;
    }
    // Free fallback — type beat + full render
    if (statusEl) statusEl.textContent = "Free full type-beat render…";
    applyTypeBeat();
    await renderFullSongWav();
    if (statusEl) statusEl.textContent = "Free song rendered";
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = "Free fallback…";
    applyTypeBeat();
    await renderFullSongWav();
  }
}

async function pollSunoJob(jobId, statusEl) {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const r = await fetch(studioApi("/api/studio/suno-poll"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      const j = await r.json();
      const clips = j.clips || [];
      const audio = clips.find((c) => c.audio_url || c.url);
      if (j.status === "complete" || audio) {
        const url = audio?.audio_url || audio?.url;
        if (statusEl) statusEl.textContent = "Suno ready";
        showToast("✦ Suno track ready");
        if (url) {
          const a = new Audio(url);
          a.crossOrigin = "anonymous";
          a.play().catch(() => {});
          // Also offer download
          const link = document.createElement("a");
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = "Open Suno MP3";
          showToast("Suno MP3 playing — check catalog too");
        }
        return;
      }
      if (statusEl) statusEl.textContent = `Suno… ${i + 1}/40`;
    } catch (_) {}
  }
  if (statusEl) statusEl.textContent = "Suno timeout — free render";
  showToast("Suno slow — rendering free type beat");
  applyTypeBeat();
  await renderFullSongWav();
}

function renderAll() {
  renderInstruments();
  renderPlaySurface();
  renderSeq();
  renderMeta();
  document.querySelectorAll("#stu-bpm").forEach((el) => {
    el.value = String(song.bpm || 100);
  });
  document.querySelectorAll("#stu-scale").forEach((el) => {
    el.value = song.scale || "minor";
  });
}

function renderMeta() {
  document.querySelectorAll("#stu-meta").forEach((el) => {
    el.textContent = `${song.name || "Jam"} · ${song.scale} · root ${NOTE_NAMES[song.root || 0]} · ${song.bpm} BPM${liveAi ? " · ◉ LIVE AI" : ""}`;
  });
}

function renderInstruments() {
  document.querySelectorAll("#stu-insts").forEach((host) => {
    host.innerHTML = INSTRUMENTS.map(
      (i) =>
        `<button type="button" class="tx-stu-inst${i.id === activeInstrument ? " on" : ""}" data-inst="${i.id}" style="--c:${i.color}">${i.label}</button>`,
    ).join("");
    host.querySelectorAll(".tx-stu-inst").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeInstrument = btn.dataset.inst;
        renderInstruments();
        renderPlaySurface();
      });
    });
  });
}

function renderPlaySurface() {
  document.querySelectorAll("#stu-play-surface").forEach((host) => {
    const inst = INSTRUMENTS.find((i) => i.id === activeInstrument) || INSTRUMENTS[0];
    if (inst.kind === "drums") {
      host.innerHTML = `<div class="tx-stu-pads">${Object.entries(DRUM_MAP)
        .map(([k, name]) => `<button type="button" class="tx-stu-pad" data-drum="${k}">${name}</button>`)
        .join("")}</div>`;
      host.querySelectorAll(".tx-stu-pad").forEach((btn) => {
        btn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          ensureAudio();
          playDrum(DRUM_MAP[Number(btn.dataset.drum)], undefined, 0.9);
          btn.classList.add("flash");
          setTimeout(() => btn.classList.remove("flash"), 120);
        });
      });
      return;
    }
    if (inst.id === "guitar") {
      let html = `<div class="tx-stu-oct">Octave <button type="button" class="btn-chip ghost stu-oct-down">−</button><span>${octave}</span><button type="button" class="btn-chip ghost stu-oct-up">+</button></div><div class="tx-stu-fretboard">`;
      for (let s = 5; s >= 0; s--) {
        html += `<div class="tx-stu-string">`;
        for (let f = 0; f < 8; f++) {
          const midi = GUITAR_OPEN[s] + f + (octave - 4) * 12;
          html += `<button type="button" class="tx-stu-fret" data-midi="${midi}">${f === 0 ? "○" : "·"}</button>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
      host.innerHTML = html;
    } else {
      let html = `<div class="tx-stu-oct">Octave <button type="button" class="btn-chip ghost stu-oct-down">−</button><span>${octave}</span><button type="button" class="btn-chip ghost stu-oct-up">+</button></div><div class="tx-stu-keys">`;
      for (let i = 0; i < 24; i++) {
        const midi = 12 * (octave + 1) + i;
        const n = NOTE_NAMES[i % 12];
        html += `<button type="button" class="tx-stu-key${n.includes("#") ? " black" : ""}" data-midi="${midi}">${n}</button>`;
      }
      html += `</div>`;
      host.innerHTML = html;
    }
    host.querySelectorAll(".stu-oct-down").forEach((b) =>
      b.addEventListener("click", () => {
        octave = Math.max(1, octave - 1);
        renderPlaySurface();
      }),
    );
    host.querySelectorAll(".stu-oct-up").forEach((b) =>
      b.addEventListener("click", () => {
        octave = Math.min(7, octave + 1);
        renderPlaySurface();
      }),
    );
    host.querySelectorAll("[data-midi]").forEach((btn) => {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        ensureAudio();
        const midi = Number(btn.dataset.midi);
        playTone(activeInstrument, midi, undefined, 0.45, 0.65);
        btn.classList.add("flash");
        setTimeout(() => btn.classList.remove("flash"), 100);
        if (playing) {
          const tr = song.tracks.find((t) => t.instrument === activeInstrument);
          if (tr) {
            tr.steps[stepIndex % STEPS] = midi;
            renderSeq();
          }
        }
      });
    });
  });
}

function renderSeq() {
  document.querySelectorAll("#stu-seq").forEach((host) => {
    let html = `<div class="tx-stu-seq-grid"><div class="tx-stu-seq-row head"><span class="tx-stu-track-name"></span>`;
    for (let s = 0; s < STEPS; s++) html += `<span class="tx-stu-step-num">${(s % 4) + 1}</span>`;
    html += `</div>`;
    song.tracks.forEach((track, ti) => {
      const inst = INSTRUMENTS.find((i) => i.id === track.instrument);
      html += `<div class="tx-stu-seq-row"><button type="button" class="tx-stu-track-name${track.mute ? " muted" : ""}" data-mute="${ti}">${inst?.label || track.instrument}</button>`;
      for (let s = 0; s < STEPS; s++) {
        html += `<button type="button" class="stu-step${track.steps[s] != null ? " filled" : ""}" data-track="${ti}" data-step="${s}" style="--c:${inst?.color || "#888"}"></button>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
    host.innerHTML = html;
    host.querySelectorAll(".stu-step").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ti = Number(btn.dataset.track);
        const s = Number(btn.dataset.step);
        const track = song.tracks[ti];
        if (!track) return;
        if (track.steps[s] != null) track.steps[s] = null;
        else if (track.instrument === "drums") track.steps[s] = ti % 8;
        else {
          const scale = scaleDegrees();
          track.steps[s] = rootMidi(3) + scale[s % scale.length];
        }
        renderSeq();
        ensureAudio();
        const cell = track.steps[s];
        if (cell != null) {
          if (track.instrument === "drums") playDrum(DRUM_MAP[cell % 8]);
          else playTone(track.instrument, cell, undefined, 0.25, 0.5);
        }
      });
    });
    host.querySelectorAll("[data-mute]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ti = Number(btn.dataset.mute);
        if (song.tracks[ti]) song.tracks[ti].mute = !song.tracks[ti].mute;
        renderSeq();
      });
    });
  });
}

function updateTransportUi() {
  document.querySelectorAll("#stu-play").forEach((btn) => {
    btn.textContent = playing ? "⏸" : "▶";
    btn.title = playing ? "Pause" : "Play loop";
    btn.classList.toggle("is-playing", playing);
  });
  document.querySelectorAll("#stu-ai-live").forEach((btn) => {
    btn.classList.toggle("on", liveAi);
    btn.textContent = liveAi ? "◉ Live ON" : "◉ Live evolve";
  });
  renderMeta();
}

function loadDemo() {
  song = defaultSong();
  song.bpm = 104;
  song.name = "Meadow pulse";
  song.scale = "minor";
  aiGenerateDrums();
  aiGenerateBass();
  aiGeneratePad();
  aiGenerateMelody("keys");
}

function getSong() {
  return JSON.parse(JSON.stringify(song));
}
function loadSong(data) {
  if (!data || typeof data !== "object") return;
  const next = defaultSong();
  if (data.bpm) next.bpm = Number(data.bpm) || 100;
  if (data.name) next.name = String(data.name);
  if (data.scale) next.scale = data.scale;
  if (data.root != null) next.root = Number(data.root) || 0;
  if (Array.isArray(data.tracks)) {
    next.tracks = data.tracks.map((t, i) => {
      const base = emptyTrack(t.instrument || INSTRUMENTS[i % INSTRUMENTS.length].id);
      base.mute = !!t.mute;
      if (Array.isArray(t.steps)) {
        for (let s = 0; s < STEPS; s++) base.steps[s] = t.steps[s] == null ? null : t.steps[s];
      }
      return base;
    });
  }
  song = next;
}

async function exportWav() {
  ensureAudio();
  showToast("Rendering 24-bit…");
  const bars = 4;
  const totalSteps = STEPS * bars;
  const stepDur = stepDuration();
  const duration = totalSteps * stepDur + 1.2;
  const rate = audioCtx.sampleRate || 48000;
  const offline = new OfflineAudioContext(2, Math.ceil(rate * duration), rate);
  const real = { audioCtx, masterGain, dryGain, wetGain, convolver, compressor, analyser, impulseCache };
  try {
    audioCtx = offline;
    impulseCache = null;
    masterGain = offline.createGain();
    masterGain.gain.value = 0.7;
    dryGain = offline.createGain();
    dryGain.gain.value = 0.78;
    wetGain = offline.createGain();
    wetGain.gain.value = 0.28;
    convolver = offline.createConvolver();
    convolver.buffer = makeImpulse(2, 2);
    compressor = offline.createDynamicsCompressor();
    masterGain.connect(dryGain);
    masterGain.connect(convolver);
    convolver.connect(wetGain);
    const mix = offline.createGain();
    dryGain.connect(mix);
    wetGain.connect(mix);
    mix.connect(compressor);
    compressor.connect(offline.destination);
    let t = 0.08;
    for (let step = 0; step < totalSteps; step++) {
      const s = step % STEPS;
      for (const track of song.tracks) {
        if (track.mute || track.steps[s] == null) continue;
        const cell = track.steps[s];
        if (track.instrument === "drums") playDrum(DRUM_MAP[cell % 8] || "kick", t, 0.85);
        else playTone(track.instrument, cell, t, stepDur * 1.05, 0.55);
      }
      t += stepDur;
    }
    const rendered = await offline.startRendering();
    const wav = audioBufferToWav(rendered, 24);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
    a.download = `${(song.name || "telephantix-jam").replace(/\s+/g, "-").toLowerCase()}-24bit.wav`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("24-bit WAV ready");
  } catch (err) {
    showToast("Export failed");
    console.error(err);
  } finally {
    Object.assign({ audioCtx, masterGain, dryGain, wetGain, convolver, compressor, analyser, impulseCache }, {});
    audioCtx = real.audioCtx;
    masterGain = real.masterGain;
    dryGain = real.dryGain;
    wetGain = real.wetGain;
    convolver = real.convolver;
    compressor = real.compressor;
    analyser = real.analyser;
    impulseCache = real.impulseCache;
  }
}

function audioBufferToWav(buffer, bits = 24) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  bits = bits === 16 ? 16 : 24;
  const bytesPerSample = bits / 8;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = samples * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (o, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bits, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  const chans = [];
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      if (bits === 16) {
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      } else {
        const v = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff);
        view.setUint8(offset, v & 0xff);
        view.setUint8(offset + 1, (v >> 8) & 0xff);
        view.setUint8(offset + 2, (v >> 16) & 0xff);
        offset += 3;
      }
    }
  }
  return ab;
}

function showToast(msg) {
  let el = document.getElementById("tx-studio-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "tx-studio-toast";
    el.className = "tx-studio-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function setStudioMinimized(v) {
  studioMinimized = !!v;
  document.querySelectorAll(".tx-studio-panel").forEach((panel) => {
    panel.classList.toggle("is-minimized", studioMinimized);
    if (!studioMinimized) {
      panel.style.removeProperty("height");
      panel.style.removeProperty("max-height");
    }
  });
  document.querySelectorAll("#stu-body").forEach((body) => {
    body.hidden = studioMinimized;
    body.classList.toggle("is-collapsed", studioMinimized);
    if (!studioMinimized) {
      body.removeAttribute("hidden");
      body.style.removeProperty("display");
    }
  });
  document.querySelectorAll("#stu-min").forEach((minBtn) => {
    minBtn.textContent = studioMinimized ? "+" : "−";
    minBtn.title = studioMinimized ? "Expand" : "Minimize";
  });
}

export function openStudio() {
  // Prefer dedicated tab on mobile / always when available
  if ($("stage-studio") && window.TelephantimScenes?.setScene) {
    window.TelephantimScenes.setScene("studio");
    return;
  }
  buildFloatingPanel();
  ensureAudio();
  panelOpen = true;
  setStudioMinimized(false);
  const el = $("tx-studio");
  if (el) el.hidden = false;
  document.body.classList.add("studio-open");
  $("btn-studio")?.setAttribute("aria-expanded", "true");
  startViz();
}

export function closeStudio() {
  stopLoop();
  stopLiveAi();
  panelOpen = false;
  setStudioMinimized(false);
  const el = $("tx-studio");
  if (el) el.hidden = true;
  document.body.classList.remove("studio-open");
  $("btn-studio")?.setAttribute("aria-expanded", "false");
}

export function toggleStudio() {
  if (isStudioScene()) {
    // already on studio tab — ensure mounted
    mountFullPageStudio();
    return;
  }
  if (panelOpen) closeStudio();
  else openStudio();
}

function goStudioTab() {
  ensureAudio();
  if (window.TelephantimScenes?.setScene) {
    window.TelephantimScenes.setScene("studio");
  } else {
    location.hash = "studio";
    mountFullPageStudio();
  }
  $("btn-studio")?.setAttribute("aria-expanded", "true");
  showToast("Music Studio");
}

function onSceneChange() {
  if (isStudioScene()) {
    mountFullPageStudio();
    document.body.classList.add("studio-open");
    $("btn-studio")?.setAttribute("aria-expanded", "true");
    // hide floating overlay when full tab is open
    const float = $("tx-studio");
    if (float) float.hidden = true;
    panelOpen = false;
    startViz();
  } else {
    $("btn-studio")?.setAttribute("aria-expanded", "false");
  }
}

function wireChrome() {
  const btn = document.getElementById("btn-studio");
  if (!btn) return;
  if (btn.dataset.wired === "1") return;
  btn.dataset.wired = "1";
  const go = (e) => {
    try {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    } catch (_) {}
    goStudioTab();
  };
  btn.addEventListener("pointerup", go, true);
  btn.addEventListener("click", go, true);
  btn.addEventListener("touchend", go, { capture: true, passive: false });
  console.info("[studio] FAB → Music Studio tab");
}

function bootStudioUi() {
  try {
    wireChrome();
  } catch (err) {
    console.error("[studio] wire failed", err);
  }
  onSceneChange();
}

window.TelephantixStudio = {
  open: openStudio,
  close: closeStudio,
  toggle: toggleStudio,
  goTab: goStudioTab,
  playNote(instrument, note, duration = 0.35) {
    ensureAudio();
    playTone(instrument || activeInstrument, noteToMidi(note), undefined, duration, 0.6);
  },
  playDrum(kind) {
    ensureAudio();
    playDrum(kind || "kick");
  },
  startLoop,
  stopLoop,
  aiJam,
  aiEvolve,
  startLiveAi,
  stopLiveAi,
  applyTypeBeat,
  renderFullSong: renderFullSongWav,
  sunoGenerate: () => sunoOrFreeGenerate(document),
  loadSong,
  getSong,
  exportWav,
  setBpm(bpm) {
    song.bpm = Math.max(40, Math.min(200, Number(bpm) || 100));
  },
  instruments: () => INSTRUMENTS.map((i) => ({ id: i.id, label: i.label })),
  typeBeats: () => Beats.TYPE_BEATS.slice(),
  onSceneChange,
};

window.addEventListener("telephantim-scene", onSceneChange);
bootStudioUi();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootStudioUi);
window.addEventListener("load", bootStudioUi);
setTimeout(bootStudioUi, 200);
setTimeout(bootStudioUi, 800);
setTimeout(bootStudioUi, 2000);
