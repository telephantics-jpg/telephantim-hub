# Make telephantix.com serve THIS site (not Beacons)

Right now **telephantix.com** is still a Beacons custom domain.  
**Luna Camp** stays on **https://telephanti.com/firmament/play** (side button).

I can’t log into your domain registrar for you — but these steps take the domain off Beacons and point it at this site.

---

## What you’ll end up with

| Domain | What it shows |
|--------|----------------|
| **telephantix.com** | This hub (Mjolnir + pay apps + links) |
| **telephanti.com** | Luna Camp / AI (unchanged) |

Side button on the hub: **Luna Camp → telephanti.com/firmament/play**

---

## Step 1 — Put this site on Render (free static hosting)

1. Create a GitHub repo and upload the `telephantix-demo` folder  
   (or only the contents: `public/` + `render.yaml`).
2. Go to [https://dashboard.render.com](https://dashboard.render.com)
3. **New → Static Site**
4. Connect the repo
5. Settings:
   - **Name:** `telephantix-com`
   - **Publish directory:** `public`
   - **Build command:** *(leave empty)*
6. Deploy. Note your free URL, e.g.  
   `https://telephantix-com.onrender.com`

Open that URL and confirm: Luna Camp button (left) + pay links (right).

---

## Step 2 — Disconnect Beacons from telephantix.com

1. Log into [Beacons](https://account.beacons.ai)
2. Find **Custom domain** / domain settings for telephantix.com
3. **Remove** the custom domain (or disable it)

If you skip this, Beacons may fight your DNS later.  
`beacons.ai/telephantix` can stay live as a backup.

---

## Step 3 — Point the domain at Render

1. In Render → your static site → **Settings → Custom Domains**
2. Add: `telephantix.com` and `www.telephantix.com`
3. Render will show DNS records. Typical pattern:

### If Render asks for CNAME (common for www)

| Type | Name | Value |
|------|------|--------|
| CNAME | `www` | `telephantix-com.onrender.com` (use exact host Render shows) |

### Apex domain `telephantix.com` (root)

Often one of:

- **A record** to Render IPs (Render will list them), or  
- **ALIAS / ANAME / CNAME flattening** at Cloudflare/Namecheap

### If the domain is on Cloudflare (recommended)

1. Add domain to Cloudflare (free) if not already  
2. DNS:
   - `CNAME` `www` → your `.onrender.com` host  
   - `CNAME` `@` (apex) → same host (Cloudflare supports CNAME flattening)  
3. SSL/TLS mode: **Full**  
4. Wait 5–30 minutes (sometimes up to a few hours)

### Where DNS lives

Whoever sold you the domain:

- **Namecheap / GoDaddy / Google Domains / Cloudflare** → DNS panel  
- Change records there; save

---

## Step 4 — Verify

1. Visit **https://telephantix.com**  
   → Your Mjolnir hub, not Beacons  
2. Click **Luna Camp**  
   → **https://telephanti.com/firmament/play**  
3. Test PayPal / Cash App / Venmo links

---

## Instagram / social bio

Update your link-in-bio to:

```
https://telephantix.com
```

(instead of only beacons.ai/telephantix)

---

## Local preview (before DNS)

```bat
OPEN_DEMO.bat
```

or

```
http://localhost:8765/
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Still shows Beacons | DNS not updated / Beacons domain not removed / cache — wait + hard refresh |
| SSL error | Wait for Render cert; Cloudflare SSL = Full |
| Luna Camp wrong | Button must go to `https://telephanti.com/firmament/play` |
| Cold start on Render free | First visit after idle can take ~30–60s |

---

## Optional later

- Keep `beacons.ai/telephantix` and add one link: “New site → telephantix.com”
- Add analytics (GA4) to `public/index.html`
- Cookie banner if you add trackers
