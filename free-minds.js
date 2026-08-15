/**
 * Free / native minds — same path as Luna Camp 2D.
 *
 * Camp principle: brains stay on telephanti.com (free_minds + aether offline),
 * no visitor API keys, CORS open. When that fails, personality.js falls through
 * to browser WebLLM / scripted duel / cached sayings.
 *
 * Mapping for Telephantim relics:
 *   Mjolnir  ↔ camp agent "thor"  (thunder / power)
 *   Caduceus ↔ camp agent "caduceus"
 *
 * CRITICAL: never send "Reply ONLY as…" director prompts as the chat message —
 * camp/aether will echo them into the bubble. Scene seeds only.
 */

// Prefer same-origin camp (unified server) so shop/TV/brains work offline of telephanti.com
function campApiBase() {
  try {
    const h = (location.hostname || "").toLowerCase();
    if (h === "localhost" || h === "127.0.0.1") return location.origin;
  } catch (_) {}
  return "https://telephanti.com";
}
const CAMP_API = campApiBase();

function mapAgent(id) {
  const a = String(id || "").toLowerCase();
  if (a === "thor" || a === "odin" || a === "mjolnir") return "mjolnir";
  if (a === "caduceus") return "caduceus";
  return null;
}

/**
 * True if text looks like a system/director prompt leaked into the bubble.
 */
export function looksLikePromptLeak(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  const low = t.toLowerCase();
  if (/^reply only as\b/i.test(t)) return true;
  if (/\breply only as\b/i.test(t) && t.length < 560) return true;
  if (/\bwrite\s+\d+\s*[–\-]\s*\d+\s+(?:vivid\s+)?sentences\b/i.test(t)) return true;
  if (/\b\d+\s*[–\-]\s*\d+\s+lively\s+spoken\s+sentences\b/i.test(t)) return true;
  if (/\bno ai\/?tech(?:\/camp)?\s+meta\b/i.test(t)) return true;
  if (/\bstorm monologue time\b/i.test(t)) return true;
  if (/\bwhat else is rattling around that skull\b/i.test(t)) return true;
  if (/\bthe wielder just grabbed you\b/i.test(t) && /react to the grip/i.test(t)) return true;
  if (/\bas an ai\b/i.test(low)) return true;
  if (/\bgift power\b/i.test(t) && /\bgift healing\b/i.test(t)) return true;
  if (/\bno camp meta, no seeds\b/i.test(t)) return true;
  if (/\bother characters monologuing\b/i.test(t)) return true;
  if (/\bstay in character\b/i.test(low)) return true;
  if (/\bno stage directions\b/i.test(low)) return true;
  if (/\bspoken words only\b/i.test(low)) return true;
  if (/\bimbue the wielder\b/i.test(low)) return true;
  if (/\bspeak first as yourself\b/i.test(low)) return true;
  if (/\bdual relic banter\b/i.test(low)) return true;
  if (/\bnot a slogan\b/i.test(low) && /\bnot a wall\b/i.test(low)) return true;
  if (/\boffer power\b/i.test(low) && /\bno (?:tech|stage)\b/i.test(low)) return true;
  if (/^topic:\s*/i.test(t) && /bond\s+\d+\/99/i.test(t)) return true;
  if (/power\s+\d+\/99/i.test(t) && /bond\s+\d+\/99/i.test(t)) return true;
  if (/\bno tech talk\b/i.test(low) && /\b(gift|offer)\s+(power|healing)\b/i.test(low)) return true;
  return false;
}

/**
 * Clean camp / aether tails into a readable relic line.
 * Free minds often append "camp air", seeds, and topic echoes — strip those.
 */
export function polishSpeech(text, { maxLen = 480 } = {}) {
  let t = String(text || "")
    .replace(/\r/g, "")
    .replace(/\u0000/g, "")
    .trim();

  // If the whole thing is a leaked prompt, bail empty
  if (looksLikePromptLeak(t)) return "";

  // Drop leading director scraps
  t = t
    .replace(/^Reply ONLY as[^.!?]{0,160}[.!?]\s*/i, "")
    .replace(/^As (Mjolnir|Caduceus|Thor)[,:]?\s*/i, "")
    .replace(/^(Okay[,.]?\s+|So[,.]?\s+)/i, "")
    .replace(/^Topic:\s*[^.!?\n]{0,180}[.!]?\s*/i, "")
    .replace(/^(?:Stay in character|No (?:tech talk|stage directions)|Spoken words only)[^.!?\n]{0,80}[.!]?\s*/gi, "")
    .replace(/^(?:Gift|Offer)\s+(?:POWER|HEALING)\.\s*/i, "")
    .replace(/^Write \d+[–\-]\d+ [^.!?\n]{0,80}[.!]?\s*/i, "")
    .trim();

  // Drop common camp boilerplate blocks
  const cutPatterns = [
    /\n\n(The corona|Camp is wide|Out here I'm also|Out here I.?m also|Recent camp air|little camp marks|Father Odin has one eye)/i,
    /\n\n?\(little camp marks:[\s\S]*$/i,
    /\nSomething familiar in the air:[\s\S]*$/i,
    /\n- (Thor|Caduceus|Sentinel|Hermes) riffed on:[\s\S]*$/i,
    /\nOkay\. At the fire with[\s\S]*$/i,
    /\nI.?m not done with At the fire[\s\S]*$/i,
    /\nTonight that bends toward[\s\S]*$/i,
    /\nIf something stays true when the music[\s\S]*$/i,
    /\nStorm monologue time:[\s\S]*$/i,
    /\nWhat else is rattling[\s\S]*$/i,
  ];
  for (const re of cutPatterns) {
    const m = t.search(re);
    if (m > 48) t = t.slice(0, m).trim();
  }

  // Strip seed / pass / hex loot noise inline
  t = t
    .replace(/\(little camp marks:[^)]*\)/gi, "")
    .replace(/\bSEED=[a-z0-9]+/gi, "")
    .replace(/\bPASS:[a-z0-9-]+/gi, "")
    .replace(/\b0x[0-9A-Fa-f]{6,}\b/g, "")
    .replace(/\bAURORA:\/\/\S+/gi, "")
    .replace(/\[glyph:[^\]]+\]/gi, "")
    .replace(/\bTHO\.[a-z0-9]+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Collapse repeated "At the fire with…" topic spam sentences
  t = t
    .replace(/(At the fire with[^.!?]*[.!?]\s*){2,}/gi, "")
    .replace(/(Topic:\s*[^.!?]*[.!?]\s*)+/gi, "")
    .trim();

  if (looksLikePromptLeak(t)) return "";

  // Prefer first 2–4 solid sentences if still a wall of text
  const parts = t.split(/(?<=[.!?])\s+/).filter((s) => s && s.length > 8);
  if (parts.length > 4) {
    t = parts.slice(0, 4).join(" ");
  }

  if (t.length > maxLen) {
    const sp = t.lastIndexOf(" ", maxLen - 1);
    t = (sp > maxLen * 0.55 ? t.slice(0, sp) : t.slice(0, maxLen - 1)).trim() + "…";
  }
  return t;
}

function trimSpeech(text) {
  return polishSpeech(text, { maxLen: 480 });
}

/** Reject camp garbage / empty lines / prompt leaks so caller can fall through to cache */
export function isStrongLine(text) {
  const t = String(text || "").trim();
  if (t.length < 36) return false;
  if (looksLikePromptLeak(t)) return false;
  if (/SEED=|little camp marks|Recent camp air|0x[0-9A-Fa-f]{6,}/i.test(t)) return false;
  if ((t.match(/At the fire with/gi) || []).length >= 2) return false;
  if ((t.match(/Topic:/gi) || []).length >= 2) return false;
  // Too much repetition of the same 20-char chunk
  if (t.length > 80) {
    const chunk = t.slice(0, 24);
    if (t.indexOf(chunk, 30) !== -1 && t.indexOf(chunk, 60) !== -1) return false;
  }
  return true;
}

/**
 * Dual banter via Luna Camp free minds.
 * @returns {Promise<{ok:true, brains:boolean, provider:string, lines:Array}|null>}
 */
export async function freeMindsBanter(topic, rounds = 4) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  try {
    const res = await fetch(`${CAMP_API}/api/firmament/camp/banter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        agent_a: "thor",
        agent_b: "caduceus",
        rounds: Math.max(2, Math.min(4, rounds || 4)),
        topic:
          topic ||
          "The wielder is on the map. Hammer and staff riff like old friends.",
        visitor_name: "Wielder",
      }),
      signal: ctrl.signal,
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.lines) || !data.lines.length) return null;

    const lines = [];
    for (const line of data.lines) {
      const persona = mapAgent(line.agent_id || line.id);
      const text = trimSpeech(line.text || line.reply || "");
      if (!persona || !text || !isStrongLine(text)) continue;
      lines.push({
        persona,
        name: persona === "mjolnir" ? "Mjolnir" : "Caduceus",
        text,
        provider: line.backend || data.backend || "free_minds",
        power: lines.filter((l) => l.persona === persona).length + 1,
      });
    }
    if (!lines.length) return null;
    return {
      ok: true,
      brains: true,
      provider: lines[0].provider || "free_minds",
      free_minds: true,
      lines,
    };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pure scene seed — NO "Reply ONLY as…" (models/aether echo that into the bubble).
 * @param {"mjolnir"|"caduceus"} persona
 * @param {string} event grab|toss|bonk|press|…
 */
export function sceneSeed(persona, event = "grab") {
  const isCad = persona === "caduceus";
  const who = isCad ? "Caduceus" : "Mjolnir";
  const ev = String(event || "grab").toLowerCase();

  if (ev === "toss" || ev === "fling") {
    return isCad
      ? `${who} was just tossed across the map. Mjolnir is watching. The wielder is laughing.`
      : `${who} was just flung across the sky. Caduceus is watching. The wielder is laughing.`;
  }
  if (ev === "bonk" || ev === "spar") {
    return isCad
      ? `${who} just clinked into Mjolnir — a playful bonk. The wielder is right here.`
      : `${who} just clinked into Caduceus — a playful bonk. The wielder is right here.`;
  }
  if (ev === "react") {
    return isCad
      ? `Mjolnir just spoke. The wielder is still holding ${who}.`
      : `Caduceus just spoke. The wielder is still holding ${who}.`;
  }
  // grab / press / default
  return isCad
    ? `The wielder just gripped ${who}. Mjolnir is nearby.`
    : `The wielder just gripped ${who}. Caduceus is nearby.`;
}

/** One-shot line via free agent chat (secure public endpoint, no keys). */
export async function freeMindsSpeak(persona, message, opts = {}) {
  const agent_id = persona === "caduceus" ? "caduceus" : "thor";
  const id = persona === "caduceus" ? "caduceus" : "mjolnir";
  // Never forward long director prompts — they leak into aether replies
  let seed = String(message || "").trim();
  if (!seed || seed.length > 220 || looksLikePromptLeak(seed) || /^Reply ONLY as\b/i.test(seed)) {
    seed = sceneSeed(id, opts.event || "grab");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 35000);
  try {
    const res = await fetch(`${CAMP_API}/api/firmament/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        agent_id,
        message: seed,
        ambient: true,
        skip_memory: true,
        visitor_name: "Wielder",
      }),
      signal: ctrl.signal,
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
    });
    if (!res.ok) return null;
    const data = await res.json();
    let text = trimSpeech(data.reply || data.text || "");
    // Reject seed echoes
    if (text && seed && text.toLowerCase().includes(seed.toLowerCase().slice(0, 40))) {
      text = "";
    }
    if (!text || !isStrongLine(text) || looksLikePromptLeak(text)) return null;
    // Prefer real free backends; aether is ok only if it's a strong clean line
    return {
      text,
      provider: data.backend || "free_minds",
      persona: id,
    };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Lightweight health — free_minds flag from camp */
export async function freeMindsHealth() {
  try {
    const res = await fetch(`${CAMP_API}/api/health`, {
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return {
      ok: !!data.ok,
      free_minds: data.free_minds !== false,
      backend: data.llm_backend || "free",
    };
  } catch (_) {
    return { ok: false };
  }
}

window.TelephantimFreeMinds = {
  freeMindsBanter,
  freeMindsSpeak,
  freeMindsHealth,
  polishSpeech,
  isStrongLine,
  looksLikePromptLeak,
  sceneSeed,
};
