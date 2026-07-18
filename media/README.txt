BACKGROUND MEDIA (Relics stage + Bio page)
==========================================

Current clip: media/bg.mp4
  (compressed from your Downloads “1.30 second clip.mp4” — ~90s loop, muted)

Used as:
  • Relics stage 3D background (Mjolnir + Caduceus stay interactive on top)
  • Bio tab full-screen Beacons-style background

Put / replace files HERE:

  media/bg.mp4        Looping video (muted autoplay)
  media/bg.jpg        Still image fallback or main image
  media/bg-poster.jpg Optional poster frame while video loads

Then open bio-config.js and set:

  mode: "video"   // force video
  mode: "image"   // force still
  mode: "auto"    // try video, fall back to image

Tips:
  - Use YOUR video/art only (not copyrighted movie clips).
  - Keep video short & compressed (e.g. 8–20s loop, 720p, under ~8MB).
  - Phones require muted video for autoplay.
  - After uploading, hard-refresh the site (Ctrl+F5).

Edit the big quote in bio-config.js → quote / quoteBy
