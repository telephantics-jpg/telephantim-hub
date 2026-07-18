/**
 * Beacons-style Bio page — pick your own background media.
 *
 * HOW TO CHANGE THE BACKGROUND
 * 1. Drop a file in the media/ folder next to index.html:
 *      media/bg.mp4   ← looping video (best, Beacons-style)
 *      media/bg.jpg   ← or a still image
 *      media/bg.webp  ← also fine
 * 2. Set mode below to "video" or "image"
 * 3. Redeploy (or hard-refresh if testing locally)
 *
 * Use your own art/video only (not copyrighted movie clips).
 */

export const BIO = {
  /** "video" | "image" | "auto" (try video, fall back to image) */
  mode: "auto",

  /** Paths relative to the site root (same folder as index.html) */
  video: "media/bg.mp4",
  image: "media/bg.jpg",
  /** Shown while video loads / if video fails */
  poster: "media/bg-poster.jpg",

  /** Optional: remote URL instead of local file (https://...) */
  // video: "https://example.com/your-loop.mp4",
  // image: "https://example.com/your-still.jpg",

  quote:
    "Power without healing is a storm that only breaks. Healing without power is a hymn no one can hear. Hold both.",
  quoteBy: "Telephantim",

  /** Mute looping video (required for autoplay on phones) */
  muted: true,
};
