/* App updater (Hephaestus): check for a new service worker on load and when the tab comes back; reload once when the new version takes over. */
(function () { try { if (!("serviceWorker" in navigator)) return; var had = !!navigator.serviceWorker.controller, done = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () { if (had && !done) { done = true; location.reload(); } });
  var up = function () { navigator.serviceWorker.getRegistration().then(function (r) { r && r.update(); }).catch(function () {}); };
  setTimeout(up, 3000); document.addEventListener("visibilitychange", function () { if (!document.hidden) up(); });
} catch (_) {} })();
/* Background hook (Hephaestus): mounts Atlas's 3D background (bg3d/bg3d.js, mountBackground) behind the app.
   three comes from the page import map -> sculpt/vendor/three.module.js (same URL Sculpt uses, so one copy loads).
   Skipped with no WebGL or localStorage miniBg3d = "off"; on any error the normal backdrop stays.
   window.MiniBg3d.requestTiltPermission() is called from the walker's one-time "Enable tilt" tap. */
(function () { try {
  if (localStorage.getItem("miniBg3d") === "off") return;
  var c = document.createElement("canvas"), gl = null; try { gl = c.getContext("webgl2") || c.getContext("webgl"); } catch (_) {} if (!gl) return;
  var host = document.createElement("div"); host.id = "bg3d-host"; host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0;transition:opacity 1.2s";
  var veil = document.createElement("div"); veil.style.cssText = "position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,26,51,.62),rgba(26,44,74,.5) 55%,rgba(11,26,51,.66))"; // keeps light text readable on the pale steel scene
  document.body.prepend(host);
  import("./bg3d/bg3d.js?v=1").then(function (m) {
    var api = m.mountBackground(host, { tilt: true }) || {}; host.appendChild(veil);
    document.documentElement.classList.add("bg3d-on"); host.style.opacity = "1";
    window.MiniBg3d = { requestTiltPermission: m.requestTiltPermission, unmount: m.unmount, api: api };
  }).catch(function (e) { console.warn("[bg3d] off:", e && e.message); host.remove(); });
} catch (e) { console.warn("[bg3d]", e); } })();
