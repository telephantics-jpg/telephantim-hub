/**
 * Free / native minds — same path as Luna Camp 2D.
 *
 * Camp principle: brains stay on telephanti.com (free_minds + aether offline),
 * no visitor API keys, CORS open. When that fails, personality.js falls through
 * to browser WebLLM / scripted duel.
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

function trimSpeech(text) {
  let t = String(text || "")
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
  // Camp free minds sometimes append long "camp air" tails — keep the first beat
  const cut = t.search(/\n\n(The corona|Camp is wide|Out here I'm also|Recent camp air|little camp marks)/i);
  if (cut > 40) t = t.slice(0, cut).trim();
  if (t.length > 420) {
    const sp = t.lastIndexOf(" ", 417);
    t = (sp > 200 ? t.slice(0, sp) : t.slice(0, 417)) + "…";
  }
  return t;
}

/**
 * Dual banter via Luna Camp free minds (Grok when available, aether offline native templates otherwise).
 * @returns {Promise<{ok:true, brains:boolean, provider:string, lines:Array}|null>}
 */
export async function freeMindsBanter(topic, rounds = 3) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(`${CAMP_API}/api/firmament/camp/banter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        agent_a: "thor",
        agent_b: "caduceus",
        rounds: Math.max(1, Math.min(4, rounds || 3)),
        topic:
          topic ||
          "Telephantim relics — Mjolnir and Caduceus, power and healing, short witty mythic banter for the wielder",
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
      if (!persona || !text) continue;
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
        message:
          message ||
          (agent_id === "thor"
            ? "Speak as living Mjolnir — short gift of POWER to the wielder."
            : "Speak as living Caduceus — short gift of HEALING to the wielder."),
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
    if (!text) return null;
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

window.TelephantimFreeMinds = { freeMindsBanter, freeMindsSpeak, freeMindsHealth };
