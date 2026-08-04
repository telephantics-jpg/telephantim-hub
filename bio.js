/**
 * Beacons-style Bio: fixed bg video/image + scrollable quote & links.
 */
import { BIO } from "./bio-config.js";
import { PROFILE, SUPPORT, FEATURED, SOCIALS, ICONS } from "./links.js";
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
  if (poster) video.poster = poster;
  video.src = url;
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
  const play = () => video.play().catch(() => {});
  const replay = () => {
    try {
      video.currentTime = 0;
    } catch (_) {}
    play();
  };
  video.onended = replay;
  video.addEventListener("loadeddata", play, { once: true });
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

function applyMedia() {
  const mode = (BIO.mode || "auto").toLowerCase();
  const poster = BIO.poster || "";
  if (mode === "image") {
    setImageBg(BIO.image || poster);
    return;
  }
  if (mode === "video") {
    setVideoBg(BIO.video, poster || BIO.image);
    return;
  }
  // auto
  if (BIO.video) setVideoBg(BIO.video, poster || BIO.image);
  else setImageBg(BIO.image || poster);
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

function linkButton(item) {
  const a = document.createElement("a");
  a.className = "bio-link";
  a.href = item.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  const ico = ICONS[item.icon] || "→";
  a.innerHTML = `<span class="bio-link-ico">${escapeHtml(ico)}</span><span class="bio-link-copy"><strong>${escapeHtml(
    item.title
  )}</strong>${item.subtitle ? `<small>${escapeHtml(item.subtitle)}</small>` : ""}</span>`;
  return a;
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
  if (!host) return;
  host.innerHTML = "";

  // Socials live in #bio-socials (above Daily Word) — refresh them here too
  renderSocials();

  // Classic bio stack: Support · Featured · Worlds
  const blocks = [
    { title: "Support", items: SUPPORT },
    { title: "Featured", items: FEATURED },
  ];

  blocks.forEach((block) => {
    if (!block.items?.length) return;
    const h = document.createElement("p");
    h.className = "bio-links-label";
    h.textContent = block.title;
    host.appendChild(h);
    block.items.forEach((item) => {
      if (!item?.url) return;
      host.appendChild(linkButton(item));
    });
  });

  // World jumps — same hub, no page reload
  const worlds = document.createElement("p");
  worlds.className = "bio-links-label";
  worlds.textContent = "Worlds";
  host.appendChild(worlds);

  [
    { title: "Relics hub", subtitle: "Mjolnir + Caduceus", scene: "telephantim", ico: "T" },
    { title: "Luna Camp 2D", subtitle: "Show as main scene", scene: "luna-2d", ico: "2D" },
    { title: "Luna Camp 3D", subtitle: "Show as main scene", scene: "luna-3d", ico: "3D" },
  ].forEach((w) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "bio-link bio-link-btn";
    b.setAttribute("data-scene", w.scene);
    b.innerHTML = `<span class="bio-link-ico">${escapeHtml(w.ico)}</span><span class="bio-link-copy"><strong>${escapeHtml(
      w.title
    )}</strong><small>${escapeHtml(w.subtitle)}</small></span>`;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.TelephantimScenes?.setScene(w.scene);
    });
    host.appendChild(b);
  });
}

function pauseMedia() {
  const video = $("bio-video");
  if (video && !video.hidden) video.pause();
}

function resumeMedia() {
  const video = $("bio-video");
  if (video && !video.hidden) video.play().catch(() => {});
}

function onScene(e) {
  const scene = e.detail?.scene;
  if (scene === "bio") {
    applyMedia();
    resumeMedia();
  } else {
    pauseMedia();
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
  window.addEventListener("telephantim-scene", onScene);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    wire();
  });
} else {
  wire();
}

window.TelephantimBio = { applyMedia, BIO, refresh: wire };
