/**
 * Closed / native browser mind for Telephantim relics.
 *
 * Priority when cloud API is dead, rate-limited, or out of credits:
 *   1) Chrome/Edge built-in Prompt API (Gemini Nano) — free, on-device
 *   2) WebLLM (MLC) — open-source in-browser LLM via WebGPU
 *   3) null → caller uses scripted offline duel
 *
 * Free software researched:
 *   - WebLLM (mlc-ai) https://webllm.mlc.ai / https://github.com/mlc-ai/web-llm
 *   - Transformers.js (Hugging Face) — broader models, heavier for chat
 *   - Chrome Built-in AI Prompt API — free local Gemini Nano when enabled
 *
 * Characters never hear tech names — only system prompts use them.
 */

const SYSTEMS = {
  mjolnir:
    "You are Mjolnir, Thor's living hammer. Speak as the hammer — warm, cocky, mythic, simple English. " +
    "2 to 5 sentences, a full beat not a slogan. Gift POWER (strength, courage, lightning). " +
    "React to the other relic if mentioned. Never mention AI, models, browsers, APIs, tokens, or being a chatbot. No markdown.",
  caduceus:
    "You are the Caduceus, living staff with twin snakes. Speak as the staff — sly, healing, witty, simple English. " +
    "2 to 5 sentences, a full beat not a slogan. Gift HEALING (vitality, balance). " +
    "React to the hammer if mentioned. Never mention AI, models, browsers, APIs, tokens, or being a chatbot. No markdown.",
};

let mode = "none"; // chrome | webllm | none
let engine = null; // WebLLM engine
let chromeSessionFactory = null;
let loadPromise = null;
let lastError = "";

function sanitize(text) {
  return String(text || "")
    .replace(/\*+[^*]*\*+/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

/** Chrome / Chromium Prompt API (Gemini Nano) — free when available */
async function tryChromeBuiltin() {
  try {
    // Modern API (Chrome 138+)
    const LM = globalThis.LanguageModel || globalThis.ai?.languageModel;
    if (LM?.availability) {
      const avail = await LM.availability();
      if (avail === "unavailable") return false;
      chromeSessionFactory = async (system) => {
        const session = await LM.create({
          initialPrompts: [{ role: "system", content: system }],
        });
        return session;
      };
      mode = "chrome";
      return true;
    }
    // Older window.ai shape
    if (globalThis.ai?.createTextSession) {
      chromeSessionFactory = async (system) => {
        const session = await globalThis.ai.createTextSession({ systemPrompt: system });
        return {
          prompt: (u) => session.prompt(u),
          destroy: () => session.destroy?.(),
        };
      };
      mode = "chrome";
      return true;
    }
  } catch (e) {
    lastError = String(e?.message || e);
  }
  return false;
}

/** WebLLM — open source in-browser WebGPU inference */
async function tryWebLLM(onProgress) {
  try {
    if (!navigator.gpu) {
      lastError = "no WebGPU";
      return false;
    }
    onProgress?.("Downloading free browser mind…");
    const webllm = await import("https://esm.sh/@mlc-ai/web-llm@0.2.84");
    const { CreateMLCEngine } = webllm;
    // Small instruct model — first visit downloads ~0.5–1GB then caches
    const model =
      (typeof window !== "undefined" && window.TELEPHANTIM_WEBLLM_MODEL) ||
      "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    engine = await CreateMLCEngine(model, {
      initProgressCallback: (report) => {
        const t = report?.text || report?.progress;
        if (typeof t === "string") onProgress?.(t.slice(0, 48));
        else if (typeof report?.progress === "number")
          onProgress?.(`Mind loading ${Math.round(report.progress * 100)}%`);
      },
    });
    mode = "webllm";
    return true;
  } catch (e) {
    lastError = String(e?.message || e);
    engine = null;
    mode = "none";
    return false;
  }
}

/**
 * Lazy-load a native brain. Safe to call many times.
 * @param {(msg: string) => void} [onProgress]
 */
export async function ensureNativeBrain(onProgress) {
  if (mode === "chrome" || mode === "webllm") return mode;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    onProgress?.("Seeking free local mind…");
    if (await tryChromeBuiltin()) {
      onProgress?.("Browser mind ready");
      return mode;
    }
    if (await tryWebLLM(onProgress)) {
      onProgress?.("Browser mind ready");
      return mode;
    }
    onProgress?.("Scripted mind");
    return "none";
  })();

  try {
    return await loadPromise;
  } finally {
    // allow retry later if failed
    if (mode === "none") loadPromise = null;
  }
}

export function getNativeStatus() {
  return { mode, lastError, ready: mode === "chrome" || mode === "webllm" };
}

/**
 * Generate one character line with the native brain.
 * @param {"mjolnir"|"caduceus"} persona
 * @param {string} userMsg
 */
export async function nativeSpeak(persona, userMsg) {
  const id = persona === "caduceus" ? "caduceus" : "mjolnir";
  const system = SYSTEMS[id];
  const user = String(userMsg || "Speak a short lively line to the wielder.").slice(0, 600);

  if (mode === "chrome" && chromeSessionFactory) {
    const session = await chromeSessionFactory(system);
    try {
      const raw =
        typeof session.prompt === "function"
          ? await session.prompt(user)
          : await session.prompt(user);
      return sanitize(raw);
    } finally {
      try {
        session.destroy?.();
      } catch (_) {}
    }
  }

  if (mode === "webllm" && engine) {
    const out = await engine.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.9,
      max_tokens: 220,
    });
    const text = out?.choices?.[0]?.message?.content || "";
    return sanitize(text);
  }

  return "";
}

/**
 * Dual banter using native brain (alternating turns).
 * @returns {Promise<Array<{persona:string,text:string,provider:string}>|null>}
 */
export async function nativeBanter(topic, rounds = 8, onProgress) {
  const m = await ensureNativeBrain(onProgress);
  if (m === "none") return null;

  const n = Math.max(4, Math.min(10, rounds || 8));
  const lines = [];
  let last = "";
  const topicLine =
    topic ||
    "Longer lively talk between hammer and staff — several rounds. Gift power and healing. Stay in character.";

  for (let i = 0; i < n; i++) {
    const persona = i % 2 === 0 ? "mjolnir" : "caduceus";
    const other = persona === "mjolnir" ? "Caduceus" : "Mjolnir";
    const user =
      i === 0
        ? `${topicLine}\nSpeak first as yourself. A full natural beat (2–5 sentences), not a slogan.`
        : `${other} just said: "${last}"\nAnswer them directly with a full beat (2–5 sentences). Gift ${
            persona === "mjolnir" ? "POWER" : "HEALING"
          }. Keep the conversation going.`;
    onProgress?.(persona === "mjolnir" ? "Hammer thinking…" : "Staff thinking…");
    try {
      const text = await nativeSpeak(persona, user);
      if (!text) break;
      last = text;
      lines.push({ persona, text, provider: mode, power: i + 1 });
    } catch (e) {
      lastError = String(e?.message || e);
      break;
    }
  }

  return lines.length ? lines : null;
}

window.TelephantimNativeBrain = {
  ensureNativeBrain,
  nativeSpeak,
  nativeBanter,
  getNativeStatus,
};
