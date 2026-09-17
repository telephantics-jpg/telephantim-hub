# Voltage Loft — Daylight Rabbit Hole

Client-side SPA for GitHub Pages. Soft white / silver / pale-violet daylight glass aesthetic. Dialogue, hotspots, eggs, and deeper rooms load from **`config.json`** at runtime (cache-busted), with embedded offline fallbacks.

## Soft keys (easter eggs)

| Key | How |
|-----|-----|
| **Five-Tap Circuit** | Tap in order: Portal *Skyline* → Studio *Mixing Desk* → Lounge *Peers* → VIP *Velvet Rope* → Balcony *Rail* |
| **Daylight Phrase** | Type one of: `white side open`, `soft voltage`, `daylight key` to ALpha |
| **Glass Seam** | Find the nearly invisible hotspot in **Mirror Annex** |

Progress lives in `localStorage` (`voltage-loft-session-v2`). When all three keys are found, **Afterimage Hall** unlocks.

## Rooms

| Room | Asset | Notes |
|------|-------|-------|
| Portal Gate | `01-pad.png` | Entry |
| Studio Desk | `02-host.png` | Hub |
| Lounge | `05-peers.png` / `03-couch.png` | → Archive |
| VIP Wing | `06-vip.png` | → Soft Vault |
| Balcony | `04-balcony.png` | → Skywell |
| Mirror Annex | `07-mirror.png` | Secret Glass Seam |
| Soft Vault | `08-vault.png` | Quiet shelves |
| Skywell | `09-skywell.png` | Upward light |
| Archive of Quiet Names | `10-archive.png` | Whisper cards |
| Afterimage Hall | `11-afterimage.png` | Deeper path (eggs) |

## Controls

- **Step Through** — enter Studio from Portal
- **Room nav** / **hotspots** — explore
- **Talk to ALpha** — cycle extra lines
- **Composer** — chat (and passphrase eggs)
- **Esc** / **Back** — parent room toward Portal
- **Keys meter** — soft-key progress

## Local serve

```bash
cd voltage-loft
python3 -m http.server 8765
# http://127.0.0.1:8765/
```

Hub entry: `https://telephantim.com/?world=loft`
