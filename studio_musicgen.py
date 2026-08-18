# -*- coding: utf-8 -*-
"""
Free local text→music via Meta MusicGen (open source, no Suno API).
Uses facebook/musicgen-small on GPU when available.

First run downloads ~1GB weights from Hugging Face (one-time).
"""

from __future__ import annotations

import io
import threading
import time
import traceback
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
if not (PUBLIC / "index.html").exists():
    PUBLIC = ROOT
# Hub serves files from PUBLIC/ — write gens where the browser can fetch them
OUT_DIR = PUBLIC / "media" / "studio-gen"
OUT_DIR.mkdir(parents=True, exist_ok=True)
(ROOT / "media" / "studio-gen").mkdir(parents=True, exist_ok=True)

_LOCK = threading.Lock()
_MODEL = None
_PROCESSOR = None
_DEVICE = "cpu"
_JOBS: dict[str, dict] = {}
_LOAD_ERROR: str | None = None


def musicgen_available() -> dict:
    device = _DEVICE
    try:
        import torch
        import transformers  # noqa: F401

        ok = True
        err = None
        if _MODEL is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
    except Exception as e:
        ok = False
        err = str(e)
    return {
        "ok": ok,
        "loaded": _MODEL is not None,
        "device": device if _MODEL is not None else device,
        "error": err or _LOAD_ERROR,
        "model": "facebook/musicgen-small",
        "license": "MIT / CC-BY-NC 4.0 weights (Meta MusicGen)",
        "outDir": str(OUT_DIR),
    }


def _ensure_model():
    global _MODEL, _PROCESSOR, _DEVICE, _LOAD_ERROR
    with _LOCK:
        if _MODEL is not None:
            return
        try:
            import torch
            from transformers import AutoProcessor, MusicgenForConditionalGeneration

            _DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
            _PROCESSOR = AutoProcessor.from_pretrained("facebook/musicgen-small")
            _MODEL = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small")
            _MODEL.to(_DEVICE)
            _MODEL.eval()
            _LOAD_ERROR = None
        except Exception as e:
            _LOAD_ERROR = f"{type(e).__name__}: {e}"
            raise


def _seconds_to_tokens(seconds: float) -> int:
    # MusicGen ~50 tokens/sec of audio (approx). Cap for VRAM.
    sec = max(5.0, min(30.0, float(seconds) or 15.0))
    return int(sec * 50) + 3


def generate_clip(prompt: str, *, seconds: float = 15.0, job_id: str | None = None) -> dict:
    """
    Synchronously generate one MusicGen clip → wav on disk.
    Returns { ok, path, url, duration, job_id }.
    """
    prompt = (prompt or "").strip()[:500]
    if not prompt:
        return {"ok": False, "error": "empty_prompt"}
    job_id = job_id or uuid.uuid4().hex[:12]
    _JOBS[job_id] = {"status": "loading_model", "prompt": prompt, "at": time.time()}
    try:
        _ensure_model()
        import numpy as np
        import scipy.io.wavfile as wavfile
        import torch

        _JOBS[job_id]["status"] = "generating"
        max_new = _seconds_to_tokens(seconds)
        inputs = _PROCESSOR(
            text=[prompt],
            padding=True,
            return_tensors="pt",
        )
        inputs = {k: v.to(_DEVICE) for k, v in inputs.items()}
        with torch.no_grad():
            audio_values = _MODEL.generate(
                **inputs,
                do_sample=True,
                guidance_scale=3.0,
                max_new_tokens=max_new,
            )
        # audio_values: (batch, channels, samples)
        audio = audio_values[0, 0].detach().cpu().numpy()
        sr = int(getattr(_MODEL.config, "audio_encoder", None) and getattr(_MODEL.config.audio_encoder, "sampling_rate", 32000) or 32000)
        # Prefer processor sampling rate if present
        try:
            sr = int(_PROCESSOR.feature_extractor.sampling_rate)
        except Exception:
            sr = 32000

        # Peak normalize
        peak = float(np.max(np.abs(audio))) or 1.0
        audio = (audio / peak * 0.92).astype("float32")
        pcm = (audio * 32767.0).astype("int16")

        fname = f"musicgen-{job_id}.wav"
        path = OUT_DIR / fname
        wavfile.write(str(path), sr, pcm)
        url = f"/media/studio-gen/{fname}"
        dur = float(len(pcm)) / float(sr)
        out = {
            "ok": True,
            "job_id": job_id,
            "status": "complete",
            "path": str(path),
            "url": url,
            "duration_sec": round(dur, 2),
            "sample_rate": sr,
            "prompt": prompt,
            "provider": "musicgen-small",
            "device": _DEVICE,
        }
        _JOBS[job_id] = {**_JOBS[job_id], **out}
        return out
    except Exception as e:
        err = {"ok": False, "job_id": job_id, "status": "error", "error": str(e), "trace": traceback.format_exc()[-800:]}
        _JOBS[job_id] = {**_JOBS.get(job_id, {}), **err}
        return err


def generate_long(
    prompt: str,
    *,
    total_seconds: float = 90.0,
    chunk_seconds: float = 20.0,
    job_id: str | None = None,
) -> dict:
    """
    Generate a longer track by stitching several MusicGen chunks (same prompt).
    Still free/local — not Suno-length vocals, but real neural audio.
    """
    prompt = (prompt or "").strip()[:500]
    if not prompt:
        return {"ok": False, "error": "empty_prompt"}
    job_id = job_id or uuid.uuid4().hex[:12]
    total_seconds = max(20.0, min(180.0, float(total_seconds) or 90.0))
    chunk_seconds = max(8.0, min(28.0, float(chunk_seconds) or 20.0))
    n = max(1, int(round(total_seconds / chunk_seconds)))
    _JOBS[job_id] = {
        "status": "generating",
        "prompt": prompt,
        "chunks": n,
        "done": 0,
        "at": time.time(),
    }
    try:
        import numpy as np
        import scipy.io.wavfile as wavfile

        parts = []
        sr = 32000
        for i in range(n):
            _JOBS[job_id]["done"] = i
            _JOBS[job_id]["status"] = f"chunk_{i + 1}_of_{n}"
            # Slight prompt variation keeps sections from cloning identically
            chunk_prompt = prompt if i == 0 else f"{prompt}, variation {i + 1}, continue the groove"
            clip = generate_clip(chunk_prompt, seconds=chunk_seconds, job_id=f"{job_id}-c{i}")
            if not clip.get("ok"):
                return {**clip, "job_id": job_id}
            sr = int(clip.get("sample_rate") or sr)
            # scipy returns (sample_rate, data)
            _sr, data = wavfile.read(clip["path"])
            if hasattr(_sr, "__int__") and not hasattr(data, "astype"):
                # swapped / unexpected — normalize
                _sr, data = data, _sr
            try:
                sr = int(_sr) or sr
            except Exception:
                pass
            data = np.asarray(data)
            if data.ndim > 1:
                data = data[:, 0]
            parts.append(data.astype("int16", copy=False))
            # Crossfade ~0.15s
            if len(parts) >= 2:
                fade = min(int(sr * 0.15), len(parts[-2]) // 4, len(parts[-1]) // 4)
                if fade > 8:
                    a = parts[-2].astype("float32")
                    b = parts[-1].astype("float32")
                    for k in range(fade):
                        w = k / fade
                        a[-fade + k] = a[-fade + k] * (1 - w) + b[k] * w
                    parts[-2] = a.astype("int16")
                    parts[-1] = b[fade:].astype("int16")

        full = np.concatenate(parts) if parts else np.zeros(1, dtype="int16")
        fname = f"musicgen-long-{job_id}.wav"
        path = OUT_DIR / fname
        wavfile.write(str(path), sr, full)
        url = f"/media/studio-gen/{fname}"
        dur = float(len(full)) / float(sr)
        out = {
            "ok": True,
            "job_id": job_id,
            "status": "complete",
            "path": str(path),
            "url": url,
            "duration_sec": round(dur, 2),
            "sample_rate": sr,
            "prompt": prompt,
            "chunks": n,
            "provider": "musicgen-small-stitched",
            "device": _DEVICE,
        }
        _JOBS[job_id] = {**_JOBS.get(job_id, {}), **out}
        return out
    except Exception as e:
        err = {"ok": False, "job_id": job_id, "status": "error", "error": str(e), "trace": traceback.format_exc()[-800:]}
        _JOBS[job_id] = {**_JOBS.get(job_id, {}), **err}
        return err


def start_job_async(prompt: str, *, total_seconds: float = 60.0) -> dict:
    """Fire-and-forget generation; poll get_job(job_id)."""
    job_id = uuid.uuid4().hex[:12]
    _JOBS[job_id] = {"status": "queued", "prompt": prompt, "at": time.time()}

    def run():
        generate_long(prompt, total_seconds=total_seconds, job_id=job_id)

    threading.Thread(target=run, daemon=True, name=f"musicgen-{job_id}").start()
    return {
        "ok": True,
        "job_id": job_id,
        "status": "queued",
        "provider": "musicgen-small",
        "free": True,
        "openSource": True,
        "model": "facebook/musicgen-small",
    }


def get_job(job_id: str) -> dict:
    j = _JOBS.get(str(job_id) or "")
    if not j:
        return {"ok": False, "error": "unknown_job"}
    return {"ok": True, **j}
