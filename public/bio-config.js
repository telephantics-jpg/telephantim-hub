/**
 * Beacons-style Bio page — pick your own background media.
 *
 * Relics stage also uses media/bg.mp4 as the 3D scene background
 * (interactive hammer + staff stay on top).
 *
 * HOW TO CHANGE THE BACKGROUND
 * 1. Replace media/bg.mp4 (or media/bg.jpg)
 * 2. Set mode: "video" | "image" | "auto"
 * 3. Redeploy / hard-refresh
 */

export const BIO = {
  /** "video" | "image" | "auto" (try video, fall back to image) */
  mode: "video",

  /** Same clip as Relics stage background */
  video: "media/bg.mp4",
  image: "media/bg.jpg",
  poster: "media/bg-poster.jpg",

  quote:
    "Power without healing is a storm that only breaks. Healing without power is a hymn no one can hear. Hold both.",
  quoteBy: "Telephantim",

  /** Mute looping video (required for autoplay on phones) */
  muted: true,
};