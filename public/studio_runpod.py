# -*- coding: utf-8 -*-
"""
RunPod serverless ACE-Step bridge (pay-per-job while generating).

Env:
  RUNPOD_API_KEY       required
  RUNPOD_ENDPOINT_ID   required  (from Serverless → your endpoint)
  RUNPOD_MAX_SECONDS   guest cap (default 120)

Calls:
  POST https://api.runpod.ai/v2/{ENDPOINT_ID}/run
  GET  https://api.runpod.ai/v2/{ENDPOINT_ID}/status/{id}

Worker input (flexible — matches common ACE / music workers):
  { prompt, lyrics, duration, tags, instrumental }
Output: looks for audio URL / base64 in output.audio / output.url / output.file
"""

from __future__ import annotations

import base64
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

RUNPOD_API_KEY = (os.getenv("RUNPOD_API_KEY") or "").strip()
RUNPOD_ENDPOINT_ID = (os.getenv("RUNPOD_ENDPOINT_ID") or os.getenv("RUNPOD_ENDPOINT") or "").strip()
MAX_SECONDS = max(15, min(300, int(os.getenv("RUNPOD_MAX_SECONDS") or "120")))

_JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()


def runpod_configured() -> bool:
    return bool(RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID)


def runpod_available() -> dict:
    return {
        "ok": runpod_configured(),
        "provider": "runpod",
        "vocals": True,
        "maxSeconds": MAX_SECONDS,
        "endpoint": RUNPOD_ENDPOINT_ID[:8] + "…" if RUNPOD_ENDPOINT_ID else None,
        "pcRequired": False,
        "hint": None
        if runpod_configured()
        else "Set RUNPOD_API_KEY + RUNPOD_ENDPOINT_ID on Render (see ENTER_THIS_RUNPOD.txt)",
    }


def _http(method: str, url: str, body: dict | None = None, timeout: float = 90.0) -> dict:
    data = None
    headers = {
        "Authorization": f"Bearer {RUNPOD_API_KEY}",
        "Accept": "application/json",
        "User-Agent": "TelephantimStudio/runpod/1.0",
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
        raise RuntimeError(f"RunPod HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"RunPod unreachable: {e.reason}") from e


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
    if not runpod_configured():
        return {
            "ok": False,
            "error": "runpod_not_configured",
            "hint": "Set RUNPOD_API_KEY + RUNPOD_ENDPOINT_ID (ENTER_THIS_RUNPOD.txt)",
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
        provider="runpod",
        ok=True,
        at=time.time(),
    )

    def run():
        try:
            _run(job_id, prompt, lyrics, seconds, tags, instrumental)
        except Exception as e:
            _set(
                job_id,
                status="error",
                ok=False,
                error=str(e),
                trace=traceback.format_exc()[-600:],
            )

    threading.Thread(target=run, daemon=True, name=f"runpod-{job_id}").start()
    return {
        "ok": True,
        "job_id": job_id,
        "status": "queued",
        "provider": "runpod",
        "vocals": not instrumental,
        "seconds": seconds,
        "cloud": True,
    }


def _run(
    job_id: str,
    prompt: str,
    lyrics: str,
    seconds: float,
    tags: str,
    instrumental: bool,
) -> None:
    _set(job_id, status="submitting")
    base = f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}"
    payload = {
        "input": {
            "prompt": prompt,
            "caption": prompt,
            "lyrics": lyrics,
            "tags": (tags or prompt)[:400],
            "duration": float(seconds),
            "audio_duration": float(seconds),
            "instrumental": bool(instrumental),
            "audio_format": "wav",
        }
    }
    submitted = _http("POST", f"{base}/run", payload, timeout=60.0)
    rp_id = str(submitted.get("id") or "").strip()
    if not rp_id:
        raise RuntimeError(f"RunPod no job id: {str(submitted)[:300]}")
    _set(job_id, status="generating", runpod_id=rp_id)

    deadline = time.time() + 900
    while time.time() < deadline:
        time.sleep(4.0)
        st = _http("GET", f"{base}/status/{rp_id}", timeout=45.0)
        status = str(st.get("status") or "").upper()
        _set(job_id, runpod_status=status)
        if status in ("FAILED", "CANCELLED", "TIMED_OUT"):
            raise RuntimeError(f"RunPod {status}: {str(st)[:400]}")
        if status == "COMPLETED":
            out = st.get("output")
            blob, ext = _extract_audio(out)
            if not blob:
                raise RuntimeError(f"RunPod completed but no audio: {str(out)[:400]}")
            fname = f"acestep-runpod-{job_id}.{ext}"
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
                provider="runpod",
                vocals=not instrumental,
                runpod_id=rp_id,
            )
            return
    raise RuntimeError("runpod_timeout")


def _extract_audio(out) -> tuple[bytes | None, str]:
    if out is None:
        return None, "wav"
    if isinstance(out, list) and out:
        out = out[0]
    if not isinstance(out, dict):
        return None, "wav"
    # URL fields
    for key in ("audio_url", "url", "file", "audio", "wav", "mp3"):
        val = out.get(key)
        if isinstance(val, dict):
            val = val.get("url") or val.get("file")
        if isinstance(val, str) and val.startswith("http"):
            req = urllib.request.Request(val, headers={"User-Agent": "TelephantimStudio/runpod/1.0"})
            with urllib.request.urlopen(req, timeout=180) as resp:
                blob = resp.read()
            ext = "mp3" if ".mp3" in val.lower() else "wav"
            return blob, ext
        if isinstance(val, str) and val.startswith("data:audio"):
            # data:audio/wav;base64,...
            try:
                b64 = val.split(",", 1)[1]
                return base64.b64decode(b64), "wav"
            except Exception:
                pass
    # raw base64
    for key in ("audio_base64", "wav_base64", "file_base64"):
        val = out.get(key)
        if isinstance(val, str) and len(val) > 100:
            try:
                return base64.b64decode(val), "wav"
            except Exception:
                pass
    return None, "wav"


def get_job(job_id: str) -> dict:
    with _LOCK:
        j = _JOBS.get(str(job_id) or "")
    if not j:
        return {"ok": False, "error": "unknown_job"}
    return {"ok": True, **j}
