/**
 * World / scene switcher — full-screen Telephantim relics, Luna Camp 2D, Luna Camp 3D.
 * Luna camps load in-page (iframe) so telephantim.com stays the shell.
 */

const SCENES = {
  telephantim: {
    id: "telephantim",
    label: "Telephantim",
    short: "Relics",
    hint: "Mjolnir + Caduceus · grab either",
    url: null, // native stage
  },
  "luna-2d": {
    id: "luna-2d",
    label: "Luna Camp 2D",
    short: "Luna 2D",
    hint: "2D Luna Camp · telephanti.com/firmament/play",
    url: "https://telephanti.com/firmament/play",
  },
  "luna-3d": {
    id: "luna-3d",
    label: "Luna Camp 3D",
    short: "Luna 3D",
    hint: "3D Luna Camp · telephanti.com/firmament/3d",
    url: "https://telephanti.com/firmament/3d",
  },
};

const STORAGE_KEY = "telephantim-scene";

let current = "telephantim";
let menuOpen = false;

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
  return normalizeScene(h);
}

function writeHash(id) {
  const next = id === "telephantim" ? "" : `#${id}`;
  if ((location.hash || "") === next) return;
  history.replaceState(null, "", next || location.pathname + location.search);
}

function setMenuOpen(open) {
  menuOpen = !!open;
  const menu = $("world-menu");
  const btn = $("world-toggle");
  if (menu) menu.hidden = !menuOpen;
  if (btn) {
    btn.setAttribute("aria-expanded", menuOpen ? "true" : "false");
    btn.classList.toggle("open", menuOpen);
  }
}

function updateChrome(scene) {
  const label = $("world-toggle-label");
  if (label) label.textContent = scene.short || scene.label;

  const hint = $("grab-hint");
  if (hint) hint.textContent = scene.hint;

  document.querySelectorAll("[data-scene]").forEach((el) => {
    const on = el.getAttribute("data-scene") === scene.id;
    el.classList.toggle("active", on);
    el.setAttribute("aria-current", on ? "true" : "false");
  });
}

function setScene(id, { persist = true, fromHash = false } = {}) {
  const sceneId = normalizeScene(id);
  const scene = SCENES[sceneId];
  current = sceneId;

  document.body.dataset.scene = sceneId;
  document.body.classList.toggle("scene-external", !!scene.url);
  document.body.classList.toggle("scene-native", !scene.url);

  const frame = $("scene-frame");
  const fallback = $("scene-fallback");

  if (scene.url && frame) {
    // Only reload if URL changed (keeps camp state when reopening menu)
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
    // Unload heavy camp when back on relics (saves GPU/RAM)
    if (frame.getAttribute("data-src")) {
      frame.removeAttribute("data-src");
      frame.removeAttribute("src");
    }
    if (fallback) fallback.hidden = true;
  }

  updateChrome(scene);
  setMenuOpen(false);

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, sceneId);
    } catch (_) {}
  }
  if (!fromHash) writeHash(sceneId);

  // Tell 3D loop to pause/resume
  window.dispatchEvent(
    new CustomEvent("telephantim-scene", { detail: { scene: sceneId, active: !scene.url } })
  );

  // Nudge resize when returning to WebGL
  if (!scene.url) {
    window.dispatchEvent(new Event("resize"));
  }
}

function wire() {
  const toggle = $("world-toggle");
  const menu = $("world-menu");

  toggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  });

  menu?.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-scene]");
    if (!btn) return;
    e.preventDefault();
    setScene(btn.getAttribute("data-scene"));
  });

  document.addEventListener("click", (e) => {
    if (!menuOpen) return;
    if (e.target.closest?.("#world-switch")) return;
    setMenuOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenuOpen(false);
  });

  window.addEventListener("hashchange", () => {
    setScene(readHash(), { fromHash: true });
  });

  // Initial: hash > saved > telephantim
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

window.TelephantimScenes = { setScene, SCENES, get current() { return current; } };
