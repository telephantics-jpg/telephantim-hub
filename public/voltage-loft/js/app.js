/**
 * Voltage Loft — Viewport
 * Offline SPA · AGENT ALpha host
 */
(function () {
  "use strict";

  const ASSETS = "assets/";

  /** Room graph */
  const ROOMS = {
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
      hotspots: [
        { label: "Skyline", x: 50, y: 35, type: "object", action: { say: "Millions of windows. One of them’s yours someday." } },
        { label: "Rail", x: 40, y: 68, type: "object", action: { say: "Hold steady. The loft holds you." } },
        { label: "Night Air", x: 72, y: 50, type: "object", action: { say: "Breathe. Voltage doesn’t only live indoors." } },
        { label: "← Studio", x: 16, y: 55, type: "door", action: { go: "studio" } },
      ],
    },
  };

  const NAV_ORDER = ["portal", "studio", "lounge", "vip", "balcony"];

  const state = {
    roomId: "portal",
    lineIndex: 0,
    extraIndex: 0,
    entered: false,
    transitioning: false,
  };

  const el = {
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
  };

  function room() {
    return ROOMS[state.roomId];
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

  function addBubble(text, system) {
    const b = document.createElement("div");
    b.className = "bubble" + (system ? " system" : "");
    b.textContent = text;
    el.chat.appendChild(b);
    el.chat.scrollTop = el.chat.scrollHeight;
  }

  function showOpeningLines() {
    clearChat();
    const r = room();
    const count = Math.min(2, r.lines.length);
    for (let i = 0; i < count; i++) {
      addBubble(r.lines[i]);
    }
    state.lineIndex = count;
    state.extraIndex = 0;
  }

  function renderHotspots() {
    el.hotspots.innerHTML = "";
    const r = room();
    r.hotspots.forEach(function (h) {
      if (r.id === "portal" && h.action && h.action.go === "studio") {
        // Primary enter also covered by Step Through button
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hotspot " + (h.type || "object");
      btn.style.left = h.x + "%";
      btn.style.top = h.y + "%";
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
    el.btnTalk.classList.toggle("hidden", showEnter && !state.entered);
    if (showEnter) {
      el.btnTalk.classList.remove("hidden");
    }
    el.hint.textContent =
      r.id === "portal"
        ? "Step Through to enter · Esc stays at gate"
        : "Hotspots · Talk to ALpha · Esc / Back toward Portal";
    renderNav();
  }

  function onHotspot(h) {
    const a = h.action || {};
    if (a.bg) {
      setBg(a.bg);
    }
    if (a.say) {
      addBubble(a.say);
    }
    if (a.go) {
      goRoom(a.go);
    }
  }

  function goRoom(id, opts) {
    opts = opts || {};
    if (state.transitioning) return;
    if (!ROOMS[id]) return;
    // From Portal Gate, any leave counts as entering the loft
    if (id !== "portal" && !state.entered && !opts.forceEnter && state.roomId !== "portal") return;

    state.transitioning = true;
    state.roomId = id;
    if (id !== "portal") state.entered = true;

    const r = room();
    setBg(r.bg);
    showOpeningLines();
    renderHotspots();
    updateChrome();

    window.setTimeout(function () {
      state.transitioning = false;
    }, 400);
  }

  function talkExtra() {
    const r = room();
    const pool = r.extra && r.extra.length ? r.extra : r.lines;
    if (!pool.length) return;
    const line = pool[state.extraIndex % pool.length];
    state.extraIndex += 1;
    addBubble(line);
  }

  function goBack() {
    const r = room();
    if (r.id === "portal") {
      addBubble("Already at the gate. Step through when you’re ready.", true);
      return;
    }
    const target = r.parent || "portal";
    goRoom(target);
  }

  function onEnter() {
    goRoom("studio", { forceEnter: true });
    window.setTimeout(function () {
      addBubble("ALpha online. Desk is yours.", true);
    }, 450);
  }

  /* Events */
  el.btnTalk.addEventListener("click", talkExtra);
  el.btnEnter.addEventListener("click", onEnter);
  el.btnBack.addEventListener("click", goBack);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      goBack();
    }
  });

  function updateCoords() {
    el.coords.textContent = window.innerWidth + "×" + window.innerHeight;
  }
  window.addEventListener("resize", updateCoords);
  updateCoords();

  /* Boot */
  function boot() {
    state.roomId = "portal";
    state.entered = false;
    el.bg.style.backgroundImage = 'url("' + ASSETS + ROOMS.portal.bg + '")';
    showOpeningLines();
    renderHotspots();
    updateChrome();
  }

  boot();
})();
