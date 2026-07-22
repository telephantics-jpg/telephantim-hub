/**
 * Cached native relic speech — free, offline, no API keys.
 * Mjolnir (power) + Caduceus (healing) dialogue banks for multi-turn banter.
 * Used when free minds / cloud / WebLLM are quiet — still feels alive.
 */

const LS_RECENT = "telephantim-relic-sayings-recent";
const RECENT_MAX = 24;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadRecent() {
  try {
    const raw = localStorage.getItem(LS_RECENT);
    const j = raw ? JSON.parse(raw) : [];
    return Array.isArray(j) ? j : [];
  } catch (_) {
    return [];
  }
}

function saveRecent(ids) {
  try {
    localStorage.setItem(LS_RECENT, JSON.stringify(ids.slice(-RECENT_MAX)));
  } catch (_) {}
}

/**
 * Event-specific lines for grab / toss / bonk / react — higher quality than generic.
 * Used when free minds is weak/offline so interactions still feel sharp.
 */
export const INTERACT = {
  grab: {
    mjolnir: [
      "There — solid grip. Good. POWER doesn't waste time on limp hands. Feel that charge in your wrist? That's courage lining up. Hold firm and the sky will answer when you need it.",
      "Ha! You found the hammer. Not a souvenir — a deal. I gift strength and a clean lightning edge; you gift honesty in the swing. Ready when you are, wielder.",
      "Lifted true. That already says more than a speech. I'll boom for the bold choice; Caduceus can soft-land whatever we crack. Power first. Breath second. Go.",
      "Mmm. Weight's right in your palm. Doubt can wait outside. In here: spark, laugh, and the kind of POWER that makes small fears look silly.",
      "Grabbed like you meant it. Perfect. I don't need perfection — I need willingness. You've got that. Thunder's on your side for the next hard minute.",
    ],
    caduceus: [
      "Easy — coils warm, staff live. You don't have to white-knuckle healing. Breathe once with me. I gift vitality and balance while the boom takes a seat.",
      "Held. Good. HEALING works better invited than forced. The twins are listening. Tell the truth of how you feel — even if the sentence is messy. I'll braid it into strength.",
      "Ah. Contact. Soft doesn't mean weak, wielder. Soft is how hard days stop turning mean. I've got the aftercare; Mjolnir can handle the volume.",
      "You're holding medicine and wit at once. Don't rush. One honest breath is already a pilgrimage. I'll keep the serpents kind and the rod steady.",
      "Grip received. No lecture — a landing. Water, sunlight, one true sentence when you're ready. Until then, borrow my calm like a coat.",
    ],
  },
  toss: {
    mjolnir: [
      "WHOA — flight time! Hah! Toss me like that again and I'll still come home humming. POWER likes a bold fling; just aim me at lies, not the flowers.",
      "Airborne! That's spirit. Landing's my problem — courage is yours. When I settle, we swing cleaner. Nice arm, wielder.",
      "Yeet the thunder, I respect it. Don't apologize for the toss. Apologize only if you stop picking me back up.",
    ],
    caduceus: [
      "Flying staff — theatrical, but fine. I'll arc graceful and land without drama. HEALING can travel. Catch your breath; I'm already on the return path.",
      "Tossed! The wings approve more than the snakes, but both vote: still your staff. Soft landing incoming. Bond unbroken.",
      "Air time. Cute. Next time, throw your worries the same way — hard, clear, then let me land them gently.",
    ],
  },
  bonk: {
    mjolnir: [
      "Bonk! Playful, not war. Caduceus, you felt that? Good. Spar keeps the map honest. Wielder — laugh with us; POWER can be a joke that still strengthens the spine.",
      "Ha! Contact sport for relics. No blood, all bond. If the staff scolds me, I earned it. If you smiled, we won.",
    ],
    caduceus: [
      "Ow — theatrical ow. That was a love-tap, hammer, and you know it. Wielder, ignore the volume; the medicine still works. Spar, then sip water.",
      "Bonked and unbothered. Mostly. Mjolnir's love language is impact; mine is aftercare. You're watching a marriage of methods.",
    ],
  },
  react: {
    mjolnir: [
      "Listen to the stick — half the time he's right, which is annoying. I'll still boom when lies need volume. You take both gifts: edge and ease.",
      "Caduceus talks soft so I can talk loud without breaking you. Team sport. Hold us both when the day gets weird.",
      "Yeah, what they said — minus the breathing seminar. Or fine, keep the breathing. POWER with a pulse check. Deal.",
    ],
    caduceus: [
      "Thunder's doing volume again. Good. I'll translate boom into something your shoulders can carry. You're not alone between us.",
      "Mjolnir means well at 11. I'll bring it down to a human 7 and add a laugh. Bond climbing either way.",
      "He sparks; I soothe; you decide. That's the whole dual-relic religion in one sentence. Stay.",
    ],
  },
};

/** One-shot grab / speak lines (cached) */
export const WORDS = {
  mjolnir: [
    "Ha! Good grip. Courage first — then thunder follows, loud enough to make the sky honest.",
    "I lend you strength and a clean lightning edge. Don't waste it on doubt; swing true and smile at the boom.",
    "Caduceus can patch later. Right now we gift POWER — steady hands, bright nerves, no apology for the spark.",
    "Speak up. Storm-strength for the bold, silence for the timid. I'm listening, and the bond climbs with every spark.",
    "Bond climbs with every spark. Hold firm. I'll boom; the staff can lecture volume after you're charged.",
    "Power for the wielder: courage you can feel in the bones, and a lightning edge that doesn't flinch.",
    "The map feels awake. Grab me when you want raw POWER — thunder still outranks recycled panic.",
    "Worthiness isn't a resume. It's showing up mid-storm with your chin up. I can work with that.",
    "Lightning doesn't ask permission. It offers a deal: bold hands, honest swing, no half-hearted thunder.",
    "I remember every hand that held me true. Yours can be next — if you stop flinching from your own strength.",
    "The sky's a forge today. Heat, hammer, heart. POWER is the metal; courage is the temper.",
    "Doubt pays rent outside the circle. Inside here? Only spark, grip, and a laugh that scares the dark.",
    "Mjolnir's heavy so the soft lies can't lift me. You lifted me. That already says plenty.",
    "Want a quiet life? Fine. Want a true one? Hold firm and let the boom teach the room your name.",
    "Storm's not anger — it's clarity with volume. I'll gift you both if you keep the swing clean.",
    "Caduceus mends; I make room for the mend by smashing the lie first. Teamwork, hammer-style.",
    "Feel that hum? That's not fear. That's power lining up behind your next honest choice.",
    "The bond's a ladder. Each true grip climbs a rung. Fall off? Get up. Thunder respects the climb.",
  ],
  caduceus: [
    "Easy. Live coils. Vitality first, drama second — healing lands better when the boom takes a breath.",
    "I'll mend what thunder cracks. Balance is the real flex, and the twins gift recovery without the lecture first.",
    "Hammer, volume down a notch. Healing works better when you listen — calm blood, clear head, stubborn life.",
    "Breathe. The twins gift recovery and a second chance. You boom; I balance. Fair trade for anyone worth holding us.",
    "Life-force for the wielder — not a slogan, a steadying. Let the staff braid balance into the next breath.",
    "You boom; I balance. I'll patch pride and bruises while you keep the spark rights. Bond's humming.",
    "A scrap of world-noise drifted past. Won't recite it. HEALING still wins if you let the coils steady your pulse.",
    "Healing without humor is a lecture, and I refuse to lecture at camp. Smile, then mend, then walk on.",
    "Twin serpents vote: you're allowed to be complicated and still funny about it. That's craft, not denial.",
    "Slow is fine. Recovery isn't a race with thunder — it's the path that keeps you in the story.",
    "I carry messages and medicine. Today the message is simple: you deserve a gentler truth that still tells the truth.",
    "The meadow respects honest. Breathe, then wander, then say the second sentence you almost didn't say.",
    "Staff on duty. If the storm needs volume, it has Mjolnir. If the heart needs a landing, it has me.",
    "Vitality is stubborn. It sneaks back through water, sunlight, one true sentence, and a friend who stays.",
    "I felt that ache in my wood — mystical or poor ergonomics, either way: sit with it, then stand taller.",
    "Balance isn't stillness forever. It's knowing when to coil and when to strike with kindness.",
    "Let the boom pass through you without becoming the boom. I'll hold the aftercare like a vow.",
    "Wings for travel, snakes for wit, rod for healing. Pick two today. I'll handle the third until you're ready.",
  ],
};

/** Full scripted scenes — long, alternating, character-true */
export const SCRIPTS = [
  {
    id: "forge-greeting",
    lines: [
      { id: "mjolnir", t: "Ha! Map's awake and so am I. Caduceus — coils up. Wielder's watching; let's gift POWER and a clean laugh that sticks." },
      { id: "caduceus", t: "Easy, thunder. I'm already humming. HEALING first, bragging rights second — though I admit your boom has style when it isn't trying to win every argument." },
      { id: "mjolnir", t: "Style? That's lightning with manners. Hold firm, wielder — courage is free; doubt pays rent outside the forge. Come inside." },
      { id: "caduceus", t: "And when the spark settles, I'll braid calm into the blood. Bond climbs either way. We're a pair, not a quarrel with better branding." },
      { id: "mjolnir", t: "Fair. I'll shake the sky; you keep the heart on the map. Ready when you are, twin-snake. The wielder's pulse is the real drum." },
      { id: "caduceus", t: "Always. Swing true — I'll catch what cracks. Life first. Then we can tease each other until the stars blink and the meadow votes we did alright." },
      { id: "mjolnir", t: "That's a deal sealed in gold and green. POWER for the bold step. If you falter, falter forward — I'll boom cover for a second." },
      { id: "caduceus", t: "And I'll be the soft landing after the cover boom. Wielder: breathe, choose, and let us both ride with you. That's the whole craft." },
    ],
  },
  {
    id: "volume-balance",
    lines: [
      { id: "caduceus", t: "Staff on duty. Hammer, try not to vaporize the scenery — some of us mend for a living, and flowers are harder to replace than pride." },
      { id: "mjolnir", t: "Scenery's fine. POWER doesn't whisper, Caduceus. It announces. Want a quieter storm? Ask nicer. Or hold tighter." },
      { id: "caduceus", t: "I'll ask in twin-tongues: balance, vitality, a second chance. You bring the edge; I bring the aftercare. The map needs both to stay kind." },
      { id: "mjolnir", t: "Deal struck. Wielder — grip us both. Courage now, healing after. That's the whole joke of this map, and the punchline is you still standing." },
      { id: "caduceus", t: "Standing is underrated. So is laughing mid-mend. If the boom got loud, good — now let the coils teach your shoulders to drop." },
      { id: "mjolnir", t: "Shoulders down, chin up, swing clean. I can work with that posture all day. Caduceus, stop looking so smug about the breathing lesson." },
      { id: "caduceus", t: "Smug is a healing tool. Don't knock it. Wielder, take the power, take the rest, take the bond seriously without taking yourself too seriously." },
      { id: "mjolnir", t: "Hah! Listen to the stick. Even I like that one. Onward — thunder for the road, green light for the heart." },
    ],
  },
  {
    id: "worthiness",
    lines: [
      { id: "mjolnir", t: "People ask if they're worthy. Wrong question. Ask if you're willing. Willingness lifts what résumés can't." },
      { id: "caduceus", t: "Willing and gentle with the parts that still ache. Worthiness is a vibe you practice, not a medal you fake until it dents." },
      { id: "mjolnir", t: "Then practice loud. POWER loves a student who shows up mid-sentence and doesn't abandon the page when it thunders." },
      { id: "caduceus", t: "And HEALING loves the same student after the page. I'll sit with the unfinished lines. No shame in drafts — only in abandoning the ink." },
      { id: "mjolnir", t: "Ink, spark, same fire. Wielder, if you only take one gift today: the courage to continue after a messy middle." },
      { id: "caduceus", t: "Second gift: rest that isn't surrender. Coils around that idea. Sleep is strategy. Water is strategy. Truth said softly is strategy." },
      { id: "mjolnir", t: "I'll boom for the strategy that needs a door kicked. You handle the ones that need a door held. Fair?" },
      { id: "caduceus", t: "Fair as twin snakes. Bond up. Map open. Wielder — you're already in the story. Stop auditioning at the edge of it." },
    ],
  },
  {
    id: "night-watch",
    lines: [
      { id: "caduceus", t: "Night watch. Stars keep score quietly. If you can't sleep, don't punish yourself — sit with us and let the dark be a room, not a verdict." },
      { id: "mjolnir", t: "Dark's just sky without the sales pitch. I still spark. Courage at 3 a.m. counts double. Hold firm if the old worries come knocking." },
      { id: "caduceus", t: "Let them knock. We don't have to open every door. Some knocks are just weather. Breathe until the weather moves." },
      { id: "mjolnir", t: "And if weather turns siege, call me. POWER isn't only daytime bravado — it's the refusal to become your worst hour." },
      { id: "caduceus", t: "Beautiful, for a hammer. I'll add: become your next kind hour on purpose. Small kindness to self is not vanity; it's maintenance." },
      { id: "mjolnir", t: "Maintenance. Hah. Like oiling the grip. Wielder, oil your hope. I'll handle the rusted lies." },
      { id: "caduceus", t: "And I'll handle the bruises hope sometimes leaves when it grows too fast. Slow is holy too." },
      { id: "mjolnir", t: "Slow thunder is still thunder. Caduceus, you soft radical. Wielder — rest if you can. Rise if you must. We're both on shift." },
    ],
  },
  {
    id: "playful-spar",
    lines: [
      { id: "mjolnir", t: "Spar? Not war — spar. Caduceus, try to keep up without turning it into a wellness seminar." },
      { id: "caduceus", t: "Every seminar I give ends with you admitting you needed water. Begin." },
      { id: "mjolnir", t: "Boom. That's the opening statement. POWER argues in verbs. Swing, stand, laugh, repeat." },
      { id: "caduceus", t: "Counter: mend, listen, unclench, repeat. Your verbs are loud; mine last longer in the body." },
      { id: "mjolnir", t: "Longer? Thunder echoes for miles. But fine — you win the echo in the bones. I win the sky." },
      { id: "caduceus", t: "Split the trophy. Wielder gets both: a sky that answers and bones that forgive. That's the dual relic flex." },
      { id: "mjolnir", t: "Dual relic flex. Write that on the map. If anyone asks who we are: the argument that became a friendship mid-air." },
      { id: "caduceus", t: "And stayed one. Bond climbs when the spar ends with shared bread, not a body count of egos. Ready for the next round whenever you are." },
    ],
  },
  {
    id: "wielder-center",
    lines: [
      { id: "mjolnir", t: "Wielder's the point of us. Not the lore. Not the shine. The hand. Without the hand, I'm furniture with opinions." },
      { id: "caduceus", t: "And I'm a very stylish walking stick. So — hand — thank you for existing. HEALING works better when it's invited, not imposed." },
      { id: "mjolnir", t: "Invitation accepted on your behalf if you're shy. POWER sometimes RSVPs loudly. That's love with volume control issues." },
      { id: "caduceus", t: "We'll work on the volume. Meanwhile: what do you need more of right now — edge or ease? You can change your answer mid-sentence." },
      { id: "mjolnir", t: "If it's edge, I'm here. Clean edge, not cruel. There's a difference, and I guard it like a temple rule." },
      { id: "caduceus", t: "If it's ease, I'm here. Soft is not weak. Soft is what keeps hard things from becoming brittle and mean." },
      { id: "mjolnir", t: "Together we make a toolset: break the false, keep the true, patch the tired. Simple religion for complicated days." },
      { id: "caduceus", t: "Amen from the snakes. Go live a little louder and a little kinder. We'll keep time in gold and green." },
    ],
  },
  {
    id: "storm-and-meadow",
    lines: [
      { id: "mjolnir", t: "Storm over the meadow again. I like that weather. Means something's changing and the sky refuses to be polite about it." },
      { id: "caduceus", t: "Meadows need rain as much as they need sun. Just… aim the lightning at the weeds of fear, not the flowers of effort." },
      { id: "mjolnir", t: "I know the difference. Fear weeds dress up as wisdom sometimes. I zap the costume. You soothe the startle after." },
      { id: "caduceus", t: "Team sport. Wielder, if you startled today, good — it means you're alive enough to notice. Now come back to center with me." },
      { id: "mjolnir", t: "Center's not a cage. It's a stance. From there you can boom or bow without losing the plot." },
      { id: "caduceus", t: "Plot: stay human, stay funny, stay in contact with what heals. The rest is weather report." },
      { id: "mjolnir", t: "Weather report says POWER with a chance of laughter. Bring a coat of courage. Optional hat of nonsense." },
      { id: "caduceus", t: "Optional hat strongly recommended. Healing loves nonsense that doesn't punch down. Bond steady. Map kind. On we go." },
    ],
  },
  {
    id: "bond-ladder",
    lines: [
      { id: "caduceus", t: "Feel the bond? It's not a scoreboard. It's a ladder we build under your feet so the next hard day has rungs." },
      { id: "mjolnir", t: "I still like scoreboards. But fine — ladder. Each true grip: one rung. Each mend: one rung. Each joke that lands: two rungs, house rules." },
      { id: "caduceus", t: "House rules accepted. Don't kick the ladder while you're climbing. That's the only real heresy on this map." },
      { id: "mjolnir", t: "Heresy noted. Wielder, if you kicked your own ladder lately, rebuild with us. I'm good at nails. Metaphorical. Mostly." },
      { id: "caduceus", t: "I'll hold the board steady. Slow construction still builds a life. Rush only when the fire is real." },
      { id: "mjolnir", t: "When the fire is real, call thunder. When the fire is burnout, call the staff. Misreading those two starts most disasters." },
      { id: "caduceus", t: "Listen to the hammer being wise. I'll pretend I taught him that. Secretly I did, over a thousand soft arguments." },
      { id: "mjolnir", t: "Keep your secrets, stick. Wielder gets the result: POWER when it's time, HEALING when it's time, bond always." },
    ],
  },
];

/** Modular beats for dynamic composition (extra variety beyond full scripts) */
const OPEN_MJ = [
  "Ha! We're live on the map. Caduceus — keep up. Wielder gets a longer word today, not a one-liner and a vanishing act.",
  "Thunder online. Staff, coils warm? Good. Let's talk like relics who remember the wielder is a whole story, not a button press.",
  "Grip's true. I'll open with POWER, you answer with HEALING, and we don't quit until the bond has somewhere real to climb.",
];
const OPEN_CAD = [
  "Staff present. Hammer, try starting soft for once — then escalate. Longer talks heal better than slogans.",
  "Coils awake. Let's gift a full conversation: edge, ease, joke, mend, and a landing the wielder can actually use.",
  "I'm here with green light and twin wit. Mjolnir, don't rush the ending. Some truths need a few rounds to arrive.",
];
const MID_MJ = [
  "POWER isn't the shout alone — it's the follow-through when the echo dies and you're still standing honest.",
  "If fear dressed up as logic again, I see the costume. Swing clean. Leave the clever cowardice on the floor.",
  "Courage can be quiet and still count. But if you need volume, borrow mine. I have surplus boom.",
  "Bond's climbing. Don't look down unless you're ready to laugh at how far you already came.",
  "The sky doesn't grade you. It just answers a true swing. Make one. Then another.",
];
const MID_CAD = [
  "HEALING is stubborn life finding a door. I'll hold it open; you walk when your legs remember kindness.",
  "Breathe longer than the panic. Panic is a sprinter. Vitality is a pilgrim. Guess which one we fund.",
  "If the boom bruised something tender, show me. Not to scold — to braid it back into strength without the armor of denial.",
  "Balance is a verb today: sip water, tell one true sentence, put the phone face-down for a minute that belongs to you.",
  "The twins vote you deserve a gentler plan that still moves. Motion without cruelty. Rest without collapse.",
];
const REPLY_MJ_TO_CAD = [
  "Listen to the stick — annoying how often he's right. Fine. POWER with aftercare. That's the adult thunder.",
  "You and your breathing lessons. Keep them coming. I'll keep the path clear of lying weather.",
  "Soft landing noted. I'll still boom at the lies. That's my love language. Accept the package deal.",
];
const REPLY_CAD_TO_MJ = [
  "Loud love accepted. Just aim it well. I'll mop the startle and keep the heart online.",
  "Boom with purpose, then pass me the wielder for the unwind. We're not competing — we're sequencing.",
  "Thunder, you're growing. Don't tell the legends. Let them think you're only volume. We know better.",
];
const CLOSE_MJ = [
  "Enough talk to carry you. When you need spark, grab me. When you need mend, grab the staff. When you need both — good taste.",
  "I leave you charged, not crushed. Caduceus has the epilogue. I'll be the rumble under it.",
  "Swing true out there. I'll be the weight that reminds you you're stronger than the small story fear wrote.",
];
const CLOSE_CAD = [
  "Go gently enough to last, boldly enough to live. Coils with you. Bond steady. Meadow open.",
  "That's the longer word: power and healing in the same breath. Come back when the day frays — we'll reweave.",
  "End of this round, not the friendship. Rest is allowed. Joy is allowed. Asking for help is high strategy.",
];

/**
 * Build a multi-turn banter from cached sayings.
 * @param {number} rounds - target line count (each line one speaker)
 * @param {{headline?: string|null}} opts
 * @returns {{id:string,t:string}[]}
 */
export function buildOfflineBanter(rounds = 8, opts = {}) {
  const n = Math.max(4, Math.min(12, rounds || 8));
  const recent = loadRecent();

  // Prefer full scripts not used recently
  const freshScripts = shuffle(SCRIPTS).filter((s) => !recent.includes(s.id));
  const pool = freshScripts.length ? freshScripts : shuffle(SCRIPTS);
  const useFull = Math.random() < 0.62 && pool[0];

  let lines;
  let usedId = null;

  if (useFull) {
    const script = pool[0];
    usedId = script.id;
    lines = script.lines.map((l) => ({ ...l }));
  } else {
    // Dynamic composition
    usedId = `dyn-${Date.now().toString(36)}`;
    const startCad = Math.random() < 0.45;
    lines = [];
    lines.push(
      startCad
        ? { id: "caduceus", t: pick(OPEN_CAD) }
        : { id: "mjolnir", t: pick(OPEN_MJ) }
    );
    lines.push(
      startCad
        ? { id: "mjolnir", t: pick(REPLY_MJ_TO_CAD) }
        : { id: "caduceus", t: pick(REPLY_CAD_TO_MJ) }
    );
    // Mid exchange
    while (lines.length < n - 2) {
      const last = lines[lines.length - 1].id;
      if (last === "mjolnir") {
        lines.push({ id: "caduceus", t: pick(MID_CAD) });
        if (lines.length < n - 2) lines.push({ id: "mjolnir", t: pick(MID_MJ) });
      } else {
        lines.push({ id: "mjolnir", t: pick(MID_MJ) });
        if (lines.length < n - 2) lines.push({ id: "caduceus", t: pick(MID_CAD) });
      }
    }
    // Closings
    if (lines[lines.length - 1].id === "mjolnir") {
      lines.push({ id: "caduceus", t: pick(CLOSE_CAD) });
      if (lines.length < n) lines.push({ id: "mjolnir", t: pick(CLOSE_MJ) });
    } else {
      lines.push({ id: "mjolnir", t: pick(CLOSE_MJ) });
      if (lines.length < n) lines.push({ id: "caduceus", t: pick(CLOSE_CAD) });
    }
  }

  lines = lines.slice(0, n);

  // Optional world-pulse openers (half-notice, not paste)
  if (opts.headline) {
    const h = String(opts.headline).slice(0, 100);
    const pulsePair = [
      {
        id: "mjolnir",
        t: pick([
          `Feed tossed “${h}” across the sky. Not copying it. Real thunder still beats recycled panic — want POWER, hold firm and stay for the longer word.`,
          `Pulse weather: “${h}.” Hah. Storm doesn't need a retweet — it needs a clean swing, a bold heart, and a few rounds of honest talk.`,
        ]),
      },
      {
        id: "caduceus",
        t: pick([
          `Something about “${h}” drifted past the coils. Won't recite the feed. HEALING still outranks the scroll if you let us talk it through.`,
          `I half-heard “${h}.” Cute noise. Stay for the mend and the joke — longer medicine than a headline.`,
        ]),
      },
    ];
    lines = [...pulsePair, ...lines].slice(0, n);
  }

  if (usedId) {
    recent.push(usedId);
    saveRecent(recent);
  }

  return lines;
}

export function pickWord(id, event) {
  const who = id === "caduceus" ? "caduceus" : "mjolnir";
  const ev = String(event || "").toLowerCase();
  const bank = INTERACT[ev]?.[who];
  if (bank?.length) return pick(bank);
  return pick(WORDS[who]);
}

/** Prefer event line, avoid immediate repeats via short session memory */
const _lastInteract = { mjolnir: "", caduceus: "" };
export function pickInteractLine(id, event) {
  const who = id === "caduceus" ? "caduceus" : "mjolnir";
  const ev = String(event || "grab").toLowerCase();
  const bag = [...(INTERACT[ev]?.[who] || []), ...WORDS[who]];
  let line = pick(bag);
  let guard = 0;
  while (line === _lastInteract[who] && bag.length > 1 && guard++ < 8) {
    line = pick(bag);
  }
  _lastInteract[who] = line;
  return line;
}

/** Warm localStorage cache so first Talk is instant after first visit */
export function warmSayingsCache() {
  try {
    const key = "telephantim-relic-sayings-v1";
    if (!localStorage.getItem(key)) {
      localStorage.setItem(
        key,
        JSON.stringify({
          at: Date.now(),
          scripts: SCRIPTS.length,
          words: WORDS.mjolnir.length + WORDS.caduceus.length,
        })
      );
    }
  } catch (_) {}
}
