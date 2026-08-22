/**
 * Compact world switcher — Relics / Bio / Luna 2D / Luna 3D.
 * Switches in-place (no full page navigation). Iframes stay warm when hidden.
 */

/**
 * Camp URLs:
 * - Local hub (8765) → Luna free town on 8767 (separate process)
 * - Local unified (already on 8767 with firmament) → same origin
 * - Live telephantim.com → telephanti.com
 */
function lunaCampBase() {
  try {
    const h = (location.hostname || "").toLowerCase();
    const port = String(location.port || "");
    const path = String(location.pathname || "");
    // Explicit override for dev: ?luna=http://127.0.0.1:8767
    try {
      const q = new URLSearchParams(location.search || "");
      const o = (q.get("luna") || "").trim().replace(/\/$/, "");
      if (o && /^https?:\/\//i.test(o)) return o;
    } catch (_) {}
    if (h === "localhost" || h === "127.0.0.1") {
      // Hub AI server is 8765 and has no /firmament — point at Luna
      if (port === "8765" || port === "8766" || port === "") {
        // Empty port only if not actually serving camp (rare); prefer 8767 for hub
        if (port === "8765" || port === "8766") return "http://127.0.0.1:8767";
      }
      // Already on Luna port → same origin (START_TOWN_LOCAL)
      if (port === "8767" || path.includes("firmament")) {
        return location.origin;
      }
      // Default local split: hub → Luna
      return "http://127.0.0.1:8767";
    }
    // Live hub / Pages / Render static → always cloud Luna (your PC off is fine)
    if (
      h.includes("telephantim") ||
      h.includes("github.io") ||
      h.includes("onrender") ||
      h.includes("telephanti")
    ) {
      return "https://telephanti.com";
    }
  } catch (_) {}
  return "https://telephanti.com";
}

/** Resolve camp base every time (not once at import — port/override can change). */
function campUrls() {
  const base = lunaCampBase().replace(/\/$/, "");
  return {
    base,
    play: `${base}/firmament/play?hub=1`,
    three: `${base}/firmament/3d?hub=1`,
  };
}

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
    hint: "Your video or photo background",
    url: null,
    mode: "bio",
  },
  studio: {
    id: "studio",
    label: "Music Studio",
    short: "Studio",
    hint: "Full synth · looper · free AI jam",
    url: null,
    mode: "studio",
  },
  "luna-2d": {
    id: "luna-2d",
    label: "Luna Camp 2D",
    short: "2D",
    hint: "Luna Camp 2D",
    // url filled live via campUrls()
    urlKey: "play",
    mode: "external",
  },
  "luna-3d": {
    id: "luna-3d",
    label: "Luna Camp 3D",
    short: "3D",
    hint: "Luna Camp 3D",
    urlKey: "three",
    mode: "external",
  },
};

function sceneUrl(scene) {
  if (!scene) return null;
  if (scene.url) return scene.url;
  if (scene.urlKey) {
    const u = campUrls();
    return scene.urlKey === "three" ? u.three : u.play;
  }
  return null;
}

const STORAGE_KEY = "telephantim-scene";

/** Public landing on telephantim.com — Bio so visitors see Relics / 2D / 3D tabs. */
const DEFAULT_SCENE = "bio";

let current = DEFAULT_SCENE;

function $(id) {
  return document.getElementById(id);
}

function normalizeScene(id) {
  if (id && SCENES[id]) return id;
  return DEFAULT_SCENE;
}

function readHash() {
  const h = (location.hash || "").replace(/^#/, "").toLowerCase();
  // Bare URL = Bio (landing) — notice 2D / 3D tabs immediately
  if (!h) return DEFAULT_SCENE;
  if (h === "luna" || h === "camp" || h === "luna2d" || h === "2d") return "luna-2d";
  if (h === "luna3d" || h === "3d") return "luna-3d";
  if (h === "relics" || h === "hub" || h === "home" || h === "telephantim") return "telephantim";
  if (h === "bio" || h === "beacons" || h === "links" || h === "quote") return "bio";
  if (h === "studio" || h === "music" || h === "lab" || h === "jam") return "studio";
  // Ignore unknown hashes (e.g. #socials) — land on Bio
  if (h && !SCENES[h]) return DEFAULT_SCENE;
  return normalizeScene(h);
}

function writeHash(id) {
  const path = location.pathname + location.search;
  // Bio is the public landing — bare URL means Bio (no # needed)
  const next =
    id === "bio"
      ? path
      : `${path}#${id === "telephantim" ? "relics" : id === "studio" ? "studio" : id}`;
  const cur = location.pathname + location.search + (location.hash || "");
  if (
    cur === next ||
    (id === "bio" && !location.hash && location.pathname + location.search === path)
  ) {
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

function sceneUrlKeyRewrite(sceneId) {
  const base = "http://127.0.0.1:8767";
  if (sceneId === "luna-3d") return `${base}/firmament/3d?hub=1`;
  return `${base}/firmament/play?hub=1`;
}

function setScene(id, { persist = true, fromHash = false } = {}) {
  const sceneId = normalizeScene(id);
  const scene = SCENES[sceneId];
  const prev = current;
  current = sceneId;

  let want = sceneUrl(scene);
  // Hub (8765) never has /firmament — always use Luna 8767 locally
  if (want && /:8765\/|:8766\//.test(want)) {
    want = sceneUrlKeyRewrite(sceneId);
  }

  const isExternal = !!want;
  const isBio = scene.mode === "bio";
  const isStudio = scene.mode === "studio" || sceneId === "studio";
  const isRelics = sceneId === "telephantim";

  document.body.dataset.scene = sceneId;
  document.body.classList.toggle("scene-external", isExternal);
  document.body.classList.toggle("scene-bio", isBio);
  document.body.classList.toggle("scene-studio", isStudio);
  document.body.classList.toggle("scene-luna-2d", sceneId === "luna-2d");
  document.body.classList.toggle("scene-luna-3d", sceneId === "luna-3d");
  document.body.classList.toggle("scene-native", isRelics);

  if (isExternal || isBio || isStudio) {
    document.body.classList.remove("sheet-open");
  }
  if (sceneId === "luna-2d") {
    document.body.classList.remove("sheet-open");
  }

  const frame = $("scene-frame");
  const fallback = $("scene-fallback");
  const bioPage = $("bio-page");
  const studioStage = $("stage-studio");
  const fallbackOpen = $("scene-fallback-open");

  if (bioPage) bioPage.hidden = !isBio;
  if (studioStage) {
    studioStage.hidden = !isStudio;
    if (isStudio) {
      try {
        window.TelephantixStudio?.onSceneChange?.();
      } catch (_) {}
    }
  }

  if (want && frame) {
    const prevSrc = frame.getAttribute("data-src") || frame.src || "";
    const deadHub = /:8765\/|:8766\//.test(prevSrc);
    if (frame.getAttribute("data-src") !== want || deadHub || !frame.src) {
      frame.setAttribute("data-src", want);
      frame.src = want;
      try {
        console.info("[telephantim] load camp", want);
      } catch (_) {}
    }
    frame.hidden = false;
    frame.removeAttribute("hidden");
    frame.title = scene.label;
    if (fallbackOpen) {
      fallbackOpen.href = want.replace(/\?hub=1/, "").replace(/&hub=1/, "") || want;
      fallbackOpen.textContent =
        sceneId === "luna-3d" ? "Open 3D full page (8767)" : "Open 2D full page (8767)";
      fallbackOpen.target = "_blank";
      fallbackOpen.rel = "noopener";
    }
    // Soft link so user can escape a black frame if Luna is down
    if (fallback) {
      fallback.hidden = false;
      fallback.classList.add("is-soft");
    }
  } else if (frame) {
    frame.hidden = true;
    if (fallback) {
      fallback.hidden = true;
      fallback.classList.remove("is-soft");
    }
  }

  updateChrome(scene);

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, sceneId);
    } catch (_) {}
  }
  if (!fromHash) writeHash(sceneId);

  if (prev !== sceneId) {
    window.dispatchEvent(
      new CustomEvent("telephantim-scene", {
        detail: { scene: sceneId, active: isRelics, prev },
      })
    );
  }

  if (isRelics) {
    // Always tell relics engine it's the active scene (even on first paint)
    window.dispatchEvent(
      new CustomEvent("telephantim-scene", {
        detail: { scene: "telephantim", active: true, prev, force: true },
      })
    );
    window.dispatchEvent(new Event("resize"));
    // Double-kick after CSS unhides the stage (visibility was hidden on Bio)
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
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

  // Bare telephantim.com → always Bio (do not restore last tab; visitors must see 2D/3D).
  // Deep links (#relics, #luna-2d, #luna-3d, #bio) still win.
  let start = readHash();
  if (!location.hash) {
    start = DEFAULT_SCENE;
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
