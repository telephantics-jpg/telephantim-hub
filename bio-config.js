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

  /** Bio background — portrait caduceus loop */
  video: "media/bio-bg-caduceus-portrait.mp4?v=v174-portrait",
  image: "media/bio-bg-caduceus-portrait.jpg?v=v174-portrait",
  poster: "media/bio-bg-caduceus-portrait.jpg?v=v174-portrait",

  quote:
    "I'm The Arcane Verse, known online as Telephantix. I've driven the long roads as an OTR trucker, worked in a laboratory, and today I'm still a driver, rooted in Western Pennsylvania. Between the miles, I weave technology, music, mystical symbols and quiet truth-seeking into everything I create. The Caduceus, ancient echoes and the steady pull of 'as above, so below' live alongside my experiments with AI, art and the hope of building something kind and real.\n\nLately that hope has teeth. I've been making original music and hypnotic videos, the Arcane Runes game, which you can play right here in your browser, and The Unburied, a dark action RPG built in Unreal Engine where the dead won't stay down. My music runs heavy, from Breaking Benjamin grit to DragonForce speed to Pink Floyd haze. All of it is built after shifts and between drives with a small crew of AI collaborators I direct, and no label, no studio and no investors, just will, patience and a refusal to stop.\n\nWhen I'm not building, I'm gaming, especially Dota and Warframe, and you can find me on social media through the links below.\n\ntelephantim.com is my own open ground. Relics of power and healing, original music, AI play and direct support live here without the middle layers. It's pure connection and room for something authentic to grow.\n\nRight now I'm working to raise money that actually reaches me, not a middleman or a platform. Every bit of real support goes into improving my life, strengthening my will, and pushing these projects further than one driver's paycheck can. If a song, a game or a single line here reached you, tap Pay below and help me build what's next.",
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