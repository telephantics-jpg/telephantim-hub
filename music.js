/**
 * On-page music player — full @telephantix Suno catalog + Spotify / YouTube albums.
 *
 * Suno songs load from suno-catalog.json (every public clip we can list).
 * Refresh catalog anytime:  python refresh-suno-catalog.py
 * Profile: https://suno.com/@telephantix  (never @telephantix-demo)
 */

const SUNO_PROFILE = "https://suno.com/@telephantix";
const SUNO_OPEN = "go-suno.html";
const SUNO_CATALOG_URL = "suno-catalog.json";

/** Fixed albums (embeds). Suno tracks are injected from the catalog. Editable via /admin. */
const BASE_ALBUMS = [
  {
    id: "spotify-album",
    title: "Telephantix — Spotify Album",
    artist: "Telephantix",
    type: "spotify",
    embedId: "album/0TQgbKYS4r0fDmciMoiqKt",
  },
  {
    id: "yt-album-1",
    title: "Telephantix Album — YouTube Music",
    artist: "Telephantix",
    type: "youtube",
    listId: "OLAK5uy_nOw1iUh26P4Zj_Odt1SjaLloUo7C9j4FY",
  },
  {
    id: "yt-album-2",
    title: "What Isn't Is — YouTube Music",
    artist: "Telephantix",
    type: "youtube",
    listId: "OLAK5uy_mCCAwPfN9jMXE9khpgsYFzA1xeei_i4NI",
  },
];

/** Live playlist (Suno queue + albums). Mutated after catalog load. */
export let PLAYLIST = [...BASE_ALBUMS];

/** Full published Suno set from suno-catalog.json (source of truth for "play all"). */
let allSunoTracks = [];

/** Ordered Suno tracks before shuffle (restore when shuffle turns off). */
let orderedSunoTracks = [];

/** "all" = suno then albums; "suno" = only published Suno songs */
let mode = "all";
let index = 0;
/** Panel shell visible (even if body minimized) */
let open = false;
/** true = panel body collapsed; audio can keep playing */
let minimized = false;
let sunoCount = 0;
let catalogLoaded = false;
/** Fisher–Yates shuffle of the current queue; Next/Prev follow shuffled order. */
let shuffleOn = false;
/**
 * Music stays silent until the user hits the bottom "Play music" chip (or a track).
 * Never autoplay on page load / catalog hydrate / scene change.
 */
let userStarted = false;
/** Live filter for the track list search box */
let listFilter = "";
/** First open this page session → shuffled queue + random start (not always song #1) */
let firstOpenShufflePending = true;
/** Don't skip-storm: user-picked track stays unless they hit Next */
let pinnedSongId = null;
let pinnedUntil = 0;
let lastAdvanceAt = 0;
let consecutiveLoadFails = 0;
let advancingUntil = 0;

function requestAdvance(force) {
  const now = Date.now();
  if (now < advancingUntil) return;
  advancingUntil = now + 2200;
  next(!!force);
}
/** Drag-placed Play music button (null = default center-bottom) */
const MUSIC_BTN_POS_KEY = "telephantim-music-btn-pos-v1";
/** Drag-placed music panel box */
const MUSIC_PANEL_POS_KEY = "telephantim-music-panel-pos-v1";
/** Mid-song + "wanted playing" across tab hide / lock (cleared when browser dies) */
const MUSIC_PERSIST_KEY = "telephantim-music-bg-v1";
const DJ_PREF_KEY = "telephantim-dj-vox-on";
let musicBtnPos = null; // { x, y } top-left of button
let musicBtnDrag = null;
let musicPanelPos = null; // { x, y } top-left of panel
let musicPanelDrag = null;
/** @type {null | ReturnType<typeof createDjRadio>} */
let djRadio = null;
/** true only when user deliberately paused (controls / lock-screen Pause) */
let userPaused = false;
let mediaSessionApi = null;
let bgKeepAliveInstalled = false;
let lastSoftResumeAt = 0;

function $(id) {
  return document.getElementById(id);
}

/** Dual-deck radio: A/B so Vox can mix instead of hard-cutting. */
let liveDeck = "a";
let mixing = false;
let mixTimer = null;
let boothCtx = null;
const boothNodes = new WeakMap();
/** Ignore ended/error while we tear down native audio to show an embed. */
let ignoringAudioEvents = false;
let radioWatch = null;
let embedStartedAt = 0;

function isIOS() {
  try {
    const ua = navigator.userAgent || "";
    return (
      /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1)
    );
  } catch (_) {
    return false;
  }
}

function isMobileRadio() {
  try {
    if (isIOS()) return true;
    const ua = navigator.userAgent || "";
    if (/Android/i.test(ua)) return true;
    if ((navigator.maxTouchPoints || 0) > 1 && Math.min(screen.width, screen.height) < 920) {
      return true;
    }
  } catch (_) {}
  return false;
}

function unlockRadio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      if (!boothCtx) boothCtx = new Ctx();
      boothCtx.resume?.();
      try {
        window.__teleVoxCtx = boothCtx;
      } catch (_) {}
      const buf = boothCtx.createBuffer(1, 1, 22050);
      const src = boothCtx.createBufferSource();
      src.buffer = buf;
      src.connect(boothCtx.destination);
      src.start(0);
    }
  } catch (_) {}
  const a = liveAudioEl();
  prepAudioElement(a);
  try {
    window.dispatchEvent(new Event("tele-audio-unlock"));
  } catch (_) {}
}

function isLocalHub() {
  let host = "";
  let port = "";
  try {
    host = (location.hostname || "").toLowerCase();
    port = String(location.port || "");
  } catch (_) {}
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (port === "8765" || port === "8767") return true;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
}

function hushNativeAudio(audio) {
  ignoringAudioEvents = true;
  if (audio) {
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load?.();
    } catch (_) {}
  }
  setTimeout(() => {
    ignoringAudioEvents = false;
  }, 600);
}

function liveAudioEl() {
  const b = document.getElementById("music-audio-b");
  const a = document.getElementById("music-audio");
  if (liveDeck === "b" && b) return b;
  return a;
}

function otherAudioEl() {
  return liveDeck === "a"
    ? document.getElementById("music-audio-b")
    : document.getElementById("music-audio");
}

function ensureBooth(audio) {
  if (isIOS() || isMobileRadio()) return null;
  if (!audio || typeof AudioContext === "undefined") return null;
  if (boothNodes.has(audio)) return boothNodes.get(audio);
  try {
    if (!boothCtx) boothCtx = new AudioContext();
    boothCtx.resume?.();
    if (boothCtx.state !== "running") return null;
    const src = boothCtx.createMediaElementSource(audio);
    const filter = boothCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 18000;
    const gain = boothCtx.createGain();
    gain.gain.value = 1;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(boothCtx.destination);
    const nodes = { filter, gain };
    boothNodes.set(audio, nodes);
    return nodes;
  } catch (err) {
    console.warn("[booth]", err);
    return null;
  }
}

function setBoothFx(fx = {}) {
  const audio = liveAudioEl();
  const nodes = ensureBooth(audio);
  if (!nodes) return;
  try {
    boothCtx?.resume?.();
  } catch (_) {}
  const hz = Number(fx.lowpass);
  if (Number.isFinite(hz) && hz > 80) {
    try {
      nodes.filter.frequency.setTargetAtTime(hz, boothCtx.currentTime, 0.18);
    } catch (_) {
      nodes.filter.frequency.value = hz;
    }
  }
}

function mixToNext() {
  // iOS / Android: one audio element. Dual-deck mix kills the queue.
  if (isMobileRadio()) return false;
  if (mixing) return false;
  if (!PLAYLIST.length) return false;
  const nextI = (index + 1) % PLAYLIST.length;
  const t = PLAYLIST[nextI];
  if (!t || t.type !== "audio" || !t.url) return false;
  const from = liveAudioEl();
  const to = otherAudioEl();
  if (!from || !to) return false;
  mixing = true;
  index = nextI;
  consecutiveLoadFails = 0;
  lastAdvanceAt = Date.now();
  pinCurrentSong(5000);
  prepAudioElement(to);
  to.hidden = false;
  to.volume = 0;
  try {
    to.src = t.url;
  } catch (_) {}
  ensureBooth(from);
  ensureBooth(to);
  setBoothFx({ lowpass: 720 });
  to.play().catch(() => {});
  const fromStart = Number(from.volume);
  const startVol = Number.isFinite(fromStart) && fromStart > 0.05 ? fromStart : 0.55;
  const steps = 16;
  let step = 0;
  if (mixTimer) clearInterval(mixTimer);
  mixTimer = setInterval(() => {
    step += 1;
    const p = Math.min(1, step / steps);
    try {
      from.volume = startVol * (1 - p);
    } catch (_) {}
    try {
      to.volume = startVol * p;
    } catch (_) {}
    if (step >= steps) {
      clearInterval(mixTimer);
      mixTimer = null;
      try {
        from.pause();
        from.removeAttribute("src");
        from.load?.();
        from.volume = startVol;
      } catch (_) {}
      liveDeck = liveDeck === "a" ? "b" : "a";
      mixing = false;
      setBoothFx({ lowpass: 18000 });
      try {
        to.volume = startVol;
      } catch (_) {}
      updateMusicChrome();
      renderList();
      updateMediaSessionMeta(true);
      saveMusicPersist();
    }
  }, 480);
  updateMusicChrome();
  renderList();
  return true;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSunoTrack(t) {
  return t && (t.type === "suno" || t.type === "audio");
}

function rebuildPlaylist() {
  sunoCount = allSunoTracks.length;
  if (mode === "suno") {
    PLAYLIST = allSunoTracks.length ? [...allSunoTracks] : [...BASE_ALBUMS];
  } else {
    PLAYLIST = [...allSunoTracks, ...BASE_ALBUMS];
  }
  if (index >= PLAYLIST.length) index = 0;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function applyShuffle(preserveCurrent) {
  const cur = preserveCurrent ? current() : null;
  const curId = cur && (cur.songId || cur.id);

  if (shuffleOn) {
    // Shuffle Suno songs; keep albums at the end in "all" mode
    const suno = shuffleArray(orderedSunoTracks.length ? orderedSunoTracks : allSunoTracks);
    allSunoTracks = suno;
  } else {
    allSunoTracks = orderedSunoTracks.length
      ? [...orderedSunoTracks]
      : [...allSunoTracks];
  }
  rebuildPlaylist();

  if (curId) {
    const i = PLAYLIST.findIndex((t) => (t.songId || t.id) === curId);
    if (i >= 0) index = i;
  }
  updateShuffleChip();
  renderList();
}

function updateShuffleChip() {
  const btn = $("music-shuffle");
  if (!btn) return;
  btn.classList.toggle("on", shuffleOn);
  btn.setAttribute("aria-pressed", shuffleOn ? "true" : "false");
  btn.textContent = shuffleOn ? "Shuffle · on" : "Shuffle";
  btn.title = shuffleOn
    ? "Shuffle on — queue is randomized. Click to restore playlist order."
    : "Shuffle the full Suno queue (no duplicates).";
}

function toggleShuffle() {
  shuffleOn = !shuffleOn;
  applyShuffle(true);
  // Stay on same song; only refresh media if user already started playback
  if (userStarted) loadTrack(false);
}

/** DistroKid masters on GitHub release (Suno's public MP3 CDN is locked). */
const RADIO_MP3_BASE =
  "https://github.com/telephantics-jpg/telephantim-hub/releases/download/radio-v1";

function isDeadSunoCdn(url) {
  return /cdn1\.suno\.ai|cdn2\.suno\.ai|audiopipe\.suno\.ai|\/api\/forbidden/i.test(
    String(url || "")
  );
}

function isHostedRadioUrl(url) {
  const u = String(url || "");
  return /\/releases\/download\/radio-|\/radio-mp3\//i.test(u) && /\.mp3(\?|$)/i.test(u);
}

function hostedMp3Url(id) {
  const clip = encodeURIComponent(id);
  if (isLocalHub()) {
    return `/radio-mp3/${clip}.mp3`;
  }
  // Luna proxy sets audio/mpeg — GitHub's octet-stream fails on iPhone
  return `https://telephanti.com/radio-mp3/${clip}.mp3`;
}

/** Suno embed — last-resort if we have no DistroKid master. */
function sunoEmbedUrl(id, wantPlay) {
  const q = wantPlay ? "?autoplay=true" : "";
  return `https://suno.com/embed/${encodeURIComponent(id)}${q}`;
}

let embedAdvanceTimer = null;

function clearEmbedAdvance() {
  if (embedAdvanceTimer) {
    clearTimeout(embedAdvanceTimer);
    embedAdvanceTimer = null;
  }
}

function armEmbedAdvance(track) {
  clearEmbedAdvance();
  embedStartedAt = Date.now();
  if (!userStarted || userPaused) return;
  if (!track || (track.type !== "suno" && track.type !== "audio")) return;
  const sec = Number(track.duration_sec);
  const waitSec = Number.isFinite(sec) && sec > 20 ? sec : 180;
  embedAdvanceTimer = setTimeout(() => {
    embedAdvanceTimer = null;
    if (!userStarted || userPaused) return;
    const cur = current();
    if (!cur || (cur.songId || cur.id) !== (track.songId || track.id)) return;
    requestAdvance(true);
  }, Math.round(waitSec * 1000) + 1500);
}

function isEmbedPlaying() {
  const frame = $("music-embed");
  const t = current();
  return !!(
    userStarted &&
    !userPaused &&
    frame &&
    !frame.hidden &&
    frame.getAttribute("src") &&
    t &&
    (t.type === "suno" || t.type === "spotify" || t.type === "youtube")
  );
}

function sunoFromCatalog(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, i) => {
      const id = row.id || row.songId;
      if (!id) return null;
      if (String(row.radio || "").toLowerCase() === "skip") return null;
      const catalogUrl = row.audio_url || row.url || "";
      const hosted = isHostedRadioUrl(catalogUrl) || row.radio === "distrokid";
      let url = hosted ? hostedMp3Url(id) : "";
      return {
        id: `suno-${id}`,
        songId: id,
        title: row.title || `Suno track ${i + 1}`,
        artist: row.artist || "Telephantix",
        type: hosted ? "audio" : "suno",
        url: hosted ? url : sunoEmbedUrl(id, false),
        duration_sec: Number(row.duration_sec) || 0,
        radio: hosted ? "distrokid" : "suno",
      };
    })
    .filter(Boolean);
}

function catalogUrls() {
  const bust = Date.now();
  const api = (typeof window !== "undefined" && window.TELEPHANTIM_API != null
    ? String(window.TELEPHANTIM_API)
    : ""
  ).replace(/\/$/, "");
  let host = "";
  try {
    host = (location.hostname || "").toLowerCase();
  } catch (_) {}
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
  // LIVE (telephantim.com): static suno-catalog.json first — works with PC OFF, free, no Render.
  // LOCAL hub: prefer /api so admin saves show up immediately.
  if (isLocal) {
    return [
      `/api/suno-catalog?v=${bust}&n=${bust}`,
      `${SUNO_CATALOG_URL}?v=${bust}`,
    ];
  }
  const urls = [`${SUNO_CATALOG_URL}?v=${bust}`];
  if (api) urls.push(`${api}/api/suno-catalog?v=${bust}`);
  return urls;
}

async function loadAlbumsFromCms() {
  try {
    const api = (typeof window !== "undefined" && window.TELEPHANTIM_API != null
      ? String(window.TELEPHANTIM_API)
      : ""
    ).replace(/\/$/, "");
    const urls = ["/api/content"];
    if (api) urls.push(`${api}/api/content`);
    urls.push(`site-content.json?v=${Date.now()}`);
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        const content = data.content || data;
        const albums = content && content.albums;
        if (Array.isArray(albums) && albums.length) {
          BASE_ALBUMS.length = 0;
          albums.forEach((a) => a && BASE_ALBUMS.push(a));
          rebuildPlaylist();
          return true;
        }
      } catch (_) {
        /* try next */
      }
    }
  } catch (err) {
    console.warn("CMS albums load failed", err);
  }
  return false;
}

async function loadSunoCatalog() {
  const sub = $("music-now-sub");
  if (sub) sub.textContent = "Loading catalog…";
  await loadAlbumsFromCms();
  let lastErr = null;
  for (const url of catalogUrls()) {
    try {
      const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) throw new Error(`catalog ${res.status}`);
      const data = await res.json();
      const rows = Array.isArray(data) ? data : data.tracks || data.catalog;
      if (!Array.isArray(rows)) throw new Error("catalog not array");
      // Never accept an empty catalog — keep trying next URL (static file has the songs)
      if (!rows.length) continue;
      orderedSunoTracks = sunoFromCatalog(rows);
      allSunoTracks = [...orderedSunoTracks];
      // Default queue = full Suno list first so new admin adds show at top
      mode = mode || "all";
      // Always rebuild so sunoCount matches latest catalog (no stuck 140 UI)
      if (shuffleOn) {
        applyShuffle(!!userStarted);
      } else {
        rebuildPlaylist();
      }
      sunoCount = allSunoTracks.length;
      catalogLoaded = true;
      try {
        console.info("[vox] catalog", rows.length, "tracks →", allSunoTracks.length, "from", url);
      } catch (_) {}
      // First visit this session: shuffle so the same songs aren't always first
      if (firstOpenShufflePending && allSunoTracks.length > 1 && !userStarted) {
        shuffleOn = true;
        applyShuffle(false);
        index = Math.floor(Math.random() * allSunoTracks.length);
        // Don't clear flag here — setOpen also reshuffles once on first open for a fresh order
      } else if (allSunoTracks.length && !shuffleOn) {
        // Ordered mode — start at top of catalog only before first play
        if (!userStarted) index = 0;
      } else if (index >= PLAYLIST.length) {
        index = 0;
      }
      updateSunoChip();
      updateShuffleChip();
      renderList();
      // Already playing: keep same song + position (do not restart)
      if (userStarted) {
        const audio = liveAudioEl();
        const cur = current();
        const same =
          audio &&
          cur &&
          isSunoTrack(cur) &&
          audio.src &&
          (audio.src === cur.url || (cur.songId && audio.src.includes(cur.songId)));
        if (same && !audio.paused) {
          updateMediaSessionMeta(true);
        } else if (!userPaused) {
          loadTrack(false);
          softResumeMusic("catalog-refresh");
        } else {
          loadTrack(false);
        }
      } else if (sub && allSunoTracks.length) {
        sub.textContent = shuffleOn
          ? `${allSunoTracks.length} songs · shuffled · tap Play`
          : `${allSunoTracks.length} songs · search or tap a title`;
      }
      return allSunoTracks.length;
    } catch (err) {
      lastErr = err;
    }
  }
  console.warn("Suno catalog load failed", lastErr);
  catalogLoaded = true;
  updateSunoChip();
  if (sub) sub.textContent = "Suno list offline — albums still play";
  return 0;
}

function current() {
  return PLAYLIST[index] || null;
}

function embedSrc(track, wantPlay) {
  if (!track) return "";
  if (track.type === "spotify") {
    // No autoplay flags — only load when user asked for sound
    return `https://open.spotify.com/embed/${track.embedId}?utm_source=generator&theme=0`;
  }
  if (track.type === "youtube") {
    const ap = wantPlay ? "1" : "0";
    return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(
      track.listId
    )}&rel=0&autoplay=${ap}`;
  }
  if (track.type === "suno" && track.songId) {
    return sunoEmbedUrl(track.songId, wantPlay);
  }
  return "";
}

function updateSunoChip() {
  const sunoLink = $("music-suno-link");
  if (!sunoLink) return;
  sunoLink.href = SUNO_OPEN;
  if (sunoCount > 0) {
    sunoLink.textContent =
      mode === "suno"
        ? `Suno · ${sunoCount} songs`
        : `Play all Suno (${sunoCount})`;
  } else {
    sunoLink.textContent = "Suno @telephantix";
  }
  sunoLink.title =
    mode === "suno"
      ? "Playing full @telephantix Suno queue — click for profile page"
      : `Play all ${sunoCount || ""} published Suno songs from @telephantix`.trim();
}

function updateHint() {
  const hint = document.querySelector(".music-hint");
  if (!hint) return;
  if (sunoCount > 0) {
    const shuf = shuffleOn ? " · shuffle on" : "";
    hint.textContent =
      mode === "suno"
        ? `Suno queue: ${sunoCount} songs from All I Got · auto-next${shuf} · no duplicates`
        : `${sunoCount} Suno songs + albums · Shuffle or Play all Suno${shuf}`;
  } else {
    hint.textContent = `Loading Suno catalog… or open ${SUNO_PROFILE.replace("https://", "")}`;
  }
}

function renderList() {
  const list = $("music-track-list");
  if (!list) return;
  list.innerHTML = "";

  const q = (listFilter || "").trim().toLowerCase();
  const entries = PLAYLIST.map((t, i) => ({ t, i })).filter(({ t }) => {
    if (!q) return true;
    const hay = `${t.title || ""} ${t.artist || ""} ${t.songId || t.id || ""}`.toLowerCase();
    return hay.includes(q);
  });

  // Group label for long Suno lists
  if (sunoCount > 0) {
    const head = document.createElement("div");
    head.className = "music-list-head";
    head.textContent = q
      ? `Search · ${entries.length} match${entries.length === 1 ? "" : "es"} (of ${PLAYLIST.length})`
      : mode === "suno"
        ? `All published Suno · ${sunoCount}`
        : `Suno (${sunoCount}) + albums`;
    list.appendChild(head);
  }

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "music-list-head";
    empty.textContent = q ? "No songs match that search" : "No tracks loaded";
    list.appendChild(empty);
    updateHint();
    return;
  }

  entries.forEach(({ t, i }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "music-track" + (i === index ? " active" : "");
    if (isSunoTrack(t)) btn.classList.add("is-suno");
    btn.innerHTML = `<strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(
      t.artist || t.type
    )}</span>`;
    btn.addEventListener("click", () => {
      index = i;
      pinCurrentSong(12000);
      loadTrack(true);
    });
    list.appendChild(btn);
  });
  updateHint();
}

/** Tell camp iframe to stop any of its own audio (prevents double music). */
function signalCampStopMusic() {
  try {
    const frame = document.getElementById("scene-frame");
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: "telephantim-stop-music" }, "*");
    }
  } catch (_) {
    /* cross-origin until camp is updated — safe to ignore */
  }
}

function stopAllMedia() {
  clearEmbedAdvance();
  const audio = liveAudioEl();
  const frame = $("music-embed");
  const stage = $("music-stage");
  ["music-audio", "music-audio-b"].forEach((id) => {
    const audio = document.getElementById(id);
    if (!audio) return;
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load?.();
    } catch (_) {}
    audio.hidden = true;
  });
  mixing = false;
  if (mixTimer) {
    clearInterval(mixTimer);
    mixTimer = null;
  }
  if (frame) {
    try {
      frame.removeAttribute("src");
    } catch (_) {}
    frame.hidden = true;
  }
  if (stage) stage.classList.remove("has-audio", "has-embed");
  signalCampStopMusic();
}

function loadTrack(autoPlayHint) {
  const t = current();
  const frame = $("music-embed");
  const audio = liveAudioEl();
  const title = $("music-now-title");
  const sub = $("music-now-sub");
  const sunoLink = $("music-suno-link");

  if (autoPlayHint) userStarted = true;

  if (title) title.textContent = t ? t.title : "No tracks";
  if (sub) {
    if (!t) sub.textContent = "";
    else if (isSunoTrack(t) && sunoCount) {
      const sunoIndex =
        PLAYLIST.slice(0, index + 1).filter(isSunoTrack).length || 1;
      sub.textContent = `${t.artist || "Suno"} · ${sunoIndex}/${sunoCount}`;
    } else {
      sub.textContent = t.artist || t.type || "";
    }
  }
  if (sunoLink) sunoLink.href = SUNO_OPEN;
  updateSunoChip();

  // Silent until the user has actually started music (no hidden embed/audio noise)
  if (!userStarted) {
    if (title && t) title.textContent = t.title;
    if (sub && !sub.textContent && t) {
      sub.textContent = sunoCount
        ? `${sunoCount} songs ready · tap Play music`
        : "Tap Play music when you want sound";
    }
    renderList();
    updateMusicButtonLabel();
    return;
  }

  if (!t) return;

  const stage = $("music-stage");
  // Always only one source: kill the other before starting this track
  signalCampStopMusic();

  // DistroKid masters stay native MP3 — iPhone Suno embeds steal the tap and never auto-next
  if (t.radio === "distrokid" || isHostedRadioUrl(t.url)) {
    t.type = "audio";
    if (!t.url || /suno\.com\/embed/i.test(t.url)) {
      t.url = hostedMp3Url(t.songId || String(t.id || "").replace(/^suno-/, ""));
    }
  }
  const useSunoEmbed = !!(
    t.songId &&
    t.radio !== "distrokid" &&
    !isHostedRadioUrl(t.url) &&
    (t.type === "suno" ||
      /suno\.ai|suno\.com|audiopipe/i.test(String(t.url || "")))
  );

  if (t.type === "audio" && !useSunoEmbed && audio && frame) {
    // Native hosted mp3 — no iframe (prevents double playback)
    clearEmbedAdvance();
    prepAudioElement(audio);
    try {
      frame.removeAttribute("src");
    } catch (_) {}
    frame.hidden = true;
    audio.hidden = false;
    if (stage) {
      stage.classList.add("has-audio");
      stage.classList.remove("has-embed");
    }
    const sameSrc =
      audio.src === t.url ||
      (audio.src && t.url && t.songId && audio.src.includes(String(t.songId)));
    if (!sameSrc) {
      audio.src = t.url;
    }
    if (autoPlayHint) {
      userPaused = false;
      const startVox = () => {
        setTimeout(() => notifyDjTrackChange(), 280);
      };
      try {
        const p = audio.play();
        if (p && typeof p.then === "function") {
          p.then(startVox).catch((err) => {
            console.warn("[radio] play blocked", err);
            setDjStatus("Song blocked — tap ♪ Play music once");
          });
        } else {
          startVox();
        }
      } catch (err) {
        console.warn("[radio] play", err);
      }
    }
    updateMediaSessionMeta(autoPlayHint || isAudioPlaying());
    saveMusicPersist();
    updateMusicChrome();
  } else if (frame && audio) {
    // Suno / Spotify / YouTube embed — pause native audio fully
    hushNativeAudio(audio);
    const other = otherAudioEl();
    if (other && other !== audio) hushNativeAudio(other);
    audio.hidden = true;
    frame.hidden = false;
    try {
      frame.setAttribute(
        "allow",
        "autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
      );
      frame.removeAttribute("loading");
    } catch (_) {}
    if (stage) {
      stage.classList.add("has-embed");
      stage.classList.remove("has-audio");
    }
    const nextSrc = embedSrc(t, !!autoPlayHint);
    if (nextSrc && frame.getAttribute("src") !== nextSrc) {
      frame.src = nextSrc;
    }
    if (useSunoEmbed) armEmbedAdvance(t);
    else clearEmbedAdvance();
    if (autoPlayHint) {
      userPaused = false;
      void notifyDjTrackChange();
    }
    updateMediaSessionMeta(autoPlayHint || isAudioPlaying());
    saveMusicPersist();
    updateMusicChrome();
  }

  renderList();
  updateMusicButtonLabel();
}

function isAudioPlaying() {
  const audio = liveAudioEl();
  const native = !!(audio && !audio.paused && !audio.ended && audio.currentTime > 0);
  return native || isEmbedPlaying();
}

/** True while we want continuous radio until browser close or user pause */
function wantBackgroundPlay() {
  return !!(userStarted && !userPaused && PLAYLIST.length);
}

function prepAudioElement(audio) {
  if (!audio) return;
  try {
    audio.setAttribute("playsinline", "");
    audio.setAttribute("webkit-playsinline", "");
    audio.playsInline = true;
    // Keep decoding friendly for long sessions
    audio.preload = "auto";
    try {
      audio.setAttribute("x-webkit-airplay", "allow");
    } catch (_) {}
  } catch (_) {}
}

function saveMusicPersist() {
  if (!wantBackgroundPlay()) return;
  try {
    const audio = liveAudioEl();
    const cur = current();
    if (!cur || !isSunoTrack(cur)) return;
    sessionStorage.setItem(
      MUSIC_PERSIST_KEY,
      JSON.stringify({
        on: true,
        id: cur.songId || cur.id,
        title: cur.title || "",
        time: audio ? Number(audio.currentTime) || 0 : 0,
        index,
        shuffleOn,
        t: Date.now(),
      }),
    );
  } catch (_) {}
}

function softResumeMusic(why) {
  if (!wantBackgroundPlay()) return;
  const now = Date.now();
  if (now - lastSoftResumeAt < 400) return;
  lastSoftResumeAt = now;
  const audio = liveAudioEl();
  const cur = current();
  if (!audio || !cur || !isSunoTrack(cur)) return;
  const dur = Number(audio.duration) || 0;
  const atEnd =
    !!audio.ended ||
    (dur > 2 && Number.isFinite(dur) && audio.currentTime >= dur - 0.35 && audio.paused);
  if (atEnd) {
    next();
    return;
  }
  // Already healthy — leave position alone
  if (!audio.paused && !audio.ended && audio.readyState >= 2) {
    updateMediaSessionMeta(true);
    return;
  }
  try {
    // Ensure src matches current track without rewinding if same file
    const same =
      audio.src &&
      (audio.src === cur.url || (cur.songId && audio.src.includes(String(cur.songId))));
    if (!same) {
      audio.src = cur.url;
    }
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (_) {}
  updateMediaSessionMeta(true);
  try {
    console.info("[telephantim-music] soft-resume", why, "t=", Math.floor(audio.currentTime || 0));
  } catch (_) {}
}

function updateMediaSessionMeta(playing) {
  if (!mediaSessionApi || typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    return;
  }
  const cur = current();
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: (cur && cur.title) || "Telephantix",
      artist: (cur && cur.artist) || "Telephantix",
      album: "Telephantim Radio",
      artwork: [
        { src: "/media/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/media/icon-512.png", sizes: "512x512", type: "image/png" },
      ].filter(() => true),
    });
  } catch (_) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: (cur && cur.title) || "Telephantix",
        artist: (cur && cur.artist) || "Telephantix",
        album: "Telephantim Radio",
      });
    } catch (__) {}
  }
  try {
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  } catch (_) {}
  try {
    const audio = liveAudioEl();
    if (
      audio &&
      typeof navigator.mediaSession.setPositionState === "function" &&
      Number(audio.duration) > 0
    ) {
      navigator.mediaSession.setPositionState({
        duration: Number(audio.duration),
        playbackRate: Number(audio.playbackRate) || 1,
        position: Math.min(Number(audio.currentTime) || 0, Number(audio.duration)),
      });
    }
  } catch (_) {}
}

function installMediaSession() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    mediaSessionApi = null;
    return;
  }
  const ms = navigator.mediaSession;
  const bind = (action, fn) => {
    try {
      ms.setActionHandler(action, (details) => {
        try {
          fn(details);
        } catch (_) {}
      });
    } catch (_) {}
  };
  bind("play", () => {
    userPaused = false;
    softResumeMusic("ms-play");
  });
  bind("pause", () => {
    userPaused = true;
    try {
      liveAudioEl()?.pause();
    } catch (_) {}
    updateMediaSessionMeta(false);
  });
  bind("stop", () => {
    userPaused = true;
    userStarted = false;
    stopAllMedia();
    updateMediaSessionMeta(false);
  });
  bind("nexttrack", () => {
    userPaused = false;
    next(true);
  });
  bind("previoustrack", () => {
    userPaused = false;
    prev();
  });
  bind("seekbackward", (d) => {
    const a = liveAudioEl();
    if (!a) return;
    const sec = Math.max(5, Number(d?.seekOffset) || 10);
    a.currentTime = Math.max(0, (a.currentTime || 0) - sec);
    saveMusicPersist();
  });
  bind("seekforward", (d) => {
    const a = liveAudioEl();
    if (!a) return;
    const sec = Math.max(5, Number(d?.seekOffset) || 10);
    const dur = Number(a.duration) || 0;
    a.currentTime = Math.min(dur || 1e9, (a.currentTime || 0) + sec);
    saveMusicPersist();
  });
  bind("seekto", (d) => {
    const a = liveAudioEl();
    if (!a || typeof d?.seekTime !== "number") return;
    a.currentTime = Math.max(0, d.seekTime);
    saveMusicPersist();
  });
  mediaSessionApi = ms;
}

/**
 * Keep Suno radio alive in background tabs / lock screen until browser closes
 * or the user pauses. Never reshuffles on unlock.
 */
function installBackgroundKeepAlive() {
  if (bgKeepAliveInstalled) return;
  bgKeepAliveInstalled = true;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      saveMusicPersist();
      // Do NOT pause — let the OS media session keep the stream
      return;
    }
    setTimeout(() => softResumeMusic("visible"), 80);
    setTimeout(() => softResumeMusic("visible-late"), 500);
  });

  window.addEventListener("pageshow", (e) => {
    setTimeout(() => softResumeMusic(e.persisted ? "bfcache" : "pageshow"), 80);
  });

  // Background tick: advance at end, soft-resume if OS stalled us
  setInterval(() => {
    if (!wantBackgroundPlay()) return;
    const a = liveAudioEl();
    if (!a) return;
    if (!a.paused && a.currentTime > 0) {
      saveMusicPersist();
      updateMediaSessionMeta(true);
    }
    if (a.ended) {
      const dur = Number(a.duration) || 0;
      if (dur >= 3) next(false);
      return;
    }
    // While tab is hidden, fight silent OS pauses
    if (document.hidden && a.paused && !a.ended) {
      softResumeMusic("bg-tick");
    }
  }, 2800);
}

function loadMusicBtnPos() {
  try {
    const raw = localStorage.getItem(MUSIC_BTN_POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x === "number" && typeof p?.y === "number") return p;
  } catch (_) {}
  return null;
}

function saveMusicBtnPos(pos) {
  try {
    if (!pos) localStorage.removeItem(MUSIC_BTN_POS_KEY);
    else localStorage.setItem(MUSIC_BTN_POS_KEY, JSON.stringify(pos));
  } catch (_) {}
}

function clampMusicBtnPos(x, y, btn) {
  const w = btn?.offsetWidth || 160;
  const h = btn?.offsetHeight || 48;
  const pad = 8;
  const maxX = Math.max(pad, window.innerWidth - w - pad);
  const maxY = Math.max(pad, window.innerHeight - h - pad);
  return {
    x: Math.min(maxX, Math.max(pad, x)),
    y: Math.min(maxY, Math.max(pad, y)),
  };
}

function loadMusicPanelPos() {
  try {
    const raw = localStorage.getItem(MUSIC_PANEL_POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x === "number" && typeof p?.y === "number") return p;
  } catch (_) {}
  return null;
}

function saveMusicPanelPos(pos) {
  try {
    if (!pos) localStorage.removeItem(MUSIC_PANEL_POS_KEY);
    else localStorage.setItem(MUSIC_PANEL_POS_KEY, JSON.stringify(pos));
  } catch (_) {}
}

function clampMusicPanelPos(x, y, panel) {
  const w = panel?.offsetWidth || 360;
  const h = panel?.offsetHeight || 200;
  const pad = 8;
  const maxX = Math.max(pad, window.innerWidth - w - pad);
  const maxY = Math.max(pad, window.innerHeight - h - pad);
  return {
    x: Math.min(maxX, Math.max(pad, x)),
    y: Math.min(maxY, Math.max(pad, y)),
  };
}

function applyMusicPanelPos() {
  const panel = $("music-player");
  if (!panel) return;
  if (musicPanelPos) {
    const p = clampMusicPanelPos(musicPanelPos.x, musicPanelPos.y, panel);
    musicPanelPos = p;
    panel.classList.add("is-placed");
    panel.classList.remove("is-anchored");
    panel.style.setProperty("--music-panel-left", `${p.x}px`);
    panel.style.setProperty("--music-panel-top", `${p.y}px`);
    panel.style.left = `${p.x}px`;
    panel.style.top = `${p.y}px`;
    panel.style.bottom = "auto";
    panel.style.right = "auto";
    panel.style.transform = "none";
  } else if (musicBtnPos) {
    // Follow chip if panel not independently placed
    const btn = $("btn-music");
    const pw = panel.offsetWidth || 360;
    const ph = panel.offsetHeight || 220;
    let px = musicBtnPos.x + (btn?.offsetWidth || 160) / 2 - pw / 2;
    let py = musicBtnPos.y - ph - 12;
    if (py < 8) py = musicBtnPos.y + (btn?.offsetHeight || 48) + 12;
    px = Math.min(window.innerWidth - pw - 8, Math.max(8, px));
    panel.classList.add("is-anchored");
    panel.classList.remove("is-placed");
    panel.style.setProperty("--music-panel-left", `${px}px`);
    panel.style.setProperty("--music-panel-top", `${py}px`);
    panel.style.left = `${px}px`;
    panel.style.top = `${py}px`;
    panel.style.bottom = "auto";
    panel.style.transform = "none";
  } else {
    panel.classList.remove("is-placed", "is-anchored");
    panel.style.removeProperty("--music-panel-left");
    panel.style.removeProperty("--music-panel-top");
    panel.style.left = "";
    panel.style.top = "";
    panel.style.bottom = "";
    panel.style.right = "";
    panel.style.transform = "";
  }
}

function applyMusicBtnPos() {
  const btn = $("btn-music");
  if (!btn) return;
  if (musicBtnPos) {
    const p = clampMusicBtnPos(musicBtnPos.x, musicBtnPos.y, btn);
    musicBtnPos = p;
    btn.classList.add("is-placed");
    btn.style.setProperty("--music-btn-left", `${p.x}px`);
    btn.style.setProperty("--music-btn-top", `${p.y}px`);
    btn.style.left = `${p.x}px`;
    btn.style.top = `${p.y}px`;
    btn.style.bottom = "auto";
    btn.style.transform = "none";
  } else {
    btn.classList.remove("is-placed");
    btn.style.removeProperty("--music-btn-left");
    btn.style.removeProperty("--music-btn-top");
    btn.style.left = "";
    btn.style.top = "";
    btn.style.bottom = "";
    btn.style.transform = "";
  }
  // Panel position is independent when dragged; else anchors to chip
  applyMusicPanelPos();
}

function wireMusicPanelDrag() {
  const panel = $("music-player");
  const handle = $("music-head");
  if (!panel || !handle || panel.dataset.panelDragWired === "1") return;
  panel.dataset.panelDragWired = "1";
  musicPanelPos = loadMusicPanelPos();
  applyMusicPanelPos();

  const onMove = (e) => {
    if (!musicPanelDrag) return;
    const pt = e.touches ? e.touches[0] : e;
    if (!pt) return;
    const dx = pt.clientX - musicPanelDrag.startX;
    const dy = pt.clientY - musicPanelDrag.startY;
    if (!musicPanelDrag.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      musicPanelDrag.moved = true;
      panel.classList.add("is-dragging");
      if (!musicPanelPos) {
        const r = panel.getBoundingClientRect();
        musicPanelPos = { x: r.left, y: r.top };
        musicPanelDrag.originX = r.left;
        musicPanelDrag.originY = r.top;
      }
    }
    if (!musicPanelDrag.moved) return;
    e.preventDefault?.();
    musicPanelPos = clampMusicPanelPos(
      musicPanelDrag.originX + dx,
      musicPanelDrag.originY + dy,
      panel,
    );
    applyMusicPanelPos();
  };

  const onUp = () => {
    if (!musicPanelDrag) return;
    if (musicPanelDrag.moved) {
      saveMusicPanelPos(musicPanelPos);
    }
    panel.classList.remove("is-dragging");
    musicPanelDrag = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };

  handle.addEventListener("pointerdown", (e) => {
    // Don't drag from action buttons
    if (e.target?.closest?.("button, a, input")) return;
    if (e.button != null && e.button !== 0) return;
    const r = panel.getBoundingClientRect();
    musicPanelDrag = {
      startX: e.clientX,
      startY: e.clientY,
      originX: musicPanelPos ? musicPanelPos.x : r.left,
      originY: musicPanelPos ? musicPanelPos.y : r.top,
      moved: false,
    };
    try {
      handle.setPointerCapture?.(e.pointerId);
    } catch (_) {}
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });

  handle.addEventListener("dblclick", (e) => {
    if (e.target?.closest?.("button")) return;
    e.preventDefault();
    musicPanelPos = null;
    saveMusicPanelPos(null);
    applyMusicPanelPos();
  });
}

function wireMusicBtnDrag() {
  const btn = $("btn-music");
  if (!btn || btn.dataset.dragWired === "1") return;
  btn.dataset.dragWired = "1";
  musicBtnPos = loadMusicBtnPos();
  applyMusicBtnPos();

  const onMove = (e) => {
    if (!musicBtnDrag) return;
    const pt = e.touches ? e.touches[0] : e;
    if (!pt) return;
    const dx = pt.clientX - musicBtnDrag.startX;
    const dy = pt.clientY - musicBtnDrag.startY;
    if (!musicBtnDrag.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      musicBtnDrag.moved = true;
      btn.classList.add("is-dragging");
      // First move off default: convert to absolute placement
      if (!musicBtnPos) {
        const r = btn.getBoundingClientRect();
        musicBtnPos = { x: r.left, y: r.top };
        musicBtnDrag.originX = r.left;
        musicBtnDrag.originY = r.top;
      }
    }
    if (!musicBtnDrag.moved) return;
    e.preventDefault?.();
    const next = clampMusicBtnPos(
      musicBtnDrag.originX + dx,
      musicBtnDrag.originY + dy,
      btn,
    );
    musicBtnPos = next;
    applyMusicBtnPos();
  };

  const onUp = (e) => {
    if (!musicBtnDrag) return;
    const wasDrag = musicBtnDrag.moved;
    if (wasDrag) {
      saveMusicBtnPos(musicBtnPos);
      e.preventDefault?.();
      e.stopPropagation?.();
    }
    btn.classList.remove("is-dragging");
    // Suppress click that follows a drag
    musicBtnDrag = wasDrag ? { suppressClick: true } : null;
    if (wasDrag) {
      setTimeout(() => {
        if (musicBtnDrag?.suppressClick) musicBtnDrag = null;
      }, 40);
    }
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onUp);
  };

  btn.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    const r = btn.getBoundingClientRect();
    const pt = e;
    musicBtnDrag = {
      startX: pt.clientX,
      startY: pt.clientY,
      originX: musicBtnPos ? musicBtnPos.x : r.left,
      originY: musicBtnPos ? musicBtnPos.y : r.top,
      moved: false,
    };
    try {
      btn.setPointerCapture?.(e.pointerId);
    } catch (_) {}
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });

  // Double-click / long-press reset: double-tap title area — also reset via title attribute hint
  btn.addEventListener("dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
    musicBtnPos = null;
    saveMusicBtnPos(null);
    applyMusicBtnPos();
  });

  window.addEventListener("resize", () => {
    if (musicBtnPos) {
      musicBtnPos = clampMusicBtnPos(musicBtnPos.x, musicBtnPos.y, btn);
      applyMusicBtnPos();
    }
    if (musicPanelPos) {
      const panel = $("music-player");
      musicPanelPos = clampMusicPanelPos(musicPanelPos.x, musicPanelPos.y, panel);
      applyMusicPanelPos();
    }
  });
}

function updateMusicChrome() {
  const label = $("btn-music-label");
  const btn = $("btn-music");
  const panel = $("music-player");
  const body = $("music-panel-body");
  const minBtn = $("music-min");
  const maxBtn = $("music-max");
  const miniRow = $("music-mini-row");
  const miniTitle = $("music-mini-title");
  const playing = isAudioPlaying();
  const cur = current();

  if (label) {
    if (!open && !playing) label.textContent = "♪ Play music";
    else if (open && !minimized) label.textContent = "♪ Hide list";
    else if (open && minimized) label.textContent = "♪ Expand";
    else label.textContent = playing ? "♪ Playing" : "♪ Music";
  }
  if (btn) {
    btn.classList.toggle("on", open && !minimized);
    btn.classList.toggle("playing-bg", playing && (minimized || !open));
    btn.setAttribute("aria-expanded", open && !minimized ? "true" : "false");
    btn.title =
      open && !minimized
        ? "Hide list · drag chip · double-click resets place"
        : playing
          ? "Show radio · drag · music keeps going across Relics/Bio/2D/3D"
          : "Play music · drag chip · double-click resets place";
  }
  if (panel) {
    const embedLive = isEmbedPlaying();
    // Embed iframes die on display:none — keep a tiny live shell while radio is on
    panel.hidden = !open && !embedLive;
    panel.classList.toggle("open", open);
    panel.classList.toggle("embed-keep", embedLive && (!open || minimized));
    panel.classList.toggle("is-minimized", open && minimized);
    // Restore full size when expanding (clear sticky layout)
    if (open && !minimized) {
      try {
        panel.style.removeProperty("height");
        panel.style.removeProperty("max-height");
        panel.style.removeProperty("width");
      } catch (_) {}
    }
  }
  if (body) {
    const collapse = !!(open && minimized);
    body.hidden = collapse;
    if (!collapse) {
      try {
        body.removeAttribute("hidden");
        body.style.removeProperty("display");
        body.style.removeProperty("height");
        body.style.removeProperty("max-height");
        body.style.removeProperty("overflow");
      } catch (_) {}
    }
  }
  if (minBtn) {
    minBtn.hidden = !!(open && minimized);
    if (!minimized) {
      try { minBtn.removeAttribute("hidden"); } catch (_) {}
    }
  }
  if (maxBtn) {
    maxBtn.hidden = !(open && minimized);
    if (open && minimized) {
      try {
        maxBtn.removeAttribute("hidden");
        maxBtn.style.display = "inline-flex";
      } catch (_) {}
    } else {
      try { maxBtn.style.removeProperty("display"); } catch (_) {}
    }
  }
  if (miniRow) {
    miniRow.hidden = !(open && minimized);
    if (open && minimized) {
      try { miniRow.removeAttribute("hidden"); } catch (_) {}
    }
  }
  if (miniTitle) {
    miniTitle.textContent = cur?.title
      ? `${playing ? "♫" : "❚❚"} ${cur.title}`
      : playing
        ? "♫ Playing…"
        : "Ready";
  }

  document.body.classList.toggle("music-open", open && !minimized);
  document.body.classList.toggle("music-minimized", open && minimized);
  document.body.classList.toggle("music-playing", playing);
  // Keep chip + panel placement (independent drag for the box)
  if (open) {
    applyMusicBtnPos();
    applyMusicPanelPos();
  }
}

/**
 * Scene switches (Relics / Bio / 2D / 3D) must NEVER kill the radio.
 * Same audio element lives on the hub parent — camp iframes stay muted for music.
 */
function onHubSceneChange() {
  signalCampStopMusic();
  if (wantBackgroundPlay()) {
    softResumeMusic("scene-change");
  }
  // Re-assert camp silence a moment after iframe paints
  setTimeout(() => signalCampStopMusic(), 400);
  setTimeout(() => {
    if (wantBackgroundPlay()) softResumeMusic("scene-change-late");
  }, 600);
  updateMusicChrome();
}

function setDjStatus(msg) {
  const el = $("music-dj-status");
  if (!el) return;
  if (msg) {
    el.hidden = false;
    el.textContent = msg;
  } else {
    el.hidden = true;
    el.textContent = "";
  }
}

async function ensureDjRadio() {
  if (djRadio) return djRadio;
  try {
    const mod = await import(`./hub-dj-radio.mjs?v=v130-live`);
    djRadio = mod.createDjRadio({
      getAudio: () => liveAudioEl(),
      mixToNext: () => mixToNext(),
      setBoothFx: (fx) => setBoothFx(fx),
      playAt: (i) => {
        const n = PLAYLIST.length;
        if (!n) return;
        index = ((Number(i) % n) + n) % n;
        loadTrack(true);
      },
      getTracks: () =>
        PLAYLIST.filter(isSunoTrack).map((t) => ({
          id: t.songId || t.id,
          title: t.title,
          artist: t.artist,
          src: t.url,
        })),
      getIndex: () => {
        // Index within Suno-only view of playlist for DJ intros
        const suno = PLAYLIST.filter(isSunoTrack);
        const cur = current();
        if (!cur || !isSunoTrack(cur)) return 0;
        const i = suno.findIndex((t) => (t.songId || t.id) === (cur.songId || cur.id));
        return i >= 0 ? i : 0;
      },
      getApiBase: () => {
        // Cloud-first: live sites always use Render (telephanti.com). PC not required.
        try {
          const h = (location.hostname || "").toLowerCase();
          const port = String(location.port || "");
          if (h.includes("telephantim") || h.includes("telephanti") || h.includes("github.io") || h.includes("onrender")) {
            return "https://telephanti.com";
          }
          if (h === "localhost" || h === "127.0.0.1") {
            // Optional local Luna only when developing on this machine
            if (port === "8767") return "";
            return "http://127.0.0.1:8767";
          }
          return "https://telephanti.com";
        } catch (_) {
          return "https://telephanti.com";
        }
      },
      // Hub owns next/prev + ended; DJ only speaks
      advanceOnEnded: false,
      isWantedOn: () => wantBackgroundPlay(),
      setStatus: setDjStatus,
      onUi: ({ enabled, status: st }) => {
        const btn = $("music-dj");
        if (btn) {
          btn.classList.toggle("on", !!enabled);
          btn.setAttribute("aria-pressed", enabled ? "true" : "false");
          btn.textContent = enabled ? "DJ Vox · on" : "DJ Vox";
        }
        if (st) setDjStatus(st);
      },
    });
    return djRadio;
  } catch (err) {
    console.warn("[music] DJ module failed", err);
    setDjStatus("Vox module failed — hard refresh");
    return null;
  }
}

async function setDjEnabled(on) {
  const dj = await ensureDjRadio();
  if (!dj) {
    setDjStatus("Vox unavailable — hard refresh");
    return;
  }
  dj.setEnabled(!!on);
  try {
    localStorage.setItem(DJ_PREF_KEY, on ? "1" : "0");
  } catch (_) {}
  if (!on) {
    try {
      dj.hush?.();
    } catch (_) {}
    setDjStatus("");
    return;
  }

  setDjStatus("DJ Vox · live booth…");
  try {
    const h = (location.hostname || "").toLowerCase();
    if (h === "localhost" || h === "127.0.0.1") {
      await fetch("http://127.0.0.1:8767/api/health", { cache: "no-store", mode: "cors" });
    }
  } catch (_) {}

  if (userStarted && isSunoTrack(current())) {
    setDjStatus("DJ Vox · on — cueing…");
    try {
      dj.onTrackChanged?.(null);
    } catch (_) {}
    void notifyDjTrackChange();
  } else {
    setDjStatus("DJ Vox · on — tap Play music / a song and Vox talks");
  }
}

/** Fire Vox for the current track — waits for module; auto-enables unless user turned off */
async function notifyDjTrackChange() {
  try {
    const dj = await ensureDjRadio();
    if (!dj) return;
    if (!dj.isEnabled()) {
      dj.setEnabled(true);
    }
    // Don't hush the line we're about to start unless mid-rant from a prior skip
    dj.onTrackChanged?.(null);
  } catch (err) {
    console.warn("[music] Vox notify", err);
    setDjStatus("Vox error — check Luna on :8767");
  }
}

function notifyDjSkip() {
  try {
    djRadio?.hush?.();
  } catch (_) {}
}

function updateMusicButtonLabel() {
  updateMusicChrome();
}

/**
 * Show / hide the player shell.
 * Sound starts ONLY when opts.play === true (Play music chip / explicit call).
 * Opening the shell alone never autoplays. Closing does NOT stop audio once started.
 */
function setOpen(v, opts) {
  open = !!v;
  if (open) minimized = false;
  updateMusicChrome();
  if (open) {
    const wantPlay = opts?.play === true;
    if (wantPlay) {
      unlockRadio();
      userStarted = true;
      userPaused = false;
      // Same tap as iPhone gesture — don't wait on catalog fetch
      if (PLAYLIST.length) loadTrack(true);
    }
    loadSunoCatalog().finally(() => {
      // First open: reshuffle + random start so it's never the same intro track
      if (firstOpenShufflePending && allSunoTracks.length > 1 && !userStarted) {
        firstOpenShufflePending = false;
        shuffleOn = true;
        applyShuffle(false);
        index = Math.floor(Math.random() * allSunoTracks.length);
        updateShuffleChip();
        renderList();
      } else if (firstOpenShufflePending) {
        firstOpenShufflePending = false;
      }

      const audio = liveAudioEl();
      const cur = current();
      const already =
        !!(
          audio &&
          cur &&
          isSunoTrack(cur) &&
          !audio.paused &&
          audio.src &&
          (audio.src === cur.url ||
            (cur.songId && audio.src.includes(cur.songId)))
        );
      if (wantPlay && !already) loadTrack(true);
      else if (userStarted) loadTrack(false);
      else renderList();
    });
  }
}

/** Collapse panel body; audio keeps playing. */
function setMinimized(v) {
  if (!open && v) {
    // Opening already minimized (chip expand path uses setOpen first)
    open = true;
  }
  minimized = !!v;
  if (!open) minimized = false;
  updateMusicChrome();
}

function toggleMinimize() {
  if (!open) {
    // Show shell only — never start sound without Play music
    setOpen(true, { play: false });
    return;
  }
  setMinimized(!minimized);
}

function pinCurrentSong(ms) {
  const cur = current();
  pinnedSongId = (cur && (cur.songId || cur.id)) || null;
  pinnedUntil = Date.now() + Math.max(800, ms || 8000);
}

function canAutoAdvance() {
  const now = Date.now();
  if (now - lastAdvanceAt < 1800) return false;
  if (now < pinnedUntil) {
    const cur = current();
    const id = cur && (cur.songId || cur.id);
    if (id && id === pinnedSongId) return false;
  }
  if (consecutiveLoadFails > 10) return false;
  return true;
}

function next(fromUser) {
  if (!PLAYLIST.length) return;
  if (!fromUser && !canAutoAdvance()) return;
  lastAdvanceAt = Date.now();
  if (fromUser) {
    pinnedSongId = null;
    pinnedUntil = 0;
    consecutiveLoadFails = 0;
  }
  // Cancel old Vox immediately so Next feels instant
  notifyDjSkip();
  index = (index + 1) % PLAYLIST.length;
  userPaused = false;
  loadTrack(true); // notifies DJ after play starts
}

function prev() {
  if (!PLAYLIST.length) return;
  pinnedSongId = null;
  pinnedUntil = 0;
  consecutiveLoadFails = 0;
  lastAdvanceAt = Date.now();
  notifyDjSkip();
  index = (index - 1 + PLAYLIST.length) % PLAYLIST.length;
  userPaused = false;
  loadTrack(true);
}

/** Play the full published Suno queue (all songs from catalog), not a handful of hardcodes. */
function playAllSuno(e) {
  if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return;
  e?.preventDefault();

  mode = "suno";
  const start = () => {
    if (shuffleOn) applyShuffle(false);
    else rebuildPlaylist();
    index = 0;
    setOpen(true, { play: true });
    loadTrack(true);
    updateSunoChip();
    updateShuffleChip();
    updateHint();
  };

  if (!catalogLoaded || !allSunoTracks.length) {
    loadSunoCatalog().then(start);
    return;
  }
  start();
}

function onAudioEnded(ev) {
  if (ignoringAudioEvents) return;
  const cur = current();
  // Empty <audio> under a Suno embed is not a real end
  if (cur && (cur.type === "suno" || cur.type === "spotify" || cur.type === "youtube")) {
    return;
  }
  if (mixing) {
    mixing = false;
    if (mixTimer) {
      clearInterval(mixTimer);
      mixTimer = null;
    }
    const live = liveAudioEl();
    const dying = ev?.target;
    if (dying && live && dying !== live) return;
  }
  if (!userStarted || userPaused || !PLAYLIST.length) return;
  const audio = (ev && ev.target) || liveAudioEl();
  const dur = Number(audio?.duration) || 0;
  const t = Number(audio?.currentTime) || 0;
  if (dur < 3 && t < 1) {
    consecutiveLoadFails += 1;
    if (consecutiveLoadFails > 2 && cur?.songId && !isMobileRadio() && cur.radio !== "distrokid") {
      cur.type = "suno";
      cur.url = sunoEmbedUrl(cur.songId, true);
      loadTrack(true);
    }
    return;
  }
  consecutiveLoadFails = 0;
  requestAdvance(true);
}

function startRadioWatch() {
  if (radioWatch) return;
  radioWatch = setInterval(() => {
    if (!userStarted || userPaused || !PLAYLIST.length) return;
    const cur = current();
    if (mixing && Date.now() - lastAdvanceAt > 12000) {
      mixing = false;
      if (mixTimer) {
        clearInterval(mixTimer);
        mixTimer = null;
      }
      requestAdvance(true);
      return;
    }
    const audio = liveAudioEl();
    if (cur && cur.type === "audio" && audio && !audio.paused && !mixing) {
      const dur = Number(audio.duration) || 0;
      const t = Number(audio.currentTime) || 0;
      if (dur > 8 && t >= dur - 0.55) {
        requestAdvance(true);
        return;
      }
    }
    if (cur && cur.type === "suno" && embedStartedAt) {
      const sec = Number(cur.duration_sec);
      const wait = ((Number.isFinite(sec) && sec > 20 ? sec : 180) + 2) * 1000;
      if (Date.now() - embedStartedAt >= wait) {
        requestAdvance(true);
      }
    }
  }, 900);
}

function wire() {
  wireMusicBtnDrag();
  wireMusicPanelDrag();
  // Single bottom "Play music" chip — only control that starts sound by default
  $("btn-music")?.addEventListener("click", (e) => {
    // Ignore click that follows a drag
    if (musicBtnDrag?.suppressClick || musicBtnDrag?.moved) {
      musicBtnDrag = null;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!open) {
      // First tap: unlock iPhone audio + start DistroKid bed in this gesture
      unlockRadio();
      setOpen(true, { play: true });
      return;
    }
    if (minimized) {
      setMinimized(false);
      return;
    }
    // Fully open → hide shell (audio keeps going if already started)
    setOpen(false);
  });
  $("music-min")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMinimized(true);
  });
  $("music-max")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMinimized(false);
  });
  // Close = hide shell (keep playing only if user already started)
  $("music-close")?.addEventListener("click", () => setOpen(false));
  $("music-next")?.addEventListener("click", () => next(true));
  $("music-prev")?.addEventListener("click", prev);
  $("music-mini-next")?.addEventListener("click", () => next(true));
  $("music-mini-prev")?.addEventListener("click", prev);
  $("music-search")?.addEventListener("input", (e) => {
    listFilter = e.target?.value || "";
    renderList();
  });
  $("music-dj")?.addEventListener("click", async () => {
    const on = !($("music-dj")?.classList.contains("on"));
    await setDjEnabled(on);
    if (on && userStarted && isSunoTrack(current())) {
      setDjStatus("Vox · cueing…");
      void notifyDjTrackChange();
    }
  });
  // Seamless radio across Relics / Bio / Luna 2D / Luna 3D
  window.addEventListener("telephantim-scene", onHubSceneChange);
  // Catalog refresh on focus — never interrupt a live stream (preserve + soft-resume)
  window.addEventListener("focus", () => {
    if (wantBackgroundPlay() && isAudioPlaying()) {
      softResumeMusic("focus-playing");
      // Quiet refresh later so admin adds land without killing the song
      setTimeout(() => {
        if (catalogLoaded) loadSunoCatalog();
      }, 2500);
      return;
    }
    if (open || catalogLoaded) loadSunoCatalog();
    else softResumeMusic("focus");
  });
  $("music-shuffle")?.addEventListener("click", toggleShuffle);
  $("music-suno-link")?.addEventListener("click", playAllSuno);

  function bindDeck(audio) {
    if (!audio || audio.dataset.deckBound === "1") return;
    audio.dataset.deckBound = "1";
    prepAudioElement(audio);
    audio.addEventListener("ended", onAudioEnded);
    audio.addEventListener("play", () => {
      userPaused = false;
      updateMusicChrome();
      updateMediaSessionMeta(true);
      saveMusicPersist();
    });
    audio.addEventListener("pause", () => {
      updateMusicChrome();
      // Background / lock: browser may pause us — fight it if we still want radio
      if (document.hidden && wantBackgroundPlay()) {
        setTimeout(() => softResumeMusic("hidden-pause"), 180);
        return;
      }
      // Visible pause that sticks = user (native controls)
      setTimeout(() => {
        if (!audio.paused || audio.ended || document.hidden) return;
        if (wantBackgroundPlay() || userStarted) {
          userPaused = true;
          updateMediaSessionMeta(false);
        }
      }, 160);
    });
    audio.addEventListener("timeupdate", () => {
      if (ignoringAudioEvents || mixing) return;
      const dur = Number(audio.duration) || 0;
      const t = Number(audio.currentTime) || 0;
      if (dur > 8 && t >= dur - 0.45 && userStarted && !userPaused) {
        requestAdvance(true);
        return;
      }
      if (Math.floor(t) % 5 === 0) {
        try {
          updateMediaSessionMeta(!audio.paused);
        } catch (_) {}
      }
    });
    audio.addEventListener("error", () => {
      if (ignoringAudioEvents) return;
      if (mixing) {
        mixing = false;
        if (mixTimer) {
          clearInterval(mixTimer);
          mixTimer = null;
        }
      }
      const cur = current();
      const id = cur?.songId;
      if (id && (cur.radio === "distrokid" || isHostedRadioUrl(cur.url))) {
        const local = `/radio-mp3/${id}.mp3`;
        const gh = `${RADIO_MP3_BASE}/${id}.mp3`;
        const src = String(audio.currentSrc || audio.src || cur.url || "");
        if (/radio-mp3/i.test(src) && !cur._triedGh) {
          cur._triedGh = true;
          cur.url = gh;
          audio.src = gh;
          audio.play().catch(() => {});
          return;
        }
        if (/github\.com|githubusercontent/i.test(src) && isLocalHub() && !cur._triedLocal) {
          cur._triedLocal = true;
          cur.url = local;
          audio.src = local;
          audio.play().catch(() => {});
          return;
        }
      }
      if (id && isSunoTrack(cur) && cur.type !== "suno") {
        if (isMobileRadio() || cur.radio === "distrokid") {
          consecutiveLoadFails += 1;
          setTimeout(() => requestAdvance(true), 400);
          return;
        }
        cur.type = "suno";
        cur.url = sunoEmbedUrl(id, true);
        loadTrack(true);
        return;
      }
      consecutiveLoadFails += 1;
      if (!userStarted || userPaused) return;
      if (!PLAYLIST.length || PLAYLIST.length < 2) return;
      if (audio && audio.currentTime > 1.2) return;
      setTimeout(() => requestAdvance(true), 600);
    });
    audio.addEventListener("playing", () => {
      consecutiveLoadFails = 0;
    });
  }
  bindDeck(document.getElementById("music-audio"));
  bindDeck(document.getElementById("music-audio-b"));
  startRadioWatch();

  installMediaSession();
  installBackgroundKeepAlive();

  // Cold start: silent, no embed/audio attached — never auto-resume across reloads
  stopAllMedia();
  userStarted = false;
  userPaused = false;
  open = false;
  minimized = false;
  try {
    sessionStorage.removeItem(MUSIC_PERSIST_KEY);
  } catch (_) {}
  renderList();
  loadSunoCatalog();
  updateMusicChrome();

  // Local booth: Vox on until they tap DJ Vox off
  try {
    localStorage.setItem(DJ_PREF_KEY, "1");
  } catch (_) {}
  setDjEnabled(true).catch(() => {});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wire);
} else {
  wire();
}

window.TelephantimMusic = {
  get PLAYLIST() {
    return PLAYLIST;
  },
  setOpen,
  setMinimized,
  toggleMinimize,
  next,
  prev,
  loadTrack,
  playAllSuno,
  loadSunoCatalog,
  toggleShuffle,
  softResumeMusic,
  wantBackgroundPlay,
  get shuffleOn() {
    return shuffleOn;
  },
  get sunoCount() {
    return sunoCount;
  },
  get open() {
    return open;
  },
  get userStarted() {
    return userStarted;
  },
  get userPaused() {
    return userPaused;
  },
  get minimized() {
    return minimized;
  },
};
