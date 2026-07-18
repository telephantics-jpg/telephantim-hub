/**
 * Telephantix hub links (Beacons pay apps + Luna Camp)
 * Main site target: https://telephantix.com
 * Luna Camp lives on telephanti.com (separate).
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
  lunaHome: "https://telephanti.com/",
};

/** Primary support / 3rd-party pay apps (display:true on Beacons) */
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
    id: "paypal2",
    title: "My PayPal",
    subtitle: "Another PayPal donate",
    url: "https://www.paypal.com/donate/?hosted_button_id=DRVU9279ZM9Z2",
    icon: "paypal",
    accent: "#009cde",
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
    id: "cashapp2",
    title: "Cash App",
    subtitle: "$Telephantics",
    url: "https://cash.app/$Telephantics",
    icon: "cashapp",
    accent: "#00c853",
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
    id: "gofundme2",
    title: "My GoFundMe",
    subtitle: "All appreciated",
    url: "https://gofund.me/3dce33f2",
    icon: "gofundme",
    accent: "#00b964",
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

/** Socials */
export const SOCIALS = [
  { title: "Instagram", url: "https://www.instagram.com/telephantix/", icon: "ig" },
  { title: "X / Twitter", url: "https://x.com/Telephantix", icon: "x" },
  { title: "Facebook", url: "https://www.facebook.com/telephantics", icon: "fb" },
  { title: "Threads", url: "https://www.threads.net/@telephantix", icon: "threads" },
  { title: "LinkedIn", url: "https://www.linkedin.com/in/telephantics", icon: "in" },
  { title: "Truth Social", url: "https://truthsocial.com/@Telephantics", icon: "truth" },
  { title: "Suno", url: "https://suno.com/@telephantix-demo", icon: "suno" },
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
};
