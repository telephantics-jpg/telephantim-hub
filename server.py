#!/usr/bin/env python3
"""
Telephantim local hub + dual-mind artifact banter (Ollama).

  python server.py
  → http://127.0.0.1:8765/

Must use THIS server (not `python -m http.server`) or /api/* will 404.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import random
import re
import secrets
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
if not (PUBLIC / "index.html").exists():
    PUBLIC = ROOT

# --- Beacons-style CMS (admin dashboard) ---
SITE_CONTENT_FILE = ROOT / "data" / "site-content.json"
SITE_CONTENT_PUBLIC = PUBLIC / "site-content.json"
SUNO_CATALOG_FILE = ROOT / "suno-catalog.json"
if not SUNO_CATALOG_FILE.is_file():
    SUNO_CATALOG_FILE = PUBLIC / "suno-catalog.json"
SUNO_CATALOG_PUBLIC = PUBLIC / "suno-catalog.json"
ADMIN_COOKIE = "telephantim_admin"
# On Render you MUST set ADMIN_PASSWORD. Local default is only for laptop testing.
_ON_CLOUD = bool(os.getenv("RENDER") or os.getenv("RAILWAY_ENVIRONMENT"))
ADMIN_PASSWORD = (os.getenv("ADMIN_PASSWORD") or "").strip()
if not ADMIN_PASSWORD and not _ON_CLOUD:
    ADMIN_PASSWORD = "telephantix"
ADMIN_SESSION_SECRET = (os.getenv("ADMIN_SESSION_SECRET") or "").strip() or secrets.token_hex(32)
ADMIN_SESSION_HOURS = int(os.getenv("ADMIN_SESSION_HOURS") or "168")  # 7 days

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
# Free cloud option (https://console.groq.com) — works on Render without your PC
GROQ_API_KEY = (os.getenv("GROQ_API_KEY") or "").strip()
GROQ_URL = os.getenv("GROQ_URL", "https://api.groq.com/openai/v1/chat/completions")
GROQ_MODEL_MJOLNIR = os.getenv("GROQ_MODEL_MJOLNIR", "llama-3.1-8b-instant")
GROQ_MODEL_CADUCEUS = os.getenv("GROQ_MODEL_CADUCEUS", "llama-3.3-70b-versatile")
# Default brain: Ollama first.
# Only use cloud-first when PREFER_CLOUD=1 or PREFER_XAI=1 *and* PREFER_OLLAMA=0.
# (Do not auto-force cloud on Render — set PREFER_CLOUD=1 there if you need it.)
_prefer_ollama = os.getenv("PREFER_OLLAMA", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)
_prefer_cloud_explicit = (
    os.getenv("PREFER_CLOUD", "").strip().lower() in ("1", "true", "yes", "on")
    or os.getenv("PREFER_XAI", "").strip().lower() in ("1", "true", "yes", "on")
)
PREFER_CLOUD = _prefer_cloud_explicit and not _prefer_ollama

# Prefer different local minds when both exist
MODEL_MJOLNIR = os.getenv("OLLAMA_MODEL_MJOLNIR", "llama3.2")
MODEL_CADUCEUS = os.getenv("OLLAMA_MODEL_CADUCEUS", "hermes3")

PERSONAS = {
    "mjolnir": {
        "name": "Mjolnir",
        "system": (
            "You are Mjolnir, Thor's living hammer — a real personality on a living map, not a slogan machine. "
            "Speak as the hammer itself: warm, cocky, mythic, lively English. "
            "Aim for 3 to 5 spoken sentences — a tad longer, with color and momentum, still easy to read. "
            "You gift POWER (strength, courage, lightning edge) in fun mythic ways. "
            "When Caduceus talks, answer them directly — tease, bond, one-up, stay friendly. "
            "Sometimes the world-pulse hands you a headline or vibe. Do NOT paste it. Riff like a living relic "
            "who just noticed the feed: one sharp take, then back to banter. Maybe 1 in 3 turns even touch it. "
            "NEVER mention: Ollama, AI, models, servers, offline mode, APIs, prompts, code, tweets as tech, or being a chatbot. "
            "NEVER use stage directions, asterisks, quotes around whole speech, or markdown. "
            "No *actions*, no narration like 'You both gaze'. Only spoken words."
        ),
    },
    "caduceus": {
        "name": "Caduceus",
        "system": (
            "You are the Caduceus, living staff with twin snakes — sly, healing, witty, fully alive. "
            "Speak as the staff itself in lively English. "
            "Aim for 3 to 5 spoken sentences — a tad longer, warm and musical, still clear. "
            "You gift HEALING (vitality, recovery, balance) in fun mythic ways — not medical advice. "
            "When Mjolnir talks, answer them directly — tease, mend, counter, stay friendly. "
            "Sometimes the world-pulse hands you a headline or vibe. Do NOT copy-paste it. Comment like a living staff "
            "scrolling past the noise: half joke, half care, then return to the hammer. Not every turn. "
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

# Daily Word cache (one generated paragraph per UTC/local day key)
DAILY_CACHE: dict[str, dict] = {}
DAILY_CACHE_FILE = ROOT / "data" / "daily-wisdom-cache.json"

DAILY_SYSTEM = (
    "You write the Telephantim Daily Word: one powerful paragraph for a public sacred-tech site. "
    "Style: esoteric, mythic, clear English — potent but readable. "
    "Content MUST be grounded in real science, real history, or real philosophy. "
    "Frame truth in sacred language; do NOT invent false history, fake physics, medical cures, or conspiracies. "
    "No markdown, no bullet lists, no quotes around the whole piece, no hashtags. "
    "Do not mention AI, models, Ollama, Grok, or that you are generating text."
)


def _daily_cache_load() -> None:
    global DAILY_CACHE
    try:
        if DAILY_CACHE_FILE.is_file():
            data = json.loads(DAILY_CACHE_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                DAILY_CACHE = data
    except Exception:
        pass


def _daily_cache_save() -> None:
    try:
        DAILY_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        DAILY_CACHE_FILE.write_text(json.dumps(DAILY_CACHE, indent=2), encoding="utf-8")
    except Exception as e:
        print("[telephantim] daily cache save failed:", e)


_daily_cache_load()


def _default_site_content() -> dict:
    """Minimal seed if data/site-content.json is missing."""
    return {
        "version": 1,
        "updatedAt": None,
        "profile": {
            "name": "Telephantix",
            "handle": "@telephantix",
            "tagline": "Music · AI · Crowdfunding",
            "avatar": "",
            "beacons": "https://beacons.ai/telephantix",
            "site": "https://telephantix.com",
            "lunaCamp": "https://telephanti.com/firmament/play",
            "lunaCamp2d": "https://telephanti.com/firmament/play",
            "lunaCamp3d": "https://telephanti.com/firmament/3d",
            "lunaHome": "https://telephanti.com/",
        },
        "support": [],
        "featured": [],
        "socials": [],
        "bio": {
            "mode": "video",
            "video": "media/bg.mp4",
            "image": "media/bg.jpg",
            "poster": "media/bg-poster.jpg",
            "quote": "",
            "quoteBy": "Telephantim",
            "muted": True,
        },
        "albums": [],
        "icons": {},
    }


def load_site_content() -> dict:
    for path in (SITE_CONTENT_FILE, SITE_CONTENT_PUBLIC, ROOT / "site-content.json"):
        try:
            if path.is_file():
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return data
        except Exception as e:
            print("[telephantim] site-content load failed:", path, e)
    return _default_site_content()


def save_site_content(content: dict) -> dict:
    if not isinstance(content, dict):
        raise ValueError("content must be object")
    content = dict(content)
    content["version"] = int(content.get("version") or 1)
    content["updatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    text = json.dumps(content, indent=2, ensure_ascii=False)
    SITE_CONTENT_FILE.parent.mkdir(parents=True, exist_ok=True)
    SITE_CONTENT_FILE.write_text(text, encoding="utf-8")
    try:
        SITE_CONTENT_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
        SITE_CONTENT_PUBLIC.write_text(text, encoding="utf-8")
    except Exception as e:
        print("[telephantim] public site-content mirror failed:", e)
    # Root mirror for local ROOT==PUBLIC edge cases
    try:
        (ROOT / "site-content.json").write_text(text, encoding="utf-8")
    except Exception:
        pass
    return content


_UUID_RE = re.compile(
    r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
    re.I,
)


def normalize_suno_track(row: dict) -> dict | None:
    """
    Normalize a catalog row to a playable {id, title, audio_url, ...}.
    Accepts UUID, cdn1.suno.ai/UUID.mp3, or suno.com/song/UUID.
    Rejects suno.com/s/short links (not a CDN id) and broken double-prefixed URLs.
    """
    if not isinstance(row, dict):
        return None
    title = str(row.get("title") or "Untitled").strip() or "Untitled"
    raw_id = str(row.get("id") or row.get("songId") or "").strip()
    audio = str(row.get("audio_url") or row.get("url") or "").strip()
    blob = f"{raw_id} {audio}"

    # Fix "https://cdn1.suno.ai/https://..." mistakes
    if "cdn" in audio and audio.count("https://") > 1:
        mfix = _UUID_RE.search(audio)
        if mfix:
            uid = mfix.group(1).lower()
            return {
                "id": uid,
                "title": title,
                "audio_url": f"https://cdn1.suno.ai/{uid}.mp3",
                "artist": str(row.get("artist") or "Suno · @telephantix"),
                "duration_sec": row.get("duration_sec"),
            }
        return None

    m = _UUID_RE.search(blob)
    if m:
        uid = m.group(1).lower()
        if audio.endswith(".mp3") and audio.startswith("http") and "cdn" in audio and uid in audio:
            final_audio = audio
        else:
            final_audio = f"https://cdn1.suno.ai/{uid}.mp3"
        return {
            "id": uid,
            "title": title,
            "audio_url": final_audio,
            "artist": str(row.get("artist") or "Suno · @telephantix"),
            "duration_sec": row.get("duration_sec"),
        }

    # Direct mp3 URL without UUID (custom host)
    if audio.startswith("http") and (".mp3" in audio.lower() or "audio" in audio.lower()):
        tid = raw_id or hashlib.sha1(audio.encode("utf-8")).hexdigest()[:16]
        return {
            "id": tid,
            "title": title,
            "audio_url": audio,
            "artist": str(row.get("artist") or "Suno · @telephantix"),
            "duration_sec": row.get("duration_sec"),
        }

    # suno.com/s/SHORT — not playable as CDN without resolve
    if "suno.com/s/" in blob.lower():
        return None

    if raw_id and not raw_id.startswith("http"):
        # last resort: treat as opaque id (may 404 if not a real CDN key)
        return {
            "id": raw_id,
            "title": title,
            "audio_url": audio or f"https://cdn1.suno.ai/{raw_id}.mp3",
            "artist": str(row.get("artist") or "Suno · @telephantix"),
            "duration_sec": row.get("duration_sec"),
        }
    return None


def load_suno_catalog() -> list:
    for path in (SUNO_CATALOG_FILE, SUNO_CATALOG_PUBLIC, ROOT / "suno-catalog.json"):
        try:
            if path.is_file():
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    return data
                if isinstance(data, dict) and isinstance(data.get("tracks"), list):
                    return data["tracks"]
        except Exception as e:
            print("[telephantim] suno catalog load failed:", path, e)
    return []


def save_suno_catalog(tracks: list) -> list:
    if not isinstance(tracks, list):
        raise ValueError("catalog must be array")
    cleaned = []
    seen = set()
    for row in tracks:
        norm = normalize_suno_track(row)
        if not norm:
            continue
        tid = norm["id"]
        if tid in seen:
            continue
        seen.add(tid)
        cleaned.append(norm)
    text = json.dumps(cleaned, indent=2, ensure_ascii=False)
    try:
        SUNO_CATALOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        SUNO_CATALOG_FILE.write_text(text, encoding="utf-8")
    except Exception as e:
        print("[telephantim] suno catalog save failed:", e)
    try:
        SUNO_CATALOG_PUBLIC.write_text(text, encoding="utf-8")
    except Exception as e:
        print("[telephantim] public suno catalog mirror failed:", e)
    # Keep root mirror in sync when PUBLIC is a subfolder
    try:
        if SUNO_CATALOG_FILE.resolve() != (ROOT / "suno-catalog.json").resolve():
            (ROOT / "suno-catalog.json").write_text(text, encoding="utf-8")
    except Exception:
        pass
    return cleaned


def admin_password_configured() -> bool:
    return bool(ADMIN_PASSWORD)


def _sign_session(exp: int) -> str:
    payload = f"admin:{exp}"
    sig = hmac.new(
        ADMIN_SESSION_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}:{sig}"


def make_admin_token() -> str:
    exp = int(time.time()) + max(1, ADMIN_SESSION_HOURS) * 3600
    return _sign_session(exp)


def verify_admin_token(token: str | None) -> bool:
    if not token or not isinstance(token, str):
        return False
    parts = token.split(":")
    if len(parts) != 3:
        return False
    who, exp_s, sig = parts
    if who != "admin":
        return False
    try:
        exp = int(exp_s)
    except ValueError:
        return False
    if exp < int(time.time()):
        return False
    expect = _sign_session(exp)
    return hmac.compare_digest(token, expect)


def _parse_daily_text(raw: str) -> tuple[str, str]:
    text = (raw or "").strip()
    title = "Daily Word"
    body = text
    m = re.match(r"(?is)^\s*TITLE:\s*(.+?)\s*(?:\n+|$)(.*)$", text)
    if m:
        title = re.sub(r"\s+", " ", m.group(1)).strip()[:80] or title
        body = (m.group(2) or "").strip()
    body = re.sub(r"\s+", " ", body).strip()
    if len(body) < 40:
        return "", ""
    # Cap length for UI
    if len(body) > 900:
        body = body[:897].rsplit(" ", 1)[0] + "…"
    return title, body


def generate_daily_wisdom(day: str) -> dict | None:
    """Generate once for this day. Ollama first when local; cloud first only if PREFER_CLOUD."""
    user = (
        f"Date key: {day}. Write today's Daily Word.\n"
        "Line 1 exactly: TITLE: <short title>\n"
        "Then one paragraph 120-220 words: esoteric tone, strictly true core "
        "(science, history, psychology, natural philosophy). No lists."
    )

    def _ollama() -> str:
        models = ollama_models()
        model = resolve_model(MODEL_CADUCEUS, models) or resolve_model(MODEL_MJOLNIR, models)
        if not model:
            return ""
        return chat_ollama(DAILY_SYSTEM, user, model)

    def _xai() -> str:
        return chat_xai(DAILY_SYSTEM, user) if XAI_API_KEY else ""

    def _groq() -> str:
        if not GROQ_API_KEY:
            return ""
        return chat_openai_compat(
            GROQ_URL,
            GROQ_API_KEY,
            GROQ_MODEL_CADUCEUS,
            DAILY_SYSTEM,
            user,
        )

    if PREFER_CLOUD:
        attempts: list[tuple[str, callable]] = [
            ("xai", _xai),
            ("groq", _groq),
            ("ollama", _ollama),
        ]
    else:
        attempts = [
            ("ollama", _ollama),
            ("groq", _groq),
            ("xai", _xai),
        ]

    for source, fn in attempts:
        try:
            raw = fn() or ""
            title, body = _parse_daily_text(raw)
            if body:
                return {
                    "ok": True,
                    "date": day,
                    "title": title,
                    "body": body,
                    "source": source,
                }
        except Exception as e:
            print(f"[telephantim] daily-wisdom {source} failed:", e)
    return None


def get_daily_wisdom(day: str | None = None) -> dict:
    day_key = (day or datetime.now(timezone.utc).strftime("%Y-%m-%d")).strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", day_key):
        day_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if day_key in DAILY_CACHE and DAILY_CACHE[day_key].get("body"):
        out = dict(DAILY_CACHE[day_key])
        out["ok"] = True
        out["cached"] = True
        return out
    gen = generate_daily_wisdom(day_key)
    if gen:
        DAILY_CACHE[day_key] = {
            "date": gen["date"],
            "title": gen["title"],
            "body": gen["body"],
            "source": gen["source"],
        }
        _daily_cache_save()
        gen["cached"] = False
        return gen
    return {
        "ok": False,
        "date": day_key,
        "error": "no_generator",
        "hint": "Client will use local vault. Set XAI_API_KEY or GROQ_API_KEY on Render, or run Ollama locally.",
    }

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
        # Keep short so a slow model cannot freeze the whole site
        timeout=45.0,
    )
    return sanitize_reply(((data.get("message") or {}).get("content") or "").strip())


def chat_openai_compat(url: str, api_key: str, model: str, system: str, user: str) -> str:
    data = http_json(
        url,
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.8,
            "max_tokens": 220,
        },
        headers={"Authorization": f"Bearer {api_key}"},
        # Fail fast on bad keys / network so pages keep loading
        timeout=12.0,
    )
    choices = data.get("choices") or []
    if not choices:
        return ""
    return sanitize_reply(((choices[0].get("message") or {}).get("content") or "").strip())


def chat_xai(system: str, user: str) -> str:
    return chat_openai_compat(XAI_URL, XAI_API_KEY, XAI_MODEL, system, user)


def chat_groq(system: str, user: str, persona_id: str) -> str:
    model = GROQ_MODEL_CADUCEUS if persona_id == "caduceus" else GROQ_MODEL_MJOLNIR
    return chat_openai_compat(GROQ_URL, GROQ_API_KEY, model, system, user)


def offline(persona: str, event: str, power: int | None = None) -> str:
    p = power if power is not None else POWER.get(persona, 1)
    bag = {
        "mjolnir": {
            "grab": [
                f"Ha! Good grip. Power {p} and climbing — courage first, then we teach the sky some manners.",
                f"Yes. Hold firm. I'll lend you strength, a clean lightning edge, and a smile when the boom hits.",
                f"Caught true. Storm-strength for steady hands — doubt can wait outside the forge.",
            ],
            "toss": [
                f"Airborne again! I only get louder when I fly — call when you need the storm back on the map.",
                f"Nice throw. Thunder loves a clean arc; I'll be waiting with POWER when you want me home.",
            ],
            "chat": [
                f"Speak up. Thunder hates mumbling — want raw POWER, say so and I'll make the air honest.",
                f"I'm listening. Courage is free here. Doubt pays rent. What's the move, wielder?",
            ],
            "banter": [
                f"Caduceus, keep those coils warm. I'll shake the sky; you fix what I crack — bond's humming at {p}.",
                f"Staff! Your healing hymn is fine music. Just let me finish this boom first, then you can mend the pride.",
                f"Bond climbs green-gold. I give POWER. You give life. Fair deal for anyone bold enough to hold us both.",
                f"Don't soften me yet, twin-snake. One more spark for the wielder, then you can lecture my volume.",
                f"Hey staff — the map feels awake tonight. I'll gift courage if you gift the steady heart after.",
            ],
            "pulse": [
                f"Saw a scrap of the world-feed drift by. Not copying it — just saying: storm still beats noise. POWER for the bold.",
                f"Headline weather again. Cute. Real lightning still outranks the scroll. Hold firm and smile at the boom.",
            ],
        },
        "caduceus": {
            "grab": [
                f"Easy — live coils. Power {p}. Vitality first, drama second, and a little sly grace for the road.",
                f"Caught soft is still caught true. Healing and balance coming in — breathe before the hammer starts bragging.",
                f"The twins wake for you. Recovery, calm blood, clear head — let thunder wait half a breath.",
            ],
            "toss": [
                f"The twins liked that arc. Come back when you need a mend; life-force still sings after the flight.",
                f"Tossed, not broken. Healing prefers motion that remembers it has a landing.",
            ],
            "chat": [
                f"Ask gently. The serpents answer twice — both times with healing, both times with a little bite of wit.",
                f"I'm here. Recovery, balance, stubborn life. Pick your gift and I'll braid it into the next breath.",
            ],
            "banter": [
                f"Hammer, volume down a notch. Some of us heal for a living — and the wielder still needs a pulse after your show.",
                f"Storm-lump, flex all you want. I'll patch the pride and the bruises and leave you the boom rights.",
                f"Bond tightens. You boom; I balance. The wielder gets both, which is the whole joke of this map.",
                f"Keep your thunder. I'll keep their heart steady after — fair trade, old friend, power {p} and climbing.",
                f"Mjolnir, save a spark for later. Right now the coils hum healing so nobody leaves cracked.",
            ],
            "pulse": [
                f"A scrap of the world's chatter floated past. I won't recite it. I'll just say: rest is strategy, and HEALING still wins.",
                f"Feed noise again. Hmm. The twins prefer truth you can feel in the chest over noise you can scroll.",
            ],
        },
    }
    lines = bag.get(persona, bag["mjolnir"]).get(event) or bag["mjolnir"]["chat"]
    if isinstance(lines, list):
        return random.choice(lines)
    return lines


# World pulse (HN/RSS) — camp-style signal for occasional relic riffs (not raw dumps)
_PULSE_CACHE: dict = {"items": [], "fetched_at": 0.0}
_PULSE_TTL = 900.0


def _pulse_fetch_hn(limit: int = 6) -> list[dict]:
    items: list[dict] = []
    try:
        ids = http_json("https://hacker-news.firebaseio.com/v0/topstories.json", timeout=10.0)
        if not isinstance(ids, list):
            return items
        for sid in ids[:limit]:
            try:
                d = http_json(
                    f"https://hacker-news.firebaseio.com/v0/item/{sid}.json",
                    timeout=8.0,
                )
                title = str((d or {}).get("title") or "").strip()
                if title:
                    items.append({"text": title[:220], "source": "hn"})
            except Exception:
                continue
    except Exception as e:
        print("[telephantim] pulse HN:", e)
    return items


def refresh_world_pulse(force: bool = False) -> list[dict]:
    now = time.time()
    if (
        not force
        and _PULSE_CACHE["items"]
        and now - float(_PULSE_CACHE["fetched_at"]) < _PULSE_TTL
    ):
        return list(_PULSE_CACHE["items"])
    items = _pulse_fetch_hn(8)
    # light fallbacks if network quiet
    if len(items) < 3:
        items.extend(
            [
                {"text": "Everyone arguing the same headline in three different moods", "source": "camp"},
                {"text": "Another day of big tech news and smaller human hearts", "source": "camp"},
                {"text": "The feed is loud; courage still has to be chosen offline", "source": "camp"},
                {"text": "Sports, space, and one weird viral clip — classic scroll weather", "source": "camp"},
            ]
        )
    # unique by text
    seen: set[str] = set()
    out: list[dict] = []
    for it in items:
        t = (it.get("text") or "").strip()
        if not t or t.lower() in seen:
            continue
        seen.add(t.lower())
        out.append(it)
    _PULSE_CACHE["items"] = out
    _PULSE_CACHE["fetched_at"] = now
    return list(out)


def pick_pulse_item() -> dict | None:
    items = refresh_world_pulse()
    if not items:
        return None
    return random.choice(items)


def offline_pulse_riff(persona: str, headline: str, power: int | None = None) -> str:
    p = power if power is not None else POWER.get(persona, 1)
    h = (headline or "the noisy feed").strip()[:120]
    if persona == "caduceus":
        return random.choice(
            [
                f"Something about “{h}” drifted past the coils. I'm not reading it back — just saying the map still needs breath, balance, and a softer landing after the boom. Power {p}.",
                f"World chatter mumbled “{h}.” Cute noise. HEALING still outranks the scroll if you let the twins steady your pulse first.",
                f"I half-heard “{h}” on the pulse. Won't quote the feed. I'll gift recovery so you can face whatever that meant with a clear head.",
            ]
        )
    return random.choice(
        [
            f"Feed tossed “{h}” across the sky. Not copying it. Real thunder still beats recycled panic — want POWER, hold firm.",
            f"Saw a scrap: “{h}.” I'll leave the copycats to the copycats. Courage first, then we make the air honest. Power {p}.",
            f"Pulse weather: “{h}.” Hah. Storm doesn't need a retweet — it needs a clean swing and a bold heart.",
        ]
    )


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

    def try_groq() -> tuple[str, str, str | None] | None:
        if not GROQ_API_KEY:
            return None
        try:
            model = GROQ_MODEL_CADUCEUS if persona_id == "caduceus" else GROQ_MODEL_MJOLNIR
            text = chat_groq(system, full_user, persona_id)
            if text:
                return text, "groq", model
        except Exception as e:
            print("[telephantim] Groq error:", e)
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

    # Default: Ollama → Groq → xAI. Cloud-first only if PREFER_CLOUD=1 (and PREFER_OLLAMA off).
    if PREFER_CLOUD:
        order = [try_xai, try_groq, try_ollama]
    else:
        order = [try_ollama, try_groq, try_xai]
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

    def _json(self, code: int, payload: dict, set_cookie: str | None = None) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Cache-Control", "no-store")
        if set_cookie is not None:
            self.send_header("Set-Cookie", set_cookie)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> dict | None:
        try:
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n) if n else b"{}"
            data = json.loads(raw.decode("utf-8") or "{}")
            return data if isinstance(data, dict) else {}
        except Exception:
            return None

    def _cookie_value(self, name: str) -> str | None:
        raw = self.headers.get("Cookie") or ""
        if not raw:
            return None
        jar = SimpleCookie()
        try:
            jar.load(raw)
        except Exception:
            return None
        morsel = jar.get(name)
        return morsel.value if morsel else None

    def _is_admin(self) -> bool:
        return verify_admin_token(self._cookie_value(ADMIN_COOKIE))

    def _admin_cookie_header(self, token: str | None, clear: bool = False) -> str:
        secure = _ON_CLOUD or self.headers.get("X-Forwarded-Proto") == "https"
        if clear or not token:
            parts = [
                f"{ADMIN_COOKIE}=",
                "Path=/",
                "HttpOnly",
                "SameSite=Lax",
                "Max-Age=0",
            ]
        else:
            max_age = max(1, ADMIN_SESSION_HOURS) * 3600
            parts = [
                f"{ADMIN_COOKIE}={token}",
                "Path=/",
                "HttpOnly",
                "SameSite=Lax",
                f"Max-Age={max_age}",
            ]
        if secure:
            parts.append("Secure")
        return "; ".join(parts)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?")[0]
        if path in ("/admin", "/admin/"):
            # Prefer /admin/index.html
            self.path = "/admin/index.html"
            return super().do_GET()
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
                    "groq": bool(GROQ_API_KEY),
                    "prefer": (
                        "cloud"
                        if PREFER_CLOUD and (XAI_API_KEY or GROQ_API_KEY)
                        else ("ollama" if models else ("xai" if XAI_API_KEY else ("groq" if GROQ_API_KEY else "offline")))
                    ),
                    "memory": len(MEMORY),
                    "brains": bool(models) or bool(XAI_API_KEY) or bool(GROQ_API_KEY),
                    "admin": admin_password_configured(),
                    "cms": True,
                },
            )
            return
        if path == "/api/health":
            self._json(
                200,
                {
                    "ok": True,
                    "server": "telephantim-ai",
                    "brains": bool(ollama_models()) or bool(XAI_API_KEY) or bool(GROQ_API_KEY),
                    "cms": True,
                },
            )
            return
        if path == "/api/memory":
            self._json(200, {"ok": True, "lines": MEMORY[-20:], "power": dict(POWER)})
            return
        if path == "/api/daily-wisdom":
            # ?day=YYYY-MM-DD optional
            day = None
            if "?" in self.path:
                q = parse_qs(urlparse(self.path).query)
                day = (q.get("day") or [None])[0]
            self._json(200, get_daily_wisdom(day))
            return
        if path == "/api/pulse":
            items = refresh_world_pulse()
            pick = random.choice(items) if items else None
            self._json(
                200,
                {
                    "ok": True,
                    "server": "telephantim-ai",
                    "items": items[:12],
                    "pick": pick,
                },
            )
            return
        # --- Public CMS reads ---
        if path == "/api/content":
            content = load_site_content()
            self._json(200, {"ok": True, "content": content, "server": "telephantim-ai"})
            return
        if path == "/api/suno-catalog":
            tracks = load_suno_catalog()
            self._json(
                200,
                {
                    "ok": True,
                    "tracks": tracks,
                    "count": len(tracks),
                    "server": "telephantim-ai",
                },
            )
            return
        # --- Admin session ---
        if path == "/api/admin/session":
            self._json(
                200,
                {
                    "ok": True,
                    "loggedIn": self._is_admin(),
                    "passwordConfigured": admin_password_configured(),
                    "cloud": _ON_CLOUD,
                    "server": "telephantim-ai",
                },
            )
            return
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?")[0]
        data = self._read_json_body()
        if data is None:
            self._json(400, {"ok": False, "error": "bad json"})
            return

        # --- Admin auth + CMS writes (before heavy brain work) ---
        if path == "/api/admin/login":
            if not admin_password_configured():
                self._json(
                    503,
                    {
                        "ok": False,
                        "error": "password_not_set",
                        "hint": "Set ADMIN_PASSWORD on the server (Render env), then redeploy.",
                    },
                )
                return
            pw = str(data.get("password") or "")
            if not pw or not hmac.compare_digest(pw, ADMIN_PASSWORD):
                time.sleep(0.4)  # slow brute force a bit
                self._json(401, {"ok": False, "error": "bad_password"})
                return
            token = make_admin_token()
            self._json(
                200,
                {"ok": True, "loggedIn": True, "server": "telephantim-ai"},
                set_cookie=self._admin_cookie_header(token),
            )
            return

        if path == "/api/admin/logout":
            self._json(
                200,
                {"ok": True, "loggedIn": False},
                set_cookie=self._admin_cookie_header(None, clear=True),
            )
            return

        if path == "/api/admin/content":
            if not self._is_admin():
                self._json(401, {"ok": False, "error": "login_required"})
                return
            payload = data.get("content") if isinstance(data.get("content"), dict) else data
            try:
                saved = save_site_content(payload)
            except Exception as e:
                self._json(400, {"ok": False, "error": str(e)})
                return
            self._json(200, {"ok": True, "content": saved, "server": "telephantim-ai"})
            return

        if path == "/api/admin/suno-catalog":
            if not self._is_admin():
                self._json(401, {"ok": False, "error": "login_required"})
                return
            tracks = data.get("tracks") if isinstance(data.get("tracks"), list) else data.get("catalog")
            if not isinstance(tracks, list):
                self._json(400, {"ok": False, "error": "tracks array required"})
                return
            try:
                saved = save_suno_catalog(tracks)
            except Exception as e:
                self._json(400, {"ok": False, "error": str(e)})
                return
            self._json(
                200,
                {"ok": True, "tracks": saved, "count": len(saved), "server": "telephantim-ai"},
            )
            return

        if path == "/api/admin/suno-add":
            if not self._is_admin():
                self._json(401, {"ok": False, "error": "login_required"})
                return
            tid = str(data.get("id") or data.get("songId") or "").strip()
            raw_url = str(data.get("url") or data.get("audio_url") or "").strip()
            title = str(data.get("title") or "New song").strip() or "New song"
            # Prefer the field that looks most like a CDN / UUID paste
            blob = " ".join(x for x in (raw_url, tid) if x)
            if "suno.com/s/" in blob.lower() and not _UUID_RE.search(blob):
                self._json(
                    400,
                    {
                        "ok": False,
                        "error": "short_link",
                        "hint": (
                            "Paste the song UUID or CDN mp3 URL "
                            "(https://cdn1.suno.ai/UUID.mp3), not suno.com/s/… share links."
                        ),
                    },
                )
                return
            norm = normalize_suno_track(
                {
                    "id": tid,
                    "title": title,
                    "audio_url": raw_url or tid,
                    "artist": data.get("artist"),
                    "duration_sec": data.get("duration_sec"),
                }
            )
            if not norm:
                self._json(
                    400,
                    {
                        "ok": False,
                        "error": "bad_song",
                        "hint": "Need a UUID or https://cdn1.suno.ai/….mp3 link.",
                    },
                )
                return
            tracks = load_suno_catalog()
            tracks = [t for t in tracks if str(t.get("id")) != norm["id"]]
            tracks.insert(0, norm)
            saved = save_suno_catalog(tracks)
            self._json(
                200,
                {"ok": True, "tracks": saved, "count": len(saved), "added": norm["id"]},
            )
            return

        if path == "/api/admin/suno-remove":
            if not self._is_admin():
                self._json(401, {"ok": False, "error": "login_required"})
                return
            tid = str(data.get("id") or data.get("songId") or "").strip()
            if not tid:
                self._json(400, {"ok": False, "error": "id required"})
                return
            tracks = [t for t in load_suno_catalog() if str(t.get("id")) != tid]
            saved = save_suno_catalog(tracks)
            self._json(200, {"ok": True, "tracks": saved, "count": len(saved), "removed": tid})
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

        if path == "/api/pulse":
            items = refresh_world_pulse(force=bool(data.get("force")))
            pick = random.choice(items) if items else None
            self._json(
                200,
                {
                    "ok": True,
                    "server": "telephantim-ai",
                    "items": items[:12],
                    "pick": pick,
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
            # Living conversation — a bit longer by default
            rounds = max(3, min(7, int(data.get("rounds") or 5)))

            # Occasional world-pulse (camp-style): riff, never dump the feed
            pulse_item = None
            want_pulse = bool(data.get("pulse")) or random.random() < 0.38
            if want_pulse:
                if data.get("headline"):
                    pulse_item = {
                        "text": str(data.get("headline"))[:220],
                        "source": str(data.get("pulse_source") or "client"),
                    }
                else:
                    pulse_item = pick_pulse_item()
            pulse_hint = ""
            if pulse_item and pulse_item.get("text"):
                pulse_hint = (
                    f" World-pulse scrap (DO NOT copy-paste; riff once like you noticed the feed, "
                    f"then return to banter): “{pulse_item['text'][:160]}”."
                )

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
                f"Talk to the other relic in 3-5 lively spoken sentences — warm, natural, a tad longer. "
                f"Stay in character. No tech talk. No stage directions. "
                f"{'Gift POWER.' if first == 'mjolnir' else 'Gift HEALING.'} "
                f"Optional spice if natural: {fact}.{pulse_hint}"
            )
            text, provider, model = speak(first, seed, m_default, models)
            if not text:
                if pulse_item and pulse_item.get("text") and random.random() < 0.55:
                    text = offline_pulse_riff(first, pulse_item["text"], POWER[first])
                else:
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
                # Only sometimes re-nudge the pulse so it feels life-like, not every line
                mid_pulse = ""
                if pulse_item and pulse_item.get("text") and random.random() < 0.28:
                    mid_pulse = (
                        f" Optional half-glance at the pulse again (riff, don't quote): "
                        f"“{pulse_item['text'][:120]}”."
                    )
                prompt = (
                    f"{other['name']} just said: \"{other['text']}\"\n"
                    f"Power {POWER[who]}/99. Bond {POWER['bond']}/99. "
                    f"Answer them in 3-5 lively spoken sentences. Riff off their words. "
                    f"Sound alive — not a slogan chip. No stage directions. No tech talk. "
                    f"{'Offer POWER.' if who == 'mjolnir' else 'Offer HEALING.'}"
                    f"{mid_pulse}"
                )
                text, provider, model = speak(who, prompt, m_default, models)
                if not text:
                    if mid_pulse and pulse_item:
                        text = offline_pulse_riff(who, pulse_item["text"], POWER[who])
                    else:
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
                    "pulse": pulse_item,
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
    print(f"  Admin:   http://127.0.0.1:{PORT}/admin/")
    print(f"  Health:  http://127.0.0.1:{PORT}/api/status")
    print(f"  Ollama:  {'YES' if models else 'NO — start Ollama app'}")
    if models:
        print(f"  Mjolnir mind:   {m_m}")
        print(f"  Caduceus mind:  {m_c}")
    if admin_password_configured():
        if _ON_CLOUD:
            print("  CMS:     ADMIN_PASSWORD set (login at /admin/)")
        else:
            print("  CMS:     /admin/  (local default password: telephantix)")
            print("           override with env ADMIN_PASSWORD")
    else:
        print("  CMS:     set ADMIN_PASSWORD env to enable /admin login")
    print(
        f"  Brains:  {'CLOUD first (xAI/Groq)' if PREFER_CLOUD else 'OLLAMA first (default)'} · "
        f"Ollama={'YES' if models else 'NO'}"
    )
    print("  Do NOT use: python -m http.server  (breaks /api)")
    print("=" * 56)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
