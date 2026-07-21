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
let open = false;
let sunoCount = 0;
let catalogLoaded = false;
/** Fisher–Yates shuffle of the current queue; Next/Prev follow shuffled order. */
let shuffleOn = false;

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
  // If shuffle just turned on and we are already open, stay on same song
  loadTrack(false);
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
    loadTrack(false);
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

function embedSrc(track) {
  if (!track) return "";
  if (track.type === "spotify") {
    return `https://open.spotify.com/embed/${track.embedId}?utm_source=generator&theme=0`;
  }
  if (track.type === "youtube") {
    return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(track.listId)}&rel=0`;
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

function loadTrack(autoPlayHint) {
  const t = current();
  const frame = $("music-embed");
  const audio = $("music-audio");
  const title = $("music-now-title");
  const sub = $("music-now-sub");
  const sunoLink = $("music-suno-link");

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
    }
  } else if (frame && audio) {
    audio.pause();
    audio.hidden = true;
    audio.removeAttribute("src");
    frame.hidden = false;
    frame.src = embedSrc(t);
  }

  renderList();
  updateMusicButtonLabel();
}

function isAudioPlaying() {
  const audio = $("music-audio");
  return !!(audio && !audio.paused && !audio.ended && audio.currentTime > 0);
}

function updateMusicButtonLabel() {
  const label = $("btn-music-label");
  const btn = $("btn-music");
  if (!label) return;
  if (open) {
    label.textContent = "Hide music";
  } else if (isAudioPlaying()) {
    // Minimized but still playing in background
    label.textContent = "Show music";
  } else {
    label.textContent = "Play music";
  }
  if (btn) {
    btn.classList.toggle("on", open);
    btn.classList.toggle("playing-bg", !open && isAudioPlaying());
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.title = open
      ? "Hide player (music keeps playing)"
      : isAudioPlaying()
        ? "Show music player — still playing"
        : "Play Telephantix music";
  }
}

/**
 * Show / hide the player panel.
 * Hiding does NOT stop audio — minimize and keep listening.
 */
function setOpen(v) {
  open = !!v;
  const panel = $("music-player");
  if (panel) {
    panel.hidden = !open;
    panel.classList.toggle("open", open);
  }
  updateMusicButtonLabel();
  if (open) {
    // Don't restart mid-song if already playing this track in the background
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
    loadTrack(!already);
  }
  // When closing: leave audio running (minimize + keep play)
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
  // Continuous play through the queue
  if (!PLAYLIST.length) return;
  next();
}

function wire() {
  // Toggle panel open/closed; hide = minimize, audio keeps going
  $("btn-music")?.addEventListener("click", () => setOpen(!open));
  $("music-close")?.addEventListener("click", () => setOpen(false));
  $("music-next")?.addEventListener("click", next);
  $("music-prev")?.addEventListener("click", prev);
  $("music-shuffle")?.addEventListener("click", toggleShuffle);
  $("music-suno-link")?.addEventListener("click", playAllSuno);

  const audio = $("music-audio");
  if (audio) {
    audio.addEventListener("ended", onAudioEnded);
    audio.addEventListener("play", updateMusicButtonLabel);
    audio.addEventListener("pause", updateMusicButtonLabel);
    // When one Suno file errors, skip to next so the whole queue still works
    audio.addEventListener("error", () => {
      if (isSunoTrack(current()) && PLAYLIST.length > 1) {
        setTimeout(next, 400);
      }
    });
  }

  renderList();
  loadTrack(false);
  loadSunoCatalog();
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
};
