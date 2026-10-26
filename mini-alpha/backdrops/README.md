# Mini Alpha backdrops
1. Add `<script src="backdrops.js"></script>` and call `const bd = MiniBackdrops.mount(document.getElementById('app'))` (a canvas or a container; a container gets a full-size canvas behind its content).
2. Switch with `bd.set('stars')` / `bd.setAccent('gold')`, or pass Mini's raw tag to `bd.tag('backdrop:stars')`; `bd.stop()` tears it down.
3. 800 ms crossfade, DPR capped at 2, ~30 fps, pauses when hidden, static frame under prefers-reduced-motion.

Tags: `backdrop:circuit|stars|waveform|fractal`, `accent:steel|gold|ember|deepred`
