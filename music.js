/**
 * On-page music player — Suno songs + Spotify / YouTube embeds.
 * Profile (correct): https://suno.com/@telephantix  (NOT @telephantix-demo)
 * Add more Suno tracks: { title, type: "suno", songId: "SONG_UUID" }
 * UUID from share URL: suno.com/song/UUID
 */

const SUNO_PROFILE = "https://suno.com/@telephantix";
/** Reliable same-origin open page (avoids blank new-tab on phones). */
const SUNO_OPEN = "go-suno.html";

/** Default playable set (in-browser). Swap/add Suno song IDs anytime. */
export const PLAYLIST = [
  // Public @telephantix Suno tracks (embed plays on-page)
  {
    id: "suno-taccata",
    title: "Taccata",
    artist: "Suno · @telephantix",
    type: "suno",
    songId: "7642aa82-4650-4776-aca5-36e65e343e33",
  },
  {
    id: "suno-desperation",
    title: "Desperation",
    artist: "Suno · @telephantix",
    type: "suno",
    songId: "c03108ad-f7a6-404f-b0f4-e6792e681818",
  },
  {
    id: "suno-faint-whispers",
    title: "Faint whispers",
    artist: "Suno · @telephantix",
    type: "suno",
    songId: "c424705a-1002-40b0-a5a1-fbeab6865c68",
  },
  {
    id: "suno-for-the-home",
    title: "For the Home",
    artist: "Suno · @telephantix",
    type: "suno",
    songId: "2f62b61b-aa1c-47ca-bbb7-c3916d3fd00e",
  },
  {
    id: "suno-lucid-dreams",
    title: "Lucid Dreams",
    artist: "Suno · @telephantix",
    type: "suno",
    songId: "891fb230-b620-4825-8755-cd762463608b",
  },
  {
    id: "spotify-album",
    title: "Telephantix — Spotify Album",
    artist: "Telephantix",
    type: "spotify",
    // open.spotify.com/album/0TQgbKYS4r0fDmciMoiqKt
    embedId: "album/0TQgbKYS4r0fDmciMoiqKt",
  },
  {
    id: "yt-album-1",
    title: "Telephantix Album — YouTube Music",
    artist: "Telephantix",
    type: "youtube",
    // music.youtube playlist → youtube embed list
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

function $(id) {
  return document.getElementById(id);
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
    // Suno share embed (works for public songs)
    return `https://suno.com/embed/${encodeURIComponent(track.songId)}`;
  }
  if (track.type === "audio" && track.url) {
    return track.url;
  }
  return "";
}

let index = 0;
let open = false;

function current() {
  return PLAYLIST[index] || null;
}

function renderList() {
  const list = $("music-track-list");
  if (!list) return;
  list.innerHTML = "";
  PLAYLIST.forEach((t, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "music-track" + (i === index ? " active" : "");
    btn.innerHTML = `<strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.artist || t.type)}</span>`;
    btn.addEventListener("click", () => {
      index = i;
      loadTrack(true);
    });
    list.appendChild(btn);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadTrack(autoPlayHint) {
  const t = current();
  const frame = $("music-embed");
  const audio = $("music-audio");
  const title = $("music-now-title");
  const sub = $("music-now-sub");
  const sunoLink = $("music-suno-link");

  if (title) title.textContent = t ? t.title : "No tracks";
  if (sub) sub.textContent = t ? t.artist || t.type : "";
  // Profile open uses go-suno.html (correct @telephantix, no -demo, reliable on phones)
  if (sunoLink) sunoLink.href = SUNO_OPEN;

  if (!t) return;

  if (t.type === "audio" && audio && frame) {
    frame.hidden = true;
    frame.removeAttribute("src");
    audio.hidden = false;
    audio.src = t.url;
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
  const label = $("btn-music-label");
  if (label) label.textContent = open ? "Hide music" : "Play music";
}

function setOpen(v) {
  open = !!v;
  const panel = $("music-player");
  const btn = $("btn-music");
  if (panel) {
    panel.hidden = !open;
    panel.classList.toggle("open", open);
  }
  if (btn) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.classList.toggle("on", open);
  }
  const label = $("btn-music-label");
  if (label) label.textContent = open ? "Hide music" : "Play music";
  if (open) loadTrack(true);
  else {
    const audio = $("music-audio");
    const frame = $("music-embed");
    if (audio) {
      audio.pause();
    }
    // keep last embed; user can reopen
    if (frame && !open) {
      /* optional: frame.removeAttribute("src"); */
    }
  }
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

/** Jump player to first Suno track (on-page embed). Profile opens via go-suno.html. */
function playSunoFirst(e) {
  // If user wants profile, leave default link; if we intercept, load Suno embed.
  // Ctrl/Cmd-click or middle-click still opens profile page.
  if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return;
  const i = PLAYLIST.findIndex((t) => t.type === "suno");
  if (i < 0) return; // fall through to go-suno.html
  e.preventDefault();
  index = i;
  setOpen(true);
  loadTrack(true);
}

function wire() {
  $("btn-music")?.addEventListener("click", () => setOpen(!open));
  $("music-close")?.addEventListener("click", () => setOpen(false));
  $("music-next")?.addEventListener("click", next);
  $("music-prev")?.addEventListener("click", prev);
  $("music-suno-link")?.addEventListener("click", playSunoFirst);
  renderList();
  loadTrack(false);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wire);
} else {
  wire();
}

window.TelephantimMusic = { PLAYLIST, setOpen, next, prev, loadTrack };
