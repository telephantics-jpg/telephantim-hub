/**
 * Beacons-style Bio: fixed bg video/image + scrollable quote & links.
 */
import { BIO } from "./bio-config.js";
import { PROFILE, SUPPORT, FEATURED, ICONS } from "./links.js";

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
  video.muted = BIO.muted !== false;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("loop", "");
  if (poster) video.poster = poster;
  video.src = url;
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

function renderProfile() {
  const av = $("bio-avatar");
  const name = $("bio-name");
  const handle = $("bio-handle");
  const quote = $("bio-quote-text");
  const by = $("bio-quote-by");
  if (av && PROFILE.avatar) {
    av.src = PROFILE.avatar;
    av.alt = PROFILE.name || "Profile";
  }
  if (name) name.textContent = PROFILE.name || "Telephantix";
  if (handle) handle.textContent = PROFILE.handle || "";
  if (quote) quote.textContent = BIO.quote || "";
  if (by) by.textContent = BIO.quoteBy ? `— ${BIO.quoteBy}` : "";
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

function renderLinks() {
  const host = $("bio-links");
  if (!host) return;
  host.innerHTML = "";

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

  // World jumps (same screen)
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
    b.innerHTML = `<span class="bio-link-ico">${escapeHtml(w.ico)}</span><span class="bio-link-copy"><strong>${escapeHtml(
      w.title
    )}</strong><small>${escapeHtml(w.subtitle)}</small></span>`;
    b.addEventListener("click", () => {
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

function wire() {
  renderProfile();
  renderLinks();
  applyMedia();
  window.addEventListener("telephantim-scene", onScene);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wire);
} else {
  wire();
}

window.TelephantimBio = { applyMedia, BIO };
