// Brains order (same free/native/secure pattern as Luna Camp 2D):
//   1) telephanti.com free_minds — camp banter + agent chat (no visitor keys, CORS open)
//   2) Optional telephantim-ai / local server.py (Ollama · Groq · Grok)
//   3) Browser-native mind (Chrome Prompt API / WebLLM)
//   4) Scripted dual duel
//
// LOCAL: empty TELEPHANTIM_API = same-origin /api/* (admin catalog + brains on server.py)
// LIVE:  Render AI host by default. For Studio vocals on visitors, run GO_PUBLIC_STUDIO.bat
//        (free Cloudflare tunnel → rewrites this file while your PC is on).
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
