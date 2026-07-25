#!/usr/bin/env python3
"""
Telephantix ONE server — hub (Relics/Bio/admin/music) + Luna Camp (2D/3D/API).

  python unified_server.py
  → http://127.0.0.1:8765/

No second terminal. Compression (gzip) enabled.
Live deploy later: same entrypoint + PORT env.
"""

from __future__ import annotations

import asyncio
import importlib.util
import mimetypes
import os
import secrets
import sys
from pathlib import Path

# --- paths ---
HUB_ROOT = Path(__file__).resolve().parent
LUNA_ROOT = HUB_ROOT.parent / "luna-avatar"
HUB_PUBLIC = HUB_ROOT / "public"
if not (HUB_PUBLIC / "index.html").exists():
    HUB_PUBLIC = HUB_ROOT

if not (LUNA_ROOT / "server.py").is_file():
    print("ERROR: luna-avatar not found next to telephantix-demo at:", LUNA_ROOT)
    sys.exit(1)

# Load env from both projects (hub first, then luna fills gaps)
def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
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


_load_env_file(HUB_ROOT / ".env")
_load_env_file(LUNA_ROOT / ".env")
os.environ.setdefault("PREFER_OLLAMA", "1")
os.environ.setdefault("LUNA_LLM_BACKEND", "ollama")
os.environ.setdefault("LUNA_FORCE_OLLAMA", "1")
# Single port default (hub habit)
os.environ.setdefault("PORT", os.environ.get("TELEPHANTIM_PORT") or "8765")

mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("application/javascript", ".js")

# --- import Luna FastAPI app (by path so hub server.py never shadows it) ---
os.chdir(LUNA_ROOT)  # relative firmament paths / data files
sys.path.insert(0, str(LUNA_ROOT))

_luna_spec = importlib.util.spec_from_file_location(
    "luna_avatar_server", LUNA_ROOT / "server.py"
)
_luna_mod = importlib.util.module_from_spec(_luna_spec)
assert _luna_spec.loader is not None
sys.modules["luna_avatar_server"] = _luna_mod
_luna_spec.loader.exec_module(_luna_mod)
app = _luna_mod.app  # Luna Avatar FastAPI

from fastapi import Request, Response  # noqa: E402
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse  # noqa: E402
from starlette.middleware.gzip import GZipMiddleware  # noqa: E402

# Compression for JS/CSS/JSON/HTML (bigger 3D assets benefit too)
app.add_middleware(GZipMiddleware, minimum_size=400)

# Mark unified mode for clients
@app.middleware("http")
async def unified_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Telephantix-Server"] = "unified"
    # Help browsers not stick on half-loaded modules during rapid dev
    path = request.url.path
    if path.endswith((".js", ".mjs", ".css", ".html")) or path in ("/", "/index.html"):
        response.headers.setdefault("Cache-Control", "no-cache")
    return response


# --- load hub server.py as module "telephantim_hub" ---
_hub_spec = importlib.util.spec_from_file_location(
    "telephantim_hub", HUB_ROOT / "server.py"
)
thub = importlib.util.module_from_spec(_hub_spec)
assert _hub_spec.loader is not None
_hub_spec.loader.exec_module(thub)


def _json(data, status: int = 200, set_cookie: str | None = None) -> Response:
    import json as _json_mod

    body = _json_mod.dumps(data).encode("utf-8")
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
    }
    if set_cookie:
        headers["Set-Cookie"] = set_cookie
    return Response(content=body, status_code=status, headers=headers)


def _admin_cookie(request: Request) -> str | None:
    return request.cookies.get(thub.ADMIN_COOKIE)


def _is_admin(request: Request) -> bool:
    return thub.verify_admin_token(_admin_cookie(request))


def _cookie_header(token: str | None, clear: bool = False) -> str:
    secure = bool(os.getenv("RENDER") or os.getenv("RAILWAY_ENVIRONMENT"))
    if clear or not token:
        parts = [f"{thub.ADMIN_COOKIE}=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"]
    else:
        max_age = max(1, thub.ADMIN_SESSION_HOURS) * 3600
        parts = [
            f"{thub.ADMIN_COOKIE}={token}",
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            f"Max-Age={max_age}",
        ]
    if secure:
        parts.append("Secure")
    return "; ".join(parts)


# ========== Hub API (Relics brains + CMS) ==========

@app.get("/api/status")
@app.get("/api/hub/status")
async def hub_status():
    # ollama_models is sync HTTP — never block the event loop
    models = await asyncio.to_thread(thub.ollama_models)
    m_m = thub.resolve_model(thub.MODEL_MJOLNIR, models)
    m_c = thub.resolve_model(thub.MODEL_CADUCEUS, models)
    return {
        "ok": True,
        "server": "telephantix-unified",
        "unified": True,
        "ollama": bool(models),
        "ollama_url": thub.OLLAMA_URL,
        "model": m_m,
        "models": {"mjolnir": m_m, "caduceus": m_c},
        "all_models": models[:16],
        "xai": bool(thub.XAI_API_KEY),
        "groq": bool(thub.GROQ_API_KEY),
        "prefer": "cloud" if thub.PREFER_CLOUD else "ollama",
        "memory": len(thub.MEMORY),
        "brains": bool(models) or bool(thub.XAI_API_KEY) or bool(thub.GROQ_API_KEY),
        "admin": thub.admin_password_configured(),
        "cms": True,
        "camp": True,
    }


@app.get("/api/hub/health")
async def hub_health():
    models = await asyncio.to_thread(thub.ollama_models)
    return {
        "ok": True,
        "server": "telephantix-unified",
        "brains": bool(models) or bool(thub.XAI_API_KEY) or bool(thub.GROQ_API_KEY),
        "cms": True,
        "unified": True,
    }


@app.get("/api/content")
async def hub_content():
    content = await asyncio.to_thread(thub.load_site_content)
    return {"ok": True, "content": content, "server": "telephantix-unified"}


@app.get("/api/suno-catalog")
async def hub_suno_catalog():
    tracks = await asyncio.to_thread(thub.load_suno_catalog)
    return {
        "ok": True,
        "tracks": tracks,
        "count": len(tracks),
        "server": "telephantix-unified",
    }


@app.get("/api/memory")
async def hub_memory():
    return {"ok": True, "lines": thub.MEMORY[-20:], "power": dict(thub.POWER)}


@app.get("/api/daily-wisdom")
async def hub_daily(day: str | None = None):
    return await asyncio.to_thread(thub.get_daily_wisdom, day)


@app.get("/api/pulse")
async def hub_pulse_get():
    items = await asyncio.to_thread(thub.refresh_world_pulse)
    pick = secrets.choice(items) if items else None
    return {"ok": True, "server": "telephantix-unified", "items": items[:12], "pick": pick}


@app.get("/api/admin/session")
async def hub_admin_session(request: Request):
    return {
        "ok": True,
        "loggedIn": _is_admin(request),
        "passwordConfigured": thub.admin_password_configured(),
        "cloud": bool(os.getenv("RENDER")),
        "server": "telephantix-unified",
        "unified": True,
    }


@app.post("/api/admin/login")
async def hub_admin_login(request: Request):
    if not thub.admin_password_configured():
        return _json(
            {
                "ok": False,
                "error": "password_not_set",
                "hint": "Set ADMIN_PASSWORD env",
            },
            503,
        )
    try:
        data = await request.json()
    except Exception:
        data = {}
    pw = str((data or {}).get("password") or "")
    import hmac
    import time

    if not pw or not hmac.compare_digest(pw, thub.ADMIN_PASSWORD):
        time.sleep(0.35)
        return _json({"ok": False, "error": "bad_password"}, 401)
    token = thub.make_admin_token()
    return _json(
        {"ok": True, "loggedIn": True, "server": "telephantix-unified"},
        set_cookie=_cookie_header(token),
    )


@app.post("/api/admin/logout")
async def hub_admin_logout():
    return _json(
        {"ok": True, "loggedIn": False},
        set_cookie=_cookie_header(None, clear=True),
    )


@app.post("/api/admin/content")
async def hub_admin_content(request: Request):
    if not _is_admin(request):
        return _json({"ok": False, "error": "login_required"}, 401)
    try:
        data = await request.json()
    except Exception:
        return _json({"ok": False, "error": "bad json"}, 400)
    payload = data.get("content") if isinstance(data.get("content"), dict) else data
    try:
        saved = thub.save_site_content(payload)
    except Exception as e:
        return _json({"ok": False, "error": str(e)}, 400)
    return {"ok": True, "content": saved, "server": "telephantix-unified"}


@app.post("/api/admin/suno-catalog")
async def hub_admin_suno_catalog(request: Request):
    if not _is_admin(request):
        return _json({"ok": False, "error": "login_required"}, 401)
    try:
        data = await request.json()
    except Exception:
        return _json({"ok": False, "error": "bad json"}, 400)
    tracks = data.get("tracks") if isinstance(data.get("tracks"), list) else data.get("catalog")
    if not isinstance(tracks, list):
        return _json({"ok": False, "error": "tracks array required"}, 400)
    saved = thub.save_suno_catalog(tracks)
    return {"ok": True, "tracks": saved, "count": len(saved), "server": "telephantix-unified"}


@app.post("/api/admin/suno-add")
async def hub_admin_suno_add(request: Request):
    if not _is_admin(request):
        return _json({"ok": False, "error": "login_required"}, 401)
    try:
        data = await request.json()
    except Exception:
        return _json({"ok": False, "error": "bad json"}, 400)
    tid = str(data.get("id") or data.get("songId") or "").strip()
    raw_url = str(data.get("url") or data.get("audio_url") or "").strip()
    title = str(data.get("title") or "New song").strip() or "New song"
    blob = " ".join(x for x in (raw_url, tid) if x)
    if "suno.com/s/" in blob.lower() and not thub._UUID_RE.search(blob):
        return _json(
            {
                "ok": False,
                "error": "short_link",
                "hint": "Paste UUID or https://cdn1.suno.ai/UUID.mp3 — not suno.com/s/ share links.",
            },
            400,
        )
    norm = thub.normalize_suno_track(
        {
            "id": tid,
            "title": title,
            "audio_url": raw_url or tid,
            "artist": data.get("artist"),
            "duration_sec": data.get("duration_sec"),
        }
    )
    if not norm:
        return _json(
            {
                "ok": False,
                "error": "bad_song",
                "hint": "Need a UUID or https://cdn1.suno.ai/….mp3 link.",
            },
            400,
        )
    tracks = thub.load_suno_catalog()
    tracks = [t for t in tracks if str(t.get("id")) != norm["id"]]
    tracks.insert(0, norm)
    saved = thub.save_suno_catalog(tracks)
    return {"ok": True, "tracks": saved, "count": len(saved), "added": norm["id"]}


@app.post("/api/admin/suno-remove")
async def hub_admin_suno_remove(request: Request):
    if not _is_admin(request):
        return _json({"ok": False, "error": "login_required"}, 401)
    try:
        data = await request.json()
    except Exception:
        return _json({"ok": False, "error": "bad json"}, 400)
    tid = str(data.get("id") or data.get("songId") or "").strip()
    if not tid:
        return _json({"ok": False, "error": "id required"}, 400)
    tracks = [t for t in thub.load_suno_catalog() if str(t.get("id")) != tid]
    saved = thub.save_suno_catalog(tracks)
    return {"ok": True, "tracks": saved, "count": len(saved), "removed": tid}


def _hub_chat_sync(data: dict) -> dict:
    """Sync LLM chat — always run via asyncio.to_thread from the async route."""
    import random

    models = thub.ollama_models()
    m_default = thub.resolve_model(thub.MODEL_MJOLNIR, models)
    persona_id = str(data.get("persona") or "mjolnir").lower()
    if persona_id in ("hammer", "thor", "mjolnir"):
        persona_id = "mjolnir"
    elif persona_id in ("caduceus", "staff", "snakes", "snake"):
        persona_id = "caduceus"
    else:
        persona_id = "mjolnir"
    event = str(data.get("event") or "chat").lower()
    user_msg = str(data.get("message") or "").strip()

    fact = random.choice(thub.TRUE_FACTS)
    bump = 2 if event in ("grab", "toss", "strike") else 1
    thub.grow_power(persona_id, bump)
    pwr = thub.POWER[persona_id]
    bond = thub.POWER["bond"]
    imbue = (
        "IMBUE the wielder with POWER: strength, courage, lightning edge"
        if persona_id == "mjolnir"
        else "IMBUE the wielder with HEALING: vitality, recovery, balance"
    )
    if not user_msg:
        if event == "grab":
            user_msg = f"The user just grabbed you. Power {pwr}/99, bond {bond}/99. React and {imbue}. {fact}"
        elif event == "toss":
            user_msg = f"The user just tossed you. Power {pwr}/99. React and boast how you evolve. {fact}"
        elif event == "strike":
            user_msg = f"Power surged — you are now {pwr}/99. One sharp line. {imbue}. {fact}"
        else:
            user_msg = f"Greet briefly at power {pwr}/99. {imbue}. {fact}"
    else:
        user_msg = (
            f"{user_msg}\n\n"
            f"(You are at power {pwr}/99, bond {bond}/99. {imbue}. "
            f"Optional true spice if it fits: {fact})"
        )
    text, provider, model = thub.speak(persona_id, user_msg, m_default, models)
    if not text:
        text = thub.offline(
            persona_id,
            event if event in ("grab", "toss", "chat", "banter") else "chat",
            pwr,
        )
        provider = "offline"
    if text:
        thub.remember(persona_id, text)
    return {
        "ok": True,
        "persona": persona_id,
        "name": thub.PERSONAS[persona_id]["name"],
        "text": text,
        "provider": provider,
        "model": model,
        "power": pwr,
        "power_all": dict(thub.POWER),
        "memory": len(thub.MEMORY),
        "server": "telephantix-unified",
    }


@app.post("/api/hub/chat")
@app.post("/api/relics/chat")
async def hub_chat(request: Request):
    """Relics brains (JSON). Luna keeps POST /api/chat as its own SSE stream."""
    try:
        data = await request.json()
    except Exception:
        return _json({"ok": False, "error": "bad json"}, 400)
    return await asyncio.to_thread(_hub_chat_sync, data or {})


def _hub_banter_sync(data: dict) -> dict:
    import random

    models = thub.ollama_models()
    m_default = thub.resolve_model(thub.MODEL_MJOLNIR, models)
    fact = str(data.get("fact") or random.choice(thub.TRUE_FACTS))
    topic = str(
        data.get("topic")
        or "a worthy visitor stands on your map, hoping to be imbued with power and healing"
    ).strip()
    rounds = max(3, min(7, int(data.get("rounds") or 5)))
    pulse_item = None
    want_pulse = bool(data.get("pulse")) or random.random() < 0.38
    if want_pulse:
        if data.get("headline"):
            pulse_item = {
                "text": str(data.get("headline"))[:220],
                "source": str(data.get("pulse_source") or "client"),
            }
        else:
            pulse_item = thub.pick_pulse_item()
    pulse_hint = ""
    if pulse_item and pulse_item.get("text"):
        pulse_hint = (
            f" World-pulse scrap (DO NOT copy-paste; riff once): “{pulse_item['text'][:160]}”."
        )
    thub.POWER["bond"] = min(99, thub.POWER["bond"] + 2)
    thub.POWER["mjolnir"] = min(99, thub.POWER["mjolnir"] + 1)
    thub.POWER["caduceus"] = min(99, thub.POWER["caduceus"] + 1)
    bond = thub.POWER["bond"]
    transcript = []
    order = ["mjolnir", "caduceus"]
    if random.random() < 0.5:
        order = ["caduceus", "mjolnir"]
    first = order[0]
    seed = (
        f"Topic: {topic}. Power {thub.POWER[first]}/99. Bond {bond}/99. "
        f"Talk to the other relic in 3-5 lively spoken sentences. "
        f"{'Gift POWER.' if first == 'mjolnir' else 'Gift HEALING.'} "
        f"Optional spice: {fact}.{pulse_hint}"
    )
    text, provider, model = thub.speak(first, seed, m_default, models)
    if not text:
        text = thub.offline(first, "banter", thub.POWER[first])
        provider = provider or "offline"
    thub.remember(first, text)
    transcript.append(
        {
            "persona": first,
            "name": thub.PERSONAS[first]["name"],
            "text": text,
            "provider": provider,
            "model": model,
            "power": thub.POWER[first],
        }
    )
    # Cap banter cost so the site stays snappy (UI can request more later)
    total_lines = min(rounds * 2, 6)
    for i in range(1, total_lines):
        who = order[i % 2]
        other = transcript[-1]
        if i % 2 == 0:
            thub.POWER[who] = min(99, thub.POWER[who] + 1)
            thub.POWER["bond"] = min(99, thub.POWER["bond"] + 1)
        mid_pulse = ""
        if pulse_item and pulse_item.get("text") and random.random() < 0.28:
            mid_pulse = f" Optional half-glance at pulse: “{pulse_item['text'][:120]}”."
        prompt = (
            f"{other['name']} just said: \"{other['text']}\"\n"
            f"Power {thub.POWER[who]}/99. Bond {thub.POWER['bond']}/99. "
            f"Answer them in 3-5 lively spoken sentences. "
            f"{'Offer POWER.' if who == 'mjolnir' else 'Offer HEALING.'}"
            f"{mid_pulse}"
        )
        text, provider, model = thub.speak(who, prompt, m_default, models)
        if not text:
            text = thub.offline(who, "banter", thub.POWER[who])
            provider = provider or "offline"
        thub.remember(who, text)
        transcript.append(
            {
                "persona": who,
                "name": thub.PERSONAS[who]["name"],
                "text": text,
                "provider": provider,
                "model": model,
                "power": thub.POWER[who],
            }
        )
    return {
        "ok": True,
        "server": "telephantix-unified",
        "fact": fact,
        "pulse": pulse_item,
        "brains": any((ln.get("provider") or "") != "offline" for ln in transcript),
        "memory": len(thub.MEMORY),
        "power": {
            "mjolnir": thub.POWER["mjolnir"],
            "caduceus": thub.POWER["caduceus"],
            "bond": thub.POWER["bond"],
        },
        "lines": transcript,
    }


@app.post("/api/banter")
async def hub_banter(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}
    return await asyncio.to_thread(_hub_banter_sync, data or {})


@app.api_route("/api/power", methods=["GET", "POST"])
async def hub_power():
    return {
        "ok": True,
        "power": dict(thub.POWER),
        "server": "telephantix-unified",
        "memory": len(thub.MEMORY),
    }


@app.post("/api/pulse")
async def hub_pulse_post(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}
    items = await asyncio.to_thread(
        thub.refresh_world_pulse, force=bool((data or {}).get("force"))
    )
    import random

    pick = random.choice(items) if items else None
    return {
        "ok": True,
        "server": "telephantix-unified",
        "items": items[:12],
        "pick": pick,
    }


# ========== Hub static files (Relics / Bio / admin) ==========
# Serve hub assets when path is not already handled by Luna.

_HUB_SKIP_PREFIXES = (
    "/api/firmament",
    "/api/health",  # luna health
    "/api/pet",
    "/api/omni",
    "/ws/",
    "/docs",
    "/openapi",
    "/redoc",
    "/firmament",
    "/static/",
    "/camp",
    "/play",
    "/visit",
    "/bubble",
    "/luna",
    "/privacy",
)


@app.middleware("http")
async def serve_hub_static(request: Request, call_next):
    path = request.url.path or "/"
    # Never steal Luna / firmament / camp APIs
    if path != "/" and any(path == p or path.startswith(p) for p in _HUB_SKIP_PREFIXES):
        return await call_next(request)
    if path.startswith("/api/"):
        # Hub APIs registered above; others fall through to Luna
        return await call_next(request)

    # Root = Telephantim hub
    if path in ("/", "/index.html"):
        idx = HUB_PUBLIC / "index.html"
        if idx.is_file():
            return FileResponse(idx, media_type="text/html; charset=utf-8")

    # Hub file (music.js, admin/, suno-catalog.json, …)
    rel = path.lstrip("/")
    if rel:
        candidate = (HUB_PUBLIC / rel).resolve()
        try:
            candidate.relative_to(HUB_PUBLIC.resolve())
        except ValueError:
            return await call_next(request)
        if candidate.is_file():
            return FileResponse(candidate)
        # directory index for /admin/
        if candidate.is_dir():
            idx = candidate / "index.html"
            if idx.is_file():
                return FileResponse(idx, media_type="text/html; charset=utf-8")

    return await call_next(request)


def main() -> None:
    import uvicorn

    host = os.getenv("TELEPHANTIM_HOST", "0.0.0.0")
    port = int(os.getenv("PORT") or os.getenv("TELEPHANTIM_PORT") or "8765")
    print("=" * 58)
    print("  TELEPHANTIX UNIFIED SERVER")
    print("  Hub + Luna Camp + Admin + Ollama brains")
    print(f"  Open:     http://127.0.0.1:{port}/")
    print(f"  Admin:    http://127.0.0.1:{port}/admin/")
    print(f"  Camp 2D:  http://127.0.0.1:{port}/firmament/play?hub=1")
    print(f"  Camp 3D:  http://127.0.0.1:{port}/firmament/3d?hub=1")
    print(f"  Health:   http://127.0.0.1:{port}/api/status")
    print(f"  Camp API: http://127.0.0.1:{port}/api/health")
    print("  Gzip:     on")
    print("  One process — do not also start server.py / uvicorn alone")
    print("=" * 58)
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
