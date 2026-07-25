/**
 * Rotating quotes for Bio + Relics.
 * Same quote for everyone in each 2-hour window (stable, not random flicker).
 * CMS static quote is a fallback if the bank is empty.
 */

/** ~2–4 sentence mythic lines — a bit longer than the old one-liner */
export const QUOTE_BANK = [
  {
    text:
      "Power without healing is a storm that only breaks the ground it claims to free. Healing without power is a hymn that never leaves the chapel. Hold both, and the map learns your name.",
    by: "Telephantim",
  },
  {
    text:
      "The hammer does not ask permission of the air it splits. The staff does not apologize for mending what pride has torn. Between them you stand — not as a spectator, but as the living hinge.",
    by: "Telephantim",
  },
  {
    text:
      "Courage is not the absence of the fracture; it is the will to keep walking while the wound is still warm. Let Mjolnir lend edge to your step, and Caduceus teach the blood to remember peace.",
    by: "Telephantim",
  },
  {
    text:
      "Every visitor arrives carrying weather they cannot name. Some bring thunder. Some bring fever. Here the relics answer both — one with voltage, one with balm — until the sky inside you clears.",
    by: "Telephantim",
  },
  {
    text:
      "Strength that never rests becomes tyranny over the self. Softness that never stands becomes a door without a lock. Learn the rhythm: strike, then soothe; rise, then root.",
    by: "Telephantim",
  },
  {
    text:
      "The old gods argued with lightning and with herbs. We keep their quarrel honest on this stage. Take what you need — a spark for the spine, a salve for the chest — and leave the map kinder than you found it.",
    by: "Telephantim",
  },
  {
    text:
      "A blade without a healer is just a story of unfinished pain. A healer without a blade is mercy that cannot defend the soft. Together they make a covenant: protect what you mend, and mend what you dare to protect.",
    by: "Telephantim",
  },
  {
    text:
      "You do not have to choose between ferocity and grace. The cosmos never did. Stars burn and still give light for navigation. Be that kind of fire — hot enough to matter, steady enough to guide.",
    by: "Telephantim",
  },
  {
    text:
      "When the feed screams, the relics whisper a slower truth: power is a gift, not a performance; healing is a craft, not a costume. Hold still long enough to feel which one your hands are hungry for.",
    by: "Telephantim",
  },
  {
    text:
      "Mjolnir says the world yields to a clean strike. Caduceus says the world yields to a patient pulse. Both are right on alternating days. Your work is to know which day this is.",
    by: "Telephantim",
  },
  {
    text:
      "There is a place between the thunderclap and the first deep breath after. That place is yours. Visit often. Bring your fear, your ambition, your quiet need to be whole — the relics know the inventory.",
    by: "Telephantim",
  },
  {
    text:
      "Do not outsource your backbone or your tenderness. Borrow them here for a moment if you must — voltage from the hammer, balance from the staff — then carry both into the ordinary hours like secret tools.",
    by: "Telephantim",
  },
];

const INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Stable index for the current 2-hour slot (UTC). */
export function quoteSlotIndex(now = Date.now(), bankLen = QUOTE_BANK.length) {
  if (!bankLen) return 0;
  const slot = Math.floor(now / INTERVAL_MS);
  return ((slot % bankLen) + bankLen) % bankLen;
}

export function currentRotatingQuote(now = Date.now()) {
  const i = quoteSlotIndex(now, QUOTE_BANK.length);
  const q = QUOTE_BANK[i] || QUOTE_BANK[0];
  return {
    text: q.text,
    by: q.by || "Telephantim",
    index: i,
    total: QUOTE_BANK.length,
    /** ms until next rotation */
    msUntilNext: INTERVAL_MS - (now % INTERVAL_MS),
  };
}

/**
 * Apply rotating quote to DOM nodes.
 * @param {{ textId: string, byId: string, boxId?: string }} ids
 * @param {{ fallbackText?: string, fallbackBy?: string, show?: boolean }} opts
 */
export function applyRotatingQuote(ids, opts = {}) {
  const quoteEl = document.getElementById(ids.textId);
  const byEl = document.getElementById(ids.byId);
  const box = ids.boxId ? document.getElementById(ids.boxId) : null;
  const rot = currentRotatingQuote();
  const text = rot.text || opts.fallbackText || "";
  const by = rot.by || opts.fallbackBy || "Telephantim";
  const show = opts.show !== false && !!String(text).trim();

  if (box) box.hidden = !show;
  if (quoteEl) quoteEl.textContent = text;
  if (byEl) byEl.textContent = by ? `— ${by}` : "";

  return rot;
}

/** Schedule a refresh when the 2-hour window rolls over (tab may stay open). */
export function scheduleQuoteRefresh(fn) {
  const rot = currentRotatingQuote();
  const wait = Math.max(5000, Math.min(rot.msUntilNext + 250, INTERVAL_MS));
  return setTimeout(() => {
    try {
      fn();
    } catch (_) {}
    scheduleQuoteRefresh(fn);
  }, wait);
}

window.TelephantimQuotes = {
  QUOTE_BANK,
  currentRotatingQuote,
  applyRotatingQuote,
  scheduleQuoteRefresh,
};
