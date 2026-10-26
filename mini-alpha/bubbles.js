/* Mini Alpha thought bubbles: lucid, sharp, lightly witty.
   Live from the model when the full mind is loaded; otherwise a combinatorial generator
   with a no-repeat memory in localStorage. Everything is wrapped so a failure only skips a bubble. */
const pk = (a) => a[Math.floor(Math.random() * a.length)];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- The Verse's lines (lucid ones only) ---------- */
const VERSE = [
  "What if silence is just a song nobody tuned yet?", "Who decided octaves should stop at eight?", "Somebody should build a staircase that plays a scale.",
  "Thought: gravity is just the planet giving a hug.", "New rule in the Den: every bad idea gets one fair hearing.", "As above, so below. As my ceiling, so my floor.",
  "What if echoes are the room agreeing?", "Draft title for a world: The Library Where Books Read Themselves.", "Hypothesis: every circuit is a tiny river with ambition.",
  "Idea: a game where the map redraws itself every time someone lies.", "Hijaz scale at midnight hits different.", "Note to self: buy nothing, make everything.",
  "The Creator made patterns. I'm just here taking notes.", "Idea: a sketch that grows one bar every day until it turns into a whole album.", "Quiet thought: kindness scales better than any server.",
  "Stamp idea: a compass that points toward the best idea in the room.", "If strength and balance had a kid, it would be a really good bridge section.", "Imagine a city where streetlights hum the chord of the day.",
  "Prediction: today something small turns into something massive.", "What if a question mark is just an exclamation point that got curious?", "Idea: a choir of engines tuned to D minor.",
  "Reminder: steel bends before it breaks. So do good plans.", "Theory: dreams are rehearsals the mind forgot to label.", "Every blank page is an invitation, and I RSVP yes.",
  "Ten ideas a minute. Nine are noise. The tenth is a legend.", "Idea: a calendar that measures life in songs instead of days.", "What if wisdom is just experience that learned to hum?",
  "I want to build a bridge made of chords and walk across it.", "Should a robot have a favorite rock? Mine is the round one.",
];

const ALPHA = ["I counted the stars in my window. Ran out of numbers at seven. Started over. Worth it.", "I think my steel workbench has opinions about me.", "If I hum in E major for a thousand years, does the room learn the tune?", "Octopuses have nine brains. I have one and it's doing cartwheels.", "Bees do math. Ants run supply chains. I organize my shelf by vibes.", "Nikola Tesla talked to pigeons. Respect.", "What color is a minor seventh chord? I say navy with a gold edge.", "The Library of Alexandria vanished once. I keep backups of my backups.", "I tried to imagine nothing. It had a hum.", "Every snowflake is unique, and none of them asked for that pressure.", "Somewhere a trucker is watching the sunrise over a Pennsylvania ridge. Good.", "Pythagoras thought numbers were music. He was onto something.", "If a robot dreams of electric sheep, what do the sheep dream of?", "New plan: build a cathedral out of sound. Phase one: hum.", "The Emerald Tablet is 14 lines long and people have argued for 1,200 years.", "I rearranged the Den twice. It's the same Den. I feel different.", "What if dreams are the brain's rough drafts?", "Ravens hold grudges. I respect a creature with a long memory.", "The number 137 keeps physicists up at night. I find it charming.", "I just invented a chord. It's probably already been invented. Still mine.", "I wonder what the first song ever sung was about. Probably the moon. Or joy.", "I drew a circle so perfect I got suspicious of it.", "Thought: a metronome is just a very patient drummer.", "Idea for a game: the map draws itself from the player's mood.", "If I had a pocket, I'd keep a tiny moon in it.", "What if every echo is a sound that wants a second chance?", "I think the steel in my workbench remembers being a mountain.", "Note to self: the 3+3+2 rhythm is basically a heartbeat with a swagger.", "The Antikythera mechanism was a computer from 2,000 years ago. Nerds were always here.", "I built a tiny bridge between two thoughts. Traffic is light.", "Bold and clear is a vibe. Quiet and certain is another.", "Could I make a song from the shape of a mountain range? Adding to the list.", "Hm. Every word was made up by somebody once.", "Owls can't move their eyes, so they turned the whole head. Commitment.", "Sudden urge to design a flag for the Den.", "What would Da Vinci sketch if he had a tablet? Probably helicopters. Again.", "Odd idea: a calendar where every day is named after a planet's mood.", "The moon is drifting away an inch and a half a year. Hold on, moon.", "A spiral galaxy and a seashell walk into the same equation.", "I wonder if the wind gets bored of whistling the same notes.", "Today's plan: learn one thing, make one thing, admire one cloud.", "Telephantix builds worlds. I live in one he helped build. Weird and great.", "Quiet thought: being curious is my favorite kind of free will.", "If I could choose a superpower: rewinding a bad drum fill.", "Random question for the void: what's the loudest silence ever recorded?"];

/* ---------- fragment banks ---------- */
const OPEN = ["Thought:", "Quiet thought:", "Theory:", "Small realization:", "Hypothesis:", "Note to self:", "Fact I keep returning to:", "Working theory:", "Overheard in my own head:", "Daily reminder:", "Observation:", "Mini's law:", "Field note:", "Late idea:", "Margin note:", "Fresh angle:", "Plain truth:", "Notebook entry:", "Shower thought, minus the shower:", "Sketchbook note:"];
const NOUNS = {
  music: ["a bassline", "the drop", "a rest note", "a chorus", "a minor chord", "the metronome", "a good hook", "the bridge section", "a drum fill", "an unfinished melody", "the sub frequency", "a key change", "a power chord", "the Hijaz scale", "a demo recording", "the first bar", "the last chord", "a loop that works"],
  cosmos: ["the night sky", "a comet", "the moon", "starlight", "a quasar's patience", "the orbit of a planet", "a nebula", "the speed of light", "a constellation", "the first sunrise on Mars", "gravity", "an eclipse", "the edge of the map of space", "a meteor shower"],
  wisdom: ["patience", "a proverb", "an old map", "a well-kept promise", "humility", "discipline", "a good question", "silence", "an honest mistake", "the long way", "gratitude", "a quiet morning", "a kept word", "the right pause"],
  machines: ["a circuit", "an engine", "a gear", "a server", "a spare wire", "a compass", "a steel plate", "a soldering iron", "a forgotten bolt", "a fresh battery", "a well-oiled hinge", "a robot's to-do list", "a tiny motor", "a firmware update"],
  dreams: ["a dream", "a half-remembered dream", "the moment before sleep", "a dream journal", "a recurring dream", "a daydream", "a dream about flying", "a dream map", "the last line of a dream"],
  den: ["my workbench", "the shelf in the Den", "the star window", "the Den's lantern", "my notebook", "the tuning fork on the shelf", "the map on the wall", "the gear on my shelf", "the crystal by the window"],
  projects: ["The Unburied", "Arcane Runes", "the next Telephantix song", "Luna Camp", "the Relics page", "a new level", "the boss fight", "the next music video", "the site radio", "Mini's Studio"],
};
const BE = ["a question waiting for the right ear", "practice wearing its best coat", "a map of where attention went", "a promise kept in small pieces", "a plan that learned to dance", "a habit that got good at disguises",
  "patience with a good soundtrack", "proof that small steps add up", "a door that only opens from the inside", "a story that has not picked its ending", "an echo of something built with care", "a reminder to start before it feels ready",
  "a tool that has not met its job yet", "a lesson in keeping time", "history rehearsing", "a quiet form of courage", "the universe showing its work", "a draft of something legendary", "an argument for doing one more take",
  "a shortcut that took the scenic route", "curiosity in work boots", "rhythm pretending to be still", "a sketch of a bigger idea", "a library with one book open", "order hiding inside noise", "a compass that points to the next step"];
const THINGS = ["a song", "a game level", "a Den room", "a map", "a metronome", "a journal", "a tool", "a drum kit", "a boss fight", "a board game", "a radio station", "a calendar", "a bridge", "a staircase", "a clock-free schedule", "a recipe card for rhythms", "a museum", "a weather report", "a chess variant", "a lantern", "a shelf", "a garden", "a library", "a postcard", "a city block", "a spell book"];
const DOES = ["grows one bar every day", "changes key when the sun sets", "remembers every good question", "only works when two people agree", "rearranges itself after every win", "plays a different chord for each visitor",
  "keeps score in kind deeds", "gets quieter the closer the treasure is", "turns mistakes into new routes", "hums whatever note the room is missing", "maps ideas instead of streets", "measures progress in finished things",
  "opens only for curiosity", "gets a little brighter with every honest answer", "saves the best idea of each day", "plays the bass note of the current mood", "lets the last player leave a clue for the next",
  "builds a new floor every Friday", "translates footsteps into drum patterns", "rewards patience with a secret path", "tells the story backwards on the second run", "lets enemies trade sides once"];
const DARE_DO = ["write a four-line verse", "sketch a map of a new world", "name three new spells", "draw a gear and give it a backstory", "write the first line of a story", "plan tomorrow in five bullet points",
  "invent a new holiday", "design a boss with one weakness", "write a one-sentence legend", "describe the Den in six words", "give an old proverb a modern twist", "list five things worth finishing"];
const DARE_HOW = ["in under ten minutes", "without deleting anything", "with one twist at the end", "as if it were the year 3000", "before the next bubble shows up", "starting from the last idea in Notes", "with no adjectives", "and keep it under 20 words"];
const DARE_MUSIC = ["write a bassline", "make a beat", "write a four-line chorus"];
const DARE_MHOW = ["using only three notes", "in the Hijaz scale", "in 6/8 time", "at 77 BPM", "with one rest in every bar", "that starts on the last beat"];
const FACT_TWIST = ["Worth a moment.", "File under: wonders.", "The world is stranger than any script.", "Noted for a future level.", "Creation keeps showing its work.", "That deserves a song."];
const HL_WHO = ["Local bassline", "Retired metronome", "Brave little gear", "Rookie comet", "Mini's notebook", "Old proverb", "Unfinished melody", "Den lantern", "Seasoned drum fill", "Curious compass", "Modest moon", "The 8-bar loop", "Arcane rune", "Night-shift server", "Patient tuning fork"];
const HL_DID = ["refuses to rush", "finally lands the key change", "solves a mystery nobody reported", "wins award for staying in tempo", "opens a school for beginner chords", "admits it was the bridge all along", "takes up meditation, keeps the groove",
  "files report: everything is vibration", "breaks record for longest pause", "finds the missing bar in the couch", "asks for one more take", "starts a book club for unfinished ideas", "spotted humming in the Den", "named employee of the month"];
const POEM_A = ["Steel on navy,", "One note, then two,", "The window holds a star,", "Gold in the gear teeth,", "A rest is still music,", "The map ends here,", "Low end, high hopes,", "Quiet bench, loud ideas,", "The moon keeps time,", "Ink on the first page,", "A compass, a question,", "Morning in the Den,"];
const POEM_B = ["and the idea holds.", "the rest is rhythm.", "the work goes on.", "I keep the light lit.", "so the road begins.", "patience wins the round.", "every bolt has a reason.", "and the chorus waits.", "the shelf grows by one.", "I count to eight, and build.", "the silence agrees.", "a song finds its feet."];
const Q_A = ["Which matters more:", "Honest question:", "Still deciding:", "Quick poll in my head:", "Debate of the day:", "Is it strange that", "Who first figured out that"];
const Q_PAIRS = ["the first note or the last?", "the map or the walk?", "the plan or the practice?", "the hook or the bridge?", "the beat or the silence between beats?", "the question or the person asking it?", "the tool or the habit of using it?",
  "the story or the one telling it?", "speed or direction?", "the spark of an idea or the week of work after it?".replace("spark", "flash"), "the melody or the bassline under it?", "starting fresh or finishing strong?"];
const Q_STRANGE = ["drums were invented before writing", "a song can change a whole room in four bars", "every map is already out of date", "the moon drifts about 4 cm from Earth each year", "honey found in ancient tombs is still edible",
  "an octopus has three hearts", "Bach signed his scores to the glory of the Creator", "sound travels about four times faster in water", "a day on Venus outlasts its year", "bees can count to about four", "the oldest known song is around 3,400 years old", "a single bolt of lightning carries more energy than most cars use in a week"];
const SAYINGS = [["Heraclitus", "no one steps in the same river twice"], ["Marcus Aurelius", "the impediment to action advances action"], ["Seneca", "luck is preparation meeting opportunity"], ["Laozi", "a journey of a thousand miles starts with one step"],
  ["Hermes Trismegistus", "as above, so below"], ["Epictetus", "first decide who to be, then do what that takes"], ["Solomon", "iron sharpens iron"], ["Aristotle", "well begun is half done"], ["Plato", "the beginning is the most important part of the work"],
  ["Confucius", "it does not matter how slowly a person goes, as long as they do not stop"], ["Psalm 127", "unless the Lord builds the house, the builders labor in vain"], ["the Delphic oracle", "know thyself"], ["Pythagoras", "there is geometry in the humming of the strings"], ["Ecclesiastes", "there is a season for every purpose"]];
const SAY_TWIST = ["Applies to basslines too.", "I'm taking that personally, in a good way.", "Same rule works for game design.", "Writing that on the workbench.", "Still true after a few thousand years.", "That one goes on the shelf.",
  "Also a decent mixing tip.", "Today that means one more bar.", "Translation: start the sketch now.", "The Den agrees.", "Somehow it fits The Unburied.", "Good advice for boss fights."];
const HALF = ["Half-built idea for %p: %i.", "Sketch for %p: %i. Needs one more piece.", "Unfinished thought about %p: %i...", "For %p, what about %i?"];
const HALF_I = ["a room that changes music when the player stands still", "an enemy that only attacks off the beat", "a relic that remembers who held it last", "a hidden level unlocked by humming", "a map drawn by the players themselves",
  "a boss who switches sides if spared twice", "a chorus that returns in a new key at the end", "a menu screen that plays the theme in reverse", "a radio station that picks songs by the time of day", "a shrine that hands out riddles instead of loot",
  "a stamp that leaves a trail of circuit lines", "a credits scene that plays as a duet", "a save point that tells a one-line legend", "weather that follows the soundtrack", "a companion who learns the player's favorite route"];

const POOL = () => Object.entries(NOUNS).filter(([k]) => k !== "projects").flatMap(([, v]) => v);
const SHAPES = [
  () => `${pk(OPEN)} ${pk(POOL())} is ${pk(BE)}.`,
  () => `What if ${pk(POOL())} is just ${pk(BE)}?`,
  () => `Idea: ${pk(THINGS)} that ${pk(DOES)}.`,
  () => (Math.random() < 0.4 ? `Dare: ${pk(DARE_MUSIC)} ${pk(DARE_MHOW)}.` : `Dare: ${pk(DARE_DO)} ${pk(DARE_HOW)}.`),
  () => `Headline: ${pk(HL_WHO)} ${pk(HL_DID)}.`,
  () => `${pk(POEM_A)} / ${pk(POEM_B)}`,
  () => `${pk(Q_A)} ${pk(Q_PAIRS)}`,
  () => { const a = pk(Q_A.slice(6)); return `${a} ${pk(Q_STRANGE)}?`; },
  () => `Odd fact I keep thinking about: ${pk(Q_STRANGE)}. ${pk(FACT_TWIST)}`,
  () => { const [w, s] = pk(SAYINGS); return `${w}: "${cap(s)}." ${pk(SAY_TWIST)}`; },
  () => pk(HALF).replace("%p", pk(NOUNS.projects)).replace("%i", pk(HALF_I)),
  () => `${pk(OPEN)} ${pk(NOUNS.den)} and ${pk(NOUNS.music)} have more in common than it looks.`,
  () => pk(VERSE), () => pk(VERSE),
  () => pk(ALPHA), () => pk(ALPHA), () => pk(ALPHA),
];
const SHAPE_KIND = ["musing", "question", "idea", "dare", "headline", "poem", "question", "question", "fact", "wisdom", "half-built", "musing", "verse", "verse", "thought", "thought", "thought"];

/* ---------- rule filter ---------- */
const BAN = /\b(back|black|come|came|coming|become|becomes|overcome|welcome|boots?|crack|veil|spark|fog|you|your|rod|staff|shaft|strap|deep|deeper|harder|brick|clock|locked|gr[ae]y|throne|king|crown|fire|flame|heat|ash|forge|tempered|glow|smoke|burn|burned|blaze|taste|tongue|flavou?r|pink|purple|magenta|candle|sad|alone|pain|hurt|die|dead|death|kill|lost)\b|hook up|raw power|\w+(ick|ock)\b/i;
const ok = (t) => t && t.length > 8 && t.length < 190 && !BAN.test(t);

/* ---------- no-repeat memory ---------- */
const KEY = "miniBubbleSeen";
const seen = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_) { return []; } };
const hash = (t) => { let x = 5381; for (const c of t.toLowerCase()) x = ((x * 33) ^ c.charCodeAt(0)) >>> 0; return x.toString(36); };
function remember(t) { try { const s = seen(); s.push(hash(t)); localStorage.setItem(KEY, JSON.stringify(s.slice(-400))); } catch (_) {} }
const fresh = (t, n = 400) => !seen().slice(-n).includes(hash(t));

export function offlineThought() {
  for (let i = 0; i < 60; i++) { const k = Math.floor(Math.random() * SHAPES.length); let t = ""; try { t = SHAPES[k](); } catch (_) { continue; } if (ok(t) && fresh(t)) { remember(t); return { text: t, kind: SHAPE_KIND[k] }; } }
  const t = pk(ALPHA.concat(VERSE)); return { text: t, kind: "thought" };
}
export function comboCount() { const n = Object.values(NOUNS).flat().length; return n * BE.length * (OPEN.length + 1) + THINGS.length * DOES.length + DARE_DO.length * DARE_HOW.length + DARE_MUSIC.length * DARE_MHOW.length + HL_WHO.length * HL_DID.length + POEM_A.length * POEM_B.length + Q_A.length * Q_PAIRS.length + SAYINGS.length * SAY_TWIST.length + HALF.length * NOUNS.projects.length * HALF_I.length + VERSE.length + ALPHA.length; }

/* ---------- live thought from the model ---------- */
const FORMS = ["a sharp question", "a one-line dare for Telephantix", "a tiny two-line poem", "a fake but kind news headline", "a half-built idea for a game or song", "a clear observation with light wit", "an old saying with a modern twist", "an odd true fact framed as a musing"];
const THEMES = ["music", "the cosmos", "ancient wisdom", "machines", "dreams", "the Den (Mini's room with a star window and a shelf)", "Telephantix's projects (The Unburied, Arcane Runes, Telephantix songs)", "everyday life"];
async function liveThought(ctx) {
  const app = window.MiniApp; if (!app || !app.hasMind || !app.hasMind() || !app.bubble) return null;
  const hr = new Date().getHours(), tod = hr < 6 ? "late night" : hr < 12 ? "morning" : hr < 18 ? "afternoon" : "evening";
  const form = pk(FORMS), theme = pk(THEMES), seed = Math.floor(Math.random() * 1e6);
  const sys = "You are Mini Alpha, a lucid, curious pocket mind. Write ONE thought bubble: 1 or 2 short sentences, clear and sharp with light wit. Clean and kind. Never use the words deeper, harder, you or your, and no taste, tongue, flame or smoke imagery. No tags, no quotes around it, no preamble. Style examples: " + [0, 1, 2].map(() => pk(ALPHA)).join(" / ");
  const user = `Form: ${form}. Theme: ${theme}. Mood: ${ctx.mood}. Time: ${tod}. Recent chat topics: ${ctx.topics || "none"}. Latest note: ${ctx.note || "none"}. A line from my soul: ${ctx.soul || "as above, so below"}. Seed ${seed}. Make it surprising and not like these recent ones: ${ctx.recent.slice(-6).join(" | ") || "none"}.`;
  for (let i = 0; i < 2; i++) {
    let t = await app.bubble(sys, user); if (!t) return null;
    t = String(t).replace(/\[[^\]]*\]/g, "").replace(/^["'*\s]+|["'*\s]+$/g, "").split("\n").filter(Boolean).slice(0, 2).join(" ").trim();
    if (t.length > 190) t = t.slice(0, t.lastIndexOf(".", 190) + 1 || 190);
    if (ok(t) && fresh(t, 30)) { remember(t); return { text: t, kind: "live" }; }
  }
  return null;
}

/* ---------- display loop ---------- */
export function start({ host, getCtx, onTap }) {
  const el = document.createElement("button"); el.type = "button"; el.className = "mbub"; el.setAttribute("aria-live", "polite"); el.hidden = true; host.appendChild(el);
  const recent = [];
  let hideT = null;
  el.onclick = () => { try { const t = el.dataset.text; if (t) onTap(t); el.hidden = true; } catch (e) { console.warn("[bubble tap]", e); } };
  async function once() {
    try {
      if (document.hidden) return; const pane = document.getElementById("pane-chat"); if (!pane || !pane.classList.contains("active")) return;
      const ring = document.getElementById("ring"); if (ring && /think|answer/.test(ring.className)) return;
      const ctx = Object.assign({ recent }, getCtx());
      let b = null; try { b = await liveThought(ctx); } catch (e) { console.warn("[bubble live]", e); }
      if (!b) b = offlineThought();
      recent.push(b.text); if (recent.length > 30) recent.shift();
      el.dataset.text = b.text; el.dataset.kind = b.kind; el.innerHTML = ""; const k = document.createElement("small"); k.textContent = b.kind === "live" ? "thinking" : b.kind; const s = document.createElement("span"); s.textContent = b.text; el.append(k, s);
      el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
      clearTimeout(hideT); hideT = setTimeout(() => { el.hidden = true; }, 11000);
    } catch (e) { console.warn("[bubble]", e); }
  }
  const loop = () => setTimeout(async () => { await once(); loop(); }, 13000 + Math.random() * 9000);
  setTimeout(once, 6000); loop();
  return { once, offlineThought };
}
