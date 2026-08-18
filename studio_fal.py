# -*- coding: utf-8 -*-
"""
Optional cloud ACE-Step via fal.ai — works when your PC is OFF.

Env:
  FAL_KEY          required for this path (https://fal.ai/dashboard/keys)
  FAL_ACE_MAX_SECONDS  guest cap (default 120)

Uses queue API:
  POST https://queue.fal.run/fal-ai/ace-step
  GET  https://queue.fal.run/fal-ai/ace-step/requests/{id}/status
  GET  https://queue.fal.run/fal-ai/ace-step/requests/{id}
"""

from __future__ import annotations

import json
import os
import threading
import time
import traceback
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
if not (PUBLIC / "index.html").exists():
    PUBLIC = ROOT
OUT_DIR = PUBLIC / "media" / "studio-gen"
OUT_DIR.mkdir(parents=True, exist_ok=True)

FAL_KEY = (os.getenv("FAL_KEY") or os.getenv("FAL_API_KEY") or "").strip()
MAX_SECONDS = max(15, min(240, int(os.getenv("FAL_ACE_MAX_SECONDS") or "120")))

_JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()


def fal_configured() -> bool:
    return bool(FAL_KEY)


def fal_available() -> dict:
    return {
        "ok": fal_configured(),
        "provider": "fal-ace-step",
        "vocals": True,
        "maxSeconds": MAX_SECONDS,
        "model": "fal-ai/ace-step",
        "pcRequired": False,
        "hint": None if fal_configured() else "Set FAL_KEY on Render for guest vocals when PC is off",
    }


def _http(method: str, url: str, body: dict | None = None, timeout: float = 60.0) -> dict:
    data = None
    headers = {
        "Authorization": f"Key {FAL_KEY}",
        "Accept": "application/json",
        "User-Agent": "TelephantimStudio/fal/1.0",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:600]
        raise RuntimeError(f"fal HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"fal unreachable: {e.reason}") from e


def _set(job_id: str, **fields) -> None:
    with _LOCK:
        cur = dict(_JOBS.get(job_id) or {})
        cur.update(fields)
        cur["updated"] = time.time()
        _JOBS[job_id] = cur


def start_job_async(
    prompt: str,
    *,
    lyrics: str = "",
    seconds: float = 60.0,
    instrumental: bool = False,
    tags: str = "",
) -> dict:
    if not fal_configured():
        return {
            "ok": False,
            "error": "fal_not_configured",
            "hint": "Add FAL_KEY on telephantim-ai (Render) for guest vocals while PC is off",
            "free": False,
            "vocals": True,
        }
    prompt = (prompt or tags or "").strip()[:500]
    if not prompt:
        return {"ok": False, "error": "empty_prompt"}
    seconds = max(15.0, min(float(MAX_SECONDS), float(seconds) or 60.0))
    lyrics = (lyrics or "").strip()
    if instrumental:
        lyrics = "[inst]"
    elif not lyrics:
        lyrics = (
            "[Verse]\nWalking through the static glow\nHeartbeat paints the night\n"
            "[Chorus]\nSing it loud, signal home\nTurn the silence into song"
        )

    job_id = uuid.uuid4().hex[:12]
    _set(
        job_id,
        status="queued",
        prompt=prompt,
        lyrics=lyrics[:3000],
        seconds=seconds,
        instrumental=bool(instrumental),
        provider="fal-ace-step",
        ok=True,
        at=time.time(),
    )

    def run():
        try:
            _run(job_id, prompt, lyrics, seconds, tags)
        except Exception as e:
            _set(
                job_id,
                status="error",
                ok=False,
                error=str(e),
                trace=traceback.format_exc()[-600:],
            )

    threading.Thread(target=run, daemon=True, name=f"fal-ace-{job_id}").start()
    return {
        "ok": True,
        "job_id": job_id,
        "status": "queued",
        "provider": "fal-ace-step",
        "vocals": not instrumental,
        "seconds": seconds,
        "free": False,
        "cloud": True,
        "model": "fal-ai/ace-step",
    }


def _run(job_id: str, prompt: str, lyrics: str, seconds: float, tags: str) -> None:
    _set(job_id, status="submitting")
    body = {
        "tags": (tags or prompt)[:400],
        "lyrics": lyrics,
        "duration": float(seconds),
        "number_of_steps": 27,
    }
    # Prefer prompt endpoint shape when available — tags field is required on fal-ai/ace-step
    submit = _http("POST", "https://queue.fal.run/fal-ai/ace-step", body, timeout=60.0)
    req_id = str(submit.get("request_id") or submit.get("requestId") or "").strip()
    if not req_id:
        raise RuntimeError(f"fal no request_id: {str(submit)[:300]}")
    _set(job_id, status="generating", fal_request_id=req_id)

    status_url = f"https://queue.fal.run/fal-ai/ace-step/requests/{req_id}/status"
    result_url = f"https://queue.fal.run/fal-ai/ace-step/requests/{req_id}"
    deadline = time.time() + 900
    while time.time() < deadline:
        time.sleep(4.0)
        st = _http("GET", status_url, timeout=30.0)
        status = str(st.get("status") or "").upper()
        _set(job_id, fal_status=status)
        if status in ("FAILED", "CANCELLED", "ERROR"):
            raise RuntimeError(f"fal {status}: {str(st)[:300]}")
        if status in ("COMPLETED", "COMPLETE", "SUCCESS"):
            break
    else:
        raise RuntimeError("fal_timeout")

    result = _http("GET", result_url, timeout=60.0)
    data = result.get("data") if isinstance(result.get("data"), dict) else result
    audio = data.get("audio") if isinstance(data, dict) else None
    url = ""
    if isinstance(audio, dict):
        url = str(audio.get("url") or "").strip()
    elif isinstance(audio, str):
        url = audio.strip()
    if not url:
        raise RuntimeError(f"fal empty audio: {str(result)[:400]}")

    _set(job_id, status="downloading")
    req = urllib.request.Request(url, headers={"User-Agent": "TelephantimStudio/fal/1.0"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        blob = resp.read()
    if len(blob) < 1000:
        raise RuntimeError("fal audio too small")
    ext = "wav"
    if ".mp3" in url.lower():
        ext = "mp3"
    fname = f"acestep-fal-{job_id}.{ext}"
    path = OUT_DIR / fname
    path.write_bytes(blob)
    try:
        (ROOT / "media" / "studio-gen" / fname).write_bytes(blob)
    except Exception:
        pass
    _set(
        job_id,
        ok=True,
        status="complete",
        path=str(path),
        url=f"/media/studio-gen/{fname}",
        duration_sec=seconds,
        prompt=prompt,
        provider="fal-ace-step",
        vocals=True,
        fal_request_id=req_id,
    )


def get_job(job_id: str) -> dict:
    with _LOCK:
        j = _JOBS.get(str(job_id) or "")
    if not j:
        return {"ok": False, "error": "unknown_job"}
    return {"ok": True, **j}
