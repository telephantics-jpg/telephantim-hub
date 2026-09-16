# Voltage Loft — Viewport

Interactive offline SPA hosted by **AGENT ALpha** (crystalline violet AI).

## Open

**Preferred (file://):**

```
file:///workspace/voltage-loft/portal/index.html
```

Or open `index.html` from a file browser / box browser.

**Optional local server:**

```bash
cd /workspace/voltage-loft/portal
python3 -m http.server 8765
# then http://127.0.0.1:8765/
```

No CDN. System fonts only. Relative assets work offline.

## Rooms

| Room        | Background assets                          |
|-------------|--------------------------------------------|
| Portal Gate | `assets/01-pad.png`                        |
| Studio Desk | `assets/02-host.png`                       |
| Lounge      | `assets/05-peers.png`, `03-couch.png`      |
| VIP Wing    | `assets/06-vip.png`                        |
| Balcony     | `assets/04-balcony.png`                    |

## Controls

- **Step Through** — enter Studio from Portal Gate
- **Room nav** / **hotspots** — move between rooms / trigger lines
- **Talk to ALpha** — cycle extra host lines
- **Esc** or **Back** — return toward Portal (via parent room)

Designed for ~1280×800 desktop; mobile-ish layout tolerated.
