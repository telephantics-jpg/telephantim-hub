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

  /** Bio background — wide caduceus loop */
  video: "media/bio-bg-caduceus-wide.mp4?v=v175-wide",
  image: "media/bio-bg-caduceus-wide.jpg?v=v175-wide",
  poster: "media/bio-bg-caduceus-wide.jpg?v=v175-wide",

  quote:
    "I'm Telephantix, The Arcane Verse. I'm an ex-trucker from Western Pennsylvania, and these days my hours go into building.\n\nMost days start with music. I lay down my own original beds first, the bass, the power chords and the pulse, then build them out into full Telephantix songs with Suno. Then the songs get eyes. I make music videos for them, like Nobility's Plight, where Goku and Thor settle it the hard way. After that I build games, like The Unburied, my dark action RPG.\n\nI love working with AI, or SI as I like to call it. I run a crew of bots: Agent Alpha on music, The Verse on lyrics, Atlas on art and Hephaestus on code and this site. I set the direction and they help me build it.\n\nI believe in correspondence, as above, so below, and in humility before divine order. I believe in free speech, the free market and good intentions. Government has a real role in keeping people safe and maintaining order. I believe in a strong defense, both to stop anyone from building an unfair system or oppressive policy and to guard against threats foreign and domestic. Oil production is being strained beyond repair, and I think the government should back new energy technology wherever it's in development.\n\nNo label, no studio, no investors. I'm still building, hoping to make a better future for myself. If something here reached you, tap Pay below and help me build what's next.",
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