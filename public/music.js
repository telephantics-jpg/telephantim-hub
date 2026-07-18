/**
 * On-page music player — Suno profile + Spotify / YouTube embeds.
 * Add more Suno tracks: { title, type: "suno", id: "SONG_UUID" }
 * Get UUID from a song share URL: suno.com/song/UUID
 */

const SUNO_PROFILE = "https://suno.com/@telephantix-demo";

/** Default playable set (in-browser). Swap/add Suno song IDs anytime. */
export const PLAYLIST = [
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
  // Example Suno entries (uncomment / replace with your song UUIDs from share links):
  // {
  //   id: "suno-1",
  //   title: "My Suno Track",
  //   artist: "@telephantix",
  //   type: "suno",
  //   songId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  // },
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
  if (sunoLink) sunoLink.href = SUNO_PROFILE;

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

function wire() {
  $("btn-music")?.addEventListener("click", () => setOpen(!open));
  $("music-close")?.addEventListener("click", () => setOpen(false));
  $("music-next")?.addEventListener("click", next);
  $("music-prev")?.addEventListener("click", prev);
  renderList();
  loadTrack(false);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wire);
} else {
  wire();
}

window.TelephantimMusic = { PLAYLIST, setOpen, next, prev, loadTrack };
