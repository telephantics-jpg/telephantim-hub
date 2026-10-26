/* Helix pet (Hephaestus): Tamagotchi-style overlay with 2D physics, mood/needs and self-made speech.
   Art:   walker/states.json (optional, Atlas) -> { "fps":12, "states": { "<name>": { "src":"x.webp", "frames":N, "fps":12, "w":256, "h":256 } } }
          State names are read dynamically; the pet asks for idle/walk/bump/talk/sleep and falls back to the first state, then to helix webp.
   Lines: generated live by Mini's model (window.MiniApp.bubble); offline they are assembled from word parts. No canned list.
          walker/style.json (optional) -> { "examples": ["..."] } is used only as style hints in the prompt.
   Sound: walker/sounds/{bump,land,pop}.mp3 optional, muted by default; missing files do nothing. */
(function () {
  if (window.top !== window || window.__MW_INIT) return; window.__MW_INIT = 1; /* one overlay per tab: never in iframes, never twice */
  var MWC = window.MW_CONF || {}, BASE = MWC.base || "walker/", NS = MWC.ns || ""; var FOL = false, MKEY_ = NS + "miniWalkerMode", MODE = "juke"; try { MODE = localStorage.getItem("pets_mode") || localStorage.getItem(MKEY_) || MWC.mode || (innerWidth < 600 ? "chill" : "juke"); } catch (_) { MODE = MWC.mode || (innerWidth < 600 ? "chill" : "juke"); }
  var PTR = { x: -1, y: -1, t: 0 }; addEventListener("pointermove", function (e) { PTR.x = e.clientX; PTR.y = e.clientY; PTR.t = performance.now(); }, { passive: true }); addEventListener("pointerdown", function (e) { PTR.x = e.clientX; PTR.y = e.clientY; PTR.t = performance.now(); }, { passive: true }, true);
  window.MiniWalkerMode = function (m) { if (m) { MODE = /^(chill|follow|music)$/.test(m) ? m : "juke"; try { localStorage.setItem(MKEY_, MODE); localStorage.setItem("pets_mode", MODE); } catch (_) {} [].forEach.call(document.querySelectorAll("#mw-mode"), function (s) { s.value = MODE; }); try { document.dispatchEvent(new CustomEvent("mw-mode", { detail: MODE })); } catch (_) {} } return MODE; };
  var PETS = [], tilt = { x: 0, y: 1, on: false }, Q = new URLSearchParams(location.search), WHO = NS + "miniWalkerWho";
  /* sprite registry: each entry is a folder with Atlas's states.json format. "tumble" (optional) plays while flung through the air. */
  var REG = { cadu: { id: "cadu", name: "Cadu", base: BASE + "", primary: true, ready: true, desc: "Cadu, a small living helix caduceus cross: two gold strands around a steel staff" },
              nir: { id: "nir", name: "Nir", base: BASE + "nir/", ready: false, enabled: MWC.nir !== false /* flip to true when Atlas's final Nir render lands; ?nirpreview=1 tests it now */, desc: "Nir, a small rotating Mjolnir hammer of steel and gold" } };
  var live = {};
  function pair(a, b) { var A = a.body(), B = b.body(); if (!A.on || !B.on) return; var ax = A.x + A.sz / 2, ay = A.y + A.sz / 2, bx = B.x + B.sz / 2, by = B.y + B.sz / 2, dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy), r = (A.sz + B.sz) * .36;
    if (MODE !== "juke" && d < r * 1.6 && d >= r && d > .01) { var sx0 = (bx - ax) / d * 40, sy0 = (by - ay) / d * 40; a.set(A.x, A.y, A.vx - sx0 * .05, A.vy - sy0 * .05); b.set(B.x, B.y, B.vx + sx0 * .05, B.vy + sy0 * .05); return; } if (d >= r || d < .01) return; var nx = dx / d, ny = dy / d, push = (r - d) / 2, rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny, k = rv < 0 ? -(1 + .6) * rv / 2 : 0;
    a.set(A.x - nx * push, A.y - ny * push, A.vx - k * nx, A.vy - k * ny); b.set(B.x + nx * push, B.y + ny * push, B.vx + k * nx, B.vy + k * ny); if (-rv > 220) { a.hit(-rv); b.hit(-rv); } if (-rv > (MODE !== "juke" ? 950 : 520)) { clash(a, b, A, B, (ax + bx) / 2, (ay + by) / 2); } }
  /* duel: faster sprite strikes then wins, slower takes the hit then is dazed. Art optional (strike/hit/win/dazed + walker/duel/clash.webp). */
  var lastClash = performance.now() + 3500, CLASH = null; (function () { var im = new Image(); im.onload = function () { CLASH = im.src; }; im.src = BASE + "duel/clash.webp"; })();
  function clash(a, b, A, B, cx, cy) { var now = performance.now(); if (now - lastClash < 6000) return; lastClash = now;
    var fa = Math.hypot(A.vx, A.vy) >= Math.hypot(B.vx, B.vy); try { (fa ? a : b).duel("win"); (fa ? b : a).duel("lose"); setTimeout(function () { (fa ? a : b).say("duel"); }, 700); try { document.dispatchEvent(new CustomEvent("mw-duel")); } catch (_) {} } catch (_) {}
    var fx = document.createElement("div"); fx.className = "mw-clash"; fx.style.left = Math.round(cx) + "px"; fx.style.top = Math.round(cy) + "px";
    if (CLASH) { var i = document.createElement("img"); i.src = CLASH + (CLASH.indexOf("?") < 0 ? "?" : "&") + "p=" + (clash.n = ((clash.n || 0) + 1) % 4); i.alt = ""; fx.appendChild(i); } else { fx.classList.add("drawn"); for (var k = 0; k < 10; k++) { var sp = document.createElement("i"); sp.style.setProperty("--a", (k * 36) + "deg"); fx.appendChild(sp); } }
    document.body.appendChild(fx); setTimeout(function () { fx.remove(); }, 750); }
  function makePet(P) { try {
  var KEY = NS + (P.primary ? "miniWalker" : "miniWalker_" + P.id), MKEY = KEY + "Mood";
  var st = { mode: "on", paused: false, x: null, y: null, sound: false };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (_) {}
  try { var GP = JSON.parse(localStorage.getItem("sprite_pos_" + P.id) || "null"); if (GP && isFinite(GP.x)) { st.x = Math.max(0, Math.min(innerWidth - 60, GP.x)); st.y = Math.max(0, Math.min(innerHeight - 60, GP.y)); } } catch (_) {} /* one drop position shared by every tab and page */
  var md = { energy: 70, joy: 65, curiosity: 60, t: Date.now() };
  try { Object.assign(md, JSON.parse(localStorage.getItem(MKEY) || "{}")); } catch (_) {}
  var save = function () { try { st.x = Math.round(x); st.y = Math.round(y); localStorage.setItem(KEY, JSON.stringify(st)); localStorage.setItem("sprite_pos_" + P.id, JSON.stringify({ x: st.x, y: st.y })); localStorage.setItem(MKEY, JSON.stringify(md)); } catch (_) {} };
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches, SZ = innerWidth < 600 ? 64 : innerWidth < 1600 ? 112 : 136;
  var root = document.createElement("div"); root.id = P.primary ? "mw-walker" : "mw-walker-" + P.id; root.className = "mw-walker"; root.style.width = root.style.height = SZ + "px";
  root.innerHTML = '<div class="mw-ctl"><button data-a="pause" aria-label="Pause">II</button><button data-a="min" aria-label="Minimize">_</button><button data-a="close" aria-label="Close">x</button></div><div class="mw-body"><div class="mw-icon" role="button" aria-label="Helix sprite" tabindex="0"></div></div>';
  var icon = root.querySelector(".mw-icon"), body = root.querySelector(".mw-body"); document.body.appendChild(root);
  var bubble = document.createElement("div"); bubble.id = P.primary ? "mw-say" : "mw-say-" + P.id; bubble.className = "mw-say"; bubble.setAttribute("aria-live", "polite"); document.body.appendChild(bubble);

  /* ---------- art: per-state sprite strips from states.json, else animated webp ---------- */
  var STATES = null, cur = "", img = null, SIZE = SZ <= 64 ? "128" : "256", oneShot = null, curSrc = "";
  function useImg(list) { var i = 0; (function next() { if (i >= list.length) return; var im = new Image(); im.alt = ""; im.onload = function () { if (STATES) return; icon.innerHTML = ""; icon.appendChild(im); img = im; }; im.onerror = function () { i++; next(); }; im.src = list[i] + "?v=2"; })(); }
  if (P.primary) useImg(SZ <= 64 ? [BASE + "helix-128.webp", BASE + "helix.webp", BASE + "helix-128.gif"] : [BASE + "helix.webp", BASE + "helix-128.webp", BASE + "helix-128.gif"]);
  function srcOf(k, J) { var s = (J || STATES).states[k], v = s && (s[SIZE] || s["128"] || s["256"]); return v ? (v.webp || v.src) : (s && s.src); }
  fetch(P.base + "states.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || !j.states || !Object.keys(j.states).length) return; var first = j.states.idle ? "idle" : Object.keys(j.states)[0];
    var probe = new Image(); probe.onload = function () { probe.onload = null; STATES = j; Object.keys(j.states).forEach(function (k) { var u = srcOf(k, j); if (u) { var p = new Image(); p.src = P.base + u; } });
      img = probe; img.alt = ""; img.className = "mw-3d"; icon.innerHTML = ""; icon.appendChild(img); curSrc = probe.src; cur = first; root.classList.add("mw-has3d"); };
    probe.src = P.base + srcOf(first, j); }).catch(function () {});
  /* ANIM CONFIG: which Atlas state plays for rest and for a full axis turn.
     First sprite set (before 08:22) had it reversed: rest "spin", turn "idle".
     Current: Atlas NEW set (08:25+), "spin" = full axis turn, "idle" = forward-facing sway: rest "idle", turn "spin". */
  var ANIM = { restState: "idle", turnState: "spin", turnEveryMs: [6000, 12000] };
  function MAPOF(w) { var r = ANIM.restState, t = ANIM.turnState; return ({ rest: [r, t], turn: [t, r], air: ["tumble", t, r], hop: ["hop", t, r], strike: ["strike", t, r], win: ["win", "wave", r], hit: ["hit", "bump", r], dazed: ["dazed", "bump", r], walk: ["walk", r], bump: ["bump", r], wave: ["wave", "talk", r], talk: ["talk", "wave", r], sleep: ["sleep", r] })[w] || [w]; }
  var chase = { until: 0, ref: null }, chT = 0, chX = 0, chY = 0, curNext = performance.now() + 6000 + Math.random() * 8000, chPh = Math.random() * 6.283, JUKE = MWC.juke !== false, jukeT = 0, holdUntil = 0, flungAir = false, nextTurn = performance.now() + ANIM.turnEveryMs[0] + Math.random() * (ANIM.turnEveryMs[1] - ANIM.turnEveryMs[0]);
  function pickState(want) { if (!STATES) return null; var S = STATES.states;
    var c = MAPOF(want).concat(Object.keys(S)); for (var i = 0; i < c.length; i++) if (S[c[i]] && srcOf(c[i])) return c[i]; return null; }
  function setState(want) { if (!STATES || !img) return; var k = pickState(want); if (!k || k === cur) return; cur = k; var u = P.base + srcOf(k); var s1 = STATES.states[k]; if (s1 && s1.loop === false) { u += (u.indexOf("?") < 0 ? "?" : "&") + "p=" + (setState.n = ((setState.n || 0) + 1) % 4); } if (u !== curSrc) { curSrc = u; img.src = u; } }
  var PRI = { strike: 3, hit: 3, win: 3, dazed: 2 }; function playOnce(want, now, then) { if (oneShot && now < oneShot.until && (PRI[oneShot.k] || 0) > (PRI[want] || 0)) return; var k = pickState(want); if (!k) return; var s = STATES.states[k]; oneShot = { k: want, until: now + 1000 * (s.frames || 24) / (s.fps || 24), then: then !== undefined ? then : want === "bump" ? "turn" : null }; }
  function stepFrames() {}
  /* ---------- optional sounds (muted by default) ---------- */
  var SND = {}; function snd(n) { if (!st.sound) return; try { if (SND[n] === false) return; if (!SND[n]) { SND[n] = new Audio(BASE + "sounds/" + n + ".mp3"); SND[n].volume = .35; SND[n].onerror = function () { SND[n] = false; }; } if (SND[n]) { SND[n].currentTime = 0; SND[n].play().catch(function () {}); } } catch (_) {} }

  /* ---------- physics ---------- */
  var x = st.x, y = st.y, vx = 0, vy = 0, rot = 0, vr = 0, sq = 0, grounded = false, drag = null, hopAt = performance.now() + 3000;
  var G = 1800, BOUNCE = .55, FRIC = 6;
  function bounds() { var nav = document.querySelector(".mn-bar"), form = document.getElementById("chat-form"), bot = innerHeight - 8;
    [nav, form].forEach(function (el) { if (el && el.offsetParent !== null) { var r = el.getBoundingClientRect(); if (r.height && r.top > innerHeight * .45 && r.top < bot) bot = r.top - 6; } });
    return { l: 4, t: 56, r: innerWidth - SZ - 4, b: Math.max(120, bot - SZ) }; }
  if (x == null || y == null) { var B0 = bounds(); x = B0.r - 12; y = B0.t + 40; }
  function hit(kind, speed) { sq = Math.min(.35, speed / 2600); if (speed > 260) { snd(kind); if (kind === "bump") { md.joy = Math.min(100, md.joy + 1); if (STATES) playOnce("bump", performance.now()); if (speed > 900 && Math.random() < .08) speak("bump"); } } }
  var bumpUntil = 0;
  function physics(dt, now) { var B = bounds();
    if (drag) { grounded = false; return; }
    if (JUKE && MODE === "juke" && now - (tilt.act || 0) > 1500 && now > holdUntil && md.energy >= 20 && now > jukeT) { var JR = RM ? .35 : 1;
      if (Math.random() < .2) { vx *= .25; jukeT = now + 250 + Math.random() * 450; }
      else { var dir = Math.random() < .5 ? -1 : 1; if (x < B.l + SZ) dir = 1; else if (x > B.r - SZ) dir = -1; else if (Math.random() < .55 && Math.abs(vx) > 40) dir = vx > 0 ? -1 : 1;
        vx = dir * (320 + Math.random() * 560) * JR; if (grounded && Math.random() < .35) { vy = -(360 + Math.random() * 460) * JR; if (STATES && !oneShot) playOnce(Math.random() < .55 ? "hop" : "turn", now); }
        jukeT = now + (400 + Math.random() * 800) / (RM ? .6 : 1); } }
    var gx = tilt.on ? tilt.x * G : 0, gy = tilt.on ? tilt.y * G : G;
    if (MODE !== "juke" && now - (tilt.act || 0) > 1500 && now > holdUntil && !flungAir) { gx = gy = 0; var CR = RM ? .45 : 1, tx, ty;
      if (now > chT || (FOL && now > chT - 13000)) { var cur0 = FOL || (PTR.t && now - PTR.t < 15000 && now > curNext && Math.random() < .25);
        if (cur0) { var oa = Math.random() * 6.283, od = SZ * 1.4 + 50; chX = PTR.x + Math.cos(oa) * od - SZ / 2; chY = PTR.y + Math.sin(oa) * od * .7 - SZ / 2; chT = now + (FOL ? 600 : 2000 + Math.random() * 1200); curNext = now + 22000 + Math.random() * 18000; }
        else { var spot = window.__mwFree ? window.__mwFree(B, SZ) : null; if (spot) { chX = spot[0]; chY = spot[1]; } else { chX = B.l + Math.random() * (B.r - B.l); chY = B.t + Math.random() * (B.b - B.t); } chT = now + 14000; } }
      if (chase.until > now && chase.ref && chase.ref.body) { var cb = chase.ref.body(); chX = cb.x + (x < cb.x ? -SZ * .9 : SZ * .9); chY = cb.y; }
      tx = Math.max(B.l, Math.min(B.r, chX)); ty = Math.max(B.t, Math.min(B.b, chY));
      tx += Math.sin(now / 1900 + chPh) * SZ * .6; ty += Math.cos(now / 2300 + chPh) * SZ * .4;
      var ddx = tx - x, ddy = ty - y, dd = Math.hypot(ddx, ddy), cru = (RM ? 40 : 120) * (dd < 60 ? dd / 60 : 1) * (1 + .25 * Math.sin(now / 3100 + chPh)); if (dd < 30 && window.__mwBusy && window.__mwBusy(x, y, SZ)) chT = now; if (dd < 30 && now < chT - 400 && !(PTR.t && Math.hypot(chX - PTR.x, chY - PTR.y) < SZ * 3)) chT = now + 400 + Math.random() * 900;
      var dvx = dd > .1 ? ddx / dd * cru : 0, dvy = dd > .1 ? ddy / dd * cru : 0; vx += (dvx - vx) * 1.1 * dt; vy += (dvy - vy) * 1.1 * dt + Math.sin(now / 700 + chPh) * 10 * dt;
      if (PTR.t) { var pdx = x + SZ / 2 - PTR.x, pdy = y + SZ / 2 - PTR.y, pd = Math.hypot(pdx, pdy); if (pd < SZ * 1.1 && pd > .1) { vx += pdx / pd * 900 * dt; vy += pdy / pd * 900 * dt; } } } vx += gx * dt; vy += gy * dt;
    x += vx * dt; y += vy * dt; vr += (-rot * 40 - vr * 6) * dt; rot += vr * dt;
    if (x < B.l) { x = B.l; if (vx < 0) { hit("bump", -vx); vx = -vx * BOUNCE; vr += vx * .02; } }
    if (x > B.r) { x = B.r; if (vx > 0) { hit("bump", vx); vx = -vx * BOUNCE; vr += vx * .02; } }
    if (y < B.t) { y = B.t; if (vy < 0) { hit("bump", -vy); vy = -vy * BOUNCE; } }
    if (y >= B.b) { y = B.b; if (vy > 0) { var sp = vy; vy = sp > 120 ? -sp * BOUNCE : 0; if (!grounded && sp > 80) hit(sp > 260 ? "land" : "none", sp); grounded = vy === 0; } vx -= vx * Math.min(1, FRIC * dt); if (Math.abs(vx) < 4) vx = 0; } else grounded = false;
    // gentle idle hop / wander when resting and awake
    if (grounded && (!tilt.on || tilt.y > .8) && !st.paused && st.mode === "on" && now > hopAt && !drawing()) { var e = md.energy / 100; vy = -(260 + 380 * e); vx = (Math.random() - .5) * (160 + 220 * e); vr += vx * .01; hopAt = now + (2500 + Math.random() * 5000) / (.4 + e); md.energy = Math.max(0, md.energy - .6); }
    sq += (0 - sq) * Math.min(1, 10 * dt);
    PETS.forEach(function (o) { if (o !== api && P.id < o.id) pair(api, o); }); }

  /* ---------- canvas guard: never cover a drawing in progress ---------- */
  function drawing() { var p = document.getElementById("pane-canvas"), m = document.getElementById("cv-msg"); return !!(p && p.classList.contains("active") && m && /is drawing/i.test(m.textContent)); }
  function canvasRect() { var p = document.getElementById("pane-canvas"), w = document.getElementById("cv-wrap"); if (!p || !w || !p.classList.contains("active")) return null; var r = w.getBoundingClientRect(); return r.width ? r : null; }
  function guard() { var r = canvasRect(), over = false; if (r) { over = x + SZ > r.left && x < r.right && y + SZ > r.top && y < r.bottom; if (over && drawing() && !drag) { var B = bounds(); // slide to the nearer side margin, or the floor below the canvas
        if (r.left - B.l >= SZ || B.r - r.right >= 0) vx += (x + SZ / 2 < (r.left + r.right) / 2 ? -1 : 1) * 60; } }
    root.classList.toggle("mw-ghost", over && (drawing() || !!r)); }

  /* ---------- frame loop ---------- */
  var last = performance.now(), lastInput = last;
  function frame(now) { var dt = Math.min(.05, (now - last) / 1000); last = now; try {
      if (st.mode === "on" && !st.paused) { if (!RM || tilt.on || JUKE) physics(dt, now); else { var B = bounds(); x = Math.max(B.l, Math.min(B.r, x)); y = Math.max(B.t, Math.min(B.b, y)); } }
      if (st.mode === "min") { var Bm = bounds(); x = innerWidth - 22; y = Math.max(Bm.t, Math.min(Bm.b, y)); }
      if (STATES) { if (oneShot && now > oneShot.until) { var nx = oneShot.then; oneShot = null; if (nx) playOnce(nx, now); } var spd = Math.hypot(vx, vy), idleLong = now - lastInput > 60000;
        if (!oneShot && now > nextTurn && !drag) { playOnce("turn", now); nextTurn = now + ANIM.turnEveryMs[0] + Math.random() * (ANIM.turnEveryMs[1] - ANIM.turnEveryMs[0]); }
        if (grounded) flungAir = false;
        var want = oneShot ? oneShot.k : drag ? "rest" : flungAir && !grounded ? "air" : md.energy < 20 && grounded ? "sleep" : bubble.classList.contains("on") ? "talk" : grounded && Math.abs(vx) > 20 ? "walk" : "rest";
        setState(want); }
      guard(); placeBubble();
      var spin = RM ? (now / 8000 % 1) * 360 : 0, s = 1 - sq * .5, sy = 1 - sq, sx = 1 + sq * .6;
      var bob = st.mode === "on" && !drag ? Math.sin(now / (RM ? 1400 : 520)) * (RM ? 2 : 3.5) : 0; root.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y + bob) + "px)";
      body.style.transform = RM ? "" : "rotate(" + (rot * 57).toFixed(1) + "deg) scale(" + sx.toFixed(3) + "," + (sy * s / s).toFixed(3) + ")";
    } catch (e) { console.warn("[walker frame]", e); } requestAnimationFrame(frame); }
  requestAnimationFrame(frame);

  /* ---------- mood / needs ---------- */
  function clamp100(v) { return Math.max(0, Math.min(100, v)); }
  (function decay() { var mins = (Date.now() - (md.t || Date.now())) / 60000; md.energy = clamp100(md.energy - mins * .4); md.joy = clamp100(md.joy - mins * .3); md.curiosity = clamp100(md.curiosity - mins * .25); md.t = Date.now(); })();
  setInterval(function () { md.energy = clamp100(md.energy - .2 + (st.paused ? 1.5 : 0)); md.joy = clamp100(md.joy - .15); md.curiosity = clamp100(md.curiosity - .12); md.t = Date.now(); save(); }, 30000);
  function moodWord() { if (md.energy < 25) return "sleepy"; if (md.joy > 75 && md.energy > 55) return "bright"; if (md.curiosity > 70) return "curious"; if (md.joy < 35) return "wistful"; return "calm"; }
  var topic = "";
  var cf = document.getElementById("chat-form"); if (cf) cf.addEventListener("submit", function () { var v = (document.getElementById("chat-in") || {}).value || ""; v = v.trim(); if (v) { topic = v.slice(0, 80); md.curiosity = clamp100(md.curiosity + 12); md.joy = clamp100(md.joy + 4); save(); } }, true);

  /* ---------- speech: model first, word parts fallback ---------- */
  var BANNED = /\b(deeper|harder|taste\w*|tongue\w*|flavou?r\w*|lick\w*|savor\w*|savour\w*)\b/i;
  function clean(t) { t = String(t || "").replace(/<[^>]*>/g, "").replace(/[*_#`"]/g, "").split(/\n/)[0].trim(); var w = t.split(/\s+/).filter(Boolean); if (!t || w.length > 12 || t.length > 90) return null;
    if (BANNED.test(t)) return null; if (window.MiniScene && window.MiniScene.safe && !window.MiniScene.safe(t)) return null; if (/\b(hate|stupid|die|dead|kill|hurt)\b/i.test(t)) return null; return t; }
  var STYLE = []; fetch(BASE + "style.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && Array.isArray(j.examples)) STYLE = j.examples.slice(0, 6).map(String); }).catch(function () {});
  function tod() { var h = new Date().getHours(); return h < 5 ? "late night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"; }
  function userBusy() { var ci = document.getElementById("chat-in"); if (ci && (document.activeElement === ci || ci.value.trim())) return true; if (document.querySelector(".ring.answer, .ring.think")) return true; return false; }
  var lastAct = "idle";
  function prompt(act) { var sys = "You are " + P.desc + ", Mini Alpha's sprite. You speak one short, kind, clean line, first person, playful and wise. Never cruel. No emojis, no quotes."
      + (STYLE.length ? " Style examples (do not copy): " + STYLE.join(" | ") : "");
    var u = "Right now: " + act + ". Mood " + moodWord() + " (energy " + Math.round(md.energy) + ", joy " + Math.round(md.joy) + ", curiosity " + Math.round(md.curiosity) + "). It is " + tod() + "." + (topic ? " Recent chat topic: " + topic + "." : "") + " Say one fresh line, 12 words or fewer.";
    return [sys, u]; }
  function gen(act) { var A = window.MiniApp; if (!A || !A.hasMind || !A.hasMind() || userBusy()) return Promise.resolve(null); var p = prompt(act);
    return Promise.race([A.bubble(p[0], p[1], { max: 40, temp: 1.0 }), new Promise(function (r) { setTimeout(function () { r(null); }, 7000); })]).then(clean).catch(function () { return null; }); }
  var PARTS = { // word parts, assembled on the fly
    open: { sleepy: ["Yawn.", "Slow coils now.", "Eyes half shut."], bright: ["Wheee!", "Gold strands humming!", "Look at me go!"], curious: ["Hmm.", "Wait, wait.", "Ooh."], wistful: ["Quiet spin.", "Missed you a little.", "Slow orbit today."], calm: ["Steady.", "Easy turns.", "All good here."] },
    act: { tap: ["that tickles my rungs", "hello up there", "you found me"], pet: ["that warms the whole staff", "my strands are glowing", "rub the steel, sure"], fed: ["new idea in the coil", "that thought spins nicely", "chewing on that idea"], rest: ["resting my gold", "a nap sounds right", "recharging the rungs"], bump: ["boing off the edge", "walls are bouncy today", "nice wall"], land: ["landed like a gear", "stuck the landing", "floor, my old friend"], idle: ["just orbiting", "spinning in place", "watching the screen"] },
    whole: { banter: ["Race to the corner? Loser polishes the other.", "Two relics, one screen. Cozy.", "Spin-off? Literally.", "Still steady over here. Mostly.", "Ha! Guess who is faster."], music: ["Beat detected. Strands swaying.", "This rhythm suits the coils."], duel: ["Good match. Again later.", "Steady wins. Barely."], sleep: ["Quiet coils... zzz.", "Resting the rungs."], scroll: ["Onward, the good stuff is further down.", "Mind the speed."], greet: ["Hello again. Spinning politely.", "There it is. The page missed company."] },
    ctx: { chat: ["Good bench for thinking out loud.", "Questions encouraged. Spins included."], canvas: ["Paint something bold. I will stay off it.", "Fresh canvas, fresh orbit."], sketch: ["Lines first, shading later.", "Sketching? I will hover politely."], write: ["Words in a row. Nice.", "Draft now, polish later."], den: ["Cozy den. Good place for a nap.", "Treasures in the den."], home: ["Nice page. Good spot to roam."] },
    tail: ["Two strands, one staff.", "Round and round, right back home.", "Navy skies, gold steps.", "Keep building.", "Tiny loops, big picture.", "Grace in every turn."] };
  function compose(act) { var LB = window.MW_LINES && (window.MW_LINES[P.id] || window.MW_LINES); if (act === "ctx") { var pl = window.MiniWalkerCtx ? window.MiniWalkerCtx.place() : "", CL = LB && LB.ctx && LB.ctx[pl]; if (!CL && PARTS.ctx[pl]) CL = PARTS.ctx[pl]; if (CL && CL.length) return CL[Math.floor(Math.random() * CL.length)]; act = "idle"; } if (!LB && PARTS.whole[act]) { var wl = PARTS.whole[act]; return wl[Math.floor(Math.random() * wl.length)]; } if (LB) { var la = LB[act === "tap" || act === "pet" ? "click" : act === "rest" ? "sleep" : act === "land" ? "bump" : act] || LB.idle; if (la && la.length) { var ln = la[Math.floor(Math.random() * la.length)]; if (ln !== compose.last || la.length < 2) { compose.last = ln; return ln; } return la[(la.indexOf(ln) + 1) % la.length]; } } var m = moodWord(), pk = function (a) { return a[Math.floor(Math.random() * a.length)]; }, parts = [pk(PARTS.open[m]), cap(pk(PARTS.act[act] || PARTS.act.idle)) + (Math.random() < .5 ? "." : "!")];
    var tw = topic ? topic.replace(/[^\w\s'-]/g, "").split(/\s+/).filter(function (w) { return w.length > 3; }) : [];
    if (tw.length && Math.random() < .6) parts.push("Still thinking about " + pk(tw).toLowerCase() + "."); else if (Math.random() < .5) parts.push(pk(PARTS.tail));
    var t = parts.join(" "), w = t.split(/\s+/); if (w.length > 12) t = w.slice(0, 12).join(" ").replace(/[,]?$/, "."); return clean(t) || "Spinning along."; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var speaking = false;
  function speak(act) { if (speaking || st.mode !== "on") return; speaking = true; lastAct = act;
    gen(act).then(function (t) { show(t || compose(act), !!t); }).finally(function () { speaking = false; }); }
  function show(t, live) { bubble.textContent = t; bubble.dataset.src = live ? "model" : "parts"; bubble.classList.add("on"); snd("pop"); if (STATES) playOnce("wave", performance.now()); clearTimeout(show.t); show.t = setTimeout(function () { bubble.classList.remove("on"); }, 3800); }
  function placeBubble() { if (!bubble.classList.contains("on")) return; var bw = bubble.offsetWidth || 200, bh = bubble.offsetHeight || 40; var l = Math.max(6, Math.min(innerWidth - bw - 6, x + SZ / 2 - bw / 2)), t = y - bh - 10; if (t < 6) t = y + SZ + 8; bubble.style.left = Math.round(l) + "px"; bubble.style.top = Math.round(t) + "px"; }
  setInterval(function () { if (st.mode === "on" && !document.hidden && !drawing() && Math.random() < .35) speak(CTX.act(md.energy)); }, 45000);
  window.addEventListener("mini-user", function () { setTimeout(function () { if (topic) speak("fed"); }, 30000); });

  /* ---------- input: drag, fling, tap, pet ---------- */
  icon.addEventListener("pointerdown", function (e) { lastInput = performance.now(); if (st.mode !== "on" && st.mode !== "min") return; holdUntil = Infinity; root.classList.add("mw-sel"); vx = vy = 0; drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: x, oy: y, moved: false, hist: [[e.clientX, e.clientY, performance.now()]], rub: 0, lx: e.clientX };
    try { icon.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); askTilt(); });
  icon.addEventListener("pointermove", function (e) { if (!drag || e.pointerId !== drag.id) return; var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.abs(e.clientX - drag.lx) > 3) { drag.rub += Math.abs(e.clientX - drag.lx); drag.lx = e.clientX; }
    if (Math.hypot(dx, dy) > 14) drag.moved = true;
    if (drag.moved && st.mode === "on") { x = drag.ox + dx; y = drag.oy + dy; rot = Math.max(-.4, Math.min(.4, (e.clientX - (drag.hist[drag.hist.length - 1] || [e.clientX])[0]) * .02)); }
    drag.hist.push([e.clientX, e.clientY, performance.now()]); if (drag.hist.length > 6) drag.hist.shift(); });
  icon.addEventListener("pointerup", endDrag); icon.addEventListener("pointercancel", endDrag);
  function endDrag(e) { if (!drag) return; var d = drag; drag = null; holdUntil = performance.now() + 3000; clearTimeout(endDrag.t); endDrag.t = setTimeout(function () { root.classList.remove("mw-sel"); }, 3000); try { icon.releasePointerCapture(e.pointerId); } catch (_) {}
    if (st.mode === "min") { st.mode = "on"; apply(); return; }
    if (d.moved) { var a = d.hist[0], b = d.hist[d.hist.length - 1], tdt = Math.max(16, b[2] - a[2]) / 1000; vx = Math.max(-2600, Math.min(2600, (b[0] - a[0]) / tdt)); vy = Math.max(-2600, Math.min(2600, (b[1] - a[1]) / tdt)); vr = vx * .004;
      flungAir = !RM; if (RM) { vx = vy = 0; } md.joy = clamp100(md.joy + 2); save(); if (Math.hypot(vx, vy) > 900 && Math.random() < .5) setTimeout(function () { speak("fling"); }, 500); return; }
    if (d.rub > 60) { md.joy = clamp100(md.joy + 10); md.energy = clamp100(md.energy + 3); save(); speak("pet"); return; }
    md.joy = clamp100(md.joy + 5); md.curiosity = clamp100(md.curiosity + 3); if (!RM) { vy = -420; vr += (Math.random() - .5) * 4; } save(); showCtl(); if (STATES) playOnce("wave", performance.now()); speak("tap"); }
  icon.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showCtl(); speak("tap"); } });
  root.querySelector(".mw-ctl").addEventListener("click", function (e) { var a = e.target.closest("button"); if (!a) return; e.stopPropagation(); a = a.dataset.a;
    if (a === "pause") { st.paused = !st.paused; if (st.paused) speak("rest"); } if (a === "min") st.mode = "min"; if (a === "close") st.mode = "closed"; root.classList.remove("mw-show"); apply(); });
  var hideCtl; function showCtl() { root.classList.add("mw-show"); clearTimeout(hideCtl); hideCtl = setTimeout(function () { root.classList.remove("mw-show"); }, 3500); }
  root.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse" && st.mode === "on") showCtl(); });

  /* ---------- device tilt gravity (on by default on phones) ----------
     Android / no permission API: listeners attach on load. iOS: a "Tap to turn on tilt" banner calls requestPermission in its click handler.
     deviceorientation (beta/gamma) drives gravity; devicemotion accelerationIncludingGravity is the fallback. Settings "Helix tilt" can turn it off (localStorage miniWalkerTilt2=off).
     ?debug=1 shows event counts, permission state and beta/gamma. */
  var TKEY = NS + "miniWalkerTilt2", tiltPref = null; try { tiltPref = localStorage.getItem(TKEY); } catch (_) {}
  var COARSE = matchMedia("(pointer: coarse)").matches, HAS_SENSOR = COARSE && ("DeviceOrientationEvent" in window || "DeviceMotionEvent" in window);
  var NEEDS_PERM = HAS_SENSOR && ((window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") || (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === "function"));
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var DEAD = .12, tiltSeen = 0, oriSeen = 0, tgt = { x: 0, y: 1 }, DBG = { ori: 0, mot: 0, perm: NEEDS_PERM ? "needs tap" : HAS_SENSOR ? "not needed" : "no sensor", b: 0, g: 0, ax: 0, ay: 0 };
  function screenAng() { return ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * Math.PI / 180; }
  function aim(dx, dy) { var ang = screenAng(), sx = dx * Math.cos(ang) + dy * Math.sin(ang), sy = -dx * Math.sin(ang) + dy * Math.cos(ang);
    var m = Math.hypot(sx, sy); if (m < DEAD) { tgt.x = 0; tgt.y = 1; } else { tilt.act = performance.now(); var k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m; tgt.x = sx * k; tgt.y = sy * k; if (Math.hypot(tgt.x, tgt.y) < .35) { tgt.x = 0; tgt.y = 1; tilt.act = 0; } } }
  function onTilt(e) { if (e.beta == null || e.gamma == null) return; DBG.ori++; DBG.b = e.beta; DBG.g = e.gamma; tiltSeen = oriSeen = performance.now();
    var b = e.beta * Math.PI / 180, g = e.gamma * Math.PI / 180; aim(Math.sin(g) * Math.cos(b), Math.sin(b)); }
  function onMotion(e) { var a = e.accelerationIncludingGravity; if (!a || a.x == null) return; DBG.mot++; DBG.ax = a.x; DBG.ay = a.y; if (performance.now() - oriSeen < 600) return; tiltSeen = performance.now();
    var sgn = IOS ? -1 : 1; aim(Math.max(-1, Math.min(1, -sgn * a.x / 9.81)), Math.max(-1, Math.min(1, sgn * a.y / 9.81))); }
  setInterval(function () { if (!tilt.on || !P.primary) return; tilt.x += (tgt.x - tilt.x) * .25; tilt.y += (tgt.y - tilt.y) * .25; if (performance.now() - tiltSeen > 3000) { tgt.x = 0; tgt.y = 1; } }, 33);
  function startTilt() { if (tilt.on) return; addEventListener("deviceorientation", onTilt); addEventListener("devicemotion", onMotion); tilt.on = true; }
  function stopTilt() { removeEventListener("deviceorientation", onTilt); removeEventListener("devicemotion", onMotion); tilt.on = false; tilt.x = 0; tilt.y = 1; }
  function setPref(v) { tiltPref = v; try { localStorage.setItem(TKEY, v); } catch (_) {} var t = document.getElementById("mw-tilt"); if (t) t.checked = v !== "off"; }
  /* must be called straight from a click/touchend handler on iOS */
  function enableTilt() { if (!HAS_SENSOR) return Promise.resolve(false);
    try { window.MiniBg3d && window.MiniBg3d.requestTiltPermission && window.MiniBg3d.requestTiltPermission(); } catch (_) {}
    var ps = []; try { if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") ps.push(DeviceOrientationEvent.requestPermission()); } catch (e) { ps.push(Promise.reject(e)); }
    try { if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === "function") ps.push(DeviceMotionEvent.requestPermission()); } catch (e) { ps.push(Promise.reject(e)); }
    if (!ps.length) { startTilt(); setPref("on"); DBG.perm = "not needed"; return Promise.resolve(true); }
    return Promise.all(ps.map(function (p) { return p.catch(function () { return "error"; }); })).then(function (rs) { DBG.perm = rs.join(",");
      if (rs.indexOf("granted") >= 0) { startTilt(); setPref("on"); try { localStorage.setItem(NS + "miniTiltOK", "1"); } catch (_) {} return true; } return false; }); }
  var chip = null;
  function banner(msg, denied) { if (!chip) { chip = document.createElement("button"); chip.id = "mw-tiltchip"; chip.type = "button"; document.body.appendChild(chip); }
    chip.className = denied ? "denied" : ""; chip.innerHTML = '<span class="t"></span><span class="mw-no" aria-label="Dismiss">x</span>'; chip.querySelector(".t").textContent = msg;
    chip.onclick = function (e) { if (e.target.classList.contains("mw-no")) { chip.remove(); chip = null; return; } if (denied) { chip.remove(); chip = null; return; }
      enableTilt().then(function (ok) { if (ok) { if (chip) { chip.remove(); chip = null; } } else banner("Tilt is blocked. iPhone Settings > Safari > Motion & Orientation Access: turn it on, then reload this page.", true); }); }; }
  function showChip() { banner("Tap to turn on tilt"); }
  if (P.primary && HAS_SENSOR && tiltPref !== "off") {
    if (!NEEDS_PERM) startTilt();
    else { /* iOS: listen right away (works if granted before); if nothing arrives, show the hint and ask on the FIRST click/touchend anywhere */
      startTilt(); var asked = false;
      var first = function () { if (asked || DBG.ori || DBG.mot) return done(); asked = true; enableTilt().then(function (ok) { if (ok && chip) { chip.remove(); chip = null; } else if (!ok) banner("Tilt is blocked. iPhone Settings > Safari > Motion & Orientation Access: turn it on, then reload this page.", true); }); done(); };
      var done = function () { document.removeEventListener("click", first, true); document.removeEventListener("touchend", first, true); };
      document.addEventListener("click", first, true); document.addEventListener("touchend", first, true);
      setTimeout(function () { if (!DBG.ori && !DBG.mot && !asked) showChip(); }, 1200);
      setInterval(function () { if ((DBG.ori || DBG.mot) && chip && !chip.classList.contains("denied")) { chip.remove(); chip = null; } }, 500); } }
  if (P.primary && Q.get("debug") === "1") { var dbg = document.createElement("div"); dbg.id = "mw-debug"; document.body.appendChild(dbg);
    setInterval(function () { dbg.textContent = "tilt " + (tilt.on ? "on" : "off") + " | perm " + DBG.perm + " | ori " + DBG.ori + " b " + Math.round(DBG.b) + " g " + Math.round(DBG.g) + " | mot " + DBG.mot + " ax " + DBG.ax.toFixed(1) + " ay " + DBG.ay.toFixed(1) + " | grav " + tilt.x.toFixed(2) + "," + tilt.y.toFixed(2) + " | ang " + Math.round(screenAng() * 57.3) + (RM ? " | reduced-motion" : ""); }, 200); }
  function askTilt() {}
  /* ---------- state / settings ---------- */
  function apply() { root.style.display = st.mode === "closed" ? "none" : ""; root.classList.toggle("mw-min", st.mode === "min"); if (st.mode !== "on") bubble.classList.remove("on");
    root.querySelector('[data-a="pause"]').textContent = st.paused ? ">" : "II";  var sg = document.getElementById("mw-sound"); if (sg) sg.checked = !!st.sound; save(); }
  (function toggle() { var s = document.getElementById("settings"); if (!P.primary || !s || document.getElementById("mw-who")) return; var l = document.createElement("label"); l.className = "tog";
    l.innerHTML = 'Helix sprite <select id="mw-who" aria-label="Which helix sprite"><option value="both" disabled>Both (Cadu + Nir)</option><option value="cadu">Cadu</option><option value="nir" disabled>Nir</option><option value="off">Off</option></select>'; var roam = s.querySelector("label.tog"); roam ? roam.after(l) : s.appendChild(l);
    l.querySelector("select").onchange = function (e) { setWho(e.target.value); }; var lm = document.createElement("label"); lm.innerHTML = 'Sprite mode <select id="mw-mode" aria-label="Sprite mode"><option value="juke">Juke (darting)</option><option value="chill">Chill (floaty)</option><option value="follow">Follow (stays near the pointer)</option><option value="music">Music (dances)</option></select>'; l.after(lm); var ms = lm.querySelector("select"); ms.value = MODE; ms.onchange = function (e) { window.MiniWalkerMode(e.target.value); };
    var l2 = document.createElement("label"); l2.className = "tog"; l2.innerHTML = '<input type="checkbox" id="mw-sound"> Helix sounds'; l.after(l2); l2.querySelector("input").onchange = function (e) { st.sound = e.target.checked; apply(); };
    if (HAS_SENSOR) { var l3 = document.createElement("label"); l3.className = "tog"; l3.innerHTML = '<input type="checkbox" id="mw-tilt"> Helix tilt'; l2.after(l3); l3.querySelector("input").checked = tiltPref !== "off";
      l3.querySelector("input").onchange = function (e) { if (e.target.checked) enableTilt(); else { setPref("off"); stopTilt(); } }; } })();
  addEventListener("pagehide", save);
  apply();
  var api = { show: function () { st.mode = "on"; apply(); }, hide: function () { st.mode = "closed"; apply(); }, say: speak, compose: compose, state: st, mood: md, fling: function (a, b) { vx = a; vy = b; }, anim: ANIM, tilt: function (b, g) { if (!tilt.on) { tilt.on = true; } onTilt({ beta: b, gamma: g }); return tgt; }, dbg: function () { return { tilt: tilt, x: x, y: y, cur: cur, oneShot: oneShot, nextTurn: nextTurn, now: performance.now(), has: !!STATES }; } };
  api.id = P.id; api.body = function () { return { x: x, y: y, vx: vx, vy: vy, sz: SZ, on: st.mode === "on" && !drag && !st.paused }; };
  api.chase = function (ref, ms) { chase.ref = ref; chase.until = performance.now() + ms; }; api.nudge = function (ax, ay) { if (drag || flungAir) return; vx += ax; vy += ay; }; api.dragging = function () { return !!drag; };
  api.set = function (a, b, c, d) { x = a; y = b; vx = c; vy = d; }; api.hit = function (sp) { hit("bump", sp); };
  api.duel = function (role) { var now = performance.now(); if (!STATES) return; if (role === "win") { playOnce("strike", now, "win"); md.joy = clamp100(md.joy + 4); }
    else { playOnce("hit", now, "dazed"); md.energy = clamp100(md.energy - 3); if (!STATES.states.dazed) setTimeout(function () { root.classList.add("mw-dazed"); setTimeout(function () { root.classList.remove("mw-dazed"); }, 1000); }, 500); } };
  api.setMode = function (m) { st.mode = m; apply(); }; api.isOn = function () { return st.mode === "on"; };
  api.enableTilt = function () { if (P.primary && HAS_SENSOR && !tilt.on) return enableTilt().then(function (ok) { if (ok && chip) { chip.remove(); chip = null; } return ok; }); };
  PETS.push(api); if (P.primary) window.MiniWalker = api;
  return api;
} catch (e) { console.warn("[walker " + P.id + "]", e); return null; } }
  function want(w) { return w === "both" ? ["cadu", "nir"] : w === "off" ? [] : [w]; }
  function setWho(w, boot) { var want0 = w; if (w !== "off" && w !== "cadu" && !REG.nir.ready) w = "cadu"; if (!boot || want0 !== w) { try { if (!boot) { localStorage.setItem(WHO, want0); localStorage.setItem("pets_who", want0); localStorage.setItem("tp_petsOn", want0 === "off" ? "0" : "1"); if (want0 !== "off") localStorage.setItem("pets_last", want0); } } catch (_) {} } var on = want(w);
    Object.keys(REG).forEach(function (id) { if (on.indexOf(id) >= 0) { if (!live[id] && REG[id].ready) live[id] = makePet(REG[id]); if (live[id] && !boot) live[id].setMode("on"); } else if (live[id]) live[id].setMode("closed"); });
    var sel = document.getElementById("mw-who"); if (sel) sel.value = w; }
  function refreshPicker() { var sel = document.getElementById("mw-who"); if (!sel) return; [].forEach.call(sel.options, function (o) { if (o.value === "nir" || o.value === "both") { o.disabled = !REG.nir.ready; o.textContent = (o.value === "nir" ? "Nir" : "Both") + (REG.nir.ready ? "" : " (loading)"); } }); }
  /* Self-drawn badge: Mini draws its own emblem with the Canvas scene code (MiniScene.plan + harm filter), palette only.
     Model picks motif/accent as JSON when loaded; otherwise a seeded random. Saved as a dataURL in localStorage NS + "miniBadgeArt". */
  var Badge = (function () { var KEY = NS + "miniBadgeArt", MOTIFS = ["music", "space", "sea", "tree", "city", "energy", "mind", "love", "tech", "faith"], ACC = { gold: "#d4a63a", ember: "#e07a1f", silver: "#9aa5b1", steel: "#5b6672", red: "#b32020" };
    var BANNED = /\b(deeper|harder|taste\w*|tongue\w*|flavou?r\w*)\b/i, url = null, busy = false; try { url = localStorage.getItem(KEY); } catch (_) {}
    function rng(seed) { var x = seed % 2147483647 || 7; return function () { x = x * 16807 % 2147483647; return (x - 1) / 2147483646; }; }
    function pickJSON(t) { try { var m = String(t || "").match(/\{[\s\S]*\}/); if (!m) return null; var j = JSON.parse(m[0]); if (MOTIFS.indexOf(j.motif) < 0) return null; if (j.accent && !ACC[j.accent]) j.accent = "gold";
        var c = String(j.caption || "").slice(0, 40); if (BANNED.test(c) || (window.MiniScene && !window.MiniScene.safe(c))) c = ""; j.caption = c; return j; } catch (_) { return null; } }
    function choose() { var A = window.MiniApp; if (A && A.hasMind && A.hasMind() && A.bubble) {
        var sys = "You design a tiny circular emblem for Mini Alpha's badge. Reply with JSON only.", u = 'Pick one motif from ' + JSON.stringify(MOTIFS) + ' and an accent from ["gold","ember","silver","steel","red"]. Format: {"motif":"...","accent":"...","caption":"two kind words"}';
        return Promise.race([A.bubble(sys, u, { max: 50, temp: 0.9 }), new Promise(function (r) { setTimeout(function () { r(null); }, 8000); })]).then(pickJSON).catch(function () { return null; }); }
      return Promise.resolve(null); }
    function render(sp) { var S = window.MiniScene; if (!S || !S.plan) return null; var pl = S.plan(sp.motif, { accent: ACC[sp.accent] || ACC.gold, caption: sp.caption || sp.motif });
      if (!pl || !pl.ops || pl.key === "kind" && sp.motif !== "faith") { /* filter tripped: still a calm picture */ }
      var N = 256, cv = document.createElement("canvas"); cv.width = cv.height = N; var g = cv.getContext("2d"), k = N / 1024;
      var bg = g.createRadialGradient(N / 2, N / 2, 8, N / 2, N / 2, N / 2); bg.addColorStop(0, "#1a2c4a"); bg.addColorStop(1, "#0b1a33"); g.fillStyle = bg; g.beginPath(); g.arc(N / 2, N / 2, N / 2, 0, 7); g.fill();
      g.save(); g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 4, 0, 7); g.clip(); g.lineCap = g.lineJoin = "round";
      (pl.ops || []).forEach(function (o) { if (!o || !o.points || o.points.length < 1) return; var col = String(o.color || "#d4a63a"); if (/^#(000|111|0{6}|1{6})/i.test(col)) col = "#0b1a33";
        g.strokeStyle = col; g.lineWidth = Math.max(1, (o.size || 6) * k * 1.4); g.shadowBlur = o.tool === "glow" ? 10 : 0; g.shadowColor = col; g.globalAlpha = o.tool === "glow" ? .85 : 1;
        g.beginPath(); g.moveTo(o.points[0][0] * k, o.points[0][1] * k); for (var i = 1; i < o.points.length; i++) g.lineTo(o.points[i][0] * k, o.points[i][1] * k); if (o.points.length === 1) g.lineTo(o.points[0][0] * k + .1, o.points[0][1] * k); g.stroke(); });
      g.restore(); g.globalAlpha = 1; g.shadowBlur = 8; g.shadowColor = "#8ce0ff"; g.strokeStyle = "rgba(140,224,255,.75)"; g.lineWidth = 3; g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 6, 0, 7); g.stroke(); // ice rim
      return cv.toDataURL("image/png"); }
    function show() { [].forEach.call(document.querySelectorAll(".mav-ring"), function (r) { var im = r.querySelector(".mw-badge-art"); if (!url) { if (im) im.remove(); return; } if (!im) { im = document.createElement("img"); im.className = "mw-badge-art"; im.alt = "Mini's badge"; r.appendChild(im); } if (im.src !== url) im.src = url; }); }
    function redraw(force) { if (busy) return; if (url && !force) { show(); return; } busy = true;
      choose().then(function (sp) { if (!sp) { var R0 = rng(Date.now() & 0x7fffffff); sp = { motif: MOTIFS[Math.floor(R0() * MOTIFS.length)], accent: Object.keys(ACC)[Math.floor(R0() * 5)], caption: "" }; sp.src = "seed"; } else sp.src = "model";
        var d = render(sp); if (d) { url = d; try { localStorage.setItem(KEY, d); localStorage.setItem(KEY + "Spec", JSON.stringify(sp)); } catch (_) {} show(); } }).finally(function () { busy = false; }); }
    return { attach: function () { if (url) show(); else setTimeout(function () { redraw(false); }, 600); }, redraw: redraw, show: show }; })();
  window.MiniBadge = Badge;
  /* Alpha badge (#ring) = summon control: tap = Cadu out, tap again = swap to Nir (when ready; otherwise toggles Cadu); long-press = put away. */
  (function badge() { var SEL = ".mav-ring, #ring", lp = null, longDone = false, tapped = false, cur = null;
    function el(e) { return e.target && e.target.closest ? e.target.closest(SEL) : null; }
    function pulse(r) { if (!r) return; r.classList.remove("mw-pulse"); void r.offsetWidth; r.classList.add("mw-pulse"); setTimeout(function () { r.classList.remove("mw-pulse"); }, 700); }
    function vis(id) { return !!(live[id] && live[id].isOn()); }
    function away(r, ev) { longDone = true; pulse(r); menu(r, ev); }
    function tap(r) { pulse(r);
      var c = vis("cadu"), n = vis("nir");
      if (!REG.nir.ready) { setWho(c ? "off" : "cadu"); return; }
      if (!c && !n) setWho("both"); else if (c && n) setWho("cadu"); else if (c) setWho("nir"); else setWho("both"); }
    window.MiniWalkerSummon = function () { var any = false; for (var k in live) if (vis(k)) { any = true; var a = live[k], b = a.body(); a.fling((innerWidth / 2 - b.x) * 2.2, (innerHeight / 2 - b.y) * 2.2 - 300); } if (!any) setWho(REG.nir.ready ? "both" : "cadu"); };
    function mark() { [].forEach.call(document.querySelectorAll(SEL), function (r) { Badge.attach(r); if (r.dataset.mwBadge) return; r.dataset.mwBadge = "1"; r.style.cursor = "pointer"; r.setAttribute("role", "button"); r.setAttribute("tabindex", "0"); r.setAttribute("aria-label", "Summon helix sprite (hold or right-click to put away)"); }); }
    /* badge menu: Redraw badge / Put pets away */
    var mnu = null; function closeMenu() { if (mnu) { mnu.remove(); mnu = null; } }
    function menu(r, ev) { closeMenu(); var b = r.getBoundingClientRect(); mnu = document.createElement("div"); mnu.className = "mw-menu"; mnu.setAttribute("role", "menu");
      mnu.innerHTML = '<button role="menuitem" data-m="redraw">Redraw badge</button><button role="menuitem" data-m="away">Put sprites away</button>';
      var x = ev && ev.clientX ? ev.clientX : b.left + b.width / 2, y = ev && ev.clientY ? ev.clientY : b.bottom;
      mnu.style.left = Math.max(8, Math.min(innerWidth - 180, x - 80)) + "px"; mnu.style.top = Math.max(8, Math.min(innerHeight - 100, y + 8)) + "px"; document.body.appendChild(mnu);
      mnu.addEventListener("pointerup", function (e) { e.stopPropagation(); }); mnu.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      mnu.addEventListener("click", function (e) { var t = e.target.closest("button"); if (!t) return; e.stopPropagation(); if (t.dataset.m === "away") setWho("off"); else Badge.redraw(true); closeMenu(); });
      setTimeout(function () { document.addEventListener("pointerdown", function once(e) { if (mnu && !mnu.contains(e.target)) { closeMenu(); } document.removeEventListener("pointerdown", once, true); }, true); }, 0); }
    mark(); new MutationObserver(mark).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointerdown", function (e) { var r = el(e); if (!r || e.button === 2) return; cur = r; longDone = false; clearTimeout(lp); lp = setTimeout(function () { away(r, e); }, 650); });
    document.addEventListener("pointerup", function (e) { if (!cur) return; var r = cur; cur = null; clearTimeout(lp); if (longDone || e.button === 2 || el(e) !== r) return; tap(r); });
    document.addEventListener("pointercancel", function () { cur = null; clearTimeout(lp); });
    document.addEventListener("click", function (e) { if (!el(e) || tapped) return; tapped = true; try { live.cadu && live.cadu.enableTilt && live.cadu.enableTilt(); } catch (_) {} }); // iOS: permission only from click
    document.addEventListener("contextmenu", function (e) { var r = el(e); if (!r) return; e.preventDefault(); clearTimeout(lp); cur = null; if (!longDone) away(r, e); });
    document.addEventListener("keydown", function (e) { var r = el(e); if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); tap(r); } }); })();
  window.MiniWalkerWho = setWho; window.MiniWalkers = live;
  if (!window.MW_LINES && !MWC.ns) fetch("/pets/lines.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (!j || window.MW_LINES) return; var B = (j._banned || []).map(function (w) { return w.toLowerCase(); });
      function ok(t) { var lw = String(t).toLowerCase(); return t.split(/\s+/).length <= 13 && !B.some(function (b) { return b.indexOf(" ") > 0 ? lw.indexOf(b) >= 0 : new RegExp("\\b" + b + "s?\\b").test(lw); }); }
      ["cadu", "nir"].forEach(function (p) { var o = j[p] || {}; Object.keys(o).forEach(function (g) { if (Array.isArray(o[g])) o[g] = o[g].filter(ok); else if (o[g] && typeof o[g] === "object") Object.keys(o[g]).forEach(function (k) { o[g][k] = (o[g][k] || []).filter(ok); }); }); });
      window.MW_LINES = j; }).catch(function () {});
  /* ---------- context, social life, UI avoidance ---------- */
  function onPets() { return Object.keys(live).map(function (k) { return live[k]; }).filter(function (p) { return p && p.body && p.body().on; }); }
  var lastUser = performance.now(), lastDuelT = 0; ["pointerdown", "keydown", "scroll", "wheel"].forEach(function (t) { addEventListener(t, function () { lastUser = performance.now(); }, { passive: true, capture: true }); });
  document.addEventListener("mw-duel", function () { lastDuelT = performance.now(); });
  window.MiniWalkerMood = function () { var now = performance.now(), P = onPets(); if (!P.length) return "sleep";
    try { if (window.MiniDance && window.MiniDance.state().dancing) return "music"; } catch (_) {} if (MODE === "music") return "music";
    if (now - lastDuelT < 8000) return "duel"; if (document.querySelector(".mw-say.on")) return "chatty";
    var e = 0; P.forEach(function (p) { e += (p.mood && p.mood.energy) || 50; }); if (e / P.length < 25 || now - lastUser > 90000) return "sleep";
    if (window.MiniWalkerMode && window.MiniWalkerMode() === "juke") return "juke"; return "calm"; };
  var CTX = window.MiniWalkerCtx = { act: function (energy) { var now = performance.now();
      try { if (window.MiniDance && window.MiniDance.state().dancing) return "music"; } catch (_) {}
      if (now - lastDuelT < 20000) return "duel"; if (energy < 25 || now - lastUser > 90000) return "sleep";
      if (Math.random() < .4 && CTX.place()) return "ctx"; return "idle"; },
    place: function () { var b = document.body; if (!b) return ""; if (/^\/mini-alpha\//.test(location.pathname)) return "mini"; var wq = (location.search.match(/[?&]world=([a-z0-9-]+)/i) || [])[1]; if (wq) return wq.toLowerCase(); var sc = b.dataset.scene; if (sc) return sc === "telephantim" ? "relics" : sc;
      var a = document.querySelector(".pane.active,[id^=pane-].active"); if (a) return (a.id || "").replace("pane-", ""); var p = location.pathname.replace(/\/(index\.html)?$/, "").split("/").pop(); return (p || "home").replace(/\.html$/, ""); } };
  /* banter + chase: when both are out */
  var lastBanter = performance.now(), lastChase = performance.now();
  setInterval(function () { if (document.hidden) return; var a = live.cadu, b = live.nir; if (!a || !b || !a.body || !b.body) return; var A = a.body(), B = b.body(); if (!A.on || !B.on) return; var now = performance.now(), d = Math.hypot(A.x - B.x, A.y - B.y);
    if (d < Math.max(A.sz, B.sz) * 3.2 && now - lastBanter > 28000 && Math.random() < .45) { lastBanter = now; var first = Math.random() < .5 ? a : b, second = first === a ? b : a; first.say("banter"); setTimeout(function () { second.say("banter"); }, 2200); }
    if (window.MiniWalkerMode && window.MiniWalkerMode() !== "juke" && now - lastChase > 35000 && Math.random() < .25) { lastChase = now; var ch = Math.random() < .5 ? a : b; ch.chase(ch === a ? b : a, 3500 + Math.random() * 2500); } }, 1500);
  /* react to scroll / tab change / coming to the page again */
  var lastReact = 0; function react(act) { var now = performance.now(); if (now - lastReact < 20000) return; var p = onPets(); if (!p.length) return; lastReact = now; p[Math.floor(Math.random() * p.length)].say(act); }
  var sy0 = scrollY; addEventListener("scroll", function () { if (Math.abs(scrollY - sy0) > 600) { sy0 = scrollY; react("scroll"); } }, { passive: true });
  var hidAt = 0; document.addEventListener("visibilitychange", function () { if (document.hidden) hidAt = Date.now(); else if (Date.now() - hidAt > 15000) react("greet"); });
  var place0 = ""; setInterval(function () { var pl = CTX.place(); if (place0 && pl !== place0) react("ctx"); place0 = pl; }, 1200);
  /* keep off buttons, links, fields, players and small text blocks */
  var RB = []; window.__mwFree = function (B, sz) { var best = null, bs = -1; for (var i = 0; i < 40; i++) { var x = B.l + Math.random() * (B.r - B.l), y = B.t + Math.random() * (B.b - B.t); if (window.__mwBusy(x, y, sz, 0)) continue; var sc = Math.random(); if (sc > bs) { bs = sc; best = [x, y]; } if (best && i > 8) break; } return best; };
  window.__mwBusy = function (x, y, sz, padK) { var pad = sz * (padK == null ? .15 : padK); for (var i = 0; i < RB.length; i++) { var r = RB[i]; if (x + pad < r.right && x + sz - pad > r.left && y + pad < r.bottom && y + sz - pad > r.top) return true; } return false; };
  var AVOID = "button,a[href],input,textarea,select,[role=button],nav,video,iframe,label,h1,h2,h3,.btn-chip";
  setInterval(function () { if (document.hidden) return; var P = onPets(); if (!P.length) return; var W = innerWidth, H = innerHeight, els = document.querySelectorAll(AVOID), R0 = [];
    for (var i = 0; i < els.length && R0.length < 120; i++) { var e = els[i]; if (e.closest && e.closest(".mw-walker,.mw-say,.mw-menu,.mav-ring,#ring")) continue; var r = e.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > H || r.width * r.height > W * H * .18) continue; R0.push(r); }
    RB = R0;
    P.forEach(function (p) { if (p.dragging()) return; var b = p.body(), pad = b.sz * .15, cx = b.x + b.sz / 2, cy = b.y + b.sz / 2;
      for (var j = 0; j < R0.length; j++) { var r = R0[j]; if (b.x + pad < r.right && b.x + b.sz - pad > r.left && b.y + pad < r.bottom && b.y + b.sz - pad > r.top) {
          var dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2), dd = Math.hypot(dx, dy) || 1; p.nudge(dx / dd * 320, dy / dd * 320); break; } } }); }, 400);
  try { if (localStorage.getItem(NS + "miniPetPrefV") !== "2") { localStorage.setItem(WHO, "both"); localStorage.setItem(NS + "miniPetPrefV", "2"); } } catch (_) {}
  var who = "cadu"; try { who = localStorage.getItem("pets_who") || localStorage.getItem(WHO) || MWC.who || "both"; } catch (_) {}
  var qs = Q.get("sprite"), force = Q.get("cadu") === "1" || !!qs; if (qs) who = qs === "both" ? "both" : qs; if (Q.get("cadu") === "1" && who === "off") who = "cadu";
  live.cadu = makePet(REG.cadu); // primary always built (settings, tilt); hidden when not picked
  if (force && live.cadu && want(who).indexOf("cadu") >= 0) live.cadu.setMode("on");
  if (want(who).indexOf("cadu") < 0 && live.cadu) live.cadu.setMode("closed");
  setWho(who, !force); refreshPicker();
  if (REG.nir.enabled || Q.get("nirpreview") === "1") fetch(REG.nir.base + "states.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { if (!j || !j.states) return; REG.nir.ready = true; refreshPicker();
    var w = who; try { w = localStorage.getItem("pets_who") || localStorage.getItem(WHO) || who; } catch (_) {} if (qs) w = qs === "both" ? "both" : qs; if (w === "nir" || w === "both") { setWho(w, false); if (w === "nir" && live.cadu) live.cadu.setMode("closed"); } }).catch(function () {});
})();
