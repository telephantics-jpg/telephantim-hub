# Mini Alpha – Den room (local only, not for telephantim.com yet)
Base 390x844 portrait; every PNG also has an @2x version. Run `python3 make.py` to regenerate everything (PIL/numpy, procedural).

## Use
```html
<link rel=stylesheet href="room/room.css"><div id=den></div><script src="room/room.js"></script>
<script>
const room = MiniRoom.mount(document.getElementById('den'), {base:'room/', onLeave: text => sendToMini(text)});
room.tag(miniReply);            // handles [shelf:"..."] and [ideal:"..."]
room.setMood('#d4a63a');        // drives the lantern and coal glow (--mood)
</script>
```
- `shelf(text)` puts an object PNG in the next free shelf slot, matched by keyword (gear, fork/tuning, map, medal/alpha, crystal, notebook/book/journal; anything else falls back to crystal) and labels it with the text.
- `ideal(text, imgUrl?)` fills the next free wall frame with Mini's image, or a navy card with the text in gold.
- `place(slotId, src, label)` places an item directly. Slot ids are f1–f4 (frames) and s1-1…s2-3 (shelf).
- `onLeave` gets the text from the "Leave something" box. Mini decides whether to keep it, then replies with a tag. Pass `onLeave:false` to hide the box.
- The box sits at bottom 2.5%. Put the knock button next to it, or move `.room__leave` up if the Den doors' knock button is in the same spot.
- `slots.json` (also inlined in room.js) holds the window, frames, shelves, shelfSlots, lantern and brazier positions as fractions of width and height.
- The starfield canvas sits over the window pane. Reduced motion holds the stars still and the glow steady.
- The room fills a 390:844 box with a stretched background. Wrap it in your own container for other aspect ratios.
