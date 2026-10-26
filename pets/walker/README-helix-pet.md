# Helix Pet: 3D caduceus-cross helix sprite set
Built in Blender 4.2.3 LTS (headless, Cycles CPU, 24 samples + denoise, transparent film). Rebuild:
`blender -b --python build.py` (model, .blend, .glb), then `blender -b helix-pet.blend --python anim.py -- idle spin bump wave walk talk sleep` (frames/), then `python3 pack.py`.

Model: helix-pet.glb (three.js / Unreal; wings = WingL/WingR, orb = OrbPivot, root = HelixPet), helix-pet.blend.
Sprites: `256/<state>.webp|.png|.json` and `128/<state>.*`. Horizontal strips, transparent, seamless loops. Index: states.json.

| state | frames | fps | use |
|---|---|---|---|
| idle  | 48 | 24 | default: slow spin + float |
| spin  | 24 | 24 | toss/throw: fast 2-turn spin with wobble |
| bump  | 24 | 24 | edge hit: squash + recoil, starts/ends in idle pose |
| wave  | 48 | 24 | greeting with speech bubble: wings lift, orb tilts, body sways |
| walk  | 48 | 24 | extra: strolling, sway/tilt while spinning |
| talk  | 24 | 24 | extra: bounce, rungs and eyes pulse brighter |
| sleep | 48 | 12 | extra: slow spin, glow dimmed |

## Physics layer → state
- At rest, no velocity: `idle`. Moving along the bottom: `walk` (or `idle`).
- Drag: `idle` (or freeze the current frame). Release with speed > ~400 px/s: `spin` while airborne. Drop back to `idle`/`walk` once speed < ~60 px/s.
- Hitting a screen edge (velocity flips): play `bump` once (24 frames, about 1 s), then go back to the previous state. Apply restitution ~0.6 and clamp to the viewport.
- Speech bubble opens: play `wave` once as the greeting, then `talk` while text shows, and `idle` when the bubble closes.
- No input for ~60 s, or the page is hidden: `sleep`. Any tap wakes it with `wave`.
- Switch states on frame boundaries. Every loop starts in the upright idle pose, so cuts stay clean.
- Phone: use 128/*.webp (CSS/`<img>` swap) or 128/*.png strips (canvas `drawImage` with frame = floor(t*fps) % frames).
