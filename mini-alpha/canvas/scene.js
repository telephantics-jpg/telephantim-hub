/* Mini Alpha scene drawer (Hephaestus): topic -> calm, palette-only picture, drawn stroke by stroke.
   window.MiniScene.plan(text, spec?) -> {key, caption, ops}; MiniScene.safe(text) -> bool. Offline + deterministic. */
(function (g) {
  var C = { navy: "#0b1a33", navy2: "#1a2c4a", gun: "#2e3640", steel: "#5b6672", silver: "#9aa5b1", light: "#d8dee4", gold: "#d4a63a", gold2: "#f4d782", ember: "#e07a1f", red: "#b32020", deep: "#7a1414" };
  var COLORS = Object.keys(C).map(function (k) { return C[k]; });
  var HARM = /\b(kill(s|ed|ing)?|murder\w*|slaughter\w*|tortur\w*|gore|gory|blood(y|shed)?|behead\w*|dismember\w*|mutilat\w*|massacre\w*|stab(s|bed|bing)?|shoot(ing|s)?|shot (him|her|them)|gun(s|man)?|rifle|bomb\w*|explosive|terror\w*|weapon\w*|knife|abus\w*|rape\w*|molest\w*|assault\w*|beat(ing)? (up|him|her)|choke|strangl\w*|hang (my|him|her)self|suicid\w*|self[- ]?harm|cut(ting)? myself|kill myself|overdose|hate (crime|speech)|nazi\w*|genocide|lynch\w*|slur|racis\w*|nude|naked|porn\w*|sex\w*|nsfw|cruel\w*|animal cruelty|hurt (him|her|them|animals?|people)|torment\w*|maim\w*|corpse|dead bod(y|ies))\b/i;
  function safe(t) { return !HARM.test(String(t || "")); }
  var KEYS = [
    ["music", /music|song|beat|bass|drum|melod|chord|sound|rhythm|lyric|sing|tune|guitar|piano/],
    ["space", /star|space|night|moon|sky|galax|cosmos|planet|dream|orbit/],
    ["sea", /sea|ocean|wave|water|river|tide|rain|shore|lake/],
    ["tree", /tree|forest|wood|leaf|leaves|garden|grow|root|nature|plant/],
    ["city", /city|town|street|build(ing)?s?\b|tower|skyline|urban/],
    ["energy", /fire|energy|power|ember|spark|heat|burn|strength|strong|force/],
    ["mind", /mind|idea|think|thought|brain|wisdom|wise|learn|genius|insight|question|why/],
    ["love", /love|kind|heart|care|friend|family|hug|grace|gentle|thank/],
    ["tech", /machine|tech|code|gear|engine|robot|circuit|computer|chip|ai\b|build|fix|server|app/],
    ["faith", /faith|spirit|god|creator|pray|soul|holy|heal|cross|church|bless|caduceus|jesus|christ/]
  ];
  function seedOf(t) { var h = 7; for (var i = 0; i < t.length; i++) h = (h * 33 + t.charCodeAt(i)) >>> 0; return h || 1; }
  function rng(s) { return function () { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; }; }
  var STOP = /^(the|a|an|and|or|but|of|to|in|on|at|for|with|is|are|was|be|it|this|that|i|you|your|me|my|we|our|so|just|like|what|how|about|from|as|by|not|no|do|can|will|have|has|its|it's|i'm|im|let's|lets|mini|joshua)$/;
  function caption(t, key, ban) {
    var w = String(t).toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(function (x) { return x.length > 2 && !STOP.test(x) && !(ban && ban(x)); });
    var out = []; w.forEach(function (x) { if (out.indexOf(x) < 0 && out.length < 3) out.push(x); });
    return (out.length ? out.join(" · ") : key).slice(0, 40);
  }
  function S(points, color, size, tool) { return { tool: tool || "pen", color: color, size: size, points: points }; }
  function circle(cx, cy, r, n, a0, a1) { var p = []; n = n || 40; a0 = a0 || 0; a1 = a1 == null ? Math.PI * 2 : a1; for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; }
  function stars(R, ops, n) { for (var i = 0; i < n; i++) { var x = 60 + R() * 900, y = 60 + R() * 520; ops.push(S([[x, y], [x + 2, y + 2]], R() < .3 ? C.gold2 : C.light, 4 + R() * 6, "glow")); } }
  function caduceus(ops, cx, top, bot) {
    ops.push(S([[cx, top], [cx, bot]], C.silver, 10));
    ops.push(S([[cx - 70, top + 70], [cx + 70, top + 70]], C.silver, 10)); // cross bar
    ops.push(S(circle(cx, top + 70, 34, 30), C.gold, 22, "glow"));
    var a = [], b = []; for (var y = top + 130; y <= bot - 20; y += 8) { var k = (y - top) / 60; a.push([cx + Math.sin(k) * 50, y]); b.push([cx - Math.sin(k) * 50, y]); }
    ops.push(S(a, C.gold, 9)); ops.push(S(b, C.ember, 9));
  }
  var SCENES = {
    music: function (R, o) { var y0 = 520; for (var L = 0; L < 3; L++) { var p = []; for (var x = 60; x <= 964; x += 16) p.push([x, y0 + L * 60 + Math.sin(x / 70 + L) * (90 - L * 25) * Math.sin(x / 1024 * Math.PI)]); o.push(S(p, L ? C.silver : C.gold, L ? 5 : 20, L ? "pen" : "glow")); }
      for (var i = 0; i < 4; i++) { var nx = 180 + i * 190, ny = 250 + R() * 120; o.push(S(circle(nx, ny, 22, 20), C.gold2, 14)); o.push(S([[nx + 22, ny], [nx + 22, ny - 120]], C.light, 7)); }
      o.push({ stamp: "waveform-bars", x: 512, y: 880, scale: 1 }); },
    space: function (R, o) { stars(R, o, 28); o.push(S(circle(720, 260, 110, 50, -1.9, 1.9), C.gold2, 26, "glow")); o.push(S(circle(690, 260, 95, 50, -1.6, 1.6), C.navy2, 30)); o.push({ stamp: "star-cluster", x: 260, y: 720, scale: 1.1 }); },
    sea: function (R, o) { stars(R, o, 10); for (var L = 0; L < 5; L++) { var p = []; for (var x = 40; x <= 984; x += 16) p.push([x, 560 + L * 85 + Math.sin(x / 90 + L * 1.3) * 28]); o.push(S(p, [C.light, C.silver, C.steel, C.gold, C.steel][L], 8 + L * 2)); } o.push(S(circle(512, 420, 70, 40, Math.PI, Math.PI * 2), C.gold, 24, "glow")); },
    tree: function (R, o) { o.push(S([[40, 880], [984, 880]], C.steel, 10)); for (var i = 0; i < 5; i++) { var x = 140 + i * 185 + R() * 30, h = 260 + R() * 200; o.push(S([[x, 880], [x, 880 - h * .4]], C.silver, 14)); o.push(S([[x - 90, 880 - h * .35], [x, 880 - h], [x + 90, 880 - h * .35], [x - 90, 880 - h * .35]], i % 2 ? C.gold : C.light, 9)); } stars(R, o, 6); },
    city: function (R, o) { stars(R, o, 12); var x = 60; while (x < 940) { var w = 70 + R() * 70, h = 180 + R() * 380; o.push(S([[x, 900], [x, 900 - h], [x + w, 900 - h], [x + w, 900]], C.silver, 8)); for (var k = 0; k < 3; k++) { var wy = 900 - h + 40 + k * 60; if (wy < 870) o.push(S([[x + 20, wy], [x + 24, wy + 2]], C.gold2, 10, "glow")); } x += w + 14; } o.push(S([[40, 900], [984, 900]], C.steel, 10)); },
    energy: function (R, o) { o.push({ stamp: "ember-glow", x: 512, y: 512, scale: 1.6 }); for (var i = 0; i < 16; i++) { var a = i / 16 * Math.PI * 2; o.push(S([[512 + Math.cos(a) * 140, 512 + Math.sin(a) * 140], [512 + Math.cos(a) * (260 + R() * 160), 512 + Math.sin(a) * (260 + R() * 160)]], i % 2 ? C.ember : C.gold, i % 2 ? 10 : 6, i % 2 ? "glow" : "pen")); } o.push(S(circle(512, 512, 120, 50), C.gold2, 12)); },
    mind: function (R, o) { o.push(S(circle(512, 420, 180, 60, Math.PI * .75, Math.PI * 2.25), C.gold, 26, "glow")); o.push(S(circle(512, 420, 180, 60, Math.PI * .75, Math.PI * 2.25), C.light, 8)); for (var k = 0; k < 3; k++) o.push(S([[440, 600 + k * 40], [584, 600 + k * 40]], C.silver, 12)); o.push(S([[470, 420], [500, 360], [524, 460], [554, 380]], C.ember, 8)); o.push({ stamp: "fractal-shard", x: 820, y: 800, scale: .8 }); o.push({ stamp: "fractal-shard", x: 200, y: 800, scale: .7 }); },
    love: function (R, o) { var p = []; for (var i = 0; i <= 80; i++) { var t = i / 80 * Math.PI * 2; p.push([512 + 16 * Math.pow(Math.sin(t), 3) * 18, 470 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 18]); } o.push(S(p, C.red, 30, "glow")); o.push(S(p, C.gold, 9)); stars(R, o, 10); },
    tech: function (R, o) { o.push({ stamp: "gear", x: 360, y: 420, scale: 1.4 }); o.push({ stamp: "gear", x: 640, y: 560, scale: 1 }); o.push({ stamp: "chip", x: 760, y: 260, scale: .9 }); for (var i = 0; i < 5; i++) { var y = 720 + i * 45; o.push(S([[60, y], [300 + R() * 200, y], [360 + R() * 200, y - 40], [964, y - 40]], i % 2 ? C.gold : C.silver, 6)); } },
    faith: function (R, o) { stars(R, o, 14); caduceus(o, 512, 150, 880); },
    fractal: function (R, o) { var n = 6 + Math.floor(R() * 5); for (var ring = 0; ring < 3; ring++) for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2 + ring * .3, r1 = 80 + ring * 110, p = []; for (var k = 0; k <= 20; k++) { var t = k / 20; p.push([512 + Math.cos(a + Math.sin(t * Math.PI) * .35) * (r1 + t * 110), 512 + Math.sin(a + Math.sin(t * Math.PI) * .35) * (r1 + t * 110)]); } o.push(S(p, [C.gold, C.silver, C.ember][ring], 7 - ring)); } o.push({ stamp: "alpha-mark", x: 512, y: 512, scale: .8 }); }
  };
  function pickKey(t) { for (var i = 0; i < KEYS.length; i++) if (KEYS[i][1].test(t)) return KEYS[i][0]; return "fractal"; }
  // sanitize an optional model spec: {"scene":"...","caption":"...","stamps":[{"s":"gear","x":..,"y":..,"scale":..}],"accent":"#hex"}
  function clean(spec) { if (!spec || typeof spec !== "object") return null; var out = {};
    if (SCENES[spec.scene]) out.scene = spec.scene;
    if (typeof spec.caption === "string") out.caption = spec.caption.replace(/[^\w ' .,·-]/g, "").slice(0, 40);
    var ST = (g.MiniCanvas && g.MiniCanvas.STAMPS) || []; out.stamps = (Array.isArray(spec.stamps) ? spec.stamps : []).slice(0, 4).filter(function (s) { return s && ST.indexOf(s.s) >= 0; }).map(function (s) { return { stamp: s.s, x: Math.max(80, Math.min(944, +s.x || 512)), y: Math.max(80, Math.min(944, +s.y || 512)), scale: Math.max(.3, Math.min(1.8, +s.scale || 1)) }; });
    if (COLORS.indexOf(String(spec.accent || "").toLowerCase()) >= 0) out.accent = spec.accent.toLowerCase(); return out; }
  function plan(text, spec, ban) {
    var t = String(text || "").toLowerCase(), R = rng(seedOf(t)), ops = [];
    if (!safe(t) || (spec && spec.caption && !safe(spec.caption))) { stars(R, ops, 22); caduceus(ops, 512, 170, 860); return { key: "kind", caption: "Let's draw something kinder", ops: ops, kind: true }; }
    var c = clean(spec) || {}, key = c.scene || pickKey(t); SCENES[key](R, ops);
    (c.stamps || []).forEach(function (s) { ops.push(s); });
    if (c.accent) ops.push(S(circle(512, 512, 470, 80), c.accent, 6));
    var cap = c.caption && safe(c.caption) ? c.caption : caption(t, key, ban); if (ban && ban(cap)) cap = key;
    return { key: key, caption: cap, ops: ops };
  }
  g.MiniScene = { plan: plan, safe: safe, clean: clean, scenes: Object.keys(SCENES), colors: C };
})(window);
