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
 */

const CAMP_API = "https://telephanti.com";

function mapAgent(id) {
  const a = String(id || "").toLowerCase();
  if (a === "thor" || a === "odin" || a === "mjolnir") return "mjolnir";
  if (a === "caduceus") return "caduceus";
  return null;
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

/** Reject camp garbage / empty lines so caller can fall through to cache */
export function isStrongLine(text) {
  const t = String(text || "").trim();
  if (t.length < 36) return false;
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
 * Dual banter via Luna Camp free minds (Grok when available, aether offline native templates otherwise).
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
          "Telephantim dual relics for the Wielder: longer natural banter. Mjolnir gifts POWER, Caduceus gifts HEALING. Witty, warm, mythic. No camp meta, no seeds, no tech talk.",
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

/** Build a tight interaction prompt camp agents actually answer well */
function buildSpeakMessage(persona, message) {
  if (message && String(message).trim().length > 12) return String(message).slice(0, 900);
  const isCad = persona === "caduceus";
  if (isCad) {
    return (
      "Reply ONLY as Caduceus, living staff of Hermes (twin snakes, healing, balance). " +
      "2 to 4 vivid sentences to the Wielder. Gift HEALING. Warm, witty, mythic. " +
      "No camp meta, no seeds, no other characters' dialogue, no tech words."
    );
  }
  return (
    "Reply ONLY as Mjolnir, living hammer of Thor (thunder, courage, power). " +
    "2 to 4 vivid sentences to the Wielder. Gift POWER. Warm, bold, mythic. " +
    "No camp meta, no seeds, no other characters' dialogue, no tech words."
  );
}

/** One-shot line via free agent chat (secure public endpoint, no keys). */
export async function freeMindsSpeak(persona, message) {
  const agent_id = persona === "caduceus" ? "caduceus" : "thor";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 35000);
  try {
    const res = await fetch(`${CAMP_API}/api/firmament/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        agent_id,
        message: buildSpeakMessage(persona, message),
        visitor_name: "Wielder",
      }),
      signal: ctrl.signal,
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = trimSpeech(data.reply || data.text || "");
    if (!text || !isStrongLine(text)) return null;
    return {
      text,
      provider: data.backend || "free_minds",
      persona: persona === "caduceus" ? "caduceus" : "mjolnir",
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
};
