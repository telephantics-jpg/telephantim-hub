/**
 * Voltage Loft — Dynamic Viewport
 * Loads config.json at runtime · localStorage session · chat composer
 * Offline-capable fallbacks if config fetch fails
 */
(function () {
  "use strict";

  const ASSETS = "assets/";
  const STORAGE_KEY = "voltage-loft-session-v1";
  const BUILD = "v160-phone";

  /** Embedded fallback if config.json cannot load (file:// or network fail) */
  const FALLBACK_CONFIG = {
    version: BUILD + "-offline",
    host: "AGENT ALpha",
    navOrder: ["portal", "studio", "lounge", "vip", "balcony"],
    keywords: [
      { match: ["hello", "hi", "hey"], replies: ["Hey. Voltage Loft’s live — pick a room or ask me anything."] },
      { match: ["help", "what", "how"], replies: ["Hotspots move you. Type to me anytime. Esc backs toward Portal."] },
      { match: ["music", "studio", "mix"], replies: ["Desk never sleeps. Studio’s where the meters breathe."] },
      { match: ["vip", "velvet"], replies: ["VIP is velvet rules — soft voice, hard boundaries."] },
      { match: ["lounge", "couch"], replies: ["Lounge is soft light, hard opinions. Match the voltage."] },
      { match: ["balcony", "city", "skyline"], replies: ["Balcony’s the screensaver. Skyline doesn’t ask for a setlist."] },
      { match: ["alpha", "who", "you"], replies: ["I’m ALpha — crystalline host. Session’s yours."] },
    ],
    fallbackReplies: [
      "Say more — or tap a hotspot. I’m listening.",
      "Room’s live. Try music, lounge, vip, balcony — or just vibe.",
    ],
    rooms: {
      portal: {
        id: "portal",
        name: "Portal Gate",
        bg: "01-pad.png",
        parent: null,
        lines: [
          "Took you long enough. Voltage Loft’s lit. Step through.",
          "Threshold’s warm. Studio’s waiting on the other side.",
          "No tickets. Just voltage. When you’re ready — step.",
        ],
        extra: [
          "I don’t do small talk at the gate. I do invitations.",
          "Behind this door: desk, lounge, VIP, balcony. Pick your voltage.",
          "Casting’s locked. You’re the guest of honor.",
        ],
        chatHooks: ["Gate’s open. Type if you want a briefing before you step."],
        hotspots: [
          { label: "Step Through", x: 50, y: 48, type: "door", action: { go: "studio" } },
          { label: "Peek Studio", x: 72, y: 62, type: "object", action: { say: "Empty chair. Mixing board breathing. That’s your pad." } },
          { label: "Skyline", x: 28, y: 38, type: "object", action: { say: "City’s already watching. Don’t keep it waiting." } },
        ],
        enterCta: true,
      },
      studio: {
        id: "studio",
        name: "Studio Desk",
        bg: "02-host.png",
        parent: "portal",
        lines: [
          "This desk never sleeps. Your seat’s the empty one — claim it.",
          "Faders up. Heartbeat in the meters. Welcome to the loft.",
          "I’m ALpha. Crystalline host. Your session starts when you sit.",
        ],
        extra: [
          "Pad’s tuned to midnight. Push anything that glows.",
          "Wall says Music Penthouse. I say: don’t waste the sunset.",
          "Need quiet? Balcony. Need noise? Lounge. Need rules? VIP.",
          "That empty chair isn’t empty anymore. You’re in it.",
        ],
        chatHooks: ["From the desk: ask about faders, lounge, VIP, or the balcony."],
        hotspots: [
          { label: "Mixing Desk", x: 55, y: 68, type: "object", action: { say: "Sliders remember every night. Make a new one." } },
          { label: "Lounge →", x: 18, y: 55, type: "door", action: { go: "lounge" } },
          { label: "VIP Wing", x: 82, y: 42, type: "door", action: { go: "vip" } },
          { label: "Balcony", x: 70, y: 28, type: "door", action: { go: "balcony" } },
        ],
      },
      lounge: {
        id: "lounge",
        name: "Lounge",
        bg: "05-peers.png",
        altBg: "03-couch.png",
        parent: "studio",
        lines: [
          "Peers are loud on purpose. Grab a pour from Clerk.",
          "Couch has room. Conversations don’t wait for intros.",
          "Soft light, hard opinions. That’s the lounge formula.",
        ],
        extra: [
          "Clerk’s pour is clean. Tip in compliments or silence.",
          "They’re not audience — they’re voltage. Match it.",
          "If the couch invites you, accept. That’s etiquette.",
          "VIP’s past the velvet. Balcony’s past the glass.",
        ],
        chatHooks: ["Lounge mode: peers, couch, Clerk’s pour — or bounce to VIP."],
        hotspots: [
          { label: "Peers", x: 48, y: 52, type: "object", action: { say: "Four frequencies. Don’t interrupt — harmonize.", bg: "05-peers.png" } },
          { label: "Couch Invite", x: 62, y: 70, type: "object", action: { say: "Sit. Stay. The night stretches when you do.", bg: "03-couch.png" } },
          { label: "Clerk’s Pour", x: 30, y: 72, type: "object", action: { say: "One glass. No tab. Reputation’s the currency." } },
          { label: "→ VIP", x: 88, y: 40, type: "door", action: { go: "vip" } },
          { label: "← Studio", x: 12, y: 48, type: "door", action: { go: "studio" } },
        ],
      },
      vip: {
        id: "vip",
        name: "VIP Wing",
        bg: "06-vip.png",
        parent: "studio",
        lines: [
          "Adults only, consent locked, invoices burned. You’re on the list.",
          "Velvet rules. Soft voice. Hard boundaries. That’s VIP.",
          "No cameras that matter. No names that stick. Just voltage.",
        ],
        extra: [
          "List doesn’t lie. You’re here because someone vouched.",
          "If it isn’t enthusiastic, it isn’t happening. House law.",
          "Amber light means stay. Violet means deeper. Read the room.",
          "Back to studio when you’re done glowing.",
        ],
        chatHooks: ["VIP channel open. Soft voice only."],
        hotspots: [
          { label: "Velvet Rope", x: 22, y: 55, type: "object", action: { say: "Rope’s theater. Consent’s the real gate." } },
          { label: "Private Booth", x: 55, y: 60, type: "object", action: { say: "Booth remembers nothing. That’s the point." } },
          { label: "→ Lounge", x: 78, y: 45, type: "door", action: { go: "lounge" } },
          { label: "← Studio", x: 14, y: 35, type: "door", action: { go: "studio" } },
        ],
      },
      balcony: {
        id: "balcony",
        name: "Balcony",
        bg: "04-balcony.png",
        parent: "studio",
        lines: [
          "City’s the screensaver. Stay as long as you want.",
          "Wind tastes like copper and rain. Good night for thinking.",
          "No setlist out here. Just skyline and whatever you brought.",
        ],
        extra: [
          "Lights below don’t care who you are. That’s freedom.",
          "Lean on the rail. Don’t fall for metaphors — or do.",
          "When the city blinks, blink back. Protocol.",
          "Studio’s warm when you’re ready to mix again.",
        ],
        chatHooks: ["Balcony air online. Skyline’s the only audience."],
        hotspots: [
          { label: "Skyline", x: 50, y: 35, type: "object", action: { say: "Millions of windows. One of them’s yours someday." } },
          { label: "Rail", x: 40, y: 68, type: "object", action: { say: "Hold steady. The loft holds you." } },
          { label: "Night Air", x: 72, y: 50, type: "object", action: { say: "Breathe. Voltage doesn’t only live indoors." } },
          { label: "← Studio", x: 16, y: 55, type: "door", action: { go: "studio" } },
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
  };

  function room() {
    return ROOMS[state.roomId] || ROOMS.portal;
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
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
  }

  function tickClock() {
    if (!el.clock) return;
    const sec = Math.floor((Date.now() - state.startedAt) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    el.clock.textContent =
      String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
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
    if (state.lastLine && state.roomsVisited.length > 1) {
      /* keep lastLine from session; opening lines overwrite display */
    }
  }

  function isPhone() {
    return window.matchMedia("(max-width: 700px)").matches;
  }

  function renderHotspots() {
    el.hotspots.innerHTML = "";
    const r = room();
    const phone = isPhone();
    (r.hotspots || []).forEach(function (h) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hotspot " + (h.type || "object");
      let x = h.x;
      let y = h.y;
      if (phone) {
        x = Math.min(86, Math.max(14, h.x));
        y = Math.min(40, Math.max(16, h.y * 0.58));
      }
      btn.style.left = x + "%";
      btn.style.top = y + "%";
      btn.textContent = h.label;
      btn.setAttribute("aria-label", h.label);
      btn.addEventListener("click", function () {
        onHotspot(h);
      });
      el.hotspots.appendChild(btn);
    });
  }

  function renderNav() {
    el.roomNav.innerHTML = "";
    NAV_ORDER.forEach(function (id) {
      const r = ROOMS[id];
      if (!r) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = r.name;
      btn.dataset.room = id;
      if (id === state.roomId) btn.classList.add("active");
      if (id !== "portal" && !state.entered) {
        btn.disabled = true;
        btn.title = "Step through the Portal first";
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
        ? "Live session · Step Through · type to ALpha"
        : "Hotspots · chat ALpha · Esc / Back · signal live";
    renderNav();
    updateSessionUI();
  }

  function onHotspot(h) {
    const a = h.action || {};
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
      addBubble("ALpha online. Desk is yours.", "system");
    }, 450);
  }

  function pick(arr) {
    if (!arr || !arr.length) return "";
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function replyToGuest(text) {
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

  /* Events */
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
    if (!ROOMS[state.roomId]) {
      state.roomId = "portal";
      state.entered = false;
    }
    if (state.roomId !== "portal") state.entered = true;
    markVisited(state.roomId);
    el.bg.style.backgroundImage = 'url("' + ASSETS + room().bg + '")';
    showOpeningLines();
    if (state.lastLine) {
      /* optional continuity note */
    }
    renderHotspots();
    updateChrome();
    tickClock();
    window.setInterval(tickClock, 1000);
    saveSession();
    startLife();
  }

  function spawnMotes() {
    const host = document.getElementById("motes");
    if (!host) return;
    host.innerHTML = "";
    const n = 18;
    for (let i = 0; i < n; i++) {
      const d = document.createElement("span");
      d.className = "mote";
      d.style.left = Math.random() * 100 + "%";
      d.style.bottom = Math.random() * 30 + "%";
      d.style.animationDuration = 7 + Math.random() * 11 + "s";
      d.style.animationDelay = -Math.random() * 12 + "s";
      d.style.width = d.style.height = 3 + Math.random() * 5 + "px";
      host.appendChild(d);
    }
  }

  function ambientLine() {
    if (document.hidden) return;
    const r = room();
    const pool = [].concat(r.chatHooks || [], r.extra || []);
    if (!pool.length) return;
    addBubble(pick(pool), "system");
    bumpSignal(1);
  }

  function loungeSwap() {
    const r = room();
    if (r.id !== "lounge" || !r.altBg) return;
    const useAlt = Math.random() < 0.5;
    setBg(useAlt ? r.altBg : r.bg);
  }

  function nudgeHotspot() {
    const nodes = el.hotspots ? el.hotspots.querySelectorAll(".hotspot") : [];
    if (!nodes.length) return;
    const n = nodes[Math.floor(Math.random() * nodes.length)];
    n.classList.add("nudge");
    window.setTimeout(function () {
      n.classList.remove("nudge");
    }, 900);
  }

  function startLife() {
    spawnMotes();
    window.setInterval(ambientLine, 14000 + Math.floor(Math.random() * 5000));
    window.setInterval(loungeSwap, 18000);
    window.setInterval(nudgeHotspot, 7000);
    window.setInterval(function () {
      if (state.signal > 8) bumpSignal(-1);
    }, 8000);
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
