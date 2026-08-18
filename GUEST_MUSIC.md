# Guest music when your PC is OFF

## Hard truth (no magic)

| Host | Can run ACE-Step vocals? |
|------|---------------------------|
| **GitHub / gh-pages** | No — static files only |
| **Render free web** | No GPU — can't run ACE-Step |
| **Buzz (Block)** | No — team chat for humans+agents, not a music GPU |
| **Your RTX 4060** | Yes — while PC is on (`START_STUDIO_LOCAL.bat`) |
| **fal.ai ACE-Step** | Yes — pay-per-song cloud; works with PC off |
| **Modal.com ACE-Step** | Yes — serverless GPU (needs Modal account + deploy) |

Git/Render host the **website + API glue**. They do **not** replace a GPU for 10‑minute vocal songs.

## What we ship

1. **PC on:** local ACE-Step (`START_ACE_STEP.bat` / `START_STUDIO_LOCAL.bat`)
2. **PC off + `FAL_KEY` on Render:** guests still get cloud vocals (capped ~2 min)
3. **Neither:** Studio stays usable — type-beat / Your songs / clear status message

## Turn on guest cloud vocals (recommended for “PC off”)

1. Create a free key at https://fal.ai/dashboard/keys  
2. Render → **telephantim-ai** → Environment → add:
   - `FAL_KEY` = your key  
3. Manual Deploy / wait for auto-deploy from `master`  
4. Guests on https://telephantim.com/#studio hit `TELEPHANTIM_API` → Render → fal

Cost is pay-per-generation (fits a ~$100 budget much longer than an always-on GPU box).

## Local refresh

```
telephantix-demo\START_STUDIO_LOCAL.bat
```

Opens http://127.0.0.1:8765/#studio and only starts hub/ACE if missing.

## Live UI

Push `master` + `gh-pages` (Studio already deployed). Hard refresh telephantim.com/#studio.
