/**
 * Daily Word — one powerful esoteric-true paragraph per calendar day.
 * 1) Prefer cloud/local API (Grok / Groq / Ollama via telephantim-ai)
 * 2) Else deterministic offline bank so the box always works on static hosting
 */

const BANK = [
  {
    title: "As Above, So Below",
    body: "The old Hermetic line is not magic code—it is pattern recognition. The spiral of a galaxy and the spiral of a seashell obey the same kinds of growth rules. Your lungs branch like rivers and trees because fluid and air both carve the path of least resistance. Sacred geometry is often just nature, named carefully. When initiates said “as above, so below,” they were noticing that scale changes costumes, not laws. Truth wears myth so the heart can carry what the mind alone drops.",
  },
  {
    title: "The Living Flame",
    body: "Fire is chemistry with a myth’s face: rapid oxidation releasing light and heat. Yet every hearth cult understood something still true—without controlled fire, civilization collapses into cold and dark. The candle and the star are cousins: plasma and flame both transmute matter into radiance. Hold that without superstition. Your attention is also a kind of fire. Where you place it, heat gathers, bonds form, ore becomes metal. Guard the flame; it is the oldest technology that still remakes a soul.",
  },
  {
    title: "Mercury’s Twin Paths",
    body: "Hermes/Mercury was messenger and psychopomp—guide between worlds—not because gods text, but because communication is how separate systems become one field. Neurons fire by chemical messengers; societies rise by shared symbols; DNA is a four-letter language that builds bodies. The caduceus’s twin snakes are a picture of polarity held in balance: left and right, inhale and exhale, analysis and synthesis. Healing is not erasing the opposite—it is conducting the current between them without shorting out.",
  },
  {
    title: "Thunder’s True Name",
    body: "Lightning is not Zeus’s mood; it is charge separation in storm clouds releasing a path of ionized air hotter than the surface of the Sun. The boom is air expanding after that heat-punch. Ancients heard a god; physicists hear plasma and pressure. Both can be reverent. Power without understanding is terror; understanding without awe is a dead lab. Stand between them. Courage is the body agreeing to be a conductor for a moment longer than fear allows.",
  },
  {
    title: "Solve et Coagula",
    body: "Alchemy’s motto—dissolve and recombine—is laboratory truth dressed as initiation. You break compounds to free elements; you recombine them into something stronger. Grief dissolves identity; love coagulates a new one. Sleep dissolves the day’s noise; morning coagulates intention. Cells constantly break down and rebuild protein. Nothing living is static. If you refuse the dissolve, you fossilize. If you refuse the recombine, you scatter. The Great Work is learning the timing of both.",
  },
  {
    title: "The Hidden Sun",
    body: "Every green leaf runs a solar rite: light splits water, frees oxygen, and stores energy in sugar. That is not metaphor—it is photosynthesis, the quiet engine of most life on Earth. Alchemists hunted a “hidden sun” in matter; in a leaf it was always public. Your blood’s iron and the chlorophyll’s magnesium sit in similar ringed molecules, cousins across kingdoms. Esoteric means “inner.” The most esoteric fact is sometimes the most ordinary: sunlight becomes flesh, and flesh becomes tomorrow’s soil.",
  },
  {
    title: "Measure of the Soul",
    body: "The Delphic “know thyself” is not self-obsession; it is instrumentation. You cannot steer what you refuse to measure. Modern psychology and ancient confession both insist on honest naming: fear, appetite, grief, pride. Naming reduces chaos into something workable—like writing a circuit so current can flow instead of arcing randomly. Truth-telling is a spiritual practice because falsehood forces the nervous system to hold two maps at once. One map is enough. Make it accurate.",
  },
  {
    title: "The Unbroken Thread",
    body: "Your body is continuous with the deep past: mitochondria are ancient symbiotic bacteria; your bones remember mineral seas; your circadian clock still tracks a spinning Earth. Esoteric lineages speak of bloodlines and stars; biology speaks of ancestry and light cues. Both say you are not a sealed object. You are a temporary knot in a longer rope. Honor that without vanity. The rope continues after the knot loosens. What you braid into it—kindness, craft, courage—is the only immortality you can verify.",
  },
  {
    title: "Water Remembers Motion",
    body: "Water does not store emotional “memories” like a diary, but it does carry structure in motion: vortices, currents, phase changes from ice to vapor. Life is water organized by membranes and information. Baptism myths and purification rites understood the symbol correctly even when they lacked equations: washing resets a state. In the body, lymph and blood are rivers of renewal. Drink, move, sweat, sleep—these are not low magic. They are the high magic that keeps consciousness embodied.",
  },
  {
    title: "The Silent Proportion",
    body: "The golden ratio appears in growth patterns not because numbers are holy, but because efficient packing and spiral growth recur under physical constraints. Beauty often tracks economy: the path that wastes least also pleases the eye. Sacred architecture used proportion to make stone feel alive. Your ear loves harmonic ratios because strings and air columns obey wave physics. Mysticism that denies measure becomes fog. Measure that denies mystery becomes a cage. Proportion is the handshake between them.",
  },
  {
    title: "Night School of Dreams",
    body: "Sleep is not absence; it is maintenance. During deep sleep the brain clears metabolic waste; during REM the mind rehearses emotion and memory. Prophetic dreams are rare; restorative dreams are nightly. Ancients incubated in temples for visions—today we incubate by putting the phone down. If you want oracles, start with circadian honesty: darkness, stillness, enough hours. The most esoteric practice available to everyone is continuous, free, and biologically mandatory. Guard it like a rite.",
  },
  {
    title: "Iron and Breath",
    body: "Hemoglobin seizes oxygen with iron and ferries it through rivers of blood—a planetary metal working inside you. Mars myths and blood oaths sensed iron’s seriousness without spectroscopy. Breathwork traditions were early systems engineering of CO₂ and O₂. Panic is often chemistry misread as doom; a slower exhale is a lever on the nervous system. You do not need fantasy to revere this. You need attention. Each inhale is a contract with plants and phytoplankton. Pay it with presence.",
  },
  {
    title: "The Temple of Attention",
    body: "Where attention goes, neural resources follow—synapses strengthen with use. That is Hebbian learning, not just a slogan. Prayer, meditation, and focus practices are technologies for aiming the mind’s scarce light. Scattered attention is a demolished temple; steady attention is a lamp that rebuilds walls. Algorithms harvest the rubble. Reclaiming focus is a spiritual and political act because it restores authorship. Choose one true thing today and look at it longer than comfort allows.",
  },
  {
    title: "Salt of the Covenant",
    body: "Salt preserves, conducts, and seasons. In the body, sodium and potassium gradients power every nerve impulse—life as controlled electricity in brine. Covenant rituals used salt because it does not easily rot; it stands for permanence. You are a walking estuary: too little salt and signals fail; too much and the system floods. Balance is not a soft word. It is the operating system of cells. Eat, drink, and speak with that precision—preserve what matters; do not pickle the heart.",
  },
  {
    title: "The Unseen Majority",
    body: "Most of the cells associated with “you” are microbial partners in gut and skin. You are a walking ecology. Ancient purity codes often tracked contamination instinctively; modern science names the microbiome. Esoteric talk of “entities within” becomes less spooky and more practical: feed the good colony, starve the chaos, sleep, fiber, fermented food, less needless antibiotic warfare. Sovereignty begins in the gut-brain axis. Rule kindly. Empires of one still need farmers.",
  },
  {
    title: "Stone Teaches Time",
    body: "A mountain is slow fire—tectonic heat and pressure over ages. Crystals grow by ordered repetition; flaws become color and character. Patience is geologic. Human panic is weather. Contemplatives went to caves not only for silence but for a tutor that does not hurry. Your problems are real; most are not mountain-shaped. Ask: is this weather or geology? Act on weather quickly. For geology, become stone enough to outlast the storm without becoming cruel.",
  },
  {
    title: "Word as World-Maker",
    body: "Language is not decoration; it is infrastructure. Shared words let strangers coordinate; private words let a self narrate. Logos traditions were right that speech shapes reality socially and psychologically—even if they overclaimed physics. A vow rewires priorities. A rumor can burn a village. A kind sentence can lower cortisol. Use words like tools with edges. The esoteric discipline is simple and hard: say only what you are willing to help become true.",
  },
  {
    title: "The Middle Pillar",
    body: "Kabbalistic and Hermetic maps place a middle path between extremes—not lukewarm compromise, but conductive balance. Nervous systems need sympathetic drive and parasympathetic rest. Societies need justice and mercy. Minds need skepticism and wonder. Collapse either pole and the current stops. The middle pillar is a practice: when rage rises, add truth; when numbness rises, add courage. Stand where the two snakes of the caduceus cross—alert, not rigid; soft, not weak.",
  },
  {
    title: "Light’s Honest Magic",
    body: "Color is wavelength interpreted by eyes and brain. Gold looks divine because our star’s spectrum and our evolution met in the middle. Stained glass catechized with physics: light enters, matter filters, story appears. You can love beauty without lying about photons. The miracle is that dead minerals and living retinas collaborate to make glory. Walk outside. Let full-spectrum day reset the clock in your skull. That is solar worship with a melatonin mechanism—and it still deserves reverence.",
  },
  {
    title: "The Debt of Fire",
    body: "Every civilization borrows from combustion—wood, coal, oil, the food-fire in mitochondria (yes, you “burn” glucose). Prometheus myths encoded a real bargain: power costs. Entropy always collects. Responsibility is the interest rate. Use energy as if the future is a person you love, because it is. Esoteric orders spoke of guardianship; climate science speaks of carbon budgets. Different dialects, same ethic: do not torch the temple to warm your hands for one night.",
  },
  {
    title: "Mirror of the Other",
    body: "Empathy has circuitry—mirror systems, theory of mind, hormonal bonding. Compassion is not weakness; it is high-bandwidth sensing. Cruelty is often a failure of imagination dressed as strength. Mystery schools demanded purification before vision; modern ethics demands seeing the other as real before power. Practice: in conflict, steel-man the other side for one full minute. If your worldview cannot survive that test, it was never a worldview—only a weapon.",
  },
  {
    title: "Seed and Season",
    body: "A seed is compressed future plus waiting. Agriculture taught initiation better than many temples: plant, trust dark soil, accept delay, harvest with gratitude. Dopamine culture hates seasons; biology insists on them. Projects, grief, and love all have germination periods. Forcing fruit in winter yields bitterness. Learn the season you are in. Act accordingly. That is practical magic: right action at right time, which is also the definition of wisdom in every serious tradition.",
  },
  {
    title: "The Unlying Body",
    body: "The body keeps the score because nervous systems store threat and safety in physiology, not only in stories. Trauma is real; so is plasticity—the capacity to relearn safety with time, relationship, and practice. Esoteric “energy work” sometimes points at breath, posture, and interoception without accurate maps. Keep the maps honest. Stretch, walk, lift, breathe, cry, laugh. Let the body finish sentences the mind interrupted. Truth that never enters the flesh remains a rumor.",
  },
  {
    title: "North Star Ethics",
    body: "Navigation once required stars because local landmarks lie when you leave home. Moral life needs fixed lights too—principles that do not move when mood does. Kindness without courage is flattery; courage without kindness is vandalism. Choose a few non-negotiables: do not humiliate, do not steal attention by deceit, keep promises small enough to keep. Polaris does not care about your excuses; that is why it works. Become slightly more polar each day.",
  },
  {
    title: "Silence as Instrument",
    body: "Silence is not empty. In physics, ground states matter; in music, rests give notes meaning; in friendship, quiet presence heals better than clever noise. Contemplative traditions prescribed silence because the mind’s default mode endlessly self-narrates. Step out. One minute without input is a pilgrimage. If you cannot bear silence, you are not free—you are occupied. Free people can hear a room. Start with sixty honest seconds. Extend as the soul strengthens.",
  },
  {
    title: "The Honest Shadow",
    body: "Jung’s shadow is not a demon to worship; it is disowned capacity and pain. Projection is the psyche’s cheap CGI—casting your unfaced traits onto others. Integration is adult work: admit envy, admit fear, admit the wish to dominate or disappear. Esoteric “shadow work” that only aestheticizes darkness becomes costume. Real work is confession with accountability. Bring the shadow a chair and a job—strength, vigilance, ambition—under conscious rule. Unruled, it runs the kingdom from the basement.",
  },
  {
    title: "Circle and Line",
    body: "Cycles return; vectors advance. Heartbeat is cycle; learning is vector. History rhymes but does not copy-paste. Fatalism loves pure circles; progress-worship loves pure lines. Wisdom uses both: honor seasons (cycle) while refusing to repeat preventable harm (vector). Your daily word returns each dawn, but you are not the same reader. That is initiation without a secret handshake—time plus attention turning a loop into a spiral upward.",
  },
  {
    title: "Threshold Guardians",
    body: "Every real change has a doorway and a fear that guards it. Myths externalize that fear as monsters; psychology names it avoidance. The body feels thresholds as activation—heart rate, tunnel vision, story-spinning. Courage is not the absence of those signals; it is crossing with them onboard. Make thresholds small enough to start and sacred enough to respect. One true email. One apology. One hour of craft. Doors open for walkers, not for wishers.",
  },
  {
    title: "Bread and Roses",
    body: "Matter and meaning both demand feeding. Bread without roses is survival as punishment; roses without bread is perfume over hunger. Spiritual talk that despises the body becomes cruelty; materialism that despises meaning becomes a mall. Cook a real meal. Make or play one beautiful thing. Share both if you can. The Eucharist, the sabbath table, the potluck—civilizations remembered that the sacred often arrives edible. Feed people. Including yourself. That is theology with a plate.",
  },
  {
    title: "The Long Memory of Kindness",
    body: "Kindness is not naivete when paired with boundaries; it is high strategy for a social species. Reciprocity networks outlast lone predators. A single act rarely trends; a pattern becomes culture. Esoteric “vibration” language is often a fuzzy label for emotional contagion—real, measurable, and trainable. Be the person whose presence lowers the room’s entropy. That will not fix everything. It will fix more than cynicism ever has. Begin where your hands already are.",
  },
  {
    title: "Crown of Attention, Root of Earth",
    body: "Mystical “crown” centers map to aspiration; “root” centers map to safety and place. Without root, crown is dissociation. Without crown, root is mere habit. Stand barefoot if you can; look at sky if you can. Name three objects you can see, two you can hear, one you can feel—this is grounding, not gimmick. Then set one high aim for the day. Heaven and earth meet in a nervous system that is both safe and pointed. Be that meeting.",
  },
];

function dayKey(d = new Date()) {
  // Local calendar day so "every day" matches the visitor's morning
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hashDay(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fromBank(key) {
  const idx = hashDay(key) % BANK.length;
  const item = BANK[idx];
  return {
    ok: true,
    date: key,
    title: item.title,
    body: item.body,
    source: "vault",
    index: idx,
  };
}

function apiBase() {
  const b = window.TELEPHANTIM_API || "";
  return String(b).replace(/\/$/, "");
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem("telephantim-daily-word");
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && o.date === key && o.body) return o;
  } catch (_) {}
  return null;
}

function cacheSet(payload) {
  try {
    localStorage.setItem("telephantim-daily-word", JSON.stringify(payload));
  } catch (_) {}
}

function render(payload) {
  const titleEls = document.querySelectorAll("[data-daily-title]");
  const bodyEls = document.querySelectorAll("[data-daily-body]");
  const metaEls = document.querySelectorAll("[data-daily-meta]");
  const dateStr = payload.date || dayKey();
  titleEls.forEach((el) => {
    el.textContent = payload.title || "Daily Word";
  });
  bodyEls.forEach((el) => {
    el.textContent = payload.body || "";
  });
  metaEls.forEach((el) => {
    const src =
      payload.source === "xai"
        ? "Grok"
        : payload.source === "groq"
          ? "cloud mind"
          : payload.source === "ollama"
            ? "local mind"
            : "Telephantim vault";
    el.textContent = `${dateStr} · ${src}`;
  });

  document.querySelectorAll(".daily-word").forEach((box) => {
    box.hidden = false;
    box.classList.add("ready");
  });

  // Once per day-key so re-renders don't inflate counts
  try {
    const stamp = `daily_word_${dateStr}`;
    if (sessionStorage.getItem(stamp) !== "1") {
      sessionStorage.setItem(stamp, "1");
      window.TelephantimAnalytics?.track?.("daily_word_view", {
        event_category: "content",
        content_type: "daily_word",
        content_id: dateStr,
        source: payload.source || "vault",
        title: (payload.title || "").slice(0, 80),
      });
    }
  } catch (_) {}
}

const MIN_KEY_STAGE = "telephantim-daily-word-collapsed";
const MIN_KEY_BIO = "telephantim-daily-word-bio-collapsed";

function setBoxCollapsed(boxId, btnId, storageKey, collapsed) {
  const box = document.getElementById(boxId);
  const btn = document.getElementById(btnId);
  if (!box) return;
  box.classList.toggle("collapsed", !!collapsed);
  if (btn) {
    btn.textContent = collapsed ? "+" : "−";
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.title = collapsed ? "Expand Daily Word" : "Minimize Daily Word";
  }
  try {
    localStorage.setItem(storageKey, collapsed ? "1" : "0");
  } catch (_) {}
}

function wireOneMinimize(boxId, btnId, storageKey, defaultCollapsed) {
  const box = document.getElementById(boxId);
  const btn = document.getElementById(btnId);
  if (!box || !btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";

  let collapsed = !!defaultCollapsed;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "0") collapsed = false;
    if (saved === "1") collapsed = true;
  } catch (_) {}
  setBoxCollapsed(boxId, btnId, storageKey, collapsed);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBoxCollapsed(
      boxId,
      btnId,
      storageKey,
      !box.classList.contains("collapsed")
    );
  });
}

function wireMinimize() {
  // Relics: start minimized (chip only) so "North Star Ethics" etc. don't cover the stage
  wireOneMinimize("daily-word-stage", "daily-word-min", MIN_KEY_STAGE, true);
  // Bio: can minimize too; default open so reading is easy first visit
  wireOneMinimize("daily-word-bio", "daily-word-bio-min", MIN_KEY_BIO, false);
}

function setStageCollapsed(collapsed) {
  setBoxCollapsed("daily-word-stage", "daily-word-min", MIN_KEY_STAGE, collapsed);
}

async function fetchRemote(key) {
  const base = apiBase();
  if (!base || !/^https?:\/\//i.test(base)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${base}/api/daily-wisdom?day=${encodeURIComponent(key)}`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.ok || !data.body) return null;
    return {
      ok: true,
      date: data.date || key,
      title: data.title || "Daily Word",
      body: data.body,
      source: data.source || "api",
    };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function loadDailyWord() {
  const key = dayKey();
  const cached = cacheGet(key);
  if (cached) {
    render(cached);
    // Refresh in background if vault — try API once for upgraded text
    if (cached.source === "vault") {
      fetchRemote(key).then((remote) => {
        if (remote && remote.body) {
          cacheSet(remote);
          render(remote);
        }
      });
    }
    return cached;
  }

  // Show vault immediately so UI never waits blank
  const vault = fromBank(key);
  render(vault);

  const remote = await fetchRemote(key);
  if (remote && remote.body) {
    cacheSet(remote);
    render(remote);
    return remote;
  }

  cacheSet(vault);
  return vault;
}

function wire() {
  wireMinimize();
  loadDailyWord();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wire);
} else {
  wire();
}

window.TelephantimDaily = {
  loadDailyWord,
  fromBank,
  dayKey,
  BANK,
  setStageCollapsed,
};
