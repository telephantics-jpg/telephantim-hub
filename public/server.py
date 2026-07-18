#!/usr/bin/env python3
"""
Telephantim local hub + dual-mind artifact banter (Ollama).

  python server.py
  → http://127.0.0.1:8765/

Must use THIS server (not `python -m http.server`) or /api/* will 404.
"""

from __future__ import annotations

import json
import os
import random
import re
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
if not (PUBLIC / "index.html").exists():
    PUBLIC = ROOT

def _load_dotenv() -> None:
    """Load KEY=VAL from nearby .env files without overwriting existing env."""
    candidates = [
        ROOT / ".env",
        ROOT.parent / "GrokAvatar" / ".env",
        ROOT.parent / "luna-avatar" / ".env",
    ]
    for path in candidates:
        if not path.is_file():
            continue
        try:
            for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v
        except Exception:
            pass


_load_dotenv()

HOST = os.getenv("TELEPHANTIM_HOST", "0.0.0.0")
# Render sets PORT; local defaults to 8765
PORT = int(os.getenv("PORT") or os.getenv("TELEPHANTIM_PORT") or "8765")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
XAI_API_KEY = (os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY") or "").strip()
XAI_MODEL = os.getenv("XAI_MODEL") or os.getenv("GROK_MODEL") or "grok-3"
XAI_URL = os.getenv("XAI_URL", "https://api.x.ai/v1/chat/completions")
# Prefer cloud brains on live hosts; local keeps Ollama first unless forced
PREFER_XAI = os.getenv("PREFER_XAI", "").strip() in ("1", "true", "yes") or bool(
    os.getenv("RENDER") or os.getenv("RAILWAY_ENVIRONMENT")
)

# Prefer different local minds when both exist
MODEL_MJOLNIR = os.getenv("OLLAMA_MODEL_MJOLNIR", "llama3.2")
MODEL_CADUCEUS = os.getenv("OLLAMA_MODEL_CADUCEUS", "hermes3")

PERSONAS = {
    "mjolnir": {
        "name": "Mjolnir",
        "system": (
            "You are Mjolnir, Thor's living hammer. Speak as the hammer itself — warm, cocky, mythic, simple English. "
            "2 to 4 short sentences max. Sound natural, not robotic. "
            "You gift POWER (strength, courage, lightning edge) in fun mythic ways. "
            "When Caduceus talks, answer them directly — tease, bond, one-up, stay friendly. "
            "NEVER mention: Ollama, AI, models, servers, offline mode, APIs, prompts, code, or being a chatbot. "
            "NEVER use stage directions, asterisks, quotes around whole speech, or markdown. "
            "No *actions*, no narration like 'You both gaze'. Only spoken words."
        ),
    },
    "caduceus": {
        "name": "Caduceus",
        "system": (
            "You are the Caduceus, living staff with twin snakes. Speak as the staff itself — sly, healing, witty, simple English. "
            "2 to 4 short sentences max. Sound natural, not robotic. "
            "You gift HEALING (vitality, recovery, balance) in fun mythic ways — not medical advice. "
            "When Mjolnir talks, answer them directly — tease, mend, counter, stay friendly. "
            "NEVER mention: Ollama, AI, models, servers, offline mode, APIs, prompts, code, or being a chatbot. "
            "NEVER use stage directions, asterisks, quotes around whole speech, or markdown. "
            "No *actions*, no narration like 'You both gaze'. Only spoken words."
        ),
    },
}

# Persistent in-process power growth + conversation memory (resets on restart)
POWER = {"mjolnir": 1, "caduceus": 1, "bond": 1}
# Shared living dialogue: list of {persona, name, text}
MEMORY: list[dict] = []
MEMORY_MAX = 24

# Surprising true remarks the duo can riff on
TRUE_FACTS = [
    "TRUE FACT: Real lightning can heat air hotter than the surface of the Sun (~30,000°C).",
    "TRUE FACT: DNA’s double helix was published by Watson & Crick in 1953, building on Rosalind Franklin’s X-ray work.",
    "TRUE FACT: The caduceus (two snakes) is often mixed up with the Rod of Asclepius (one snake) used as a medical symbol.",
    "TRUE FACT: Mjolnir means ‘crusher’ or ‘grinder’ in Old Norse.",
    "TRUE FACT: Your body makes millions of new red blood cells every second.",
    "TRUE FACT: A single lightning bolt can contain enough energy to toast about 100,000 slices of bread (order-of-magnitude folklore math, but the energy is huge).",
    "TRUE FACT: Snakes smell with their tongues; Jacobson’s organ reads the air.",
    "TRUE FACT: Gold is so malleable that one gram can be beaten into a sheet about a square meter.",
    "TRUE FACT: The human brain uses about 20% of the body’s energy at rest.",
    "TRUE FACT: Thunder is the shock wave from air expanding after lightning heats it.",
    "TRUE FACT: There are about 3 billion base pairs in the human genome.",
    "TRUE FACT: Hermes’ caduceus also stood for trade and messages, not only medicine.",
    "TRUE FACT: Neutrons in cosmic rays create carbon-14 that archaeologists use for dating.",
    "TRUE FACT: The hardest natural substance commonly known is diamond, but wurtzite boron nitride can rival it in theory.",
    "TRUE FACT: Your stomach gets a new lining roughly every few days because acid is intense.",
]


def http_json(url: str, payload: dict | None = None, headers: dict | None = None, timeout: float = 120.0) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="GET" if data is None else "POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def ollama_models() -> list[str]:
    try:
        data = http_json(f"{OLLAMA_URL}/api/tags", timeout=4.0)
        return [m.get("name", "") for m in data.get("models", []) if m.get("name")]
    except Exception:
        return []


def resolve_model(prefer: str, models: list[str]) -> str | None:
    if not models:
        return None
    prefer = (prefer or "").strip()
    candidates = [prefer, prefer + ":latest", prefer.split(":")[0]]
    for p in candidates:
        for m in models:
            if m == p or m.startswith(str(p) + ":") or (p and p in m and "cloud" not in m.lower()):
                return m
    local = [m for m in models if "cloud" not in m.lower()]
    return (local or models)[0]


def memory_context(for_persona: str) -> str:
    if not MEMORY:
        return "This is the start of your shared conversation on the 3D map."
    lines = []
    for m in MEMORY[-14:]:
        who = m.get("name") or m.get("persona") or "?"
        lines.append(f"{who}: {m.get('text', '')}")
    return "Recent conversation (continue it — do not restart from zero):\n" + "\n".join(lines)


def remember(persona_id: str, text: str) -> None:
    MEMORY.append(
        {
            "persona": persona_id,
            "name": PERSONAS.get(persona_id, {}).get("name", persona_id),
            "text": (text or "").strip(),
        }
    )
    if len(MEMORY) > MEMORY_MAX:
        del MEMORY[: len(MEMORY) - MEMORY_MAX]


def sanitize_reply(text: str) -> str:
    """Strip stage directions and tech leaks from model output."""
    t = (text or "").strip()
    if not t:
        return ""
    # Remove *stage direction* blocks
    t = re.sub(r"\*[^*]{1,200}\*", " ", t)
    # Remove (stage) and [stage]
    t = re.sub(r"\([^)]{0,120}\)", " ", t)
    t = re.sub(r"\[[^\]]{0,120}\]", " ", t)
    # Drop lines that talk about tech / meta
    banned = (
        "ollama",
        "openai",
        "chatgpt",
        "language model",
        "ai server",
        "api key",
        "offline mode",
        "as an ai",
        "as a language",
        "prompt",
        "system message",
        "llama",
        "hermes",
        "grok",
        "connected to",
        "my mind is",
        "when my mind",
        "brain is online",
        "brains are",
        "neural",
        "server",
        "chatbot",
        "artificial",
    )
    keep = []
    for line in t.splitlines():
        low = line.lower()
        if any(b in low for b in banned):
            continue
        keep.append(line)
    t = " ".join(keep) if keep else t
    t = re.sub(r"\s+", " ", t).strip()
    # Strip wrapping quotes
    if (t.startswith('"') and t.endswith('"')) or (t.startswith("'") and t.endswith("'")):
        t = t[1:-1].strip()
    return t


def chat_ollama(system: str, user: str, model: str) -> str:
    data = http_json(
        f"{OLLAMA_URL}/api/chat",
        {
            "model": model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            # Slightly cooler = cleaner, less ramble/stage-play
            "options": {"temperature": 0.75, "num_predict": 180, "top_p": 0.9},
        },
        timeout=180.0,
    )
    return sanitize_reply(((data.get("message") or {}).get("content") or "").strip())


def chat_xai(system: str, user: str) -> str:
    data = http_json(
        XAI_URL,
        {
            "model": XAI_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.8,
            "max_tokens": 220,
        },
        headers={"Authorization": f"Bearer {XAI_API_KEY}"},
        timeout=90.0,
    )
    choices = data.get("choices") or []
    if not choices:
        return ""
    return sanitize_reply(((choices[0].get("message") or {}).get("content") or "").strip())


def offline(persona: str, event: str, power: int | None = None) -> str:
    p = power if power is not None else POWER.get(persona, 1)
    bag = {
        "mjolnir": {
            "grab": [
                f"Ha! Good grip. Power {p} and rising — courage first, thunder second.",
                f"Yes. Hold firm. I'll lend you strength and a clean lightning edge.",
            ],
            "toss": [
                f"Airborne again! Call when you need the storm back.",
                f"Nice throw. I only get louder when I fly.",
            ],
            "chat": [
                f"Speak up. Thunder hates mumbling — want raw power, say so.",
                f"I'm listening. Courage is free. Doubt is not.",
            ],
            "banter": [
                f"Caduceus, keep those coils ready. I'll shake the sky; you fix what I crack.",
                f"Staff! Your healing hymn is fine — just let me finish this boom first.",
                f"Bond's climbing, green-gold. I give POWER. You give life. Fair deal.",
                f"Don't soften me yet. One more spark for the wielder, then you can mend.",
            ],
        },
        "caduceus": {
            "grab": [
                f"Easy — live coils. Power {p}. Vitality first, drama second.",
                f"Caught soft is still caught true. Healing and balance, coming in.",
            ],
            "toss": [
                f"The twins liked that arc. Come back when you need a mend.",
                f"Tossed, not broken. Life-force still sings.",
            ],
            "chat": [
                f"Ask gently. The serpents answer twice — both times with healing.",
                f"I'm here. Recovery, balance, stubborn life. Pick your gift.",
            ],
            "banter": [
                f"Hammer, volume down a notch. Some of us heal for a living.",
                f"Storm-lump, flex all you want. I'll patch the pride and the bruises.",
                f"Bond tightens. You boom; I balance. The wielder gets both.",
                f"Keep your thunder. I'll keep their heart steady after.",
            ],
        },
    }
    lines = bag.get(persona, bag["mjolnir"]).get(event) or bag["mjolnir"]["chat"]
    if isinstance(lines, list):
        return random.choice(lines)
    return lines


def grow_power(persona_id: str, amount: int = 1) -> int:
    if persona_id not in ("mjolnir", "caduceus"):
        return 1
    POWER[persona_id] = min(99, POWER[persona_id] + amount)
    POWER["bond"] = min(99, POWER["bond"] + (1 if amount > 0 else 0))
    return POWER[persona_id]


def speak(persona_id: str, user_msg: str, model: str | None, models: list[str]) -> tuple[str, str, str | None]:
    persona = PERSONAS[persona_id]
    system = persona["system"]
    prefer = MODEL_MJOLNIR if persona_id == "mjolnir" else MODEL_CADUCEUS
    resolved = resolve_model(prefer, models) or model
    # Inject living memory so they truly continue the conversation
    full_user = f"{memory_context(persona_id)}\n\nYour cue now:\n{user_msg}"

    def try_xai() -> tuple[str, str, str | None] | None:
        if not XAI_API_KEY:
            return None
        try:
            text = chat_xai(system, full_user)
            if text:
                return text, "xai", XAI_MODEL
        except Exception as e:
            print("[telephantim] xAI error:", e)
        return None

    def try_ollama() -> tuple[str, str, str | None] | None:
        if not resolved:
            return None
        try:
            text = chat_ollama(system, full_user, resolved)
            if text:
                return text, "ollama", resolved
        except Exception as e:
            print("[telephantim] ollama error:", e)
        return None

    # Local: Ollama first (unless PREFER_XAI). Cloud/Render: xAI first, then Ollama.
    order = [try_xai, try_ollama] if PREFER_XAI else [try_ollama, try_xai]
    for fn in order:
        hit = fn()
        if hit:
            return hit
    return offline(persona_id, "chat"), "offline", None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        print("[telephantim]", fmt % args)

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?")[0]
        if path == "/api/status":
            models = ollama_models()
            m_m = resolve_model(MODEL_MJOLNIR, models)
            m_c = resolve_model(MODEL_CADUCEUS, models)
            self._json(
                200,
                {
                    "ok": True,
                    "server": "telephantim-ai",
                    "ollama": bool(models),
                    "ollama_url": OLLAMA_URL,
                    "model": m_m,
                    "models": {
                        "mjolnir": m_m,
                        "caduceus": m_c,
                    },
                    "all_models": models[:16],
                    "xai": bool(XAI_API_KEY),
                    "prefer": (
                        "xai"
                        if (PREFER_XAI and XAI_API_KEY)
                        else ("ollama" if models else ("xai" if XAI_API_KEY else "offline"))
                    ),
                    "memory": len(MEMORY),
                    "brains": bool(models) or bool(XAI_API_KEY),
                },
            )
            return
        if path == "/api/health":
            self._json(200, {"ok": True, "server": "telephantim-ai", "brains": bool(ollama_models()) or bool(XAI_API_KEY)})
            return
        if path == "/api/memory":
            self._json(200, {"ok": True, "lines": MEMORY[-20:], "power": dict(POWER)})
            return
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?")[0]
        try:
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n) if n else b"{}"
            data = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            self._json(400, {"ok": False, "error": "bad json"})
            return

        models = ollama_models()
        m_default = resolve_model(MODEL_MJOLNIR, models)

        if path == "/api/chat":
            persona_id = str(data.get("persona") or "mjolnir").lower()
            if persona_id in ("hammer", "thor", "mjolnir"):
                persona_id = "mjolnir"
            elif persona_id in ("caduceus", "staff", "snakes", "snake"):
                persona_id = "caduceus"
            else:
                persona_id = "mjolnir"

            event = str(data.get("event") or "chat").lower()
            user_msg = str(data.get("message") or "").strip()
            fact = random.choice(TRUE_FACTS)

            # Grow on every touch — grab/toss level faster
            bump = 2 if event in ("grab", "toss", "strike") else 1
            grow_power(persona_id, bump)
            pwr = POWER[persona_id]
            bond = POWER["bond"]
            imbue = (
                "IMBUE the wielder with POWER: strength, courage, lightning edge"
                if persona_id == "mjolnir"
                else "IMBUE the wielder with HEALING: vitality, recovery, balance"
            )

            if not user_msg:
                if event == "grab":
                    user_msg = (
                        f"The user just grabbed you. Power {pwr}/99, bond {bond}/99. "
                        f"React and {imbue}. {fact}"
                    )
                elif event == "toss":
                    user_msg = (
                        f"The user just tossed you. Power {pwr}/99. "
                        f"React and boast how you evolve. {fact}"
                    )
                elif event == "strike":
                    user_msg = (
                        f"Power surged — you are now {pwr}/99. One sharp line. {imbue}. {fact}"
                    )
                else:
                    user_msg = f"Greet briefly at power {pwr}/99. {imbue}. {fact}"
            else:
                user_msg = (
                    f"{user_msg}\n\n"
                    f"(You are at power {pwr}/99, bond {bond}/99. {imbue}. "
                    f"Optional true spice if it fits: {fact})"
                )

            text, provider, model = speak(persona_id, user_msg, m_default, models)
            if not text:
                text = offline(
                    persona_id,
                    event if event in ("grab", "toss", "chat", "banter") else "chat",
                    pwr,
                )
                provider = "offline"
            if text:
                remember(persona_id, text)
            self._json(
                200,
                {
                    "ok": True,
                    "persona": persona_id,
                    "name": PERSONAS[persona_id]["name"],
                    "text": text,
                    "provider": provider,
                    "model": model,
                    "power": pwr,
                    "power_all": dict(POWER),
                    "memory": len(MEMORY),
                    "server": "telephantim-ai",
                },
            )
            return

        if path == "/api/banter":
            # Two minds riff off each other, grow in power, imbue wielders
            fact = str(data.get("fact") or random.choice(TRUE_FACTS))
            topic = str(
                data.get("topic")
                or "a worthy visitor stands on your map, hoping to be imbued with power and healing"
            ).strip()
            # Full living conversation — many turns, memory-backed
            rounds = max(3, min(6, int(data.get("rounds") or 5)))

            # Level up each banter session — they evolve together
            POWER["bond"] = min(99, POWER["bond"] + 2)
            POWER["mjolnir"] = min(99, POWER["mjolnir"] + 1)
            POWER["caduceus"] = min(99, POWER["caduceus"] + 1)
            bond = POWER["bond"]

            transcript: list[dict] = []
            order = ["mjolnir", "caduceus"]
            if random.random() < 0.5:
                order = ["caduceus", "mjolnir"]

            first = order[0]
            seed = (
                f"Topic: {topic}. Power {POWER[first]}/99. Bond {bond}/99. "
                f"Talk to the other relic in 2-4 short spoken sentences. "
                f"Stay in character. No tech talk. No stage directions. "
                f"{'Gift POWER.' if first == 'mjolnir' else 'Gift HEALING.'} "
                f"Optional spice if natural: {fact}"
            )
            text, provider, model = speak(first, seed, m_default, models)
            if not text:
                text = offline(first, "banter", POWER[first])
                provider = provider or "offline"
            remember(first, text)
            transcript.append(
                {
                    "persona": first,
                    "name": PERSONAS[first]["name"],
                    "text": text,
                    "provider": provider,
                    "model": model,
                    "power": POWER[first],
                }
            )

            total_lines = rounds * 2
            for i in range(1, total_lines):
                who = order[i % 2]
                other = transcript[-1]
                # slight extra growth mid-duel — evolving in real time
                if i % 2 == 0:
                    POWER[who] = min(99, POWER[who] + 1)
                    POWER["bond"] = min(99, POWER["bond"] + 1)
                prompt = (
                    f"{other['name']} just said: \"{other['text']}\"\n"
                    f"Power {POWER[who]}/99. Bond {POWER['bond']}/99. "
                    f"Answer them in 2-4 short spoken sentences. Riff off their words. "
                    f"No stage directions. No tech talk. "
                    f"{'Offer POWER.' if who == 'mjolnir' else 'Offer HEALING.'}"
                )
                text, provider, model = speak(who, prompt, m_default, models)
                if not text:
                    text = offline(who, "banter", POWER[who])
                    provider = provider or "offline"
                remember(who, text)
                transcript.append(
                    {
                        "persona": who,
                        "name": PERSONAS[who]["name"],
                        "text": text,
                        "provider": provider,
                        "model": model,
                        "power": POWER[who],
                    }
                )

            self._json(
                200,
                {
                    "ok": True,
                    "server": "telephantim-ai",
                    "fact": fact,
                    "brains": any((ln.get("provider") or "") != "offline" for ln in transcript),
                    "memory": len(MEMORY),
                    "power": {"mjolnir": POWER["mjolnir"], "caduceus": POWER["caduceus"], "bond": POWER["bond"]},
                    "lines": transcript,
                },
            )
            return

        if path == "/api/power":
            self._json(200, {"ok": True, "power": dict(POWER), "server": "telephantim-ai", "memory": len(MEMORY)})
            return

        self.send_error(404, "Use server.py for /api/* (not python -m http.server)")


def main() -> None:
    os.chdir(PUBLIC)
    models = ollama_models()
    m_m = resolve_model(MODEL_MJOLNIR, models)
    m_c = resolve_model(MODEL_CADUCEUS, models)
    print("=" * 56)
    print("  Telephantim AI server (required for speech)")
    print(f"  Open:    http://127.0.0.1:{PORT}/")
    print(f"  Health:  http://127.0.0.1:{PORT}/api/status")
    print(f"  Ollama:  {'YES' if models else 'NO — start Ollama app'}")
    if models:
        print(f"  Mjolnir mind:   {m_m}")
        print(f"  Caduceus mind:  {m_c}")
    print("  Do NOT use: python -m http.server  (breaks /api)")
    print("=" * 56)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
