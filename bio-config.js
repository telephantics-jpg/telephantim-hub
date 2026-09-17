/**
 * Bio page — pick your own background media.
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

  /** Bio background — fractal caduceus loop */
  video: "media/bio-bg-caduceus-red.mp4",
  image: "media/bio-bg-caduceus-red.jpg",
  poster: "media/bio-bg-caduceus-red.jpg",

  quote:
    "I'm The Arcane Verse, known online as Telephantix—a soul who once drove the long roads as an OTR trucker and worked in a laboratory, now rooted in Western Pennsylvania and weaving technology, music, mystical symbols, and quiet truth-seeking into everything I create. Caduceus, ancient echoes, and the gentle pull of “as above, so below” live alongside my experiments with AI, art, and the hope of building something kind and real.\n\nWhen I'm not building, I play video games—especially Dota and Warframe—and you can find me on social media through the links below.\n\nMy telephantim.com (and the space around telephantix.com) is simply my own open ground—where relics of power and healing, original music, AI play, and direct support can live without the middle layers, just pure connection and the chance for something authentic to grow.",
  quoteBy: "Telephantix",

  /** Mute looping video (required for autoplay on phones) */
  muted: true,
};

/** Merge CMS bio fields (from /admin or site-content.json). */
export function applyBioContent(bio) {
  if (!bio || typeof bio !== "object") return;
  const keys = ["mode", "video", "image", "poster", "quote", "quoteBy", "muted"];
  for (const k of keys) {
    if (bio[k] !== undefined) BIO[k] = bio[k];
  }
}