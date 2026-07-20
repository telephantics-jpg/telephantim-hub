#!/usr/bin/env python3
"""
Build a 60s looping caduceus optical-illusion background.
Includes a brief sacred CROSS silhouette beat (~1s) each cycle.
"""
from __future__ import annotations

import math
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parent
SESSION_IMG = Path(
    r"C:\Users\Stood\.grok\sessions\C%3A%5CUsers%5CStood\019f7224-c564-77b0-bf6e-76975baa74c7\images"
)
BASE = SESSION_IMG / "1.jpg"
CROSS = SESSION_IMG / "2.jpg"
FRAMES_DIR = ROOT / "_caduceus_frames"
OUT_MP4 = ROOT / "bg.mp4"
SIZE = 720
FPS = 24
DURATION = 60  # seconds
# Cross appears once per 10s segment for ~1s (optical flash of the cross form)
CROSS_EVERY = 10.0
CROSS_HOLD = 1.0  # seconds of cross emphasis
TOTAL = FPS * DURATION


def ease_in_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 0.5 - 0.5 * math.cos(math.pi * t)


def load_square(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    im = im.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    return im


def rotate_zoom(im: Image.Image, angle: float, zoom: float) -> Image.Image:
    z = max(1.0, zoom)
    big = int(SIZE * z)
    scaled = im.resize((big, big), Image.Resampling.BILINEAR)
    rot = scaled.rotate(angle, resample=Image.Resampling.BILINEAR, expand=False)
    # center crop to SIZE
    left = (rot.width - SIZE) // 2
    top = (rot.height - SIZE) // 2
    return rot.crop((left, top, left + SIZE, top + SIZE))


def pulse_glow(im: Image.Image, amount: float) -> Image.Image:
    """amount 0..1 — slight brightness + soft blur mix for breathing glow."""
    a = max(0.0, min(1.0, amount))
    bright = ImageEnhance.Brightness(im).enhance(1.0 + 0.18 * a)
    soft = bright.filter(ImageFilter.GaussianBlur(radius=0.6 + 1.2 * a))
    return Image.blend(bright, soft, 0.25 * a)


def cross_weight(t_sec: float) -> float:
    """0..1 how much of the CROSS image to show. Peaks briefly each CROSS_EVERY seconds."""
    # position within cycle
    phase = t_sec % CROSS_EVERY
    # ramp up 0.25s, hold middle, ramp down — total CROSS_HOLD centered around CROSS_EVERY/2
    center = CROSS_EVERY * 0.5
    half = CROSS_HOLD * 0.5
    if abs(phase - center) > half:
        return 0.0
    # distance from center normalized 0 at edge, 1 at center
    d = 1.0 - abs(phase - center) / half
    return ease_in_out(d)


def optical_angle(t_sec: float) -> float:
    """Continuous slow spin that returns near-aligned every 10s for seamless-ish loop feel."""
    # full 360 over 60s so end matches start orientation for loop
    return (t_sec / DURATION) * 360.0


def optical_zoom(t_sec: float) -> float:
    # gentle breathing zoom 1.0–1.08, two cycles per minute
    return 1.0 + 0.08 * (0.5 + 0.5 * math.sin(t_sec * math.pi * 2 / 30.0))


def build_frames() -> None:
    if not BASE.exists():
        raise SystemExit(f"Missing base image: {BASE}")
    if not CROSS.exists():
        raise SystemExit(f"Missing cross image: {CROSS}")

    if FRAMES_DIR.exists():
        shutil.rmtree(FRAMES_DIR)
    FRAMES_DIR.mkdir(parents=True)

    base = load_square(BASE)
    cross = load_square(CROSS)

    print(f"Rendering {TOTAL} frames @ {FPS}fps ({DURATION}s)…")
    for i in range(TOTAL):
        t = i / FPS
        ang = optical_angle(t)
        zoom = optical_zoom(t)
        cw = cross_weight(t)

        frame_a = rotate_zoom(base, ang, zoom)
        frame_b = rotate_zoom(cross, ang * 0.35, zoom)  # cross drifts slower for illusion

        # Mix: mostly caduceus, flash toward sacred cross silhouette
        if cw > 0.01:
            mixed = Image.blend(frame_a, frame_b, cw)
            # extra glow when cross peaks
            mixed = pulse_glow(mixed, 0.35 + 0.65 * cw)
        else:
            # subtle continuous glow pulse
            g = 0.35 + 0.35 * math.sin(t * 2.2)
            mixed = pulse_glow(frame_a, max(0.0, g))

        # slight hue-independent contrast for “illusion” pop
        mixed = ImageEnhance.Contrast(mixed).enhance(1.05 + 0.08 * cw)
        mixed = ImageEnhance.Color(mixed).enhance(1.05)

        out = FRAMES_DIR / f"f_{i:05d}.jpg"
        mixed.save(out, "JPEG", quality=88, optimize=True)

        if i % (FPS * 5) == 0:
            print(f"  {i}/{TOTAL}  t={t:.1f}s  cross={cw:.2f}")

    print("Frames done.")


def encode_mp4() -> None:
    # Prefer newer winget ffmpeg if present
    ffmpeg = shutil.which("ffmpeg") or r"C:\Users\Stood\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
    pattern = str(FRAMES_DIR / "f_%05d.jpg")
    cmd = [
        ffmpeg,
        "-y",
        "-framerate",
        str(FPS),
        "-i",
        pattern,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an",
        str(OUT_MP4),
    ]
    print("Encoding", OUT_MP4)
    subprocess.check_call(cmd)
    mb = OUT_MP4.stat().st_size / (1024 * 1024)
    print(f"Wrote {OUT_MP4} ({mb:.1f} MB)")


def main() -> None:
    build_frames()
    encode_mp4()
    # cleanup frames to save disk
    shutil.rmtree(FRAMES_DIR, ignore_errors=True)
    print("Cleaned frame cache.")


if __name__ == "__main__":
    main()
