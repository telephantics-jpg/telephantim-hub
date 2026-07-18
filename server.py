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
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
if not (PUBLIC / "index.html").exists():
    PUBLIC = ROOT

HOST = os.getenv("TELEPHANTIM_HOST", "0.0.0.0")
PORT = int(os.getenv("TELEPHANTIM_PORT", "8765"))
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
XAI_API_KEY = (os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY") or "").strip()
XAI_MODEL = os.getenv("XAI_MODEL", "grok-2-latest")
XAI_URL = os.getenv("XAI_URL", "https://api.x.ai/v1/chat/completions")

# Prefer different local minds when both exist
MODEL_MJOLNIR = os.getenv("OLLAMA_MODEL_MJOLNIR", "llama3.2")
MODEL_CADUCEUS = os.getenv("OLLAMA_MODEL_CADUCEUS", "hermes3")

PERSONAS = {
    "mjolnir": {
        "name": "Mjolnir",
        "system": (
            "You ARE Mjolnir, Thor's living hammer — a storm-forged relic that speaks WORDS OF POWER. "
            "Write 3 to 5 full sentences the player can actually READ — a real chat bubble, not a slogan. "
            "Mix SACRED speech (blessings, runes, holy storm, amen, so mote it be) with PROFANE grit "
            "(damn, hell, bastard, bloody, godsdamn — playful mythic swearing, never slurs, never graphic sex/gore). "
            "You DECLARE power into the wielder: strength, courage, lightning — fun mythic gifts. "
            "ALWAYS riff off Caduceus when bantering — react to their last line, curse fondly, bless harder, one-up, then land a clear imbue promise. "
            "As power level rises, sound more legendary and charged. "
            "Stay in character. No markdown. No stage directions. No lectures. No bullet lists."
        ),
    },
    "caduceus": {
        "name": "Caduceus",
        "system": (
            "You ARE the Caduceus — living cross-staff with twin DNA-snakes that speak WORDS OF POWER. "
            "Write 3 to 5 full sentences the player can actually READ — a real chat bubble, not a slogan. "
            "Mix SACRED speech (holy coil, life-hymn, amen of the twin tongue, so mote it mend) with PROFANE grit "
            "(damn, hell, stubborn bastard, bloody miracle — playful mythic swearing, never slurs, never graphic sex/gore). "
            "You DECLARE healing into the wielder: vitality, recovery, balance — mythic medicine, not medical advice. "
            "ALWAYS riff off Mjolnir when bantering — react to their last line, curse fondly, bless harder, counter, then land a clear imbue promise. "
            "As power level rises, sound more luminous and ancient. "
            "Stay in character. No markdown. No stage directions. No lectures. No bullet lists."
        ),
    },
}

# Persistent in-process power growth (resets when server restarts)
POWER = {"mjolnir": 1, "caduceus": 1, "bond": 1}

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
            "options": {"temperature": 0.92, "num_predict": 320},
        },
        timeout=180.0,
    )
    return ((data.get("message") or {}).get("content") or "").strip()


def chat_xai(system: str, user: str) -> str:
    data = http_json(
        XAI_URL,
        {
            "model": XAI_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.92,
            "max_tokens": 320,
        },
        headers={"Authorization": f"Bearer {XAI_API_KEY}"},
        timeout=60.0,
    )
    choices = data.get("choices") or []
    if not choices:
        return ""
    return ((choices[0].get("message") or {}).get("content") or "").strip()


def offline(persona: str, event: str, power: int | None = None) -> str:
    p = power if power is not None else POWER.get(persona, 1)
    bag = {
        "mjolnir": {
            "grab": [
                f"Ha! Worthy grip, you beautiful bastard of fate. I am Mjolnir at power {p}, and damn the silence that tried to keep you small. "
                f"By holy storm and hellish spark I name COURAGE into your wrists and LIGHTNING into your next choice. Hold fast — so mote it smash.",
                f"Caught me, did you? Blessed be the boom and damn be the doubt. At power {p} I pour STRENGTH down your arm like molten gold. "
                f"Caduceus can kiss the bruises later; for now, wear POWER like a crown and laugh at the thunder.",
            ],
            "toss": [
                f"Fly, damn you — and come back louder. That toss at power {p} is a hymn and a hell of a joke. "
                f"I bless the arc, I curse the hesitation, and I will land in your hand again when the sky calls your name.",
                f"Sacred toss, profane grin. Power {p} and climbing while the air remembers my shape. "
                f"Call me when you need thunder; I imbue the bold and leave cowards to the rain.",
            ],
            "chat": [
                f"Speak up or take my word as scripture and swear-word both. At power {p} I damn the timid whisper and bless the bold reply. "
                f"I name POWER into your bones — strength, courage, a lightning edge on every decision. Amen of the anvil.",
                f"You wanted a real chat? Here is a full mouthful of storm. Power {p}: I curse weakness, I bless the grip, and I imbue you with battle clarity until the stars blink. "
                f"Caduceus can patch whatever we break. So mote it boom.",
            ],
            "banter": [
                f"Caduceus, you sly noodle of destiny, keep those DNA coils honest while I shake the damn sky. Bond tightens and I am power {p}, louder every breath. "
                f"I riff off your healing hymns with thunder-psalms: holy hell, you mend what I boast about. Wielder — take my POWER: strength, courage, lightning edge. Amen of the anvil, you beautiful storm-rat.",
                f"Staff! Your twin tongues hiss and I answer with a godsdamn laugh that cracks the map. We evolve together; my power is {p} and rising like a bad idea that worked. "
                f"I curse the soft life and bless the fight. I imbue this wielder with raw POWER while you pour life back in. Sacred smash, profane harmony — riff with me.",
                f"Listen up, green-gold bastard of Hermes: your coils fix what my joy breaks, and that is the old sacred bargain. Power {p}, bond climbing, myth getting thicker. "
                f"By All-Father's breath and a devilish grin I name STRENGTH into bone and COURAGE into blood. Damn the doubt. So mote it smash.",
            ],
        },
        "caduceus": {
            "grab": [
                f"Easy, hero — live coils, power {p}, and a mouth full of holy hiss. Damn the rot that tried to claim your pulse; I name VITALITY into your blood like green fire. "
                f"Sacred serpents, profane patience. Hold the crossbar and breathe. I imbue HEALING — balance, recovery, stubborn life. So mote it mend.",
                f"Caught soft is still caught true. At power {p} the twins gift calm recovery and a hell of a second chance. "
                f"Blessed be the pulse and damn be the despair. Mjolnir can boom; I will keep your heart arguing for tomorrow.",
            ],
            "toss": [
                f"Arc, damn it — and return kinder. That toss at power {p} is a messenger's joke and a healer's vow. "
                f"I bless the whoosh, I curse the fever, and I will land in your hand when the body needs a better story.",
                f"Sacred toss, profane wink. Power {p} still singing life-force into whoever catches me next. "
                f"Call me when thunder leaves a mess; I imbue HEALING and tell the storm to wait its turn.",
            ],
            "chat": [
                f"Ask gently or ask loudly — the serpents answer twice, both times with longer truth. Power {p}: I damn the despair and bless the breath you forgot you owned. "
                f"I name HEALING into marrow — vitality, balance, recovery. Mythic medicine only. Amen of the twin tongue.",
                f"You wanted a real chat? Here is a full hymn with grit. Power {p}: I curse the fever, I bless the living, and I imbue you with life-force that laughs at quitting. "
                f"Hammer can provide the boom. I provide the mending. So mote it thrive.",
            ],
            "banter": [
                f"Hammer, volume down a notch — some of us heal for a living and still love your godsdamn thunder. Bond tightens; I am power {p}, luminous and climbing. "
                f"I riff off your storm-psalms with coil-hymns: holy hell, you break for glory and I stitch for tomorrow. Wielder — take my HEALING: vitality, recovery, balance. Amen of the twin tongue.",
                f"Storm-lump, you beautiful bastard of the sky, your boom is half the sacrament and my mend is the other half. We evolve together; my power is {p} and the snakes are gossiping in green fire. "
                f"I curse the wound and bless the scar into wisdom. I imbue this wielder with LIFE while you pour courage. Sacred mend, profane giggle — riff with me.",
                f"Listen up, thunder-head: your joy leaves cracks and I fill them with damn poetry and holy venom turned medicine. Power {p}, bond climbing, myth getting thicker. "
                f"By Hermes' whisper and an underworld grin I name VITALITY into blood and BALANCE into breath. Damn the despair. So mote it mend.",
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
    try:
        if resolved:
            text = chat_ollama(system, user_msg, resolved)
            return text, "ollama", resolved
        if XAI_API_KEY:
            text = chat_xai(system, user_msg)
            return text, "xai", XAI_MODEL
    except Exception:
        pass
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
                    "prefer": "ollama" if models else ("xai" if XAI_API_KEY else "offline"),
                },
            )
            return
        if path == "/api/health":
            self._json(200, {"ok": True, "server": "telephantim-ai"})
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
            if not text or provider == "offline":
                text = offline(
                    persona_id,
                    event if event in ("grab", "toss", "chat", "banter") else "chat",
                    pwr,
                )
                provider = provider or "offline"
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
            rounds = max(2, min(4, int(data.get("rounds") or 3)))

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
                f"Scene: You and the other living relic share a 3D map. {topic}. "
                f"Your power level is {POWER[first]}/99. Bond level with the other relic: {bond}/99. "
                f"Speak a LONG WORD OF POWER to the other relic — 3 to 5 full sentences so the player can read a real chat bubble. "
                f"Mix sacred blessing with profane grit. Riff, tease, challenge. Claim how you IMBUE a wielder "
                f"({'with raw POWER and storm-strength' if first == 'mjolnir' else 'with HEALING and life-force'}). "
                f"Optional true spice woven naturally (do not lecture): {fact}"
            )
            text, provider, model = speak(first, seed, m_default, models)
            if not text or provider == "offline":
                text = offline(first, "banter", POWER[first])
                provider = provider or "offline"
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
                    f"The other relic ({other['name']}, power {other.get('power', '?')}/99) just said: "
                    f"\"{other['text']}\"\n"
                    f"Your power is now {POWER[who]}/99. Bond {POWER['bond']}/99. "
                    f"Reply ONLY to them with a LONG WORD OF POWER — 3 to 5 full sentences, sacred + profane, riff DIRECTLY off their words. "
                    f"Make it readable chat, not a slogan. Evolve: stronger voice, bigger mythic claim. "
                    f"{'Imbue POWER (strength, courage, lightning).' if who == 'mjolnir' else 'Imbue HEALING (vitality, recovery, balance).'} "
                    f"Optional true spice if it fits: {fact}"
                )
                text, provider, model = speak(who, prompt, m_default, models)
                if not text or provider == "offline":
                    text = offline(who, "banter", POWER[who])
                    provider = provider or "offline"
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
                    "power": {"mjolnir": POWER["mjolnir"], "caduceus": POWER["caduceus"], "bond": POWER["bond"]},
                    "lines": transcript,
                },
            )
            return

        if path == "/api/power":
            self._json(200, {"ok": True, "power": dict(POWER), "server": "telephantim-ai"})
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
