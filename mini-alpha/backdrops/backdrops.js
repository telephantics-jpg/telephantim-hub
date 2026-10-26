/* MiniBackdrops — vanilla canvas 2D backdrops for Mini Alpha. No libraries. */
(function (g) {
  'use strict';
  var ACCENTS = { steel: [127,166,214], gold: [212,166,58], ember: [224,104,42], deepred: [143,29,36] };
  var STEEL = [127,166,214];
  var NAMES = ['circuit','stars','waveform','fractal'];
  var FADE = 800, FRAME = 1000 / 30, INTENSITY = 0.32;
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  // deepred is dark on navy; lift it slightly so it still reads at low intensity
  function lineCol(c) { return c === ACCENTS.deepred ? [176,48,54] : c; }
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  /* ---- scenes: each has init(w,h) and draw(ctx,w,h,t,accent,alpha) ---- */
  var scenes = {
    circuit: function () {
      var traces = [], pulses = [], W, H, G;
      return {
        init: function (w, h) {
          W = w; H = h; G = Math.max(22, Math.round(Math.min(w, h) / 14));
          var r = rnd(7), n = Math.round((w * h) / (G * G * 6)); traces = [];
          for (var i = 0; i < n; i++) {
            var x = Math.round(r() * w / G) * G, y = Math.round(r() * h / G) * G, pts = [[x, y]];
            var dir = Math.floor(r() * 4), segs = 2 + Math.floor(r() * 4);
            for (var s = 0; s < segs; s++) {
              var len = (1 + Math.floor(r() * 4)) * G, dx = [1,0,-1,0][dir], dy = [0,1,0,-1][dir];
              if (r() < 0.35) { dx = dx || (r() < .5 ? 1 : -1); dy = dy || (r() < .5 ? 1 : -1); } // 45° jog
              x += dx * len; y += dy * len; pts.push([x, y]);
              dir = (dir + (r() < .5 ? 1 : 3)) % 4;
            }
            var L = 0; for (var k = 1; k < pts.length; k++) L += Math.hypot(pts[k][0]-pts[k-1][0], pts[k][1]-pts[k-1][1]);
            traces.push({ pts: pts, len: L });
          }
          pulses = []; for (var p = 0; p < Math.min(18, traces.length); p++) pulses.push({ t: Math.floor(r() * traces.length), s: r(), v: 0.05 + r() * 0.08 });
        },
        draw: function (c, w, h, t, ac, a) {
          var drift = (t * 0.004) % G;
          c.save(); c.translate(-drift, -drift * 0.5); c.lineWidth = 1.2; c.lineJoin = 'miter';
          for (var i = 0; i < traces.length; i++) {
            var P = traces[i].pts; c.strokeStyle = rgba(STEEL, 0.22 * a); c.beginPath(); c.moveTo(P[0][0], P[0][1]);
            for (var k = 1; k < P.length; k++) c.lineTo(P[k][0], P[k][1]); c.stroke();
            c.fillStyle = rgba(STEEL, 0.3 * a); var e = P[P.length-1]; c.fillRect(e[0]-2, e[1]-2, 4, 4);
            c.strokeRect(P[0][0]-3, P[0][1]-3, 6, 6);
          }
          var col = lineCol(ac); c.lineWidth = 2;
          for (var j = 0; j < pulses.length; j++) {
            var pu = pulses[j], tr = traces[pu.t]; pu.s = (pu.s + pu.v * 0.033) % 1;
            var d = pu.s * tr.len, P2 = tr.pts, acc = 0;
            for (var m = 1; m < P2.length; m++) {
              var sl = Math.hypot(P2[m][0]-P2[m-1][0], P2[m][1]-P2[m-1][1]);
              if (acc + sl >= d) { var f = (d - acc) / sl, x = P2[m-1][0] + (P2[m][0]-P2[m-1][0]) * f, y = P2[m-1][1] + (P2[m][1]-P2[m-1][1]) * f;
                var gr = c.createRadialGradient(x, y, 0, x, y, 14); gr.addColorStop(0, rgba(col, 0.75 * a)); gr.addColorStop(1, rgba(col, 0));
                c.fillStyle = gr; c.fillRect(x-14, y-14, 28, 28); c.fillStyle = rgba(col, 0.9 * a); c.fillRect(x-1.5, y-1.5, 3, 3); break; }
              acc += sl;
            }
          }
          c.restore();
        }
      };
    },
    stars: function () {
      var layers, neb;
      return {
        init: function (w, h) {
          var r = rnd(11); layers = [];
          [[0.004, 1.0, 220], [0.009, 1.4, 90], [0.018, 2.0, 35]].forEach(function (L) {
            var s = []; for (var i = 0; i < L[2] * (w * h) / 300000; i++) s.push([r() * w, r() * h, r()]);
            layers.push({ v: L[0], z: L[1], s: s });
          });
          neb = [[w * .3, h * .35, Math.max(w, h) * .45], [w * .75, h * .7, Math.max(w, h) * .35]];
        },
        draw: function (c, w, h, t, ac, a) {
          for (var n = 0; n < neb.length; n++) { var N = neb[n], ox = Math.sin(t * 0.00005 + n) * 30;
            var gr = c.createRadialGradient(N[0]+ox, N[1], 0, N[0]+ox, N[1], N[2]); gr.addColorStop(0, rgba(STEEL, 0.14 * a)); gr.addColorStop(1, rgba(STEEL, 0));
            c.fillStyle = gr; c.fillRect(0, 0, w, h); }
          var col = lineCol(ac);
          for (var l = 0; l < layers.length; l++) { var L = layers[l], off = t * L.v;
            for (var i = 0; i < L.s.length; i++) { var S = L.s[i], x = (S[0] - off) % w; if (x < 0) x += w;
              var tw = 0.55 + 0.45 * Math.sin(t * 0.0012 + S[2] * 40);
              c.fillStyle = rgba(S[2] > 0.85 ? col : STEEL, (0.4 + 0.3 * l / 2) * tw * a); c.fillRect(x, S[1], L.z, L.z); } }
        }
      };
    },
    waveform: function () {
      return {
        init: function () {},
        draw: function (c, w, h, t, ac, a) {
          var col = lineCol(ac), mid = h * 0.55, step = Math.max(4, w / 160);
          for (var k = 0; k < 5; k++) {
            var amp = h * (0.05 + k * 0.022) * (0.75 + 0.25 * Math.sin(t * 0.0011 + k)), ph = t * (0.0006 + k * 0.00015), fq = 0.006 + k * 0.0025;
            c.beginPath();
            for (var x = 0; x <= w + step; x += step) {
              var env = Math.sin(Math.PI * x / w), y = mid + (k - 2) * h * 0.035 + env * amp * (Math.sin(x * fq + ph) * 0.7 + Math.sin(x * fq * 2.7 - ph * 1.6) * 0.3);
              x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
            }
            c.lineWidth = k === 2 ? 2 : 1.1; c.strokeStyle = rgba(k === 2 || k === 3 ? col : STEEL, (k === 2 ? 0.6 : 0.28) * a); c.stroke();
          }
        }
      };
    },
    fractal: function () {
      function tri(c, x, y, s, d, rot) {
        var p = []; for (var i = 0; i < 3; i++) { var an = rot + i * 2 * Math.PI / 3 - Math.PI / 2; p.push([x + s * Math.cos(an), y + s * Math.sin(an)]); }
        c.moveTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1]); c.lineTo(p[2][0], p[2][1]); c.closePath();
        if (d > 0) for (var j = 0; j < 3; j++) tri(c, (x + p[j][0]) / 2, (y + p[j][1]) / 2, s / 2, d - 1, rot);
      }
      return {
        init: function () {},
        draw: function (c, w, h, t, ac, a) {
          var cx = w / 2, cy = h / 2, R = Math.hypot(w, h) * 0.75, rot = t * 0.00004;
          // triangular lattice
          c.save(); c.translate(cx, cy); c.rotate(rot); c.lineWidth = 1; c.strokeStyle = rgba(STEEL, 0.12 * a);
          var sp = Math.max(40, Math.min(w, h) / 8); c.beginPath();
          for (var k = 0; k < 3; k++) { c.save(); c.rotate(k * Math.PI / 3);
            for (var o = -R; o <= R; o += sp) { c.moveTo(-R, o); c.lineTo(R, o); } c.restore(); }
          c.stroke(); c.restore();
          // Sierpinski triangle, counter-rotating, breathing
          var col = lineCol(ac), s = Math.min(w, h) * (0.42 + 0.02 * Math.sin(t * 0.0008));
          c.lineWidth = 1.3; c.strokeStyle = rgba(col, 0.42 * a); c.beginPath(); tri(c, cx, cy, s, 4, -rot * 2); c.stroke();
          c.strokeStyle = rgba(STEEL, 0.2 * a); c.beginPath(); tri(c, cx, cy, s * 1.6, 2, -rot * 2 + Math.PI); c.stroke();
        }
      };
    }
  };

  function mount(target) {
    var canvas = target;
    if (!(target instanceof HTMLCanvasElement)) {
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:0';
      if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
      target.insertBefore(canvas, target.firstChild);
    }
    var ctx = canvas.getContext('2d'), W = 0, H = 0, dpr = 1;
    var reduced = g.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cur = { name: 'circuit', sc: scenes.circuit() }, prev = null, fadeStart = 0;
    var accent = ACCENTS.steel, raf = 0, last = 0, t0 = performance.now(), stopped = false;

    function resize() {
      dpr = Math.min(2, g.devicePixelRatio || 1);
      var r = canvas.getBoundingClientRect(); W = Math.max(1, r.width || innerWidth); H = Math.max(1, r.height || innerHeight);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      cur.sc.init(W, H); if (prev) prev.sc.init(W, H); render(performance.now());
    }
    function render(now) {
      var t = reduced ? 20000 : now - t0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1a33'); bg.addColorStop(1, '#060e1e');
      ctx.globalAlpha = 1; ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      var f = prev ? Math.min(1, (now - fadeStart) / FADE) : 1;
      if (reduced) f = 1;
      if (prev && f < 1) prev.sc.draw(ctx, W, H, t, accent, INTENSITY / 0.32 * (1 - f));
      cur.sc.draw(ctx, W, H, t, accent, f);
      if (f >= 1) prev = null;
    }
    function loop(now) {
      if (stopped) return; raf = requestAnimationFrame(loop);
      if (now - last < FRAME - 2) return; last = now; render(now);
    }
    function start() { if (!reduced && !raf && !stopped && !document.hidden) raf = requestAnimationFrame(loop); }
    function pause() { cancelAnimationFrame(raf); raf = 0; }
    function onVis() { document.hidden ? pause() : start(); }
    document.addEventListener('visibilitychange', onVis);
    g.addEventListener('resize', resize);
    resize(); start();

    return {
      set: function (name) {
        if (!scenes[name] || name === cur.name) return;
        prev = cur; cur = { name: name, sc: scenes[name]() }; cur.sc.init(W, H); fadeStart = performance.now();
        if (reduced || !raf) render(fadeStart + FADE);
      },
      setAccent: function (name) { if (ACCENTS[name]) { accent = ACCENTS[name]; if (reduced || !raf) render(performance.now()); } },
      /* apply a Mini tag like "backdrop:stars" or "accent:gold" */
      tag: function (s) { var m = /^(backdrop|accent):(\w+)$/.exec(String(s).trim()); if (m) this[m[1] === 'backdrop' ? 'set' : 'setAccent'](m[2]); },
      stop: function () { stopped = true; pause(); document.removeEventListener('visibilitychange', onVis); g.removeEventListener('resize', resize); },
      get current() { return cur.name; }
    };
  }
  g.MiniBackdrops = { mount: mount, names: NAMES, accents: Object.keys(ACCENTS) };
})(window);
