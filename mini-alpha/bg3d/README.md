# bg3d — Mini Alpha 3D background

Files: `bg3d.js` (module), `three.module.min.js` (three r160, local/offline), `demo.html`, `preview.png`.

## Drop in
```html
<script type="importmap">
{"imports":{"three":"./bg3d/three.module.min.js"}}
<!-- or CDN: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js" -->
</script>
<script type="module">
  import { mountBackground, requestTiltPermission, unmount } from './bg3d/bg3d.js';
  mountBackground(document.body, { tilt: true });        // opts: { tilt, static }
  someButton.onclick = () => requestTiltPermission();   // must be from a user tap on iOS
</script>
```
If the app already has an import map for `three`, reuse it (one copy of three only).
Canvas is `position:fixed; z-index:-1; pointer-events:none`, so the pet and UI stay on top — make sure the page body has no opaque background over it.

## Behavior
- Pale steel gradient #E6EBF1→#C9D3DE, drifting brushed steel/gold panels with fractal etching, pulsing ice-blue (#8CE0FF) circuit traces, gold dust.
- Lights: key #FFF4E0 2.2, rim #9CC8FF 1.4, hemi #DDE6F0/#2A3550 0.5, ACES exposure 1.1.
- Tilt parallax (deviceorientation gamma/beta), mouse fallback on PC.
- Pixel ratio capped 1.5 on phones, fewer panels/particles on mobile, pauses when tab hidden, static frame with prefers-reduced-motion.
