/**
 * Compact world switcher — Relics / Bio / Luna 2D / Luna 3D.
 * Bio = Beacons-style page (your video/image bg + scroll quote & links).
 */

const SCENES = {
  telephantim: {
    id: "telephantim",
    label: "Telephantim",
    short: "Relics",
    hint: "Mjolnir + Caduceus · grab either",
    url: null,
    mode: "relics",
  },
  bio: {
    id: "bio",
    label: "Bio",
    short: "Bio",
    hint: "Beacons-style · your video or photo background",
    url: null,
    mode: "bio",
  },
  "luna-2d": {
    id: "luna-2d",
    label: "Luna Camp 2D",
    short: "2D",
    hint: "Luna Camp 2D",
    url: "https://telephanti.com/firmament/play",
    mode: "external",
  },
  "luna-3d": {
    id: "luna-3d",
    label: "Luna Camp 3D",
    short: "3D",
    hint: "Luna Camp 3D",
    url: "https://telephanti.com/firmament/3d",
    mode: "external",
  },
};

const STORAGE_KEY = "telephantim-scene";

let current = "telephantim";

function $(id) {
  return document.getElementById(id);
}

function normalizeScene(id) {
  if (id && SCENES[id]) return id;
  return "telephantim";
}

function readHash() {
  const h = (location.hash || "").replace(/^#/, "").toLowerCase();
  if (h === "luna" || h === "camp" || h === "luna2d" || h === "2d") return "luna-2d";
  if (h === "luna3d" || h === "3d") return "luna-3d";
  if (h === "relics" || h === "hub" || h === "home") return "telephantim";
  if (h === "bio" || h === "beacons" || h === "links" || h === "quote") return "bio";
  return normalizeScene(h);
}

function writeHash(id) {
  const next = id === "telephantim" ? "" : `#${id}`;
  if ((location.hash || "") === next) return;
  history.replaceState(null, "", next || location.pathname + location.search);
}

function updateChrome(scene) {
  const hint = $("grab-hint");
  if (hint) hint.textContent = scene.hint;

  document.querySelectorAll("[data-scene]").forEach((el) => {
    const on = el.getAttribute("data-scene") === scene.id;
    el.classList.toggle("active", on);
    if (el.hasAttribute("aria-current") || el.classList.contains("world-tab")) {
      el.setAttribute("aria-current", on ? "true" : "false");
    }
  });
}

function setScene(id, { persist = true, fromHash = false } = {}) {
  const sceneId = normalizeScene(id);
  const scene = SCENES[sceneId];
  current = sceneId;

  const isExternal = !!scene.url;
  const isBio = scene.mode === "bio";
  const isRelics = sceneId === "telephantim";

  document.body.dataset.scene = sceneId;
  document.body.classList.toggle("scene-external", isExternal);
  document.body.classList.toggle("scene-bio", isBio);
  document.body.classList.toggle("scene-native", isRelics);
  // Never leave the hub pay-sheet open over Luna/Bio — covers content
  if (isExternal || isBio) {
    document.body.classList.remove("sheet-open");
  }

  const frame = $("scene-frame");
  const fallback = $("scene-fallback");
  const bioPage = $("bio-page");

  if (bioPage) bioPage.hidden = !isBio;

  if (scene.url && frame) {
    if (frame.getAttribute("data-src") !== scene.url) {
      frame.setAttribute("data-src", scene.url);
      frame.src = scene.url;
    }
    frame.hidden = false;
    frame.title = scene.label;
    if (fallback) {
      fallback.hidden = false;
      const open = $("scene-fallback-open");
      if (open) {
        open.href = scene.url;
        open.textContent = `Open ${scene.label} full page`;
      }
    }
  } else if (frame) {
    frame.hidden = true;
    if (frame.getAttribute("data-src")) {
      frame.removeAttribute("data-src");
      frame.removeAttribute("src");
    }
    if (fallback) fallback.hidden = true;
  }

  updateChrome(scene);

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, sceneId);
    } catch (_) {}
  }
  if (!fromHash) writeHash(sceneId);

  // Only run WebGL on Relics
  window.dispatchEvent(
    new CustomEvent("telephantim-scene", {
      detail: { scene: sceneId, active: isRelics },
    })
  );

  if (isRelics) {
    window.dispatchEvent(new Event("resize"));
  }
}

function onWorldClick(e) {
  const btn = e.target.closest?.("[data-scene]");
  if (!btn) return;
  // Only handle our world controls (tabs / sheet / menu), not random links
  if (
    !btn.classList.contains("world-tab") &&
    !btn.classList.contains("world-opt") &&
    !btn.classList.contains("link-btn") &&
    btn.tagName !== "BUTTON"
  ) {
    return;
  }
  e.preventDefault();
  setScene(btn.getAttribute("data-scene"));
  document.body.classList.remove("sheet-open");
}

function wire() {
  const bar = $("world-switch");
  bar?.addEventListener("click", onWorldClick);

  // Sheet world buttons
  $("sheet-body")?.addEventListener("click", onWorldClick);

  // Luna camp (iframe) → same tabs via postMessage
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.source !== "telephantim-world-nav") return;
    if (d.type === "set-scene" && d.scene) {
      setScene(d.scene);
    }
  });

  window.addEventListener("hashchange", () => {
    setScene(readHash(), { fromHash: true });
  });

  let start = readHash();
  if (!location.hash) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SCENES[saved]) start = saved;
    } catch (_) {}
  }
  setScene(start, { persist: true, fromHash: !!location.hash });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wire);
} else {
  wire();
}

window.TelephantimScenes = {
  setScene,
  SCENES,
  get current() {
    return current;
  },
};
