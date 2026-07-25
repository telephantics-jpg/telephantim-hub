/**
 * Apply CMS "relics" settings to the Relics stage:
 * background video/image + rotating quote overlay (every 2 hours).
 */
import { hydrateSiteContent, fetchSiteContent } from "./load-site.js";
import { applyRotatingQuote, scheduleQuoteRefresh } from "./quote-rotate.js";

function $(id) {
  return document.getElementById(id);
}

let _relicsCms = null;
let _quoteTimerStarted = false;

function paintRelicsQuote() {
  const relics = _relicsCms || {};
  applyRotatingQuote(
    { textId: "relics-quote-text", byId: "relics-quote-by", boxId: "relics-quote" },
    {
      fallbackText: relics.quote,
      fallbackBy: relics.quoteBy,
      show: relics.showQuote !== false,
    },
  );
}

function applyRelics(relics) {
  if (!relics || typeof relics !== "object") return;
  _relicsCms = relics;

  const title = $("relics-title") || document.querySelector("#stage-telephantim .brand h1");
  const hint = $("grab-hint");
  if (title && relics.title) title.textContent = relics.title;
  if (hint && relics.hint != null) hint.textContent = relics.hint;

  // Background video
  const video = $("stage-bg-video");
  const src = (relics.backgroundVideo || "").trim();
  if (video && src && video.getAttribute("src") !== src && video.src !== new URL(src, location.href).href) {
    video.src = src;
    video.load();
    video.play?.().catch(() => {});
  }

  // Optional CSS image fallback behind video
  const stage = $("stage-telephantim");
  const img = (relics.backgroundImage || "").trim();
  if (stage && img) {
    stage.style.setProperty("--relics-bg-image", `url("${img}")`);
    stage.classList.add("has-bg-image");
  }

  paintRelicsQuote();
  if (!_quoteTimerStarted) {
    _quoteTimerStarted = true;
    scheduleQuoteRefresh(paintRelicsQuote);
  }

  window.TelephantimRelics = { ...(window.TelephantimRelics || {}), cms: relics };
}

export async function hydrateRelics() {
  let content = null;
  try {
    content = await fetchSiteContent();
  } catch (err) {
    console.warn("[relics-cms] fetch failed", err);
  }
  if (!content) {
    try {
      content = await hydrateSiteContent();
    } catch (_) {
      /* defaults */
    }
  }
  if (content && content.relics) {
    applyRelics(content.relics);
  } else {
    // Still rotate quotes with defaults when CMS is offline
    paintRelicsQuote();
    if (!_quoteTimerStarted) {
      _quoteTimerStarted = true;
      scheduleQuoteRefresh(paintRelicsQuote);
    }
  }
  return content;
}

// Run early so video src updates before play settles
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    hydrateRelics();
  });
} else {
  hydrateRelics();
}

window.TelephantimRelicsCms = { applyRelics, hydrateRelics, paintRelicsQuote };
