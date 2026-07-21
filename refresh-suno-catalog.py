#!/usr/bin/env python3
"""
Refresh suno-catalog.json from public Suno pages for @telephantix.

Rules:
  - Proper song titles from Suno clip objects (title + id + audio_url + duration)
  - No duplicates (by id, audio_url, normalized title)
  - Only tracks 3–7 minutes (180–420 seconds)

Sources:
  - Playlist "All I Got" (primary — full clip schema)
  - Profile https://suno.com/@telephantix (extra public clips)

Run anytime you publish more songs, then commit/redeploy the hub:
  python refresh-suno-catalog.py
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import urllib.request
from collections import OrderedDict

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "suno-catalog.json"
HANDLE = "telephantix"
PLAYLIST_ID = "eb4d09a6-f232-4b1a-8582-fcbf0d76a5f7"
MIN_SEC = 180.0  # 3 minutes
MAX_SEC = 420.0  # 7 minutes
JUNK_TITLE_RE = re.compile(
    r"^(verse\s*\d+|untitled|recording\b.*@|\d+(\.\d+)?s\s+recording)",
    re.I,
)
SKIP_IDS = {
    "0c0754b1-c8c9-4d0c-bed8-f51d3e543fec",  # profile user id
    PLAYLIST_ID,
}


def fetch(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml",
            "Referer": f"https://suno.com/@{HANDLE}",
        },
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read().decode("utf-8", "replace")


def unescape(s: str) -> str:
    return (
        s.replace("\\/", "/")
        .replace("\\u0026", "&")
        .replace("\\n", " ")
        .replace('\\"', '"')
    )


def extract_playlist_clips(html: str) -> list[dict]:
    """
    Authoritative pairing from playlist_clips:
      "clip":{"status":"complete","title":"...","id":"...","audio_url":"...","metadata":{...,"duration":N}
    """
    clips: list[dict] = []
    pat = re.compile(
        r'\\"clip\\":\{'
        r'\\"status\\":\\"complete\\",'
        r'\\"title\\":\\"((?:\\\\.|[^\\"\\\\])*)\\",'
        r"(?:(?!\\\"clip\\\":).){0,600}?"
        r'\\"id\\":\\"([0-9a-f-]{36})\\",'
        r"(?:(?!\\\"clip\\\":).){0,1000}?"
        r'\\"audio_url\\":\\"(https:[^\\"]+)\\",'
        r"(?:(?!\\\"clip\\\":).){0,8000}?"
        r'\\"duration\\":([0-9.]+)',
        re.DOTALL,
    )
    for m in pat.finditer(html):
        title = re.sub(r"\s+", " ", unescape(m.group(1)).strip())
        cid = m.group(2)
        audio = unescape(m.group(3))
        duration = float(m.group(4))
        if not cid or cid.startswith("00000000") or cid in SKIP_IDS:
            continue
        # Always bind audio to song id (canonical CDN)
        audio = f"https://cdn1.suno.ai/{cid}.mp3"
        clips.append(
            {
                "id": cid,
                "title": title,
                "audio_url": audio,
                "duration": duration,
            }
        )
    return clips


def extract_profile_clips(html: str) -> list[dict]:
    """Fallback for profile page: title → id → audio_url near duration."""
    clips: list[dict] = []
    pat = re.compile(
        r'\\"title\\":\\"((?:\\\\.|[^\\"\\\\])*)\\"'
        r"(?:(?!\\\"title\\\").){0,900}?"
        r'\\"id\\":\\"([0-9a-f-]{36})\\"'
        r"(?:(?!\\\"id\\\").){0,1500}?"
        r'\\"audio_url\\":\\"(https:[^\\"]+)\\"',
        re.DOTALL,
    )
    for m in pat.finditer(html):
        title = re.sub(r"\s+", " ", unescape(m.group(1)).strip())
        cid = m.group(2)
        if not cid or cid.startswith("00000000") or cid in SKIP_IDS:
            continue
        window = html[m.start() : min(len(html), m.end() + 5000)]
        durs = re.findall(r'\\"duration\\":([0-9.]+)', window)
        duration = None
        for d in durs:
            val = float(d)
            if 30.0 <= val <= 900.0:
                duration = val
                break
        clips.append(
            {
                "id": cid,
                "title": title,
                "audio_url": f"https://cdn1.suno.ai/{cid}.mp3",
                "duration": duration,
            }
        )
    return clips


def extract_ui_title_ids(html: str) -> dict[str, str]:
    """Visible song list: title attribute + /song/uuid (confirm display names)."""
    pairs = re.findall(
        r'title="([^"]+)"[^>]*>\s*<a href="/song/([0-9a-f-]{36})"',
        html,
    )
    out: dict[str, str] = {}
    for title, cid in pairs:
        title = re.sub(r"\s+", " ", title.strip())
        if cid and title:
            out[cid] = title
    return out


def norm_title(t: str) -> str:
    t = (t or "").strip().lower()
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def clean(clips: list[dict], ui_titles: dict[str, str]) -> tuple[list[dict], list[str]]:
    by_id: OrderedDict[str, dict] = OrderedDict()
    for c in clips:
        cid = c["id"]
        # Prefer UI display title when available (what you see on Suno)
        if cid in ui_titles:
            c = {**c, "title": ui_titles[cid]}
        if cid not in by_id:
            by_id[cid] = c
            continue
        prev = by_id[cid]
        # Prefer entry with duration
        if prev.get("duration") is None and c.get("duration") is not None:
            by_id[cid] = c
        elif c.get("title") and not prev.get("title"):
            by_id[cid] = c

    out: list[dict] = []
    seen_titles: set[str] = set()
    seen_audio: set[str] = set()
    skipped: list[str] = []

    for c in by_id.values():
        title = re.sub(r"\s+", " ", (c.get("title") or "").strip())
        nt = norm_title(title)
        audio = f"https://cdn1.suno.ai/{c['id']}.mp3"
        dur = c.get("duration")

        if not title or not nt or JUNK_TITLE_RE.search(title):
            skipped.append(f"junk: {title or '(empty)'}")
            continue
        if dur is None:
            skipped.append(f"no duration: {title}")
            continue
        if not (MIN_SEC <= float(dur) <= MAX_SEC):
            skipped.append(f"length {float(dur)/60:.1f}m: {title}")
            continue
        if nt in seen_titles:
            skipped.append(f"dup title: {title}")
            continue
        if audio in seen_audio:
            skipped.append(f"dup audio: {title}")
            continue

        seen_titles.add(nt)
        seen_audio.add(audio)
        out.append(
            {
                "id": c["id"],
                "title": title,
                "audio_url": audio,
                "duration_sec": round(float(dur), 2),
                "artist": f"Suno · @{HANDLE}",
            }
        )

    out.sort(key=lambda x: (-x["duration_sec"], x["title"].lower()))
    return out, skipped


def main() -> int:
    playlist_url = f"https://suno.com/playlist/{PLAYLIST_ID}"
    profile_url = f"https://suno.com/@{HANDLE}"

    all_clips: list[dict] = []
    ui_titles: dict[str, str] = {}

    print(f"fetch {playlist_url}")
    try:
        pl_html = fetch(playlist_url)
        pl = extract_playlist_clips(pl_html)
        ui_titles.update(extract_ui_title_ids(pl_html))
        print(f"  playlist clips {len(pl)}  ui titles {len(ui_titles)}")
        all_clips.extend(pl)
    except Exception as e:
        print(f"  FAIL {e}")

    print(f"fetch {profile_url}")
    try:
        pr_html = fetch(profile_url)
        pr = extract_profile_clips(pr_html)
        ui_titles.update(extract_ui_title_ids(pr_html))
        print(f"  profile clips {len(pr)}  ui titles total {len(ui_titles)}")
        all_clips.extend(pr)
    except Exception as e:
        print(f"  FAIL {e}")

    final, skipped = clean(all_clips, ui_titles)
    text = json.dumps(final, indent=2, ensure_ascii=False) + "\n"
    OUT.write_text(text, encoding="utf-8")
    public = ROOT / "public" / "suno-catalog.json"
    if public.parent.is_dir():
        public.write_text(text, encoding="utf-8")

    print(f"\nwrote {OUT} ({len(final)} tracks · 3–7 min · proper titles · no dups)")
    for c in final:
        print(f"  {c['duration_sec']/60:4.1f}m  {c['title']}")

    if skipped:
        print(f"\nskipped {len(skipped)}:")
        for s in skipped:
            print(f"  - {s}")

    # Final sanity
    bad = [c for c in final if not c["title"] or c["id"] not in c["audio_url"]]
    if bad:
        print("ERROR: bad title/audio pairs", len(bad))
        return 1
    return 0 if final else 1


if __name__ == "__main__":
    sys.exit(main())
