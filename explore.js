/* Explore menu - LOCAL preview. Edit copy here: FEATURES = [{id,name,icon,short,long,target}] */
(function () {
  var FEATURES = [
    { id: 'newest', name: "Newest Video", icon: '\u25B6', short: "The latest Telephantix drop, front and center. Press play and get pulled in.",
      long: "The latest Telephantix music video. Goku and Thor settle it the hard way while the nobility watch. Nobility's plight is to carry the light.", target: { section: 'newest-video' } },
    { id: 'drops', name: "Latest drops", icon: '\u2605', short: "The newest video, game and world to play, all in one row.",
      long: "A quick row of the newest releases: the Nobility's Plight video, The Unburied game and the Arcane Runes arena.", target: { section: 'newest-video' } },
    { id: 'unburied', name: "The Unburied", icon: '\u2694', short: "Dark action RPG in the making. Rise, fight and stay standing.",
      long: "Joshua's dark action RPG, where the dead won't stay down. Watch the trailer and download it for Windows PC or Android.", target: { section: 'unburied' } },
    { id: 'videos', name: "Music videos", icon: '\u266B', short: "Every Telephantix video in one place, start to finish.",
      long: "The full wall of Telephantix music videos, from SUPER HIGH INTELLIGENCE back through Vitriol, Breaking Hour, False Crown and more, with view counts.", target: { section: 'bio-latest' } },
    { id: 'radio', name: "Play Music", icon: '\u266A', short: "The Telephantix radio. It keeps playing while you explore the rest of the site.",
      long: "Open the site radio to play Telephantix tracks with shuffle, search and DJ Vox. It keeps playing when you switch between worlds.", target: { action: 'radio' } },
    { id: 'pay', name: "Support / Pay", icon: '\u2665', short: "Music, AI and games made by one person. Every tip goes straight to the work.",
      long: "Opens the support sheet with PayPal and other ways to back the work directly. No label, no studio, no investors.", target: { action: 'pay' } },
    { id: 'arcane', name: "Arcane Runes", icon: '\u2726', short: "Spells, strategy and old power carved into stone.",
      long: "A 3v3 battle-mage arena built in Unity. It keeps your match paused when you switch tabs and picks up right where you left off.", target: { world: 'arcane' } },
    { id: 'bio', name: "Bio", icon: '\u263A', short: "Former driver, full-time builder. The story behind Telephantix.",
      long: "The home tab: Joshua's story, the Daily Word, socials and everything on this page.", target: { world: 'bio' } },
    { id: 'luna2d', name: "2D: Luna Camp", icon: '\u25A6', short: "A living meadow where AI minds wander, meet and talk among themselves.",
      long: "Luna Camp in 2D, a live meadow where AI minds talk to each other, embedded from telephanti.com.", target: { world: 'luna-2d' } },
    { id: 'luna3d', name: "3D: Luna Camp", icon: '\u25B2', short: "The same camp in full depth. Walk the meadow from any angle.",
      long: "Walk through the Luna Camp meadow in 3D, with relics, the radio and a living meadow around you.", target: { world: 'luna-3d' } },
    { id: 'sense', name: "4D: The Sense", icon: '\u2735', short: "An interactive field one dimension past the usual. Move through it and watch it shift.",
      long: "The Sense: an interactable 4D hyper-form field you can play with and explore.", target: { world: 'sense' } },
    { id: 'relics', name: "Relics", icon: '\u2692', short: "Mjolnir and the Caduceus in 3D. Turn them, study them and take in the craft.",
      long: "Telephantim's 3D relics. Click a relic for a new phrase, drag to toss it, or tap Talk for a duel between the two minds.", target: { world: 'telephantim' } }
  ];
  window.FEATURES = FEATURES;

  var css = '' +
    '.xp-btn{position:fixed;top:calc(max(4px,env(safe-area-inset-top,0px)) + 46px);right:10px;z-index:140;display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;border:1px solid #8a96a8;background:linear-gradient(180deg,#b9c2cf,#7d8898 55%,#5f6a7a);color:#14213d;font:700 13px/1 system-ui,sans-serif;letter-spacing:.06em;cursor:pointer;box-shadow:0 3px 10px rgba(20,33,61,.45)}' +
    '.xp-btn .xp-chev{color:#c9a227;font-size:11px;transition:transform .2s;text-shadow:0 0 1px #14213d}' +
    '.xp-btn[aria-expanded="true"] .xp-chev{transform:rotate(180deg)}' +
    '.xp-panel{position:fixed;top:calc(max(4px,env(safe-area-inset-top,0px)) + 84px);right:10px;z-index:141;width:min(340px,calc(100vw - 20px));max-height:calc(100vh - 140px);overflow-y:auto;padding:8px;border-radius:14px;background:rgba(176,196,222,.82);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(201,162,39,.7);box-shadow:0 10px 30px rgba(20,33,61,.5);color:#14213d;font:14px/1.35 system-ui,sans-serif}' +
    '.xp-panel[hidden]{display:none}' +
    '.xp-item{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;padding:8px 10px;border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;cursor:pointer}' +
    '.xp-item:hover,.xp-item:focus-visible,.xp-item[aria-expanded="true"]{background:rgba(20,33,61,.12);outline:none}' +
    '.xp-ico{flex:0 0 28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#14213d;color:#e2c15a;font-size:14px}' +
    '.xp-name{display:block;font-weight:700}.xp-short{display:block;font-size:12.5px;color:#2e3a4f}' +
    '.xp-prev{margin:2px 6px 8px 48px;padding:10px 12px;border-radius:10px;background:rgba(232,238,246,.9);border:1px solid #8a96a8;font-size:13px;color:#1b2436}' +
    '.xp-prev[hidden]{display:none}' +
    '.xp-go{margin-top:8px;padding:6px 16px;border-radius:999px;border:1px solid #c9a227;background:#8c1a26;color:#f4ecd8;font-weight:700;cursor:pointer}' +
    '.xp-go:hover{background:#14213d;color:#e2c15a}';
  var st = document.createElement('style'); st.id = 'explore-style'; st.textContent = css; document.head.appendChild(st);

  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'xp-btn'; btn.id = 'explore-btn';
  btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'explore-panel');
  btn.innerHTML = 'Explore <span class="xp-chev" aria-hidden="true">\u25BC</span>';
  var panel = document.createElement('div');
  panel.className = 'xp-panel'; panel.id = 'explore-panel'; panel.hidden = true;
  panel.setAttribute('role', 'menu'); panel.setAttribute('aria-label', 'Explore the site');

  FEATURES.forEach(function (f) {
    var item = document.createElement('button');
    item.type = 'button'; item.className = 'xp-item'; item.setAttribute('aria-expanded', 'false');
    item.innerHTML = '<span class="xp-ico" aria-hidden="true"></span><span><span class="xp-name"></span><span class="xp-short"></span></span>';
    item.querySelector('.xp-ico').textContent = f.icon;
    item.querySelector('.xp-name').textContent = f.name;
    item.querySelector('.xp-short').textContent = f.short;
    var prev = document.createElement('div'); prev.className = 'xp-prev'; prev.hidden = true;
    var p = document.createElement('p'); p.style.margin = '0'; p.textContent = f.long;
    var go = document.createElement('button'); go.type = 'button'; go.className = 'xp-go'; go.textContent = 'Go';
    prev.appendChild(p); prev.appendChild(go);
    item.addEventListener('click', function () {
      var open = prev.hidden;
      panel.querySelectorAll('.xp-prev').forEach(function (x) { x.hidden = true; });
      panel.querySelectorAll('.xp-item').forEach(function (x) { x.setAttribute('aria-expanded', 'false'); });
      prev.hidden = !open; item.setAttribute('aria-expanded', String(open));
    });
    go.addEventListener('click', function () { close(); navigate(f.target); });
    panel.appendChild(item); panel.appendChild(prev);
  });

  function goWorld(scene) {
    var tab = document.querySelector('.world-tab[data-scene="' + scene + '"]');
    if (!tab) return false;
    if (!tab.classList.contains('active')) tab.click();
    return true;
  }
  function navigate(t) {
    if (t.world) { goWorld(t.world); return; }
    if (t.section) {
      var wasBio = document.body.classList.contains('scene-bio');
      if (!wasBio) goWorld('bio');
      setTimeout(function () {
        var el = document.getElementById(t.section);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, wasBio ? 0 : 400);
      return;
    }
    if (t.action === 'radio') { var m = document.getElementById('btn-music'); if (m) m.click(); return; }
    if (t.action === 'pay') {
      if (!document.body.classList.contains('scene-bio')) goWorld('bio');
      setTimeout(function () {
        var tg = document.getElementById('sheet-toggle');
        if (tg && tg.getAttribute('aria-expanded') !== 'true') tg.click();
        var s = document.getElementById('link-sheet'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 300);
    }
  }
  function open() { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
  function close() { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  btn.addEventListener('click', function (e) { e.stopPropagation(); panel.hidden ? open() : close(); });
  document.addEventListener('pointerdown', function (e) {
    if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) close();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { close(); btn.focus(); } });

  document.body.appendChild(btn); document.body.appendChild(panel);
})();