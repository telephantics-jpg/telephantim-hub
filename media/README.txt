BIO BACKGROUND MEDIA (Beacons-style)
====================================

Put your background files HERE (same names as below, or edit bio-config.js):

  media/bg.mp4        Looping video (muted autoplay — works like Beacons)
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
