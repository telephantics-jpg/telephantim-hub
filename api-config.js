// Live guests → free Cloudflare tunnel to Stood's PC (ACE-Step vocals).
// PC must stay on with hub + ACE + cloudflared. Localhost still same-origin.
(function () {
  var h = "";
  try { h = (location.hostname || "").toLowerCase(); } catch (_) {}
  var isLocal = h === "localhost" || h === "127.0.0.1" || h === "";
  if (isLocal) {
    window.TELEPHANTIM_API = "";
    window.TELEPHANTIM_UNIFIED = true;
  } else {
    window.TELEPHANTIM_API = "https://cho-lip-steam-due.trycloudflare.com";
    window.TELEPHANTIM_UNIFIED = true;
  }
})();
window.TELEPHANTIM_GA_ID = "G-418J7T1HZ1";
window.TELEPHANTIM_LAN_STUDIO = "http://192.168.1.151:8765/#studio";