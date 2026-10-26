/* Mini Alpha dance mode: companion + pets dance while media plays (beat from WebAudio when possible).
   No microphone is ever used. */
(function () {
  "use strict";
  var LOG = []; var RM = matchMedia("(prefers-reduced-motion: reduce)").matches, DBG = /[?&]debug=1/.test(location.search);
  var playing = new Set(), ctx = null, an = null, buf = null, srcs = new WeakMap(), mic = null;
  var onsets = [], lastOn = 0, avg = 0, bpm = 112, phase = 0, lastT = 0, kick = 0, beatLive = false, raf = 0, dancing = false;
  function AC() { if (!ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); an = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0; an.connect(ctx.destination); buf = new Uint8Array(an.frequencyBinCount); } if (ctx.state === "suspended") ctx.resume().catch(function () {}); return ctx; }
  function tap(el) { if (srcs.has(el)) return; srcs.set(el, 1);
    try { var u = new URL(el.currentSrc || el.src, location.href); if (u.origin !== location.origin && !el.crossOrigin) return; // cross-origin would go silent: leave it alone, use groove
      if (!AC()) return;
      /* never route audio into a suspended context (that plays silence): wait until it is running, otherwise leave the element alone */
      if (ctx.state !== "running") { srcs.delete(el); ctx.resume().then(function () { if (ctx.state === "running" && !el.paused) tap(el); }).catch(function () {}); return; }
      ctx.createMediaElementSource(el).connect(an); } catch (_) {} }
  ["pointerdown", "keydown", "touchend"].forEach(function (t) { addEventListener(t, function () { if (ctx && ctx.state === "suspended") ctx.resume().catch(function () {}); }, true); });
  function audible(el) { return !el.paused && !el.ended && !el.muted && el.volume > 0 && el.readyState > 2; }
  function track(el) { if (!el || el.__mwd) return; el.__mwd = 1;
    ["play", "playing"].forEach(function (t) { el.addEventListener(t, function () { if (audible(el) || !el.muted) { tap(el); playing.add(el); update(); } }); });
    ["pause", "ended", "emptied", "volumechange"].forEach(function (t) { el.addEventListener(t, function () { if (!audible(el) && (el.paused || el.ended || el.muted)) playing.delete(el); else playing.add(el); update(); }); }); }
  var op = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { track(this); return op.apply(this, arguments); };
  document.addEventListener("play", function (e) { if (e.target instanceof HTMLMediaElement) { track(e.target); if (!e.target.muted) { tap(e.target); playing.add(e.target); update(); } } }, true);
  [].forEach.call(document.querySelectorAll("audio,video"), track);
  setInterval(function () { playing.forEach(function (el) { if (el.paused || el.ended) playing.delete(el); }); update(); }, 1000);
  function sessionPlaying() { try { return navigator.mediaSession && navigator.mediaSession.playbackState === "playing"; } catch (_) { return false; } }
  function want() { return playing.size > 0 || sessionPlaying() || !!mic; }
  function update() { var w = want(); if (w && !dancing) start(); else if (!w && dancing) stop(); chip(); }
  /* beat: low-band energy onset + interval tempo */
  function energy(a) { if (!a) return -1; if (!a.__b) a.__b = new Uint8Array(a.frequencyBinCount); var b = a.__b; a.getByteFrequencyData(b); var hz = ctx.sampleRate / a.fftSize, lo = Math.max(1, Math.floor(35 / hz)), hi = Math.max(lo + 1, Math.ceil(160 / hz)), s = 0; for (var i = lo; i <= hi; i++) s += b[i]; return s / (hi - lo + 1); }
  var prevE = 0, IVS = [];
  function tempo(iv) { while (iv > 860) iv /= 2; while (iv < 375) iv *= 2; IVS.push(iv); if (IVS.length > 12) IVS.shift(); var s = IVS.slice().sort(function (a, b) { return a - b; }), m = s[s.length >> 1]; var nb = 60000 / m; bpm = IVS.length < 3 ? bpm * 0.5 + nb * 0.5 : nb; }
  function step(t) { raf = requestAnimationFrame(step); var dt = Math.min(0.1, (t - (lastT || t)) / 1000); lastT = t;
    var e = playing.size ? energy(an) : -1;
    if (e > 2) { var fl = e - prevE; prevE = e; avg = avg * 0.9 + e * 0.1; if (fl > Math.max(10, avg * 0.25) && t - lastOn > 280) { var iv = t - lastOn; lastOn = t; kick = 1; beatLive = true; if (LOG.length > 80) LOG.shift(); LOG.push({ t: t, ct: (function () { var c = -1; playing.forEach(function (el) { c = el.currentTime; }); return c; })(), bpm: Math.round(bpm) });
        if (iv < 3000) tempo(iv); phase = Math.round(phase); } }
    else if (t - lastOn > 2500) beatLive = false;
    phase += dt * bpm / 60; kick *= Math.pow(0.02, dt);
    var p = phase * Math.PI, A = RM ? 0.35 : 1, k = beatLive ? kick : 0.35 + 0.35 * Math.abs(Math.sin(p));
    var bounce = -Math.abs(Math.sin(p)) * 10 * A - k * 4 * A, sway = Math.sin(p / 2) * (RM ? 0 : 9), sq = 1 + k * 0.07 * A;
    var tf = "translateY(" + bounce.toFixed(1) + "px) rotate(" + sway.toFixed(1) + "deg) scale(" + (2 - sq).toFixed(3) + "," + sq.toFixed(3) + ")";
    [].forEach.call(document.querySelectorAll(".mw-icon"), function (el) { el.style.transform = tf; el.style.transformOrigin = "50% 100%"; });
    [].forEach.call(document.querySelectorAll(".mav-ring"), function (r) { var el = r.parentElement; if (!el) return; el.style.transformOrigin = "50% 100%"; el.style.transform = "translateY(" + (bounce * 0.5).toFixed(1) + "px) rotate(" + (sway * 0.6).toFixed(1) + "deg) scale(" + (1 + k * 0.05 * A).toFixed(3) + ")"; });
    if (dbg) dbg.textContent = "dance " + (beatLive ? "beat" : "groove") + " bpm " + bpm.toFixed(0) + " e " + (e | 0) + " avg " + (avg | 0)+ (""); }
  function start() { dancing = true; document.documentElement.classList.add("mw-dancing"); lastT = 0; avg = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(step);
    try { var L = window.MiniWalkers || {}; Object.keys(L).forEach(function (k) { L[k] && L[k].say && L[k].say("music"); }); } catch (_) {} }
  function stop() { dancing = false; beatLive = false; document.documentElement.classList.remove("mw-dancing"); cancelAnimationFrame(raf);
    [].forEach.call(document.querySelectorAll(".mw-icon"), function (el) { el.style.transform = ""; }); [].forEach.call(document.querySelectorAll(".mav-ring"), function (r) { if (r.parentElement) r.parentElement.style.transform = ""; }); }
  /* no microphone: dancing follows only this page's own audio/video elements */
  function chip() {} var dbg = null;
  function mount() { if (DBG) { dbg = document.createElement("div"); dbg.id = "mw-dance-dbg"; document.body.appendChild(dbg); } }
  if (document.body) mount(); else addEventListener("DOMContentLoaded", mount);
  window.MiniDance = { log: LOG, state: function () { return { dancing: dancing, beat: beatLive, bpm: Math.round(bpm), mic: !!mic, media: playing.size, session: sessionPlaying() }; }, update: update };
})();
