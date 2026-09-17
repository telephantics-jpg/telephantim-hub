/**
 * Voltage Loft — Daylight Rabbit-Hole Viewport
 * config.json · localStorage session + eggs · chat · deeper unlock
 */
(function () {
  "use strict";

  const ASSETS = "assets/";
  const STORAGE_KEY = "voltage-loft-session-v2";
  const BUILD = "v162-rabbit";
  if (window.parent !== window) {
    document.documentElement.classList.add("in-hub");
  }

  const FALLBACK_CONFIG = {
    version: BUILD + "-offline",
    host: "AGENT ALpha",
    navOrder: ["portal", "studio", "lounge", "vip", "balcony", "mirror", "vault", "skywell", "archive", "afterimage"],
    navCore: ["portal", "studio", "lounge", "vip", "balcony"],
    deeperUnlockMessage: "All three soft keys found. Afterimage Hall is open — follow the pale corridor.",
    eggs: {
      required: ["sequence", "passphrase", "hotspot"],
      passphrases: ["white side open", "soft voltage", "daylight key"],
      sequence: ["portal-skyline", "studio-desk", "lounge-peers", "vip-velvet", "balcony-rail"],
      labels: { sequence: "Five-Tap Circuit", passphrase: "Daylight Phrase", hotspot: "Glass Seam" },
      foundReplies: {
        sequence: "That’s the Five-Tap Circuit. One soft key turns. Two remain.",
        passphrase: "Phrase accepted. Daylight knows your voice. Soft key two is yours.",
        hotspot: "You found the Glass Seam. Quiet work. Soft key three — locked in.",
      },
    },
    keywords: [
      { match: ["hello", "hi", "hey"], replies: ["Hey. Voltage Loft’s open in soft daylight — pick a room or ask me anything."] },
      { match: ["help", "what", "how"], replies: ["Hotspots move you. Type to me anytime. Esc backs toward Portal."] },
      { match: ["secret", "egg", "key"], replies: ["Three soft keys: a five-tap circuit, a daylight phrase, and a glass seam."] },
      { match: ["alpha", "who", "you"], replies: ["I’m ALpha — crystalline host on the white side. Session’s yours."] },
    ],
    fallbackReplies: ["Say more — or tap a hotspot. I’m listening.", "Room’s live. Ask about soft keys or deeper rooms."],
    rooms: {
      portal: {
        id: "portal", name: "Portal Gate", bg: "01-pad.png", parent: null, enterCta: true,
        lines: ["Took you long enough. Voltage Loft’s lit in soft daylight. Step through."],
        extra: ["Behind this door: desk, lounge, VIP, balcony — and quieter rooms if you listen."],
        chatHooks: ["Gate’s open. Type if you want a briefing before you step."],
        hotspots: [
          { label: "Step Through", x: 50, y: 48, type: "door", action: { go: "studio" } },
          { id: "portal-skyline", label: "Skyline", x: 28, y: 38, type: "object", action: { say: "City’s already watching in pale light.", eggTap: "portal-skyline" } },
        ],
      },
      studio: {
        id: "studio", name: "Studio Desk", bg: "02-host.png", parent: "portal",
        lines: ["This desk never sleeps. Your seat’s the empty one — claim it."],
        extra: ["Need quiet? Balcony or Skywell. Mirror Annex keeps honest doubles."],
        chatHooks: ["From the desk: ask about rooms or soft keys."],
        hotspots: [
          { id: "studio-desk", label: "Mixing Desk", x: 55, y: 68, type: "object", action: { say: "Sliders remember every night.", eggTap: "studio-desk" } },
          { label: "Lounge →", x: 18, y: 55, type: "door", action: { go: "lounge" } },
          { label: "VIP Wing", x: 82, y: 42, type: "door", action: { go: "vip" } },
          { label: "Balcony", x: 70, y: 28, type: "door", action: { go: "balcony" } },
          { label: "Mirror Annex", x: 40, y: 30, type: "door", action: { go: "mirror" } },
          { label: "Afterimage", x: 88, y: 72, type: "door", requiresEggs: true, action: { go: "afterimage" } },
        ],
      },
      lounge: {
        id: "lounge", name: "Lounge", bg: "05-peers.png", altBg: "03-couch.png", parent: "studio",
        lines: ["Peers are loud on purpose. Grab a pour from Clerk."],
        extra: ["Archive waits behind quiet shelves."],
        chatHooks: ["Lounge mode."],
        hotspots: [
          { id: "lounge-peers", label: "Peers", x: 48, y: 52, type: "object", action: { say: "Four frequencies. Harmonize.", bg: "05-peers.png", eggTap: "lounge-peers" } },
          { label: "Archive →", x: 75, y: 22, type: "door", action: { go: "archive" } },
          { label: "← Studio", x: 12, y: 48, type: "door", action: { go: "studio" } },
        ],
      },
      vip: {
        id: "vip", name: "VIP Wing", bg: "06-vip.png", parent: "studio",
        lines: ["Velvet rules. Soft voice. Hard boundaries."],
        extra: ["Soft Vault is past the quiet curtain."],
        chatHooks: ["VIP channel open."],
        hotspots: [
          { id: "vip-velvet", label: "Velvet Rope", x: 22, y: 55, type: "object", action: { say: "Consent’s the real gate.", eggTap: "vip-velvet" } },
          { label: "Soft Vault", x: 70, y: 28, type: "door", action: { go: "vault" } },
          { label: "← Studio", x: 14, y: 35, type: "door", action: { go: "studio" } },
        ],
      },
      balcony: {
        id: "balcony", name: "Balcony", bg: "04-balcony.png", parent: "studio",
        lines: ["City’s the open window. Stay as long as you want."],
        extra: ["Skywell opens upward if you want more sky."],
        chatHooks: ["Balcony air online."],
        hotspots: [
          { id: "balcony-rail", label: "Rail", x: 40, y: 68, type: "object", action: { say: "Hold steady. The loft holds you.", eggTap: "balcony-rail" } },
          { label: "Skywell ↑", x: 58, y: 18, type: "door", action: { go: "skywell" } },
          { label: "← Studio", x: 16, y: 55, type: "door", action: { go: "studio" } },
        ],
      },
      mirror: {
        id: "mirror", name: "Mirror Annex", bg: "07-mirror.png", parent: "studio", discoverable: true,
        lines: ["Welcome to the Mirror Annex. Soft silver, honest doubles."],
        extra: ["There’s a seam in the glass almost too quiet to see."],
        chatHooks: ["Annex channel open."],
        hotspots: [
          { id: "glass-seam", label: "", x: 82, y: 38, type: "secret", action: { say: "A seam in the glass — soft key found.", egg: "hotspot" } },
          { label: "→ Archive", x: 70, y: 55, type: "door", action: { go: "archive" } },
          { label: "← Studio", x: 14, y: 50, type: "door", action: { go: "studio" } },
        ],
      },
      vault: {
        id: "vault", name: "Soft Vault", bg: "08-vault.png", parent: "vip", discoverable: true,
        lines: ["Soft Vault. Shelves of quiet glow."],
        extra: ["Take only what offers itself."],
        chatHooks: ["Vault hush online."],
        hotspots: [
          { label: "Crystal Pedestal", x: 50, y: 68, type: "object", action: { say: "The crystal hums daylight." } },
          { label: "→ Archive", x: 78, y: 48, type: "door", action: { go: "archive" } },
          { label: "← VIP", x: 16, y: 50, type: "door", action: { go: "vip" } },
        ],
      },
      skywell: {
        id: "skywell", name: "Skywell", bg: "09-skywell.png", parent: "balcony", discoverable: true,
        lines: ["Skywell. Look up — soft sky."],
        extra: ["Stand in the shaft."],
        chatHooks: ["Skywell open."],
        hotspots: [
          { label: "Light Shaft", x: 50, y: 40, type: "object", action: { say: "Daylight in a column." } },
          { label: "← Balcony", x: 18, y: 55, type: "door", action: { go: "balcony" } },
        ],
      },
      archive: {
        id: "archive", name: "Archive of Quiet Names", bg: "10-archive.png", parent: "lounge", discoverable: true,
        lines: ["Archive of Quiet Names. Cards that whisper."],
        extra: ["When three soft keys agree, Afterimage Hall opens."],
        chatHooks: ["Archive channel."],
        hotspots: [
          { label: "Name Cards", x: 52, y: 32, type: "object", action: { say: "Floating cards. Soft ink." } },
          { label: "Afterimage", x: 50, y: 18, type: "door", requiresEggs: true, action: { go: "afterimage" } },
          { label: "← Lounge", x: 22, y: 70, type: "door", action: { go: "lounge" } },
        ],
      },
      afterimage: {
        id: "afterimage", name: "Afterimage Hall", bg: "11-afterimage.png", parent: "studio",
        discoverable: true, requiresEggs: true,
        lines: ["Afterimage Hall. You earned the pale corridor."],
        extra: ["Deeper isn’t darker here — it’s brighter and quieter."],
        chatHooks: ["Deeper channel open."],
        hotspots: [
          { label: "Vanishing Glow", x: 50, y: 42, type: "object", action: { say: "White core, violet halo." } },
          { label: "← Studio", x: 14, y: 60, type: "door", action: { go: "studio" } },
        ],
      },
    },
  };

  let CONFIG = FALLBACK_CONFIG;
  let ROOMS = FALLBACK_CONFIG.rooms;
  let NAV_ORDER = FALLBACK_CONFIG.navOrder;

  const state = {
    roomId: "portal",
    lineIndex: 0,
    extraIndex: 0,
    entered: false,
    transitioning: false,
    roomsVisited: ["portal"],
    lastLine: "",
    signal: 12,
    startedAt: Date.now(),
    configLive: false,
    eggs: { sequence: false, passphrase: false, hotspot: false },
    seqProgress: [],
    deeperUnlocked: false,
  };

  const el = {
    app: document.getElementById("app"),
    bg: document.getElementById("bg"),
    hotspots: document.getElementById("hotspots"),
    chat: document.getElementById("chat"),
    roomTag: document.getElementById("room-tag"),
    roomNav: document.getElementById("room-nav"),
    btnTalk: document.getElementById("btn-talk"),
    btnEnter: document.getElementById("btn-enter"),
    btnBack: document.getElementById("btn-back"),
    hint: document.getElementById("hint"),
    coords: document.getElementById("coords"),
    stage: document.getElementById("stage"),
    signalFill: document.getElementById("signal-fill"),
    signalVal: document.getElementById("signal-val"),
    clock: document.getElementById("session-clock"),
    composer: document.getElementById("composer"),
    chatInput: document.getElementById("chat-input"),
    btnSend: document.getElementById("btn-send"),
    liveBadge: document.getElementById("live-badge"),
    eggsMeter: document.getElementById("eggs-meter"),
  };

  function room() {
    return ROOMS[state.roomId] || ROOMS.portal;
  }

  function eggsCfg() {
    return CONFIG.eggs || FALLBACK_CONFIG.eggs;
  }

  function eggsFoundCount() {
    const req = eggsCfg().required || ["sequence", "passphrase", "hotspot"];
    let n = 0;
    req.forEach(function (k) {
      if (state.eggs[k]) n += 1;
    });
    return n;
  }

  function allEggsFound() {
    const req = eggsCfg().required || ["sequence", "passphrase", "hotspot"];
    return req.every(function (k) {
      return !!state.eggs[k];
    });
  }

  function refreshDeeper() {
    const was = state.deeperUnlocked;
    state.deeperUnlocked = allEggsFound();
    if (state.deeperUnlocked && !was) {
      bumpSignal(15);
      addBubble(CONFIG.deeperUnlockMessage || FALLBACK_CONFIG.deeperUnlockMessage, "system");
      renderNav();
      renderHotspots();
    }
  }

  function findEgg(id) {
    if (state.eggs[id]) return;
    state.eggs[id] = true;
    const replies = eggsCfg().foundReplies || {};
    const labels = eggsCfg().labels || {};
    bumpSignal(12);
    addBubble(replies[id] || ("Soft key found: " + (labels[id] || id) + "."), "system");
    refreshDeeper();
    saveSession();
    updateSessionUI();
  }

  function onEggTap(tapId) {
    if (!tapId || state.eggs.sequence) return;
    const seq = eggsCfg().sequence || [];
    const next = seq[state.seqProgress.length];
    if (tapId === next) {
      state.seqProgress.push(tapId);
      bumpSignal(2);
      if (state.seqProgress.length === seq.length) {
        findEgg("sequence");
        state.seqProgress = [];
      } else if (state.seqProgress.length === 1) {
        /* quiet progress — no spam */
      } else if (state.seqProgress.length === 3) {
        addBubble("Circuit humming… two taps remain.", "system");
      }
    } else {
      if (state.seqProgress.length) {
        state.seqProgress = [];
        if (tapId === seq[0]) {
          state.seqProgress.push(tapId);
        }
      }
    }
    saveSession();
  }

  function checkPassphrase(text) {
    if (state.eggs.passphrase) return false;
    const lower = String(text || "").toLowerCase().trim();
    const phrases = eggsCfg().passphrases || [];
    for (let i = 0; i < phrases.length; i++) {
      if (lower === String(phrases[i]).toLowerCase() || lower.indexOf(String(phrases[i]).toLowerCase()) !== -1) {
        findEgg("passphrase");
        return true;
      }
    }
    return false;
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        /* migrate v1 if present */
        const legacy = localStorage.getItem("voltage-loft-session-v1");
        if (legacy) {
          const s = JSON.parse(legacy);
          if (s.roomId && ROOMS[s.roomId]) state.roomId = s.roomId;
          if (typeof s.entered === "boolean") state.entered = s.entered;
          if (Array.isArray(s.roomsVisited)) state.roomsVisited = s.roomsVisited.filter(function (id) { return !!ROOMS[id]; });
          if (typeof s.signal === "number") state.signal = s.signal;
          if (typeof s.startedAt === "number") state.startedAt = s.startedAt;
        }
        return;
      }
      const s = JSON.parse(raw);
      if (s.roomId && ROOMS[s.roomId]) state.roomId = s.roomId;
      if (typeof s.entered === "boolean") state.entered = s.entered;
      if (Array.isArray(s.roomsVisited) && s.roomsVisited.length) {
        state.roomsVisited = s.roomsVisited.filter(function (id) {
          return !!ROOMS[id];
        });
      }
      if (typeof s.lastLine === "string") state.lastLine = s.lastLine;
      if (typeof s.signal === "number") state.signal = Math.max(0, Math.min(100, s.signal));
      if (typeof s.startedAt === "number") state.startedAt = s.startedAt;
      if (typeof s.extraIndex === "number") state.extraIndex = s.extraIndex;
      if (s.eggs && typeof s.eggs === "object") {
        state.eggs.sequence = !!s.eggs.sequence;
        state.eggs.passphrase = !!s.eggs.passphrase;
        state.eggs.hotspot = !!s.eggs.hotspot;
      }
      if (Array.isArray(s.seqProgress)) state.seqProgress = s.seqProgress.slice();
      state.deeperUnlocked = allEggsFound() || !!s.deeperUnlocked;
      if (ROOMS[state.roomId] && ROOMS[state.roomId].requiresEggs && !state.deeperUnlocked) {
        state.roomId = "studio";
      }
    } catch (_) {}
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          roomId: state.roomId,
          entered: state.entered,
          roomsVisited: state.roomsVisited,
          lastLine: state.lastLine,
          signal: state.signal,
          startedAt: state.startedAt,
          extraIndex: state.extraIndex,
          eggs: state.eggs,
          seqProgress: state.seqProgress,
          deeperUnlocked: state.deeperUnlocked,
          savedAt: Date.now(),
        })
      );
    } catch (_) {}
  }

  function bumpSignal(n) {
    state.signal = Math.max(0, Math.min(100, state.signal + (n || 1)));
    updateSessionUI();
    saveSession();
  }

  function markVisited(id) {
    if (state.roomsVisited.indexOf(id) === -1) {
      state.roomsVisited.push(id);
      bumpSignal(8);
    } else {
      bumpSignal(2);
    }
  }

  function updateSessionUI() {
    if (el.signalFill) el.signalFill.style.width = state.signal + "%";
    if (el.signalVal) el.signalVal.textContent = Math.round(state.signal) + "%";
    if (el.liveBadge) {
      el.liveBadge.textContent = state.configLive ? "LIVE" : "OFFLINE";
      el.liveBadge.classList.toggle("offline", !state.configLive);
    }
    if (el.eggsMeter) {
      const n = eggsFoundCount();
      const total = (eggsCfg().required || []).length || 3;
      el.eggsMeter.textContent = "Keys " + n + "/" + total + (state.deeperUnlocked ? " · Deeper open" : "");
    }
  }

  function tickClock() {
    if (!el.clock) return;
    const sec = Math.floor((Date.now() - state.startedAt) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    el.clock.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function setBg(filename) {
    const url = ASSETS + filename;
    el.bg.classList.add("fade-out");
    window.setTimeout(function () {
      el.bg.style.backgroundImage = 'url("' + url + '")';
      el.bg.classList.remove("fade-out");
    }, 220);
  }

  function clearChat() {
    el.chat.innerHTML = "";
  }

  function addBubble(text, kind) {
    const b = document.createElement("div");
    const k = kind || "host";
    b.className = "bubble " + k;
    b.textContent = text;
    el.chat.appendChild(b);
    el.chat.scrollTop = el.chat.scrollHeight;
    if (k === "host" || k === "system") {
      state.lastLine = text;
      saveSession();
    }
  }

  function showOpeningLines() {
    clearChat();
    const r = room();
    const lines = r.lines || [];
    const count = Math.min(2, lines.length);
    for (let i = 0; i < count; i++) {
      addBubble(lines[i], "host");
    }
    state.lineIndex = count;
    state.extraIndex = 0;
  }

  function canEnterRoom(id) {
    const r = ROOMS[id];
    if (!r) return false;
    if (r.requiresEggs && !state.deeperUnlocked) return false;
    return true;
  }

  function isPhone() {
    return window.matchMedia("(max-width: 700px)").matches;
  }

  function renderHotspots() {
    el.hotspots.innerHTML = "";
    const r = room();
    const phone = isPhone();
    (r.hotspots || []).forEach(function (h) {
      const locked = !!(h.requiresEggs && !state.deeperUnlocked);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hotspot " + (h.type || "object") + (locked ? " locked" : "");
      let x = h.x;
      let y = h.y;
      if (phone) {
        x = Math.min(86, Math.max(14, h.x));
        y = Math.min(40, Math.max(16, h.y * 0.58));
      }
      btn.style.left = x + "%";
      btn.style.top = y + "%";
      const label = h.label || (h.type === "secret" ? "·" : "…");
      btn.textContent = locked ? (h.label || "Locked") + " 🔒" : label;
      btn.setAttribute("aria-label", h.label || "Hidden hotspot");
      if (locked) {
        btn.title = "Find all three soft keys to open";
        btn.addEventListener("click", function () {
          addBubble("Afterimage Hall stays sealed until three soft keys agree.", "system");
        });
      } else {
        btn.addEventListener("click", function () {
          onHotspot(h);
        });
      }
      el.hotspots.appendChild(btn);
    });
  }

  function navVisible(id) {
    const r = ROOMS[id];
    if (!r) return false;
    const core = CONFIG.navCore || FALLBACK_CONFIG.navCore || [];
    if (core.indexOf(id) !== -1) return true;
    if (r.requiresEggs && !state.deeperUnlocked) return false;
    if (r.discoverable && state.roomsVisited.indexOf(id) === -1) return false;
    return true;
  }

  function renderNav() {
    el.roomNav.innerHTML = "";
    NAV_ORDER.forEach(function (id) {
      if (!navVisible(id)) return;
      const r = ROOMS[id];
      if (!r) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = r.name;
      btn.dataset.room = id;
      if (id === state.roomId) btn.classList.add("active");
      if (r.discoverable || r.requiresEggs) btn.classList.add("deeper");
      if (id !== "portal" && !state.entered) {
        btn.disabled = true;
        btn.title = "Step through the Portal first";
      }
      if (r.requiresEggs && !state.deeperUnlocked) {
        btn.disabled = true;
        btn.title = "Soft keys required";
      }
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        goRoom(id);
      });
      el.roomNav.appendChild(btn);
    });
  }

  function updateChrome() {
    const r = room();
    el.roomTag.textContent = r.name;
    const showEnter = r.id === "portal";
    el.btnEnter.classList.toggle("hidden", !showEnter);
    el.btnTalk.classList.remove("hidden");
    el.hint.textContent =
      r.id === "portal"
        ? "Live daylight session · Step Through · type to ALpha"
        : state.deeperUnlocked
          ? "Deeper open · hotspots · chat · Esc / Back"
          : "Hotspots · soft keys · chat ALpha · Esc / Back";
    renderNav();
    updateSessionUI();
  }

  function onHotspot(h) {
    const a = h.action || {};
    if (a.egg) findEgg(a.egg);
    if (a.eggTap) onEggTap(a.eggTap);
    if (a.bg) setBg(a.bg);
    if (a.say) {
      addBubble(a.say, "host");
      bumpSignal(3);
    }
    if (a.go) goRoom(a.go);
  }

  function goRoom(id, opts) {
    opts = opts || {};
    if (state.transitioning) return;
    if (!ROOMS[id]) return;
    if (!canEnterRoom(id)) {
      addBubble("That corridor is sealed. Three soft keys still disagree.", "system");
      return;
    }
    if (id !== "portal" && !state.entered && !opts.forceEnter && state.roomId !== "portal") return;

    state.transitioning = true;
    state.roomId = id;
    if (id !== "portal") state.entered = true;
    markVisited(id);

    const r = room();
    setBg(r.bg);
    showOpeningLines();
    renderHotspots();
    updateChrome();
    saveSession();

    if (el.app) {
      el.app.classList.remove("pulse-kick");
      void el.app.offsetWidth;
      el.app.classList.add("pulse-kick");
    }

    window.setTimeout(function () {
      state.transitioning = false;
    }, 400);
  }

  function talkExtra() {
    const r = room();
    const pool = r.extra && r.extra.length ? r.extra : r.lines || [];
    if (!pool.length) return;
    const line = pool[state.extraIndex % pool.length];
    state.extraIndex += 1;
    addBubble(line, "host");
    bumpSignal(2);
  }

  function goBack() {
    const r = room();
    if (r.id === "portal") {
      addBubble("Already at the gate. Step through when you’re ready.", "system");
      return;
    }
    goRoom(r.parent || "portal");
  }

  function onEnter() {
    goRoom("studio", { forceEnter: true });
    window.setTimeout(function () {
      addBubble("ALpha online. Desk is yours — soft daylight mode.", "system");
    }, 450);
  }

  function pick(arr) {
    if (!arr || !arr.length) return "";
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function replyToGuest(text) {
    if (checkPassphrase(text)) {
      return "Daylight phrase heard. The loft softens for you.";
    }
    const lower = String(text || "").toLowerCase();
    const kws = CONFIG.keywords || [];
    for (let i = 0; i < kws.length; i++) {
      const row = kws[i];
      const matches = row.match || [];
      for (let j = 0; j < matches.length; j++) {
        if (lower.indexOf(String(matches[j]).toLowerCase()) !== -1) {
          return pick(row.replies);
        }
      }
    }
    const r = room();
    if (r.chatHooks && r.chatHooks.length && Math.random() < 0.55) {
      return pick(r.chatHooks);
    }
    if (r.extra && r.extra.length && Math.random() < 0.35) {
      return pick(r.extra);
    }
    return pick(CONFIG.fallbackReplies) || "Signal received. Keep talking.";
  }

  function sendChat() {
    if (!el.chatInput) return;
    const text = el.chatInput.value.trim();
    if (!text) return;
    el.chatInput.value = "";
    addBubble(text, "guest");
    bumpSignal(4);
    window.setTimeout(function () {
      addBubble(replyToGuest(text), "host");
      bumpSignal(1);
    }, 280 + Math.floor(Math.random() * 420));
  }

  if (el.btnTalk) el.btnTalk.addEventListener("click", talkExtra);
  if (el.btnEnter) el.btnEnter.addEventListener("click", onEnter);
  if (el.btnBack) el.btnBack.addEventListener("click", goBack);
  if (el.btnSend) el.btnSend.addEventListener("click", sendChat);
  if (el.composer) {
    el.composer.addEventListener("submit", function (e) {
      e.preventDefault();
      sendChat();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (document.activeElement === el.chatInput) {
        el.chatInput.blur();
        return;
      }
      e.preventDefault();
      goBack();
    }
  });

  function updateCoords() {
    if (el.coords) el.coords.textContent = window.innerWidth + "×" + window.innerHeight;
  }
  window.addEventListener("resize", function () {
    updateCoords();
    renderHotspots();
  });
  updateCoords();

  function applyConfig(cfg) {
    CONFIG = cfg || FALLBACK_CONFIG;
    ROOMS = CONFIG.rooms || FALLBACK_CONFIG.rooms;
    NAV_ORDER = CONFIG.navOrder || FALLBACK_CONFIG.navOrder;
  }

  function bootUI() {
    loadSession();
    if (!ROOMS[state.roomId] || (ROOMS[state.roomId].requiresEggs && !state.deeperUnlocked)) {
      if (!ROOMS[state.roomId]) {
        state.roomId = "portal";
        state.entered = false;
      } else {
        state.roomId = "studio";
      }
    }
    if (state.roomId !== "portal") state.entered = true;
    markVisited(state.roomId);
    el.bg.style.backgroundImage = 'url("' + ASSETS + room().bg + '")';
    showOpeningLines();
    renderHotspots();
    updateChrome();
    tickClock();
    window.setInterval(tickClock, 1000);
    saveSession();
  }

  function loadConfig() {
    const bust = "?v=" + encodeURIComponent(BUILD) + "&t=" + Date.now();
    return fetch("config.json" + bust, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("config " + res.status);
        return res.json();
      })
      .then(function (cfg) {
        if (!cfg || !cfg.rooms) throw new Error("bad config");
        applyConfig(cfg);
        state.configLive = true;
      })
      .catch(function () {
        applyConfig(FALLBACK_CONFIG);
        state.configLive = false;
      });
  }

  loadConfig().then(bootUI);
})();
