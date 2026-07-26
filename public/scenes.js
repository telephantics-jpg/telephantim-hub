/**
 * Compact world switcher — Relics / Bio / Luna 2D / Luna 3D.
 * Switches in-place (no full page navigation). Iframes stay warm when hidden.
 */

/**
 * Camp URLs — same origin when unified server (one process).
 * Fallback: live telephanti.com.
 */
function lunaCampBase() {
  try {
    const h = (location.hostname || "").toLowerCase();
    if (h === "localhost" || h === "127.0.0.1") {
      return location.origin;
    }
    if (h.includes("telephantim") || h.includes("github.io")) {
      return "https://telephanti.com";
    }
  } catch (_) {}
  return "https://telephanti.com";
}

const LUNA = lunaCampBase();

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
    url: `${LUNA}/firmament/play?hub=1`,
    mode: "external",
  },
  "luna-3d": {
    id: "luna-3d",
    label: "Luna Camp 3D",
    short: "3D",
    hint: "Luna Camp 3D",
    url: `${LUNA}/firmament/3d?hub=1`,
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
  // Ignore unknown hashes (e.g. #socials) — stay on current/relics
  if (h && !SCENES[h]) return "telephantim";
  return normalizeScene(h);
}

function writeHash(id) {
  const path = location.pathname + location.search;
  const next = id === "telephantim" ? path : `${path}#${id}`;
  const cur = location.pathname + location.search + (location.hash || "");
  if (cur === next || (id === "telephantim" && !location.hash && location.pathname + location.search === path)) {
    return;
  }
  // replaceState only — never assign location / never full navigation
  try {
    history.replaceState({ telephantimScene: id }, "", next);
  } catch (_) {}
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
  const prev = current;
  current = sceneId;

  const isExternal = !!scene.url;
  const isBio = scene.mode === "bio";
  const isRelics = sceneId === "telephantim";

  document.body.dataset.scene = sceneId;
  document.body.classList.toggle("scene-external", isExternal);
  document.body.classList.toggle("scene-bio", isBio);
  document.body.classList.toggle("scene-native", isRelics);

  if (isExternal || isBio) {
    document.body.classList.remove("sheet-open");
  }
  if (sceneId === "luna-2d") {
    document.body.classList.remove("sheet-open");
  }

  const frame = $("scene-frame");
  const fallback = $("scene-fallback");
  const bioPage = $("bio-page");

  if (bioPage) bioPage.hidden = !isBio;

  if (scene.url && frame) {
    // Load once per camp URL — keep warm when switching away (no reload flash)
    const want = scene.url;
    if (frame.getAttribute("data-src") !== want) {
      frame.setAttribute("data-src", want);
      frame.src = want;
    }
    frame.hidden = false;
    frame.title = scene.label;
    if (fallback) fallback.hidden = true;
  } else if (frame) {
    // Hide only — do NOT clear src (keeps 2D/3D ready for next visit)
    frame.hidden = true;
    if (fallback) fallback.hidden = true;
  }

  updateChrome(scene);

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, sceneId);
    } catch (_) {}
  }
  if (!fromHash) writeHash(sceneId);

  // Skip redundant events when re-selecting same scene
  if (prev !== sceneId) {
    window.dispatchEvent(
      new CustomEvent("telephantim-scene", {
        detail: { scene: sceneId, active: isRelics, prev },
      })
    );
  }

  if (isRelics) {
    window.dispatchEvent(new Event("resize"));
  }
}

function onWorldClick(e) {
  const btn = e.target.closest?.("[data-scene]");
  if (!btn) return;
  // Only hub world controls — never hijack random links
  if (
    !btn.classList.contains("world-tab") &&
    !btn.classList.contains("world-opt") &&
    !btn.classList.contains("link-btn") &&
    btn.tagName !== "BUTTON"
  ) {
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  const id = btn.getAttribute("data-scene");
  if (!id || !SCENES[id]) return;
  setScene(id);
  document.body.classList.remove("sheet-open");
}

function wire() {
  const bar = $("world-switch");
  // Capture phase so nothing else steals the tap
  bar?.addEventListener("click", onWorldClick, true);
  bar?.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target.closest?.(".world-tab")) {
        e.stopPropagation();
      }
    },
    true
  );

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
    const next = readHash();
    if (next !== current) setScene(next, { fromHash: true });
  });

  // Block accidental middle-click / modified clicks on world tabs from opening new pages
  bar?.addEventListener("auxclick", (e) => {
    if (e.target.closest?.(".world-tab")) e.preventDefault();
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
