// Brains + Studio API
// LOCAL: same-origin /api/*
// LIVE: telephantim-ai on Render (works with PC off when FAL_KEY is set)
(function () {
  var h = "";
  try {
    h = (location.hostname || "").toLowerCase();
  } catch (_) {}
  var isLocal = h === "localhost" || h === "127.0.0.1" || h === "";
  if (isLocal) {
    window.TELEPHANTIM_API = "";
    window.TELEPHANTIM_UNIFIED = true;
  } else {
    window.TELEPHANTIM_API = window.TELEPHANTIM_API || "https://telephantim-ai.onrender.com";
    window.TELEPHANTIM_UNIFIED = true;
  }
})();

window.TELEPHANTIM_GA_ID = "G-418J7T1HZ1";
