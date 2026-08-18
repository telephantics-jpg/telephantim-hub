// Auto-published for Studio vocals + brains — PC must stay on with tunnel
(function () {
  var h = "";
  try { h = (location.hostname || "").toLowerCase(); } catch (_) {}
  var isLocal = h === "localhost" || h === "127.0.0.1" || h === "";
  if (isLocal) {
    window.TELEPHANTIM_API = "";
    window.TELEPHANTIM_UNIFIED = true;
  } else {
    window.TELEPHANTIM_API = "https://judge-satisfy-competent-prohibited.trycloudflare.com";
    window.TELEPHANTIM_UNIFIED = true;
  }
})();
window.TELEPHANTIM_GA_ID = "G-418J7T1HZ1";
