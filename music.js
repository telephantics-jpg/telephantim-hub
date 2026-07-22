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

/** Fixed albums (embeds). Suno tracks are injected from the catalog. */
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

function $(id) {
  return document.getElementById(id);
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

function sunoFromCatalog(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, i) => {
      const id = row.id || row.songId;
      if (!id) return null;
      const url = row.audio_url || row.url || `https://cdn1.suno.ai/${id}.mp3`;
      return {
        id: `suno-${id}`,
        songId: id,
        title: row.title || `Suno track ${i + 1}`,
        artist: row.artist || "Suno · @telephantix",
        // Native audio — full queue play + auto-next (Suno profile pages cannot be embedded)
        type: "audio",
        url,
      };
    })
    .filter(Boolean);
}

async function loadSunoCatalog() {
  const sub = $("music-now-sub");
  if (sub && !catalogLoaded) sub.textContent = "Loading all Suno songs…";
  try {
    const res = await fetch(`${SUNO_CATALOG_URL}?v=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const rows = await res.json();
    orderedSunoTracks = sunoFromCatalog(rows);
    allSunoTracks = [...orderedSunoTracks];
    if (shuffleOn) {
      applyShuffle(false);
    } else {
      rebuildPlaylist();
    }
    catalogLoaded = true;
    updateSunoChip();
    updateShuffleChip();
    renderList();
    // Prefer landing on the full Suno queue once catalog is ready
    if (allSunoTracks.length && !isSunoTrack(current())) {
      index = 0;
    }
    // Do NOT start audio here — only refresh UI / media if user already hit Play
    if (userStarted) loadTrack(false);
    else if (sub && allSunoTracks.length) {
      sub.textContent = `${allSunoTracks.length} songs ready · tap Play music`;
    }
    return allSunoTracks.length;
  } catch (err) {
    console.warn("Suno catalog load failed", err);
    catalogLoaded = true;
    updateSunoChip();
    if (sub) sub.textContent = "Suno list offline — albums still play";
    return 0;
  }
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
    return `https://suno.com/embed/${encodeURIComponent(track.songId)}`;
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

  // Group label for long Suno lists
  if (sunoCount > 0) {
    const head = document.createElement("div");
    head.className = "music-list-head";
    head.textContent =
      mode === "suno"
        ? `All published Suno · ${sunoCount}`
        : `Suno (${sunoCount}) + albums`;
    list.appendChild(head);
  }

  PLAYLIST.forEach((t, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "music-track" + (i === index ? " active" : "");
    if (isSunoTrack(t)) btn.classList.add("is-suno");
    btn.innerHTML = `<strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(
      t.artist || t.type
    )}</span>`;
    btn.addEventListener("click", () => {
      index = i;
      loadTrack(true);
    });
    list.appendChild(btn);
  });
  updateHint();
}

function stopAllMedia() {
  const audio = $("music-audio");
  const frame = $("music-embed");
  if (audio) {
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load?.();
    } catch (_) {}
    audio.hidden = true;
  }
  if (frame) {
    frame.removeAttribute("src");
    frame.hidden = true;
  }
}

function loadTrack(autoPlayHint) {
  const t = current();
  const frame = $("music-embed");
  const audio = $("music-audio");
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

  if (t.type === "audio" && audio && frame) {
    frame.hidden = true;
    frame.removeAttribute("src");
    audio.hidden = false;
    if (audio.src !== t.url) {
      audio.src = t.url;
    }
    if (autoPlayHint) {
      audio.play().catch(() => {});
    } else {
      // Catalog/shuffle refresh — keep paused if user already paused
      // (do not force-play)
    }
  } else if (frame && audio) {
    audio.pause();
    audio.hidden = true;
    audio.removeAttribute("src");
    frame.hidden = false;
    // Only attach embed when user wants sound (avoids Spotify/YT auto-start)
    if (autoPlayHint || !frame.getAttribute("src")) {
      frame.src = embedSrc(t, !!autoPlayHint);
    } else {
      frame.src = embedSrc(t, false);
    }
  }

  renderList();
  updateMusicButtonLabel();
}

function isAudioPlaying() {
  const audio = $("music-audio");
  return !!(audio && !audio.paused && !audio.ended && audio.currentTime > 0);
}

function updateMusicChrome() {
  const label = $("btn-music-label");
  const btn = $("btn-music");
  const panel = $("music-player");
  const body = $("music-panel-body");
  const minBtn = $("music-min");
  const maxBtn = $("music-max");
  const playing = isAudioPlaying();

  if (label) {
    if (!open && !playing) label.textContent = "Play music";
    else if (open && !minimized) label.textContent = "Hide music";
    else if (open && minimized) label.textContent = "Expand music";
    else label.textContent = "Show music"; // closed shell but still playing
  }
  if (btn) {
    btn.classList.toggle("on", open && !minimized);
    btn.classList.toggle("playing-bg", playing && (minimized || !open));
    btn.setAttribute("aria-expanded", open && !minimized ? "true" : "false");
    btn.title =
      open && !minimized
        ? "Hide player (music keeps playing)"
        : playing
          ? "Show / expand music player"
          : "Play Telephantix music";
  }
  if (panel) {
    panel.hidden = !open;
    panel.classList.toggle("open", open);
    panel.classList.toggle("is-minimized", open && minimized);
  }
  if (body) body.hidden = !!(open && minimized);
  if (minBtn) minBtn.hidden = !!(open && minimized);
  if (maxBtn) maxBtn.hidden = !(open && minimized);

  document.body.classList.toggle("music-open", open && !minimized);
  document.body.classList.toggle("music-minimized", open && minimized);
  document.body.classList.toggle("music-playing", playing);
}

function updateMusicButtonLabel() {
  updateMusicChrome();
}

/**
 * Show / hide the player shell.
 * First open from "Play music" starts playback; later open only shows the panel.
 * Closing does NOT stop audio once the user has started it.
 */
function setOpen(v, opts) {
  open = !!v;
  if (open) minimized = false;
  updateMusicChrome();
  if (open) {
    const wantPlay = opts?.play !== false;
    const audio = $("music-audio");
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
    // First time user opens the chip → start sound. Re-open while already
    // playing → just show UI. Never autoplay without this path.
    if (wantPlay && !already) loadTrack(true);
    else if (userStarted) loadTrack(false);
    else if (wantPlay) loadTrack(true);
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
    setOpen(true);
    return;
  }
  setMinimized(!minimized);
}

function next() {
  if (!PLAYLIST.length) return;
  index = (index + 1) % PLAYLIST.length;
  loadTrack(true);
}

function prev() {
  if (!PLAYLIST.length) return;
  index = (index - 1 + PLAYLIST.length) % PLAYLIST.length;
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
    setOpen(true);
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

function onAudioEnded() {
  // Continuous play through the queue — only after user started
  if (!userStarted || !PLAYLIST.length) return;
  next();
}

function wire() {
  // Single bottom "Play music" chip — only control that starts sound by default
  $("btn-music")?.addEventListener("click", () => {
    if (!open) {
      // First tap: open panel AND start music (explicit user gesture)
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
  $("music-next")?.addEventListener("click", next);
  $("music-prev")?.addEventListener("click", prev);
  $("music-shuffle")?.addEventListener("click", toggleShuffle);
  $("music-suno-link")?.addEventListener("click", playAllSuno);

  const audio = $("music-audio");
  if (audio) {
    audio.addEventListener("ended", onAudioEnded);
    audio.addEventListener("play", updateMusicChrome);
    audio.addEventListener("pause", updateMusicChrome);
    audio.addEventListener("error", () => {
      if (userStarted && isSunoTrack(current()) && PLAYLIST.length > 1) {
        setTimeout(next, 400);
      }
    });
  }

  // Cold start: silent, no embed/audio attached
  stopAllMedia();
  userStarted = false;
  open = false;
  minimized = false;
  renderList();
  loadSunoCatalog();
  updateMusicChrome();
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
  get shuffleOn() {
    return shuffleOn;
  },
  get sunoCount() {
    return sunoCount;
  },
  get open() {
    return open;
  },
  get minimized() {
    return minimized;
  },
};
