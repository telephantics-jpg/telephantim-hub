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
/** Drag-placed Play music button (null = default center-bottom) */
const MUSIC_BTN_POS_KEY = "telephantim-music-btn-pos-v1";
let musicBtnPos = null; // { x, y } top-left of button
let musicBtnDrag = null;

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

function catalogUrls() {
  const bust = Date.now();
  // Always hit local server first (admin saves land here)
  const urls = [`/api/suno-catalog?v=${bust}`];
  const api = (typeof window !== "undefined" && window.TELEPHANTIM_API != null
    ? String(window.TELEPHANTIM_API)
    : ""
  ).replace(/\/$/, "");
  let host = "";
  try {
    host = (location.hostname || "").toLowerCase();
  } catch (_) {}
  const isLocal = host === "localhost" || host === "127.0.0.1";
  // On this PC, never pull a dead remote catalog over the admin-saved one
  if (api && !isLocal) urls.push(`${api}/api/suno-catalog?v=${bust}`);
  urls.push(`${SUNO_CATALOG_URL}?v=${bust}`);
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
      // Empty remote is useless — keep trying (local file / other host)
      if (!rows.length && !url.startsWith("/api/")) continue;
      orderedSunoTracks = sunoFromCatalog(rows);
      allSunoTracks = [...orderedSunoTracks];
      // Default queue = full Suno list first so new admin adds show at top
      mode = mode || "all";
      if (shuffleOn) {
        applyShuffle(false);
      } else {
        rebuildPlaylist();
      }
      catalogLoaded = true;
      // First visit this session: shuffle so the same songs aren't always first
      if (firstOpenShufflePending && allSunoTracks.length > 1) {
        shuffleOn = true;
        applyShuffle(false);
        index = Math.floor(Math.random() * allSunoTracks.length);
        // Don't clear flag here — setOpen also reshuffles once on first open for a fresh order
      } else if (allSunoTracks.length && !shuffleOn) {
        // Ordered mode — start at top of catalog
        if (!userStarted) index = 0;
      } else if (index >= PLAYLIST.length) {
        index = 0;
      }
      updateSunoChip();
      updateShuffleChip();
      renderList();
      if (userStarted) loadTrack(false);
      else if (sub && allSunoTracks.length) {
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
  const audio = $("music-audio");
  const frame = $("music-embed");
  const stage = $("music-stage");
  if (audio) {
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load?.();
    } catch (_) {}
    audio.hidden = true;
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

  const stage = $("music-stage");
  // Always only one source: kill the other before starting this track
  signalCampStopMusic();

  if (t.type === "audio" && audio && frame) {
    // Native Suno mp3 — no iframe (prevents double playback)
    try {
      frame.removeAttribute("src");
    } catch (_) {}
    frame.hidden = true;
    audio.hidden = false;
    if (stage) {
      stage.classList.add("has-audio");
      stage.classList.remove("has-embed");
    }
    if (audio.src !== t.url && !(audio.src && t.url && audio.src.endsWith(t.songId + ".mp3"))) {
      audio.src = t.url;
    }
    if (autoPlayHint) {
      audio.play().catch(() => {});
    }
  } else if (frame && audio) {
    // Spotify / YouTube embed only — pause native audio fully
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load?.();
    } catch (_) {}
    audio.hidden = true;
    frame.hidden = false;
    if (stage) {
      stage.classList.add("has-embed");
      stage.classList.remove("has-audio");
    }
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

function applyMusicBtnPos() {
  const btn = $("btn-music");
  const panel = $("music-player");
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
    // Panel sits above the button when open
    if (panel) {
      const pw = panel.offsetWidth || 360;
      const ph = panel.offsetHeight || 280;
      let px = p.x + (btn.offsetWidth || 160) / 2 - pw / 2;
      let py = p.y - ph - 12;
      if (py < 8) py = p.y + (btn.offsetHeight || 48) + 12;
      px = Math.min(window.innerWidth - pw - 8, Math.max(8, px));
      panel.classList.add("is-anchored");
      panel.style.setProperty("--music-panel-left", `${px}px`);
      panel.style.setProperty("--music-panel-top", `${py}px`);
      panel.style.left = `${px}px`;
      panel.style.top = `${py}px`;
      panel.style.bottom = "auto";
      panel.style.transform = "none";
    }
  } else {
    btn.classList.remove("is-placed");
    btn.style.removeProperty("--music-btn-left");
    btn.style.removeProperty("--music-btn-top");
    btn.style.left = "";
    btn.style.top = "";
    btn.style.bottom = "";
    btn.style.transform = "";
    if (panel) {
      panel.classList.remove("is-anchored");
      panel.style.removeProperty("--music-panel-left");
      panel.style.removeProperty("--music-panel-top");
      panel.style.left = "";
      panel.style.top = "";
      panel.style.bottom = "";
      panel.style.transform = "";
    }
  }
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
  });
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
    if (!open && !playing) label.textContent = "♪ Play music";
    else if (open && !minimized) label.textContent = "♪ Hide list";
    else if (open && minimized) label.textContent = "♪ Expand";
    else label.textContent = "♪ Playing"; // closed shell but still playing
  }
  if (btn) {
    btn.classList.toggle("on", open && !minimized);
    btn.classList.toggle("playing-bg", playing && (minimized || !open));
    btn.setAttribute("aria-expanded", open && !minimized ? "true" : "false");
    btn.title =
      open && !minimized
        ? "Hide player · drag to move · double-click resets"
        : playing
          ? "Show player · drag to move · double-click resets"
          : "Play music · drag to move · double-click resets place";
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
  // Keep panel glued to dragged button
  if (open) applyMusicBtnPos();
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
    // Always re-pull catalog when opening so admin "add song" shows up
    loadSunoCatalog().finally(() => {
      // First open: reshuffle + random start so it's never the same intro track
      if (firstOpenShufflePending && allSunoTracks.length > 1) {
        firstOpenShufflePending = false;
        shuffleOn = true;
        applyShuffle(false);
        index = Math.floor(Math.random() * allSunoTracks.length);
        updateShuffleChip();
        renderList();
      } else if (firstOpenShufflePending) {
        firstOpenShufflePending = false;
      }

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
  wireMusicBtnDrag();
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
  $("music-search")?.addEventListener("input", (e) => {
    listFilter = e.target?.value || "";
    renderList();
  });
  // After admin adds songs in another tab, refresh catalog when you come back
  window.addEventListener("focus", () => {
    if (open || catalogLoaded) loadSunoCatalog();
  });
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
