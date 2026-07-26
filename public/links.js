/**
 * Telephantix hub links (Beacons pay apps + Luna Camp)
 * Main site target: https://telephantix.com
 * Luna Camp lives on telephanti.com (separate).
 *
 * Editable live via /admin dashboard → data/site-content.json
 * Defaults below ship with the static site; CMS can override at runtime.
 */
export const PROFILE = {
  name: "Telephantix",
  handle: "@telephantix",
  tagline: "Music · AI · Crowdfunding",
  avatar:
    "https://cdn.beacons.ai/user_content/gH8ZHlL6aqeSAOZ8y4thx8RoSXG3/profile_telephantix.png?t=1783265767591",
  beacons: "https://beacons.ai/telephantix",
  site: "https://telephantix.com",
  lunaCamp: "https://telephanti.com/firmament/play",
  lunaCamp2d: "https://telephanti.com/firmament/play",
  lunaCamp3d: "https://telephanti.com/firmament/3d",
  lunaHome: "https://telephanti.com/",
};

/** Primary support links (one working path each — no duplicates) */
export const SUPPORT = [
  {
    id: "paypal",
    title: "PayPal",
    subtitle: "Donate via PayPal",
    url: "https://www.paypal.com/donate/?hosted_button_id=7Q29UNGPVFAT4",
    icon: "paypal",
    accent: "#003087",
  },
  {
    id: "cashapp",
    title: "Cash App",
    subtitle: "$Telephantix",
    url: "https://cash.app/$Telephantix",
    icon: "cashapp",
    accent: "#00d632",
  },
  {
    id: "venmo",
    title: "Venmo",
    subtitle: "@Telephantix",
    url: "https://venmo.com/u/Telephantix",
    icon: "venmo",
    accent: "#3d95ce",
  },
  {
    id: "gofundme",
    title: "Help support",
    subtitle: "GoFundMe",
    url: "https://gofund.me/52108a9d",
    icon: "gofundme",
    accent: "#02a95c",
  },
  {
    id: "bmc",
    title: "Buy Me a Coffee",
    subtitle: "Tip jar",
    url: "https://www.buymeacoffee.com/Telephantics",
    icon: "coffee",
    accent: "#ffdd00",
  },
];

/** Featured content / media */
export const FEATURED = [
  {
    id: "album1",
    title: "Telephantix — Album",
    subtitle: "YouTube Music · explicit lyrics",
    url: "https://music.youtube.com/playlist?list=OLAK5uy_nOw1iUh26P4Zj_Odt1SjaLloUo7C9j4FY&si=okOT2S_QAeNOEAbY",
    icon: "music",
  },
  {
    id: "album2",
    title: "What Isn't Is",
    subtitle: "Album on YouTube Music",
    url: "https://music.youtube.com/playlist?list=OLAK5uy_mCCAwPfN9jMXE9khpgsYFzA1xeei_i4NI&si=9fq0PvYupIDkFxeu",
    icon: "music",
  },
  {
    id: "spotify",
    title: "Spotify — Telephantix",
    subtitle: "Album · 6 songs",
    url: "https://open.spotify.com/album/0TQgbKYS4r0fDmciMoiqKt?si=BIq_EokSSIOCVIru08AvlQ",
    icon: "spotify",
  },
  {
    id: "luna",
    title: "Luna",
    subtitle: "AI Beta I made",
    url: "https://www.telephanti.com",
    icon: "spark",
  },
];

/**
 * Socials — one clean row (Instagram · Facebook · Snapchat · X · Threads · Truth).
 * Edit live via /admin → Socials.
 */
export const SOCIALS = [
  {
    title: "Instagram",
    subtitle: "@telephantix",
    url: "https://www.instagram.com/telephantix/",
    icon: "ig",
  },
  {
    title: "Facebook",
    subtitle: "telephantics",
    url: "https://www.facebook.com/telephantics",
    icon: "fb",
  },
  {
    title: "Snapchat",
    subtitle: "Add Telephantix",
    url: "https://www.snapchat.com/add/telephantix",
    icon: "snap",
  },
  {
    title: "X / Twitter",
    subtitle: "@Telephantix",
    url: "https://x.com/Telephantix",
    icon: "x",
  },
  {
    title: "Threads",
    subtitle: "@telephantix",
    url: "https://www.threads.net/@telephantix",
    icon: "threads",
  },
  {
    title: "Truth Social",
    subtitle: "@Telephantics",
    url: "https://truthsocial.com/@Telephantics",
    icon: "truth",
  },
];

/** Plain text emblems (encoding-safe brand marks) */
export const ICONS = {
  paypal: "PP",
  cashapp: "$",
  venmo: "V",
  gofundme: "GF",
  coffee: "BMC",
  music: "YT",
  spotify: "SP",
  spark: "LU",
  ig: "IG",
  x: "X",
  fb: "f",
  threads: "Th",
  in: "in",
  truth: "T",
  suno: "Su",
  snap: "Sc",
  beacons: "B",
};

/** Merge CMS payload into live link tables (in-place so importers see updates). */
export function applySiteContent(content) {
  if (!content || typeof content !== "object") return;
  if (content.profile && typeof content.profile === "object") {
    Object.assign(PROFILE, content.profile);
  }
  if (Array.isArray(content.support)) {
    SUPPORT.length = 0;
    content.support.forEach((row) => row && SUPPORT.push(row));
  }
  if (Array.isArray(content.featured)) {
    FEATURED.length = 0;
    content.featured.forEach((row) => row && FEATURED.push(row));
  }
  if (Array.isArray(content.socials)) {
    SOCIALS.length = 0;
    content.socials.forEach((row) => row && SOCIALS.push(row));
  }
  if (content.icons && typeof content.icons === "object") {
    Object.assign(ICONS, content.icons);
  }
}
