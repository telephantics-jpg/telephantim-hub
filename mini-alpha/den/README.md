# Mini Alpha Den door
1. Copy the PNGs and `den.css` next to the app and include `<link rel="stylesheet" href="den.css">`; use the markup in `demo.html` (`.den` > `.den__glow`, `.den__door--l`, `.den__door--r`, `.den__seal`).
2. Toggle `.is-closed` on `.den` for privacy (700 ms slide, seal fades in after); add `.is-knock` briefly for the knock shake.
3. Set `--mood` on `.den` to the current mood color to tint the pulsing seam glow; reduced-motion users get instant doors and no pulse/shake.
