/**
 * Studio-grade type-beat arrangement + full-song WAV render (free).
 * Builds multi-minute songs from musical sections (intro/verse/chorus/…).
 */

export const TYPE_BEATS = [
  {
    id: "trap-dark",
    label: "🖤 Dark Trap",
    bpm: 140,
    scale: "minor",
    tags: "dark trap type beat, 808s, atmospheric",
  },
  {
    id: "boom-bap",
    label: "🎧 Boom Bap",
    bpm: 92,
    scale: "dorian",
    tags: "boom bap hip hop type beat, dusty drums",
  },
  {
    id: "lofi",
    label: "☕ Lo-Fi",
    bpm: 78,
    scale: "major",
    tags: "lofi chill hop type beat, warm keys",
  },
  {
    id: "drill",
    label: "🔪 Drill",
    bpm: 144,
    scale: "minor",
    tags: "uk drill type beat, sliding 808, dark",
  },
  {
    id: "cinematic",
    label: "🎬 Cinematic",
    bpm: 100,
    scale: "mystic",
    tags: "cinematic trailer type beat, epic pads",
  },
  {
    id: "telephantix",
    label: "✦ Telephantix",
    bpm: 96,
    scale: "mystic",
    tags: "mystical electronic type beat, caduceus energy, ambient trap",
  },
];

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  mystic: [0, 3, 5, 7, 10],
};

const PROG = {
  minor: [0, 5, 3, 4],
  major: [0, 4, 5, 3],
  dorian: [0, 3, 4, 0],
  mystic: [0, 3, 5, 4],
  pentatonic: [0, 2, 4, 0],
};

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Build a full song arrangement as repeating 16-step patterns per section.
 * @returns {{ bpm, scale, root, name, bars, sections, tracks }}
 */
export function generateTypeBeat(styleId = "telephantix", opts = {}) {
  const style = TYPE_BEATS.find((t) => t.id === styleId) || TYPE_BEATS[0];
  const rand = rng(opts.seed || Date.now());
  const bpm = opts.bpm || style.bpm;
  const scaleName = opts.scale || style.scale;
  const deg = SCALES[scaleName] || SCALES.minor;
  const prog = PROG[scaleName] || PROG.minor;
  const root = opts.root != null ? opts.root : Math.floor(rand() * 12);
  const bars = Math.max(32, Math.min(96, Number(opts.bars) || 64)); // ~2–4 min

  // Section map (bars)
  const sections = [];
  let b = 0;
  const push = (name, n, density) => {
    for (let i = 0; i < n && b < bars; i++, b++) sections.push({ name, density, bar: b });
  };
  push("intro", 8, 0.35);
  push("verse", 16, 0.55);
  push("chorus", 16, 0.9);
  push("verse", 12, 0.55);
  push("chorus", 16, 0.95);
  push("bridge", 8, 0.45);
  push("chorus", 12, 1);
  push("outro", Math.max(4, bars - b), 0.3);

  const empty = () => Array.from({ length: 16 }, () => null);

  const drums = empty();
  const bass = empty();
  const keys = empty();
  const pad = empty();
  const lead = empty();

  // Base 16-step patterns (looped across arrangement with density)
  for (let s = 0; s < 16; s++) {
    if (s % 4 === 0) drums[s] = 0;
    if (s % 8 === 4) drums[s] = 1;
    if (s % 2 === 0) drums[s] = drums[s] ?? 2;
    if (s === 15 && rand() > 0.4) drums[s] = 1;

    const chord = prog[Math.floor(s / 4) % prog.length];
    const d = deg[chord % deg.length];
    if (s % 2 === 0) bass[s] = 36 + root + d;
    if (s % 4 === 0) pad[s] = 48 + root + d;
    if (s === 0 || s === 8) keys[s] = 60 + root + d;
    if (s === 4 || s === 12) keys[s] = 60 + root + deg[(chord + 2) % deg.length];
    if ([2, 6, 10, 14].includes(s) && rand() > 0.35) {
      lead[s] = 72 + root + deg[Math.floor(rand() * deg.length)];
    }
  }

  // Style tweaks
  if (styleId === "trap-dark" || styleId === "drill") {
    for (let s = 0; s < 16; s++) {
      if (s % 4 !== 0 && rand() > 0.7) drums[s] = 2;
      if (s % 2 === 1 && rand() > 0.6) bass[s] = bass[s - 1] != null ? bass[s - 1] + (rand() > 0.5 ? 1 : -1) : bass[s];
    }
  }
  if (styleId === "lofi") {
    for (let s = 0; s < 16; s++) {
      if (drums[s] === 2 && rand() > 0.5) drums[s] = null;
      if (s % 8 === 0) keys[s] = 60 + root + deg[0];
    }
  }

  return {
    bpm,
    scale: scaleName,
    root,
    name: `${style.label} · ${bars} bars`,
    bars,
    style: styleId,
    tags: style.tags,
    sections,
    tracks: [
      { instrument: "drums", mute: false, steps: drums },
      { instrument: "bass", mute: false, steps: bass },
      { instrument: "pad", mute: false, steps: pad },
      { instrument: "keys", mute: false, steps: keys },
      { instrument: "lead", mute: false, steps: lead },
      { instrument: "strings", mute: false, steps: pad.map((v) => (v != null ? v - 12 : null)) },
    ],
  };
}

/**
 * Expand arrangement into a flat list of { trackIndex, midiOrDrum, time } events for OfflineAudioContext.
 * density from section gates how busy each bar is.
 */
export function expandSongEvents(song, playToneFn, playDrumFn) {
  // This is used by studio.js render — return per-step schedule helper instead
  return song;
}

export function barsToApproxSeconds(bars, bpm) {
  // 4/4: bar = 4 beats
  return (Number(bars) || 64) * (60 / Math.max(40, Number(bpm) || 100)) * 4;
}
