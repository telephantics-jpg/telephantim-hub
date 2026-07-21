/**
 * Living Pulse — dynamic banner where the birthday dedication used to be.
 * Changes with hour of day + rotates short lines every few seconds.
 */

const PHASES = [
  {
    id: "dawn",
    hours: [5, 6, 7, 8],
    tag: "Dawn fire",
    accent: "dawn",
    lines: [
      "First light. The relics remember who woke them.",
      "Morning is a forge. Strike while the sky is soft.",
      "Breathe in gold. The day has not decided against you yet.",
    ],
  },
  {
    id: "day",
    hours: [9, 10, 11, 12, 13, 14, 15, 16],
    tag: "High sun",
    accent: "day",
    lines: [
      "Power and healing share the same hand today.",
      "Walk true. Thunder only follows a clean path.",
      "The twins of the staff are awake — balance is a verb.",
    ],
  },
  {
    id: "dusk",
    hours: [17, 18, 19, 20],
    tag: "Ember hour",
    accent: "dusk",
    lines: [
      "Edges glow. Lay down what you cannot carry past sunset.",
      "Healing prefers twilight — fewer masks, more truth.",
      "The hammer cools; the coils still hum. Rest is strategy.",
    ],
  },
  {
    id: "night",
    hours: [21, 22, 23, 0, 1, 2, 3, 4],
    tag: "Night watch",
    accent: "night",
    lines: [
      "Stars keep score. Sleep is still a form of courage.",
      "Silence is not empty — it is the room where power reloads.",
      "If you dream of lightning, wake ready to mend something.",
    ],
  },
];

const TICK_MS = 7000;

function phaseForHour(h) {
  return PHASES.find((p) => p.hours.includes(h)) || PHASES[1];
}

function $(id) {
  return document.getElementById(id);
}

function paint() {
  const now = new Date();
  const phase = phaseForHour(now.getHours());
  const lineIdx = Math.floor(now.getTime() / TICK_MS) % phase.lines.length;
  const line = phase.lines[lineIdx];

  const root = $("live-pulse");
  const tag = $("pulse-tag");
  const text = $("pulse-line");
  const clock = $("pulse-clock");

  if (root) {
    root.dataset.phase = phase.accent;
    root.classList.remove("pulse-flash");
    // reflow for animation
    void root.offsetWidth;
    root.classList.add("pulse-flash");
  }
  if (tag) tag.textContent = phase.tag;
  if (text) {
    text.classList.add("fading");
    setTimeout(() => {
      text.textContent = line;
      text.classList.remove("fading");
    }, 180);
  }
  if (clock) {
    clock.textContent = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

function wire() {
  paint();
  setInterval(paint, TICK_MS);
  // refresh clock more often without always changing the line
  setInterval(() => {
    const clock = $("pulse-clock");
    if (clock) {
      clock.textContent = new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }, 30000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wire);
} else {
  wire();
}
