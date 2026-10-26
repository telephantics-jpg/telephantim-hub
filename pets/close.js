/* Sprites close X: shows on hover (mouse) or long-press (touch/pen) over a Sprite; never on a drag. */
(function () {
  if (window.SpriteClose) return;
  window.SpriteClose = function (onClose) {
    if (document.getElementById("sp-close")) return;
    var x = document.createElement("button"); x.id = "sp-close"; x.type = "button"; x.textContent = "\u2715"; x.title = "Close Sprites"; x.setAttribute("aria-label", "Close Sprites");
    x.style.cssText = "position:fixed;z-index:2147483647;display:none;width:28px;height:28px;border-radius:50%;border:2px solid #d4af37;background:#4a5a6e;color:#f3dc8f;font:bold 15px/22px sans-serif;padding:0;margin:0;cursor:pointer;box-shadow:0 1px 5px rgba(16,28,52,.7);touch-action:none";
    document.body.appendChild(x);
    var cur = null, hideT = null, lp = null, down = null, dragging = false;
    function W(t) { return t && t.closest ? t.closest(".mw-walker") : null; }
    function inR(el, px, py, pad) { if (!el) return false; var r = el.getBoundingClientRect(); return px >= r.left - pad && px <= r.right + pad && py >= r.top - pad && py <= r.bottom + pad; }
    function show(el, ms) { cur = el; var r = el.getBoundingClientRect(); x.style.left = Math.max(2, Math.min(innerWidth - 30, r.right - 14)) + "px"; x.style.top = Math.max(2, Math.min(innerHeight - 30, r.top - 12)) + "px"; x.style.display = "block";
      clearTimeout(hideT); hideT = setTimeout(hide, ms || 3000); }
    function hide() { clearTimeout(hideT); x.style.display = "none"; cur = null; }
    document.addEventListener("pointerover", function (e) { var w = W(e.target); if (w && e.pointerType === "mouse" && !down && !dragging) show(w); }, true);
    document.addEventListener("pointerdown", function (e) { if (e.target === x) return; var w = W(e.target); if (!w) { if (x.style.display !== "none") hide(); return; }
      down = { x: e.clientX, y: e.clientY }; dragging = false; if (e.pointerType !== "mouse") hide(); clearTimeout(lp);
      lp = setTimeout(function () { if (down && !dragging) show(w, 4500); }, 600); }, true);
    function mv(e) { if (down && !dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { dragging = true; clearTimeout(lp); hide(); }
      if (cur && !down && x.style.display !== "none" && !inR(cur, e.clientX, e.clientY, 10) && !inR(x, e.clientX, e.clientY, 6)) { clearTimeout(hideT); hideT = setTimeout(hide, 700); } }
    document.addEventListener("pointermove", mv, true); window.addEventListener("pointermove", function (e) { if (e.target === window) mv(e); });
    function up() { clearTimeout(lp); down = null; setTimeout(function () { dragging = false; }, 50); }
    document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", up, true);
    x.addEventListener("pointerenter", function () { clearTimeout(hideT); });
    x.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    x.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); hide(); try { onClose(); } catch (_) {} });
  };
})();