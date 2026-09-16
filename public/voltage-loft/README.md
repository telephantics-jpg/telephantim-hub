# Voltage Loft — Live Dynamic Viewport

Client-side SPA hosted on GitHub Pages. Dialogue/hotspots load from **`config.json`** at runtime (cache-busted), with embedded offline fallbacks. Session state (rooms visited, last line, signal meter, clock) lives in **localStorage**. Guests can type to **AGENT ALpha** — keyword/heuristic replies, room-aware, no backend.

## Open

**Preferred (file://):**

```
file:///workspace/voltage-loft/portal/index.html
```

Or open `index.html` from a file browser / box browser.

**Optional local server:**

```bash
cd /workspace/telephantim-hub/voltage-loft
python3 -m http.server 8765
# then http://127.0.0.1:8765/
```

No CDN. System fonts only. Relative assets work offline. If `config.json` fails to fetch (e.g. strict file://), the app boots from embedded fallbacks and shows **OFFLINE** on the live badge.

## Dynamic pieces

| Piece | Behavior |
|-------|----------|
| `config.json` | Rooms, lines, hotspots, keyword replies — edit without rewriting `app.js` |
| Session | `localStorage` key `voltage-loft-session-v1` |
| Chat composer | Guest → ALpha replies (keywords + room `chatHooks`) |
| Ambient UI | Soft CSS pulse / glow so the tab doesn’t feel frozen |
| Hub iframe | `scenes.js` cache-busts `/voltage-loft/?v=…` |

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
- **Composer** — type to ALpha for live replies
- **Esc** or **Back** — return toward Portal (via parent room)

Designed for ~1280×800 desktop; mobile-ish layout tolerated.
