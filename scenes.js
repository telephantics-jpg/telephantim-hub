/**
 * Compact world switcher — Arcane / Bio / Luna 2D / Luna 3D / 4D / Relics.
 * (Loft has no tab but ?world=loft still opens it.)
 * Switches in-place (no full page navigation). Iframes stay warm when hidden.
 * Arcane Runes has its own iframe (#arcane-frame) that is never re-pointed, so the
 * match survives tab switches: hidden = paused + muted, shown = resumed.
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
    // Explicit override: ?luna=http://127.0.0.1:8767 when local Camp is running
    try {
      const q = new URLSearchParams(location.search || "");
      const o = (q.get("luna") || "").trim().replace(/\/$/, "");
      if (o && /^https?:\/\//i.test(o)) return o;
    } catch (_) {}
    if (h === "localhost" || h === "127.0.0.1") {
      // Already on Luna → same origin
      if (port === "8767" || path.includes("firmament")) {
        return location.origin;
      }
      // Local hub (8765): Camp on 8767 when Luna is running.
      // Fallback: ?luna=https://telephanti.com for live Camp.
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
    sense: `${base}/sense`,
  };
}

const SCENES = {
  arcane: {
    id: "arcane",
    label: "Arcane Runes",
    short: "Arcane",
    hint: "3v3 battle-mage arena · plays on PC + phone",
    url: null,
    mode: "arcane",
  },
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
  sense: {
    id: "sense",
    label: "4D — The Sense",
    short: "4D",
    hint: "Interactable 4D field",
    urlKey: "sense",
    mode: "external",
  },
  loft: {
    id: "loft",
    label: "Voltage Loft",
    short: "Loft",
    hint: "Daylight rabbit hole · soft keys · AGENT ALpha",
    url: "/voltage-loft/",
    cacheBust: true,
    mode: "external",
  },
};

function sceneUrl(scene) {
  if (!scene) return null;
  let url = null;
  if (scene.url) url = scene.url;
  else if (scene.urlKey) {
    const u = campUrls();
    if (scene.urlKey === "three") url = u.three;
    else if (scene.urlKey === "sense") url = u.sense;
    else url = u.play;
  }
  if (url && scene.cacheBust) {
    url += (url.indexOf("?") >= 0 ? "&" : "?") + "v=v162-rabbit";
  }
  return url;
}

const STORAGE_KEY = "telephantim-scene";

/** Public landing on telephantim.com — Arcane Runes (Bio / 2D / 3D / Relics / Loft stay one tap away). */
const DEFAULT_SCENE = "arcane";

// null so the very first setScene() always fires "telephantim-scene" (bio/relics pause correctly)
let current = null;

function $(id) {
  return document.getElementById(id);
}

function normalizeScene(id) {
  if (id && SCENES[id]) return id;
  return DEFAULT_SCENE;
}

function worldSlug(id) {
  if (id === "luna-2d") return "2d";
  if (id === "luna-3d") return "3d";
  if (id === "telephantim") return "relics";
  if (id === "sense") return "4d";
  if (id === "loft") return "loft";
  if (id === "studio") return "studio";
  if (id === "arcane") return "arcane";
  return "bio";
}

function mapWorldToken(raw) {
  const t = String(raw || "").replace(/^#/, "").toLowerCase().trim();
  if (!t) return "";
  if (t === "arcane" || t === "runes" || t === "arcane-runes" || t === "game" || t === "moba") return "arcane";
  if (t === "luna" || t === "camp" || t === "luna2d" || t === "luna-2d" || t === "2d" || t === "play") {
    return "luna-2d";
  }
  if (t === "luna3d" || t === "luna-3d" || t === "3d") return "luna-3d";
  if (t === "home") return DEFAULT_SCENE;
  if (t === "relics" || t === "hub" || t === "telephantim") return "telephantim";
  if (t === "bio" || t === "beacons" || t === "links" || t === "quote") return "bio";
  if (t === "sense" || t === "sixth" || t === "field" || t === "matrix" || t === "4d" || t === "4-d") return "sense";
  if (t === "loft" || t === "voltage" || t === "voltage-loft" || t === "alpha") return "loft";
  if (t === "aether" || t === "cottage" || t === "house") return DEFAULT_SCENE;
  if (t === "prophecy" || t === "oracle" || t === "omen") return "sense";
  if (t === "studio" || t === "music" || t === "lab" || t === "jam") return DEFAULT_SCENE;
  if (SCENES[t]) return t;
  return "";
}

function readQueryWorld() {
  try {
    const q = new URLSearchParams(location.search || "");
    return mapWorldToken(q.get("world") || q.get("w") || q.get("scene") || "");
  } catch (_) {
    return "";
  }
}

function readPathWorld() {
  try {
    const last = (location.pathname || "/")
      .replace(/\/+$/, "")
      .split("/")
      .pop()
      .toLowerCase();
    if (last === "2d" || last === "2d.html") return "luna-2d";
    if (last === "3d" || last === "3d.html") return "luna-3d";
    if (last === "sense" || last === "sense.html" || last === "prophecy" || last === "prophecy.html") return "sense";
    if (last === "loft" || last === "loft.html" || last === "voltage-loft") return "loft";
    if (last === "relics" || last === "relics.html") return "telephantim";
    if (last === "studio" || last === "studio.html") return "studio";
  } catch (_) {}
  return "";
}

function readHash() {
  const h = (location.hash || "").replace(/^#/, "").toLowerCase();
  if (!h) return "";
  return mapWorldToken(h);
}

/** Shared links use ?world=2d (hashes get stripped by iMessage / Discord / X). */
function readStartScene() {
  const fromQuery = readQueryWorld();
  if (fromQuery) return fromQuery;
  const fromPath = readPathWorld();
  if (fromPath) return fromPath;
  const fromHash = readHash();
  if (fromHash) return fromHash;
  return DEFAULT_SCENE;
}

function writeUrl(id) {
  try {
    const u = new URL(location.href);
    if (id === DEFAULT_SCENE) {
      u.searchParams.delete("world");
      u.searchParams.delete("w");
      u.searchParams.delete("scene");
    } else {
      u.searchParams.set("world", worldSlug(id));
    }
    u.hash = "";
    const next = u.pathname + u.search;
    const cur = location.pathname + location.search;
    if (cur === next && !location.hash) return;
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
  if (sceneId === "loft") return "/voltage-loft/";
  const base = lunaCampBase().replace(/\/$/, "");
  if (sceneId === "luna-3d") return `${base}/firmament/3d?hub=1`;
  if (sceneId === "sense") return `${base}/sense`;
  return `${base}/firmament/play?hub=1`;
}

/* ---------- Arcane Runes: persistent game iframe ---------- */
let arcaneLoaded = false;
let arcaneVisible = false;

function arcaneFrame() {
  return $("arcane-frame");
}

function arcaneSignal(action) {
  const f = arcaneFrame();
  try {
    f?.contentWindow?.postMessage({ source: "telephantim-hub", type: "arcane-" + action }, "*");
  } catch (_) {}
}

function setArcaneActive(on) {
  const f = arcaneFrame();
  const stage = $("stage-arcane");
  if (!f || !stage) return;
  if (on && !arcaneLoaded) {
    // Load once, on first visit to the tab. Never changed again → match persists.
    arcaneLoaded = true;
    f.src = f.getAttribute("data-src") || "arcane/index.html";
    f.addEventListener("load", () => arcaneSignal(arcaneVisible ? "resume" : "pause"));
  }
  stage.classList.toggle("is-active", !!on);
  stage.setAttribute("aria-hidden", on ? "false" : "true");
  if (on === arcaneVisible) return;
  arcaneVisible = !!on;
  if (!arcaneLoaded) return;
  arcaneSignal(on ? "resume" : "pause");
  if (on) {
    setTimeout(() => {
      try {
        f.contentWindow?.focus();
      } catch (_) {}
    }, 60);
  }
}

function wireArcaneChrome() {
  const fsBtn = $("arcane-fullscreen");
  const stage = $("stage-arcane");
  const canFs = !!(
    stage &&
    (stage.requestFullscreen || stage.webkitRequestFullscreen) &&
    (document.fullscreenEnabled || document.webkitFullscreenEnabled)
  );
  if (fsBtn && canFs) {
    fsBtn.hidden = false;
    fsBtn.addEventListener("click", () => {
      const f = arcaneFrame();
      const target = f || stage;
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          const req = target.requestFullscreen || target.webkitRequestFullscreen;
          const p = req.call(target);
          // Phones: lock landscape once fullscreen (ignored where unsupported)
          if (p && p.then) {
            p.then(() => screen.orientation?.lock?.("landscape").catch(() => {})).catch(() => {});
          }
        }
      } catch (_) {}
    });
  }
}

function setScene(id, { persist = true, fromHash = false, fromUrl = false } = {}) {
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
  const isArcane = sceneId === "arcane";

  document.body.dataset.scene = sceneId;
  document.body.classList.toggle("scene-external", isExternal);
  document.body.classList.toggle("scene-bio", isBio);
  document.body.classList.toggle("scene-studio", isStudio);
  document.body.classList.toggle("scene-luna-2d", sceneId === "luna-2d");
  document.body.classList.toggle("scene-luna-3d", sceneId === "luna-3d");
  document.body.classList.toggle("scene-native", isRelics);
  document.body.classList.toggle("scene-arcane", isArcane);

  setArcaneActive(isArcane);

  if (isExternal || isBio || isStudio || isArcane) {
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
        sceneId === "loft"
          ? "Open Voltage Loft full page"
          : sceneId === "luna-3d"
            ? "Open 3D full page (8767)"
            : sceneId === "sense"
              ? "Open 4D full page"
              : "Open 2D full page (8767)";
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
  if (!fromHash && !fromUrl) writeUrl(sceneId);

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
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
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
    const next = readStartScene();
    if (next !== current) setScene(next, { fromHash: true, fromUrl: true });
  });
  window.addEventListener("popstate", () => {
    const next = readStartScene();
    if (next !== current) setScene(next, { fromUrl: true });
  });

  // Block accidental middle-click / modified clicks on world tabs from opening new pages
  bar?.addEventListener("auxclick", (e) => {
    if (e.target.closest?.(".world-tab")) e.preventDefault();
  });

  wireArcaneChrome();

  // Bare telephantim.com → Arcane. Shared links use ?world=bio / ?world=2d (hash is fallback only).
  const start = readStartScene();
  setScene(start, {
    persist: true,
    fromHash: !!location.hash && !readQueryWorld(),
    fromUrl: !!(readQueryWorld() || readPathWorld()),
  });
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
