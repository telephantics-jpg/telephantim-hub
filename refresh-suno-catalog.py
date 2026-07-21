#!/usr/bin/env python3
"""
Refresh suno-catalog.json from the full @telephantix Suno playlist "All I Got".

Source of truth:
  https://suno.com/playlist/eb4d09a6-f232-4b1a-8582-fcbf0d76a5f7
  API: https://studio-api.prod.suno.com/api/playlist/{id}/?cursor=...

Rules:
  - All playlist tracks (paginated until next_cursor is empty)
  - Proper titles from clip.title
  - No duplicates (by song id, audio_url, normalized title — keep first)
  - No length filter (whole playlist)

Run:
  python refresh-suno-catalog.py
Then commit + push master + gh-pages for telephantim.com.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "suno-catalog.json"
HANDLE = "telephantix"
PLAYLIST_ID = "eb4d09a6-f232-4b1a-8582-fcbf0d76a5f7"
API_BASE = f"https://studio-api.prod.suno.com/api/playlist/{PLAYLIST_ID}/"


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
            "Referer": f"https://suno.com/playlist/{PLAYLIST_ID}",
        },
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def fetch_all_playlist_clips() -> tuple[list[dict], int]:
    """Paginate playlist API via next_cursor until complete."""
    clips: list[dict] = []
    cursor: str | None = None
    page = 0
    num_total = None

    while True:
        page += 1
        if cursor:
            url = API_BASE + "?" + urllib.parse.urlencode({"cursor": cursor})
        else:
            url = API_BASE
        print(f"fetch page {page} {url[:90]}...")
        data = fetch_json(url)
        if num_total is None:
            num_total = data.get("num_total_results")
            print(
                f"  playlist={data.get('name')!r} "
                f"num_total_results={num_total} "
                f"total_duration={data.get('total_duration')}"
            )

        batch = data.get("playlist_clips") or []
        print(f"  clips this page: {len(batch)}")
        for item in batch:
            clip = item.get("clip") or item
            if not isinstance(clip, dict):
                continue
            cid = (clip.get("id") or "").strip()
            if not cid or cid.startswith("00000000") or cid == PLAYLIST_ID:
                continue
            title = re.sub(r"\s+", " ", (clip.get("title") or "").strip())
            meta = clip.get("metadata") or {}
            duration = meta.get("duration")
            if duration is None:
                duration = clip.get("duration")
            audio = (clip.get("audio_url") or "").strip()
            if not audio or cid not in audio:
                audio = f"https://cdn1.suno.ai/{cid}.mp3"
            clips.append(
                {
                    "id": cid,
                    "title": title,
                    "audio_url": audio,
                    "duration": float(duration) if duration is not None else None,
                }
            )

        cursor = data.get("next_cursor") or None
        if not cursor:
            break
        if page > 50:
            print("  safety stop: too many pages")
            break

    return clips, int(num_total or 0)


def norm_title(t: str) -> str:
    t = (t or "").strip().lower()
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def dedupe(clips: list[dict]) -> tuple[list[dict], list[str]]:
    """
    Keep every unique song id (full playlist).
    Only skip true duplicates: same id or same audio URL.
    Same title with different ids = different takes — keep both and label.
    """
    by_id: OrderedDict[str, dict] = OrderedDict()
    skipped: list[str] = []

    for c in clips:
        cid = c["id"]
        if cid in by_id:
            skipped.append(f"dup id: {c.get('title') or cid}")
            continue
        by_id[cid] = c

    out: list[dict] = []
    seen_audio: set[str] = set()
    title_counts: dict[str, int] = {}

    for c in by_id.values():
        title = re.sub(r"\s+", " ", (c.get("title") or "").strip())
        if not title:
            title = f"Untitled · {c['id'][:8]}"
        nt = norm_title(title)
        audio = f"https://cdn1.suno.ai/{c['id']}.mp3"

        if audio in seen_audio:
            skipped.append(f"dup audio: {title}")
            continue
        seen_audio.add(audio)

        # Disambiguate repeated titles so both show in the queue
        n = title_counts.get(nt, 0) + 1
        title_counts[nt] = n
        display = title if n == 1 else f"{title} ({n})"

        row = {
            "id": c["id"],
            "title": display,
            "audio_url": audio,
            "artist": f"Suno · @{HANDLE}",
        }
        if c.get("duration") is not None:
            row["duration_sec"] = round(float(c["duration"]), 2)
        out.append(row)

    return out, skipped


def main() -> int:
    try:
        clips, num_total = fetch_all_playlist_clips()
    except urllib.error.HTTPError as e:
        print(f"API FAIL {e}")
        return 1
    except Exception as e:
        print(f"FAIL {e}")
        return 1

    print(f"raw clips fetched: {len(clips)} (api num_total_results={num_total})")
    final, skipped = dedupe(clips)

    # Playlist order as returned (page 1 first), not re-sorted by length
    text = json.dumps(final, indent=2, ensure_ascii=False) + "\n"
    OUT.write_text(text, encoding="utf-8")
    public = ROOT / "public" / "suno-catalog.json"
    if public.parent.is_dir():
        public.write_text(text, encoding="utf-8")

    print(f"\nwrote {OUT} ({len(final)} unique tracks, no dups)")
    for i, c in enumerate(final, 1):
        dur = c.get("duration_sec")
        d = f"{dur/60:4.1f}m" if dur else "  ?  "
        print(f"  {i:3}. {d}  {c['title']}")

    if skipped:
        print(f"\nskipped dups/junk {len(skipped)}:")
        for s in skipped[:30]:
            print(f"  - {s}")
        if len(skipped) > 30:
            print(f"  … +{len(skipped)-30} more")

    if num_total and len(final) < num_total * 0.9:
        print(
            f"WARNING: got {len(final)} unique vs api total {num_total} "
            f"— some may still be missing or were dups"
        )

    bad = [c for c in final if not c["title"] or c["id"] not in c["audio_url"]]
    if bad:
        print("ERROR bad pairs", len(bad))
        return 1
    return 0 if final else 1


if __name__ == "__main__":
    sys.exit(main())
