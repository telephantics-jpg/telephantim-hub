# Mini Alpha — Canvas tab art kit (local build only)
Files: palette.json · stamps/*.svg + *.png (16, 256px, transparent) · icons/*.svg (14, 48px gunmetal/gold) · brushes.js · canvas.css · demo.html (`#selftest` draws a scene) · preview.png · make.py (regenerates palette, stamps, icons).

## Integrate
```html
<link rel="stylesheet" href="canvas.css"><div id="stage"></div>
<script src="brushes.js"></script>
<script>const mc = MiniCanvas('#stage', {width:1024, height:1024, stampBase:'stamps/', background:'#0b1a33'});</script>
```
The stage is square (aspect-ratio 1). Only `.mc-overlay` takes pointer events; layers are `pointer-events:none`.

## API
| Call | Notes |
|---|---|
| `setTool('pen'|'airbrush'|'glow'|'smudge'|'eraser'|'stamp')` | |
| `setColor(hex)` → hex | snaps to nearest palette swatch while lock is on |
| `setPaletteLock(bool)`, `palette()` | lock on by default; glow forces gold/ember/red |
| `setSize(1-200)`, `setOpacity(0.05-1)` | pressure scales size 0.35–1.65× |
| `setLayer(0|1|2)`, `toggleLayer(i, visible?)`, `clearLayer(i?)` | 0 = background (navy fill), 1 = mid, 2 = top |
| `setStamp(name, scale?, rotDeg?)`, `placeStamp(name,x,y,scale,rotDeg)` → Promise | wheel = scale, shift+wheel = rotate; ghost preview on hover |
| `undo()`, `redo()` | 30 steps, per-layer snapshots |
| `stroke(points[{x,y,p}], {tool,color,size,layer})` | for Mini drawing programmatically (canvas pixel coords 0–1024) |
| `begin(p)/move(p)/end()` | low-level |
| `exportPNG(name)` → Promise<Blob>, `toDataURL()`, `flatten()` | visible layers only |
| `on('change'|'history'|'stamp', fn)`, `destroy()` | |
Statics: `MiniCanvas.PALETTE`, `MiniCanvas.STAMPS`, `MiniCanvas.nearest(hex)`.

## Known weak spots
- Stamps load as SVG from `stampBase`; must be same-origin or export taints the canvas. PNGs are there as fallback (change `.svg` in `loadStamp`).
- Undo stores full ImageData (~4 MB each at 1024²) → 30 steps ≈ 120 MB worst case; lower `maxUndo` on older iPhones.
- iPhone has no pressure for finger touch (fixed 0.6); Apple Pencil works. Mouse is fixed pressure.
- No pinch-to-zoom/pan, no on-canvas rotate/scale handles (sliders + wheel only); stamps are committed on tap, not movable afterwards.
- Smudge is a simple drag-copy; it looks good on steel but is slow on big brushes.
- A few shade stops (dark bronze #8a5a12, hammer-grip brown #3a2a1a) sit just outside the 12 swatches.
