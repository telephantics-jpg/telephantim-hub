/**
 * Bio page: fixed bg video/image + scrollable quote & links.
 */
import { BIO } from "./bio-config.js?v=v175-wide";
import { PROFILE, SOCIALS, ICONS } from "./links.js";
import { hydrateSiteContent } from "./load-site.js";
import {
  claimPlayback,
  createPauseGate,
  movieResumeTime,
  playbackOwner,
  releasePlayback,
  shouldHandoffMovie,
  shouldWakeMutedBackdrop,
  syncPlaybackSession,
} from "./lock-playback.js";
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

function setImageBg(url) {
  const img = $("bio-image");
  const video = $("bio-video");
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.hidden = true;
  }
  if (img) {
    img.hidden = false;
    img.style.backgroundImage = url ? `url("${url}")` : "";
    img.classList.toggle("has-media", !!url);
  }
}

function setVideoBg(url, poster) {
  const video = $("bio-video");
  const img = $("bio-image");
  if (img) img.hidden = true;
  if (!video || !url) {
    setImageBg(poster || BIO.image);
    return;
  }
  video.hidden = false;
  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("muted", "muted");
  video.setAttribute("loop", "");
  video.setAttribute("autoplay", "");
  // Cache-bust so phones don't keep a stale Mind-Over-Hell clip
  const bust = String(url).includes("?") ? url : `${url}?v=v175-wide`;
  if (poster) video.poster = poster;
  video.src = bust;
  const forceMute = () => {
    try {
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
    } catch (_) {}
  };
  forceMute();
  video.addEventListener("volumechange", forceMute);
  video.addEventListener("play", forceMute);
  const play = () => {
    forceMute();
    return video.play().catch(() => {});
  };
  const replay = () => {
    try {
      video.currentTime = 0;
    } catch (_) {}
    play();
  };
  video.onended = replay;
  video.addEventListener("loadeddata", play, { once: true });
  video.addEventListener("canplay", play, { once: true });
  // Mobile Safari: unlock muted loop on first tap if autoplay was blocked
  if (!video.__bioUnlockBound) {
    video.__bioUnlockBound = true;
    const unlock = () => {
      // Only on Bio — taps inside other tabs (e.g. Arcane) must not wake the hidden bg video
      if (document.body?.dataset?.scene !== "bio") return;
      forceMute();
      play();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
  }
  video.addEventListener(
    "error",
    () => {
      console.warn("Bio video failed, using image fallback");
      setImageBg(BIO.image || poster);
    },
    { once: true }
  );
  play();
}

const BIO_BG_VIDEO = "media/bio-bg-caduceus-wide.mp4";
const BIO_BG_STILL = "media/bio-bg-caduceus-wide.jpg";
const LEGACY_BIO_BG = /(?:^|\/)(?:bio-bg(?:-grok|-caduceus(?:-red)?)?|bio-bg-caduceus-portrait|mjolnir_loop_720|mjolnir_bg_poster)\.(?:mp4|jpe?g)$/i;

function isLegacyBioBg(url) {
  const path = String(url || "").split("?")[0];
  return !path || LEGACY_BIO_BG.test(path);
}

function applyMedia() {
  const mode = (BIO.mode || "auto").toLowerCase();
  let poster = BIO.poster || "";
  let image = BIO.image || "";
  let videoUrl = BIO.video || "";
  if (isLegacyBioBg(videoUrl)) videoUrl = BIO_BG_VIDEO;
  if (poster && isLegacyBioBg(poster)) poster = BIO_BG_STILL;
  if (image && isLegacyBioBg(image)) image = BIO_BG_STILL;
  if (mode === "image") {
    setImageBg(image || poster);
    return;
  }
  if (mode === "video") {
    setVideoBg(videoUrl, poster || image);
    return;
  }
  if (videoUrl) setVideoBg(videoUrl, poster || image);
  else setImageBg(image || poster);
}

function renderQuote() {
  // Bio first section: fixed personal history from CMS / bio-config (not the rotating bank)
  const quoteEl = $("bio-quote-text");
  const byEl = $("bio-quote-by");
  const text = String(BIO.quote || "").trim();
  const by = String(BIO.quoteBy || "Telephantix").trim();
  if (quoteEl) {
    quoteEl.textContent = text;
    quoteEl.classList.add("bio-quote-story");
  }
  if (byEl) byEl.textContent = by ? `— ${by}` : "";
}

function renderProfile() {
  const av = $("bio-avatar");
  const name = $("bio-name");
  const handle = $("bio-handle");
  if (av && PROFILE.avatar) {
    av.src = PROFILE.avatar;
    av.alt = PROFILE.name || "Profile";
  }
  if (name) name.textContent = PROFILE.name || "Telephantix";
  if (handle) handle.textContent = PROFILE.handle || "";
  renderQuote();
}

/** Top-of-bio social chips (always visible — not buried under Support). */
function renderSocials() {
  const row = $("bio-socials");
  if (!row) return;
  const list = Array.isArray(SOCIALS) && SOCIALS.length
    ? SOCIALS.filter((s) => s && s.url)
    : [];
  if (!list.length) return; // keep static HTML fallback
  row.innerHTML = "";
  list.forEach((s) => {
    const a = document.createElement("a");
    const ico = s.icon || "in";
    a.className = `bio-social-chip ico-${escapeHtml(ico)}`;
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = s.title + (s.subtitle ? ` · ${s.subtitle}` : "");
    a.textContent = ICONS[ico] || s.title.slice(0, 2);
    row.appendChild(a);
  });
}

function renderLinks() {
  const host = $("bio-links");
  if (host) {
    host.innerHTML = "";
    host.hidden = true;
  }
  // Social chips stay on Bio. Support lives in the collapsible Pay sheet.
  // Featured and Worlds stay off this page.
  renderSocials();
}

function pauseMedia() {
  const video = $("bio-video");
  if (video && !video.hidden) video.pause();
}

function latestVideos() {
  return [...document.querySelectorAll(".bio-latest-video")];
}

function anyLatestPlaying() {
  return latestVideos().some((v) => v && !v.paused);
}

function pauseLatestVideos(except) {
  latestVideos().forEach((v) => {
    if (v && v !== except && !v.paused) v.pause();
  });
}

function resumeMedia() {
  const video = $("bio-video");
  if (anyLatestPlaying()) return;
  if (video && !video.hidden) video.play().catch(() => {});
}

let activeMovie = null;
let movieUserPause = false;
let restoringMovie = false;

function handoffEl() {
  let audio = document.getElementById("movie-lock-audio");
  if (!audio) {
    audio = document.createElement("audio");
    audio.id = "movie-lock-audio";
    audio.preload = "none";
    audio.playsInline = true;
    audio.setAttribute("playsinline", "");
    audio.hidden = true;
    document.body.appendChild(audio);
  }
  return audio;
}

function movieSrc(video) {
  return video?.currentSrc || video?.querySelector("source")?.src || "";
}

function handoffIsPlaying() {
  const audio = document.getElementById("movie-lock-audio");
  return !!(audio && !audio.paused && !audio.ended);
}

function releaseMovieSession() {
  releasePlayback("movie");
  try {
    if (window.TelephantimMusic?.wantBackgroundPlay?.()) {
      claimPlayback("music");
      syncPlaybackSession(true);
      return;
    }
  } catch (_) {}
  syncPlaybackSession(playbackOwner() === "music");
}

function movieIsActive() {
  if (movieUserPause || !activeMovie || activeMovie.ended) return false;
  return true;
}

let continuingMovie = false;

function continueMovie(video) {
  if (continuingMovie) return Promise.resolve(false);
  if (!video || movieUserPause || video.ended || video.muted) return Promise.resolve(false);
  continuingMovie = true;
  activeMovie = video;
  if (!video.paused) {
    continuingMovie = false;
    return Promise.resolve(true);
  }
  const resumeSame = video.play();
  const afterVideo = resumeSame && resumeSame.then ? resumeSame.catch(() => {}) : Promise.resolve();
  return Promise.resolve(afterVideo).then(() => {
    if (!video.paused || movieUserPause) return true;
    const src = movieSrc(video);
    if (!shouldHandoffMovie({
      pageHidden: true,
      paused: true,
      ended: false,
      muted: false,
      userPause: false,
      started: true,
    })) return false;
    if (!src) return false;
    const audio = handoffEl();
    const time = Number(video.currentTime) || 0;
    let abs = src;
    try { abs = new URL(src, document.baseURI).href; } catch (_) {}
    const begin = () => {
      try { audio.currentTime = time; } catch (_) {}
      audio.volume = 1;
      const played = audio.play();
      return played && played.then ? played.then(() => true).catch(() => false) : !audio.paused;
    };
    if (audio.src !== abs) audio.src = abs;
    if (audio.readyState >= 1 && audio.src === abs) return begin();
    return new Promise((resolve) => {
      const done = () => {
        audio.removeEventListener("loadedmetadata", done);
        audio.removeEventListener("error", done);
        Promise.resolve(begin()).then(resolve);
      };
      audio.addEventListener("loadedmetadata", done);
      audio.addEventListener("error", done);
    });
  }).finally(() => {
    continuingMovie = false;
  });
}

function restoreMovie(video) {
  const audio = document.getElementById("movie-lock-audio");
  if (!video || !audio || audio.paused) return;
  const time = movieResumeTime(audio.currentTime, video.currentTime);
  try { audio.pause(); } catch (_) {}
  restoringMovie = true;
  try { video.currentTime = time; } catch (_) {}
  const played = video.play();
  const clear = () => { restoringMovie = false; };
  if (played && played.finally) played.finally(clear);
  else clear();
}

function publishMovieLock() {
  window.__teleMovieLock = {
    active: () => movieIsActive(),
    title() {
      return activeMovie?.getAttribute("title") || activeMovie?.getAttribute("aria-label") || "Telephantix";
    },
    artist() { return "Telephantix"; },
    artwork() {
      const poster = activeMovie?.getAttribute("poster");
      if (!poster) return [];
      return [{ src: poster }];
    },
    mediaEl() {
      const audio = document.getElementById("movie-lock-audio");
      if (audio && !audio.paused && !audio.ended) return audio;
      return activeMovie;
    },
    play() {
      movieUserPause = false;
      claimPlayback("movie");
      syncPlaybackSession(true);
      if (document.hidden) continueMovie(activeMovie);
      else if (activeMovie) {
        const audio = document.getElementById("movie-lock-audio");
        if (audio && !audio.paused) restoreMovie(activeMovie);
        else activeMovie.play().catch(() => {});
      }
      window.__teleRefreshMediaSession?.();
    },
    pause() {
      movieUserPause = true;
      releaseMovieSession();
      try { activeMovie?.pause(); } catch (_) {}
      try { document.getElementById("movie-lock-audio")?.pause(); } catch (_) {}
      window.__teleRefreshMediaSession?.();
    },
    seekBy(sec) {
      const el = this.mediaEl();
      if (!el) return;
      const dur = Number(el.duration) || 0;
      el.currentTime = Math.min(dur || 1e9, Math.max(0, (Number(el.currentTime) || 0) + sec));
      window.__teleRefreshMediaSession?.();
    },
    seekTo(t) {
      const el = this.mediaEl();
      if (!el || typeof t !== "number") return;
      el.currentTime = Math.max(0, t);
      window.__teleRefreshMediaSession?.();
    },
  };
}

function bindAudibleVideo(latest, wrap) {
  if (!latest || latest.__wired) return;
  latest.__wired = true;
  const showThumb = () => wrap?.classList.remove("is-playing");
  const hideThumb = () => wrap?.classList.add("is-playing");
  const gate = createPauseGate({
    hidden: () => document.hidden || document.visibilityState === "hidden",
    onUser() {
      if (activeMovie !== latest) return;
      movieUserPause = true;
      releaseMovieSession();
      try { document.getElementById("movie-lock-audio")?.pause(); } catch (_) {}
      if (latest.ended || latest.currentTime < 0.2) showThumb();
      if (!latest.ended && shouldWakeMutedBackdrop({ pageHidden: false, movieUserPause: true })) {
        resumeMedia();
      }
      window.__teleRefreshMediaSession?.();
    },
    onOs() {
      if (latest.ended || latest.muted) return;
      if (activeMovie && activeMovie !== latest && movieIsActive()) return;
      movieUserPause = false;
      activeMovie = latest;
      claimPlayback("movie");
      syncPlaybackSession(true);
      continueMovie(latest);
      window.__teleRefreshMediaSession?.();
    },
  });
  latest.__lockGate = gate;
  const start = () => {
    hideThumb();
    pauseLatestVideos(latest);
    pauseMedia();
    movieUserPause = false;
    activeMovie = latest;
    claimPlayback("movie");
    syncPlaybackSession(true);
    latest.play().catch(() => showThumb());
  };
  wrap?.querySelector(".bio-latest-play")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    start();
  });
  latest.addEventListener("play", () => {
    if (restoringMovie) return;
    hideThumb();
    pauseLatestVideos(latest);
    pauseMedia();
    movieUserPause = false;
    activeMovie = latest;
    gate.cancel();
    claimPlayback("movie");
    syncPlaybackSession(true);
    if (document.hidden) {
      try { document.getElementById("movie-lock-audio")?.pause(); } catch (_) {}
    }
    const id = wrap?.getAttribute("data-video-id");
    if (id && window.TelephantimVisitorCounter && window.TelephantimVisitorCounter.recordVideo) {
      window.TelephantimVisitorCounter.recordVideo(id);
    }
    window.__teleRefreshMediaSession?.();
  });
  latest.addEventListener("pause", () => {
    if (restoringMovie) return;
    if (movieUserPause && activeMovie === latest) {
      gate.cancel();
      return;
    }
    gate.notePause();
  });
  latest.addEventListener("ended", () => {
    gate.cancel();
    if (activeMovie === latest) {
      movieUserPause = false;
      releaseMovieSession();
      try { document.getElementById("movie-lock-audio")?.pause(); } catch (_) {}
    }
    showThumb();
    try { latest.currentTime = 0; } catch (_) {}
    resumeMedia();
    window.__teleRefreshMediaSession?.();
  });
}

function wireLatestVideo() {
  document.querySelectorAll("[data-video-embed]").forEach((wrap) => {
    bindAudibleVideo(wrap.querySelector(".bio-latest-video"), wrap);
  });
  const newest = document.querySelector("#newest-video video");
  if (newest) bindAudibleVideo(newest, null);
  if (wireLatestVideo.done) return;
  wireLatestVideo.done = true;
  publishMovieLock();
  const pageLeft = () => {
    document.querySelectorAll("#bio-page video, #newest-video video").forEach((video) => {
      video.__lockGate?.notePageLeft();
    });
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || document.visibilityState === "hidden") {
      pageLeft();
      return;
    }
    if (activeMovie && !movieUserPause) {
      if (handoffIsPlaying()) restoreMovie(activeMovie);
      else if (activeMovie.paused && !activeMovie.ended) activeMovie.play().catch(() => {});
    }
    window.__teleRefreshMediaSession?.();
  });
  window.addEventListener("pagehide", pageLeft);
  window.addEventListener("freeze", pageLeft);
}

function onScene(e) {
  const scene = e.detail?.scene;
  if (scene === "bio") {
    applyMedia();
    resumeMedia();
  } else {
    pauseMedia();
    pauseLatestVideos();
  }
}

async function wire() {
  // Paint socials immediately from defaults (HTML fallback already visible)
  try {
    renderSocials();
  } catch (_) {}
  try {
    await hydrateSiteContent();
  } catch (err) {
    console.warn("Bio CMS hydrate failed; using defaults", err);
  }
  renderProfile();
  renderSocials();
  renderLinks();
  applyMedia();
  wireLatestVideo();
  window.addEventListener("telephantim-scene", onScene);
  // Landing on Arcane / Relics: keep the hidden Bio bg video paused
  if (document.body?.dataset?.scene !== "bio") {
    pauseMedia();
    const v = $("bio-video");
    v?.addEventListener("play", () => { if (document.body.dataset.scene !== "bio") v.pause(); });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    wire();
  });
} else {
  wire();
}

window.TelephantimBio = { applyMedia, BIO, refresh: wire };
