# telephantim.com (home) → button → Luna Camp (telephanti.com)

## Architecture (what you want)

```
telephantim.com          →  THIS hub (static site on Render)
   └── [Luna Camp button] →  telephanti.com/firmament/play
                                 └── existing Luna backend (already on Render)
```

| Domain | Role | Render service |
|--------|------|----------------|
| **telephantim.com** | Main home page (Mjolnir + pay apps + Camp button) | **New** Static Site |
| **telephanti.com** | Luna Camp backend (unchanged) | **Existing** web service |

Same Render **account**. Two services. Domains are not both glued to one backend.

---

## Step 1 — Buy telephantim.com (if you haven’t)

Namecheap, Cloudflare, Google Domains, etc.  
Don’t point DNS yet — wait until Render gives you records.

---

## Step 2 — Deploy this hub as a Static Site

1. Push `telephantix-demo` to GitHub (or upload folder).
2. [dashboard.render.com](https://dashboard.render.com) → **New → Static Site**
3. Connect repo
4. Settings:
   - **Name:** `telephantim-hub` (anything)
   - **Publish directory:** `public`
   - **Build command:** empty
5. Deploy → open `https://telephantim-hub.onrender.com` (or whatever URL Render gives)
6. Confirm:
   - Left: **Luna Camp** button
   - Right: PayPal / Cash App / Venmo / etc.
   - Button opens **https://telephanti.com/firmament/play**

Leave your **existing Luna service** alone. Don’t put telephantim.com on that service.

---

## Step 3 — Attach telephantim.com to the **new** Static Site only

1. Render → **telephantim-hub** (static site) → **Settings → Custom Domains**
2. Add:
   - `telephantim.com`
   - `www.telephantim.com` (optional but recommended)
3. Render shows DNS records (CNAME / A). Copy them.

---

## Step 4 — DNS at your registrar

Where you bought **telephantim.com**, add exactly what Render shows.

Typical Cloudflare / Namecheap style:

| Type | Name | Target |
|------|------|--------|
| CNAME | `www` | `telephantim-hub.onrender.com` *(use Render’s exact host)* |
| CNAME or ALIAS | `@` / apex | same host *(or A records if Render lists IPs)* |

**Do not** change **telephanti.com** DNS unless Luna breaks — that stays on the Luna service.

Wait for SSL (green lock) — often 5–30 minutes.

---

## Step 5 — Verify

| URL | Should show |
|-----|-------------|
| https://telephantim.com | Hub (3D + links) |
| Click **Luna Camp** | https://telephanti.com/firmament/play |
| https://telephanti.com | Luna (as before) |

---

## Bio / socials

Use as your main link:

```
https://telephantim.com
```

People land on the hub; Camp is one click.

---

## Optional later

- Point **telephantix.com** at this same static site (add another custom domain on the hub service), or leave Beacons as backup.
- Add `telephantim.com` → redirect old Beacons traffic when ready.

---

## Local preview

```bat
OPEN_DEMO.bat
```

→ http://localhost:8765/
