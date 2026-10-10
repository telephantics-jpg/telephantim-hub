/**
 * Bio page: fixed bg video/image + scrollable quote & links.
 */
import { BIO } from "./bio-config.js";
import { PROFILE, SOCIALS, ICONS } from "./links.js";
import { hydrateSiteContent } from "./load-site.js";
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
  const bust = String(url).includes("?") ? url : `${url}?v=v167-caduceus`;
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

const BIO_BG_VIDEO = "media/bio-bg-caduceus.mp4";
const BIO_BG_STILL = "media/bio-bg-caduceus.jpg";
const LEGACY_BIO_BG = /(?:^|\/)bio-bg(?:-grok|-caduceus-red)?\.(?:mp4|jpe?g)$/i;

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

function wireLatestVideo() {
  document.querySelectorAll("[data-video-embed]").forEach((wrap) => {
    const latest = wrap.querySelector(".bio-latest-video");
    const playBtn = wrap.querySelector(".bio-latest-play");
    if (!latest || latest.__wired) return;
    latest.__wired = true;
    const showThumb = () => wrap.classList.remove("is-playing");
    const hideThumb = () => wrap.classList.add("is-playing");
    const start = () => {
      hideThumb();
      pauseLatestVideos(latest);
      pauseMedia();
      latest.play().catch(() => showThumb());
    };
    playBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      start();
    });
    latest.addEventListener("play", () => {
      hideThumb();
      pauseLatestVideos(latest);
      pauseMedia();
      const id = wrap.getAttribute("data-video-id");
      if (id && window.TelephantimVisitorCounter && window.TelephantimVisitorCounter.recordVideo) {
        window.TelephantimVisitorCounter.recordVideo(id);
      }
    });
    latest.addEventListener("pause", () => {
      if (latest.ended || latest.currentTime < 0.2) showThumb();
      if (latest.ended) return;
      resumeMedia();
    });
    latest.addEventListener("ended", () => {
      showThumb();
      try {
        latest.currentTime = 0;
      } catch (_) {}
      resumeMedia();
    });
  });
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
