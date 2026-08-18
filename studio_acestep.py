# -*- coding: utf-8 -*-
"""
Visitor-facing AI songs with vocals via ACE-Step (open source).

Talks to a local/remote ACE-Step REST API (default http://127.0.0.1:8001):
  POST /release_task  → task_id
  POST /query_result  → status + audio path
  GET  /v1/audio?path=… → download

Jobs are persisted to disk so a hub restart does not show "job lost"
while ACE-Step is still cooking on the GPU.

Env:
  ACESTEP_API_BASE   default http://127.0.0.1:8001
  ACESTEP_API_KEY    optional bearer / ai_token
  ACESTEP_MAX_SECONDS  cap for visitors (default 600 = 10 min)
  ACESTEP_RATE_PER_IP  max concurrent+queued jobs per IP (default 3)
"""

from __future__ import annotations

import json
import os
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
if not (PUBLIC / "index.html").exists():
    PUBLIC = ROOT
OUT_DIR = PUBLIC / "media" / "studio-gen"
OUT_DIR.mkdir(parents=True, exist_ok=True)
(ROOT / "media" / "studio-gen").mkdir(parents=True, exist_ok=True)

JOBS_FILE = ROOT / "data" / "studio-acestep-jobs.json"
JOBS_FILE.parent.mkdir(parents=True, exist_ok=True)

ACESTEP_API_BASE = (
    os.getenv("ACESTEP_API_BASE") or os.getenv("ACESTEP_URL") or "http://127.0.0.1:8001"
).strip().rstrip("/")
ACESTEP_API_KEY = (os.getenv("ACESTEP_API_KEY") or "").strip()
MAX_SECONDS = max(30, min(600, int(os.getenv("ACESTEP_MAX_SECONDS") or "600")))
RATE_PER_IP = max(1, min(8, int(os.getenv("ACESTEP_RATE_PER_IP") or "3")))

_JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()
_IP_STARTED: dict[str, list[float]] = defaultdict(list)
_IP_LOCK = threading.Lock()
_WATCHERS: set[str] = set()
_WATCH_LOCK = threading.Lock()


def _http_json(method: str, path: str, body: dict | None = None, timeout: float = 60.0) -> dict:
    url = f"{ACESTEP_API_BASE}{path}"
    data = None
    headers = {
        "Accept": "application/json",
        "User-Agent": "TelephantimStudio/ACE-Step/1.0",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if ACESTEP_API_KEY:
        headers["Authorization"] = f"Bearer {ACESTEP_API_KEY}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:600]
        raise RuntimeError(f"ACE-Step HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"ACE-Step unreachable at {ACESTEP_API_BASE}: {e.reason}") from e


def _http_bytes(path_or_url: str, timeout: float = 120.0) -> bytes:
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        url = path_or_url
    elif path_or_url.startswith("/"):
        url = f"{ACESTEP_API_BASE}{path_or_url}"
    else:
        q = urllib.parse.quote(path_or_url, safe="")
        url = f"{ACESTEP_API_BASE}/v1/audio?path={q}"
    headers = {"User-Agent": "TelephantimStudio/ACE-Step/1.0"}
    if ACESTEP_API_KEY:
        headers["Authorization"] = f"Bearer {ACESTEP_API_KEY}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _save_jobs() -> None:
    try:
        # Keep last 40 jobs only
        items = sorted(_JOBS.items(), key=lambda kv: float(kv[1].get("at") or 0), reverse=True)[:40]
        payload = {k: {kk: vv for kk, vv in v.items() if kk != "trace"} for k, v in items}
        JOBS_FILE.write_text(json.dumps(payload, indent=0), encoding="utf-8")
    except Exception as e:
        print("[studio_acestep] save jobs failed:", e)


def _load_jobs() -> None:
    global _JOBS
    if not JOBS_FILE.is_file():
        return
    try:
        raw = json.loads(JOBS_FILE.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            _JOBS = {str(k): v for k, v in raw.items() if isinstance(v, dict)}
    except Exception as e:
        print("[studio_acestep] load jobs failed:", e)


def _set_job(job_id: str, **fields) -> dict:
    with _LOCK:
        cur = dict(_JOBS.get(job_id) or {})
        cur.update(fields)
        cur["at"] = cur.get("at") or time.time()
        cur["updated"] = time.time()
        _JOBS[job_id] = cur
        snap = dict(cur)
    _save_jobs()
    return snap


def acestep_available() -> dict:
    info = {
        "ok": False,
        "provider": "ace-step",
        "base": ACESTEP_API_BASE,
        "hasKey": bool(ACESTEP_API_KEY),
        "maxSeconds": MAX_SECONDS,
        "vocals": True,
        "model": "ACE-Step 1.5 (turbo)",
        "license": "MIT",
        "outDir": str(OUT_DIR),
    }
    try:
        wrap = _http_json("GET", "/health", timeout=3.0)
        data = wrap.get("data") if isinstance(wrap, dict) else None
        status = (data or {}).get("status") if isinstance(data, dict) else None
        if status == "ok" or wrap.get("code") == 200 or (isinstance(data, dict) and data):
            info["ok"] = True
            info["health"] = data or wrap
            if isinstance(data, dict):
                info["modelsInitialized"] = bool(data.get("models_initialized"))
                info["llmInitialized"] = bool(data.get("llm_initialized"))
                info["loadedModel"] = data.get("loaded_model")
                info["loadedLm"] = data.get("loaded_lm_model")
                if not info["modelsInitialized"]:
                    info["warming"] = True
            return info
        if wrap.get("status") == "ok":
            info["ok"] = True
            info["health"] = wrap
            return info
        info["error"] = "unexpected_health"
        info["raw"] = str(wrap)[:200]
    except Exception as e:
        info["error"] = str(e)
    return info


def _acquire_ip(ip: str) -> bool:
    ip = (ip or "anon").strip() or "anon"
    now = time.time()
    with _IP_LOCK:
        fresh = [t for t in _IP_STARTED[ip] if now - t < 1800]
        _IP_STARTED[ip] = fresh
        if len(fresh) >= RATE_PER_IP:
            return False
        _IP_STARTED[ip].append(now)
        return True


def _release_ip(ip: str) -> None:
    ip = (ip or "anon").strip() or "anon"
    with _IP_LOCK:
        if _IP_STARTED[ip]:
            _IP_STARTED[ip].pop(0)


def _default_lyrics(prompt: str) -> str:
    hook = (prompt or "telephantix night").strip()[:80]
    return (
        f"[Verse 1]\n"
        f"Walking through the static glow of {hook}\n"
        f"Every heartbeat paints a new horizon line\n"
        f"\n[Chorus]\n"
        f"Sing it loud, let the signal carry home\n"
        f"We were born to turn the silence into song\n"
        f"\n[Verse 2]\n"
        f"Relics hum, the campfire keeps the time\n"
        f"Caduceus light and hammer in the rhyme\n"
        f"\n[Chorus]\n"
        f"Sing it loud, let the signal carry home\n"
        f"We were born to turn the silence into song\n"
        f"\n[Outro]\n"
        f"Fade into the firmament, keep the melody\n"
    )


def start_job_async(
    prompt: str,
    *,
    lyrics: str = "",
    seconds: float = 180.0,
    instrumental: bool = False,
    bpm: int | None = None,
    tags: str = "",
    client_ip: str = "anon",
    thinking: bool = False,
) -> dict:
    prompt = (prompt or tags or "").strip()[:800]
    if not prompt:
        return {"ok": False, "error": "empty_prompt"}

    avail = acestep_available()
    if not avail.get("ok"):
        return {
            "ok": False,
            "error": "ace_step_offline",
            "hint": "Start ACE-Step API (START_ACE_STEP.bat) or set ACESTEP_API_BASE",
            "detail": avail.get("error"),
            "free": True,
            "vocals": True,
        }

    if not _acquire_ip(client_ip):
        return {
            "ok": False,
            "error": "rate_limited",
            "hint": f"Max {RATE_PER_IP} songs at once per visitor — wait for one to finish, then Create again",
            "free": True,
        }

    seconds = max(10.0, min(float(MAX_SECONDS), float(seconds) or 180.0))
    # 4060 tier often caps LM CoT around 480s — keep request honest
    if seconds > 480:
        seconds = 480.0
    lyrics = (lyrics or "").strip()
    if not instrumental and not lyrics:
        lyrics = _default_lyrics(prompt)

    job_id = uuid.uuid4().hex[:12]
    _set_job(
        job_id,
        status="queued",
        prompt=prompt,
        lyrics=lyrics[:4000],
        seconds=seconds,
        instrumental=bool(instrumental),
        provider="ace-step",
        client_ip=client_ip,
        thinking=bool(thinking),
        bpm=bpm,
        ok=True,
    )

    def run():
        try:
            _run_job(job_id, prompt, lyrics, seconds, instrumental, bpm, thinking)
        finally:
            _release_ip(client_ip)

    threading.Thread(target=run, daemon=True, name=f"acestep-{job_id}").start()
    return {
        "ok": True,
        "job_id": job_id,
        "status": "queued",
        "provider": "ace-step",
        "free": True,
        "openSource": True,
        "vocals": not instrumental,
        "seconds": seconds,
        "model": "ACE-Step 1.5",
    }


def resume_ace_task(ace_task_id: str, *, job_id: str | None = None, client_ip: str = "anon") -> dict:
    """Re-attach to an ACE-Step task after hub restart."""
    ace_task_id = (ace_task_id or "").strip()
    if not ace_task_id:
        return {"ok": False, "error": "missing_ace_task_id"}
    job_id = (job_id or "").strip() or uuid.uuid4().hex[:12]
    with _LOCK:
        existing = _JOBS.get(job_id)
        if existing and existing.get("status") == "complete" and existing.get("url"):
            return {"ok": True, **existing}
    _set_job(
        job_id,
        status="generating",
        ace_task_id=ace_task_id,
        provider="ace-step",
        client_ip=client_ip,
        ok=True,
        resumed=True,
    )
    _ensure_watcher(job_id)
    return {"ok": True, "job_id": job_id, "status": "generating", "ace_task_id": ace_task_id, "provider": "ace-step"}


def _ensure_watcher(job_id: str) -> None:
    with _WATCH_LOCK:
        if job_id in _WATCHERS:
            return
        _WATCHERS.add(job_id)

    def run():
        try:
            _watch_existing(job_id)
        finally:
            with _WATCH_LOCK:
                _WATCHERS.discard(job_id)

    threading.Thread(target=run, daemon=True, name=f"acestep-watch-{job_id}").start()


def _watch_existing(job_id: str) -> None:
    with _LOCK:
        j = dict(_JOBS.get(job_id) or {})
    task_id = str(j.get("ace_task_id") or "").strip()
    if not task_id:
        _set_job(job_id, status="error", error="missing_ace_task_id", ok=False)
        return
    seconds = float(j.get("seconds") or 180)
    lyrics = str(j.get("lyrics") or "")
    prompt = str(j.get("prompt") or "")
    instrumental = bool(j.get("instrumental"))
    try:
        _poll_and_save(job_id, task_id, prompt, lyrics, seconds, instrumental)
    except Exception as e:
        _set_job(
            job_id,
            status="error",
            error=str(e),
            ok=False,
            trace=traceback.format_exc()[-800:],
        )


def _run_job(
    job_id: str,
    prompt: str,
    lyrics: str,
    seconds: float,
    instrumental: bool,
    bpm: int | None,
    thinking: bool,
) -> None:
    _set_job(job_id, status="submitting")

    # Lean request: lyrics + caption. Avoid sample_query / heavy CoT (hangs queue on 8GB).
    # WAV (not mp3): ACE MP3 export needs ffmpeg on the ACE process PATH; empty file=""
    # happens when encode fails after a successful DiT run.
    body: dict = {
        "prompt": prompt,
        "caption": prompt,
        "lyrics": "" if instrumental else lyrics,
        "audio_duration": float(seconds),
        "duration": float(seconds),
        "thinking": bool(thinking) and not instrumental,
        "vocal_language": "en",
        "audio_format": "wav",
        "inference_steps": 8,
        "batch_size": 1,
        "use_random_seed": True,
        "use_format": False,
        "use_cot_caption": False,
        "use_cot_language": False,
    }
    if bpm:
        try:
            body["bpm"] = int(bpm)
        except Exception:
            pass
    if ACESTEP_API_KEY:
        body["ai_token"] = ACESTEP_API_KEY

    try:
        wrap = _http_json("POST", "/release_task", body, timeout=90.0)
        data = wrap.get("data") if isinstance(wrap, dict) else None
        if not isinstance(data, dict):
            raise RuntimeError(f"bad release_task response: {str(wrap)[:300]}")
        task_id = str(data.get("task_id") or "").strip()
        if not task_id:
            raise RuntimeError(f"no task_id: {str(wrap)[:300]}")
        _set_job(
            job_id,
            status="generating",
            ace_task_id=task_id,
            queue_position=data.get("queue_position"),
        )
        _poll_and_save(job_id, task_id, prompt, lyrics, seconds, instrumental)
    except Exception as e:
        _set_job(
            job_id,
            status="error",
            error=str(e),
            ok=False,
            trace=traceback.format_exc()[-800:],
            provider="ace-step",
        )


def _poll_and_save(
    job_id: str,
    task_id: str,
    prompt: str,
    lyrics: str,
    seconds: float,
    instrumental: bool,
) -> None:
    deadline = time.time() + 1500
    while time.time() < deadline:
        time.sleep(5.0)
        q = _http_json(
            "POST",
            "/query_result",
            {"task_id_list": [task_id]},
            timeout=30.0,
        )
        rows = q.get("data") if isinstance(q, dict) else None
        if not isinstance(rows, list) or not rows:
            continue
        row = rows[0] if isinstance(rows[0], dict) else {}
        st = row.get("status")
        _set_job(job_id, ace_status=st, status="generating" if st == 0 else _JOBS.get(job_id, {}).get("status", "generating"))

        if st == 2:
            err = row.get("error") or row.get("result") or "ace_step_failed"
            raise RuntimeError(str(err)[:400])

        if st == 1:
            result_raw = row.get("result")
            parsed = result_raw
            if isinstance(result_raw, str):
                try:
                    parsed = json.loads(result_raw)
                except Exception:
                    parsed = []
            if isinstance(parsed, dict):
                parsed = [parsed]
            if not isinstance(parsed, list) or not parsed:
                raise RuntimeError("empty ace-step result")
            item = parsed[0] if isinstance(parsed[0], dict) else {}
            file_ref = _pick_audio_ref(item)
            if not file_ref:
                # ACE sometimes returns status=1 with file="" when MP3 encode failed.
                # Rescue: copy newest file from ACE api_audio tmp if present.
                rescued = _rescue_from_ace_tmp(job_id, since=float(_JOBS.get(job_id, {}).get("at") or time.time()) - 30)
                if rescued:
                    metas = item.get("metas") if isinstance(item.get("metas"), dict) else {}
                    _set_job(
                        job_id,
                        ok=True,
                        status="complete",
                        path=rescued["path"],
                        url=rescued["url"],
                        duration_sec=float(metas.get("duration") or seconds),
                        prompt=prompt,
                        lyrics=lyrics[:500],
                        provider="ace-step",
                        vocals=not instrumental,
                        ace_task_id=task_id,
                        metas=metas,
                        rescued=True,
                        dit_model=item.get("dit_model"),
                        lm_model=item.get("lm_model"),
                    )
                    return
                raise RuntimeError(
                    "ACE finished but returned no audio file path (often missing ffmpeg for mp3). "
                    "Retrying with wav — or install ffmpeg on PATH for the ACE-Step process."
                )

            _set_job(job_id, status="downloading")
            blob = _fetch_audio_bytes(file_ref)
            if len(blob) < 1000:
                raise RuntimeError("downloaded audio too small")

            ext = _guess_ext(file_ref, blob)
            fname = f"acestep-{job_id}.{ext}"
            path = OUT_DIR / fname
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            path.write_bytes(blob)
            try:
                mirror = ROOT / "media" / "studio-gen" / fname
                mirror.parent.mkdir(parents=True, exist_ok=True)
                mirror.write_bytes(blob)
            except Exception:
                pass

            metas = item.get("metas") if isinstance(item.get("metas"), dict) else {}
            dur = metas.get("duration") or seconds
            _set_job(
                job_id,
                ok=True,
                status="complete",
                path=str(path),
                url=f"/media/studio-gen/{fname}",
                duration_sec=float(dur) if dur else seconds,
                prompt=prompt,
                lyrics=lyrics[:500],
                provider="ace-step",
                vocals=not instrumental,
                ace_task_id=task_id,
                metas=metas,
                dit_model=item.get("dit_model"),
                lm_model=item.get("lm_model"),
            )
            return

    raise RuntimeError("ace_step_timeout")


def _pick_audio_ref(item: dict) -> str:
    for key in ("file", "url", "audio", "path", "audio_url", "first_audio_path"):
        v = item.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _guess_ext(file_ref: str, blob: bytes) -> str:
    low = (file_ref or "").lower()
    if ".wav" in low or blob[:4] == b"RIFF":
        return "wav"
    if ".flac" in low or blob[:4] == b"fLaC":
        return "flac"
    if ".opus" in low:
        return "opus"
    if ".mp3" in low or blob[:3] == b"ID3" or blob[:2] == b"\xff\xfb":
        return "mp3"
    return "wav"


def _fetch_audio_bytes(file_ref: str) -> bytes:
    # Absolute Windows path from ACE
    if len(file_ref) > 2 and file_ref[1] == ":" and ("\\" in file_ref or "/" in file_ref):
        p = Path(file_ref)
        if p.is_file():
            return p.read_bytes()
    # Already an /v1/audio?path= URL path
    if file_ref.startswith("/v1/audio"):
        return _http_bytes(file_ref, timeout=180.0)
    if file_ref.startswith("http://") or file_ref.startswith("https://"):
        return _http_bytes(file_ref, timeout=180.0)
    if file_ref.startswith("/"):
        return _http_bytes(file_ref, timeout=180.0)
    # Treat as filesystem path → ACE audio endpoint
    return _http_bytes(file_ref, timeout=180.0)


def _rescue_from_ace_tmp(job_id: str, *, since: float) -> dict | None:
    """If ACE wrote a file but forgot to put it in the result, grab the newest one."""
    candidates = [
        Path(os.getenv("ACESTEP_TMPDIR") or "") / "api_audio",
        Path.home() / "ACE-Step-1.5" / ".cache" / "acestep" / "tmp" / "api_audio",
        ROOT.parent / "ACE-Step-1.5" / ".cache" / "acestep" / "tmp" / "api_audio",
        Path(r"C:\Users\Stood\ACE-Step-1.5\.cache\acestep\tmp\api_audio"),
    ]
    newest: Path | None = None
    newest_mtime = since
    for folder in candidates:
        if not folder or not folder.is_dir():
            continue
        try:
            for p in folder.iterdir():
                if not p.is_file():
                    continue
                if p.suffix.lower() not in (".wav", ".mp3", ".flac", ".opus"):
                    continue
                mt = p.stat().st_mtime
                if mt >= newest_mtime and p.stat().st_size > 1000:
                    newest = p
                    newest_mtime = mt
        except Exception:
            continue
    if not newest:
        return None
    blob = newest.read_bytes()
    ext = newest.suffix.lstrip(".") or "wav"
    fname = f"acestep-{job_id}.{ext}"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / fname
    dest.write_bytes(blob)
    try:
        (ROOT / "media" / "studio-gen").mkdir(parents=True, exist_ok=True)
        (ROOT / "media" / "studio-gen" / fname).write_bytes(blob)
    except Exception:
        pass
    return {"path": str(dest), "url": f"/media/studio-gen/{fname}"}


def get_job(job_id: str) -> dict:
    job_id = str(job_id or "").strip()
    if not job_id:
        return {"ok": False, "error": "unknown_job"}
    with _LOCK:
        j = _JOBS.get(job_id)
    if not j:
        # Disk may have it after restart before memory warm
        _load_jobs()
        with _LOCK:
            j = _JOBS.get(job_id)
    if not j:
        return {
            "ok": False,
            "error": "unknown_job",
            "hint": "Hub restarted — hit ✦ Create again. ACE-Step may still finish old GPU jobs.",
        }
    # Resume watcher if hub restarted mid-generate
    st = j.get("status")
    if st in ("queued", "submitting", "generating", "downloading") and j.get("ace_task_id"):
        _ensure_watcher(job_id)
    return {"ok": True, **j}


def resume_incomplete_jobs() -> int:
    """Call on hub boot — reattach watchers for jobs still cooking."""
    _load_jobs()
    n = 0
    with _LOCK:
        items = list(_JOBS.items())
    for jid, j in items:
        st = j.get("status")
        if st in ("queued", "submitting", "generating", "downloading") and j.get("ace_task_id"):
            _ensure_watcher(jid)
            n += 1
        elif st in ("queued", "submitting") and not j.get("ace_task_id"):
            # Never reached ACE — mark so UI doesn't spin forever
            age = time.time() - float(j.get("updated") or j.get("at") or 0)
            if age > 120:
                _set_job(
                    jid,
                    status="error",
                    error="interrupted_by_hub_restart",
                    hint="Hit ✦ Create again",
                    ok=False,
                )
    return n


# Boot hydrate
_load_jobs()
try:
    resume_incomplete_jobs()
except Exception as e:
    print("[studio_acestep] resume on import:", e)
