// Live guests + phone → Cloudflare tunnel → Stood PC ACE-Step (free, no visitor signup).
// Keep PC on: hub :8765 + ACE :8001 + this cloudflared process.
(function () {
  var h = "";
  try { h = (location.hostname || "").toLowerCase(); } catch (_) {}
  var isLocal = h === "localhost" || h === "127.0.0.1" || h === "";
  if (isLocal) {
    window.TELEPHANTIM_API = "";
    window.TELEPHANTIM_UNIFIED = true;
  } else {
    window.TELEPHANTIM_API = "https://chairman-summit-endless-building.trycloudflare.com";
    window.TELEPHANTIM_UNIFIED = true;
  }
})();
window.TELEPHANTIM_GA_ID = "G-418J7T1HZ1";
window.TELEPHANTIM_LAN_STUDIO = "http://192.168.1.151:8765/#studio";