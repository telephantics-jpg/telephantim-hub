#!/usr/bin/env python3
"""
Refresh suno-catalog.json from public Suno pages for @telephantix.
Sources:
  - Profile https://suno.com/@telephantix
  - Playlist "All I Got" https://suno.com/playlist/eb4d09a6-f232-4b1a-8582-fcbf0d76a5f7

Run locally anytime you publish more songs, then redeploy the hub:
  python refresh-suno-catalog.py
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "suno-catalog.json"
HANDLE = "telephantix"
PLAYLIST_ID = "eb4d09a6-f232-4b1a-8582-fcbf0d76a5f7"
JUNK_TITLES = {
    "untitled",
    "(verse 1)",
    "17.6s recording (feb 28 @ 12:06 pm)",
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
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", "replace")


def unescape(s: str) -> str:
    try:
        return bytes(s, "utf-8").decode("unicode_escape")
    except Exception:
        return s.replace("\\/", "/").replace('\\"', '"').replace("\\n", " ")


def extract(html: str) -> list[dict]:
    clips: list[dict] = []

    for b in re.finditer(r'\\"audio_url\\":\\"(https:[^\\"]+)\\"', html):
        window = html[max(0, b.start() - 4000) : min(len(html), b.end() + 4000)]
        idm = re.search(r'\\"id\\":\\"([0-9a-f-]{36})\\"', window)
        tm = re.search(r'\\"title\\":\\"((?:\\\\.|[^\\"\\\\])*)\\"', window)
        if not idm:
            continue
        cid = idm.group(1)
        if cid.startswith("00000000"):
            continue
        title = unescape(tm.group(1)) if tm else "Untitled"
        audio = b.group(1).replace("\\/", "/").replace("\\u0026", "&")
        clips.append({"id": cid, "title": title, "audio_url": audio})

    # title/id pairings without audio_url still map to CDN mp3
    patterns = [
        r'\\"id\\":\\"([0-9a-f-]{36})\\"(?:(?!\\"id\\").){0,2200}?\\"title\\":\\"((?:\\\\.|[^\\"\\\\])*)\\"',
        r'\\"title\\":\\"((?:\\\\.|[^\\"\\\\])*)\\"(?:(?!\\"title\\").){0,2200}?\\"id\\":\\"([0-9a-f-]{36})\\"',
    ]
    for i, pat in enumerate(patterns):
        for m in re.finditer(pat, html):
            if i == 0:
                cid, title = m.group(1), unescape(m.group(2))
            else:
                title, cid = unescape(m.group(1)), m.group(2)
            if cid.startswith("00000000"):
                continue
            clips.append(
                {
                    "id": cid,
                    "title": title,
                    "audio_url": f"https://cdn1.suno.ai/{cid}.mp3",
                }
            )
    return clips


def clean(clips: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for c in clips:
        cid = (c.get("id") or "").strip()
        title = re.sub(r"\s+", " ", (c.get("title") or "").strip())
        if not cid or cid in seen or cid.startswith("00000000"):
            continue
        if not title or title.lower() in JUNK_TITLES:
            continue
        # skip profile user id if it ever sneaks in as a clip
        if cid == "0c0754b1-c8c9-4d0c-bed8-f51d3e543fec":
            continue
        if cid == PLAYLIST_ID:
            continue
        seen.add(cid)
        out.append(
            {
                "id": cid,
                "title": title,
                "audio_url": c.get("audio_url") or f"https://cdn1.suno.ai/{cid}.mp3",
                "artist": f"Suno · @{HANDLE}",
            }
        )
    return out


def main() -> int:
    urls = [
        f"https://suno.com/@{HANDLE}",
        f"https://suno.com/playlist/{PLAYLIST_ID}",
    ]
    all_clips: list[dict] = []
    for url in urls:
        print(f"fetch {url}")
        try:
            html = fetch(url)
        except Exception as e:
            print(f"  FAIL {e}")
            continue
        clips = extract(html)
        print(f"  raw clips {len(clips)} html_len={len(html)}")
        all_clips.extend(clips)

    final = clean(all_clips)
    OUT.write_text(json.dumps(final, indent=2, ensure_ascii=False), encoding="utf-8")
    public = ROOT / "public" / "suno-catalog.json"
    if public.parent.is_dir():
        public.write_text(OUT.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"wrote {OUT} ({len(final)} tracks)")
    for c in final:
        print(f"  - {c['title']}")
    return 0 if final else 1


if __name__ == "__main__":
    sys.exit(main())
