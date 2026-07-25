# Telephantim Admin Dashboard (Beacons-style)

Your own control panel to edit **telephantim.com** without hand-editing code every time.

## What you can change

| Tab | Edits |
|-----|--------|
| **Profile** | Name, handle, tagline, avatar, Beacons / site URLs |
| **Pay / Support** | PayPal, Cash App, Venmo, GoFundMe, coffee links |
| **Featured** | Albums, Luna, highlight buttons |
| **Socials** | Instagram, X, Facebook, Threads, etc. |
| **Bio quote** | Quote text + attribution |
| **Songs** | Add / remove Suno tracks on the hub player |

## How it works

1. You log into **`/admin/`** on the hub AI server (password protected).
2. You edit fields and hit **Save**.
3. Server stores JSON in `data/site-content.json` (+ song catalog).
4. The live hub loads that content from **`/api/content`** and **`/api/suno-catalog`**
   (via `TELEPHANTIM_API` → `https://telephantim-ai.onrender.com`).

Public visitors never see `/admin` — only you, with the password.

## Local (this PC)

```powershell
cd C:\Users\Stood\telephantix-demo
# optional custom password:
# $env:ADMIN_PASSWORD = "pick-a-strong-password"
python server.py
```

Then open:

- **Admin:** http://127.0.0.1:8765/admin/
- **Site:** http://127.0.0.1:8765/

**Local default password** (only if `ADMIN_PASSWORD` is unset): `telephantix`

## Live (internet) — one-time setup

On **Render** → service **telephantim-ai** (or whatever hosts `server.py`):

1. **Environment** → add:
   - `ADMIN_PASSWORD` = a strong secret only you know
   - (optional) `ADMIN_SESSION_SECRET` = long random string
2. **Redeploy** so the new env vars load.
3. Deploy this repo’s `server.py` + `public/admin/` + hub JS (`load-site.js`, etc.) the usual way
   (`master` / `gh-pages` as you already do).

Then open:

**https://telephantim-ai.onrender.com/admin/**

Log in → change stuff → Save.

Hard-refresh the hub (**Ctrl+F5** on https://telephantim.com) to see updates.

### Important about free Render disks

Free/ephemeral disks can **lose file writes on redeploy**. After big edits, either:

- Keep a backup of `data/site-content.json`, or  
- Ask me to wire GitHub auto-commit / a persistent disk later.

Until then: saving works for the life of the running instance; redeploys may reset to the JSON shipped in git.

## Fruit check

| Step | URL |
|------|-----|
| Log in | https://telephantim-ai.onrender.com/admin/ (after deploy + password) |
| Public content | https://telephantim-ai.onrender.com/api/content |
| Live hub | https://telephantim.com |

## Security

- Never share `ADMIN_PASSWORD`.
- Do not put the password in the repo or screenshots.
- Change the local default before any public tunnel.
