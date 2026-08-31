/**
 * Telephantix DJ Vox — Spotify-style: every track gets a witty comment.
 *
 * - Song always changes instantly on Next (never waits on TTS).
 * - Prefetch + cache bridge drops for upcoming songs so Vox is ready.
 * - Most songs: slightly longer witty bridge naming the track.
 * - Every 3–4 songs: "truth from today's world" then land on the title.
 * - Spam-skip cancels the old rant and starts the new track's intro ASAP.
 */

const DUCK_VOL = 0.42;
const DUCK_TALK = 0.38;
const PREFETCH_AHEAD = 3; // next N tracks in queue
const PREFETCH_LEAD_SEC = 22; // also warm near end of current
const MIN_TRACK_FOR_END_PREFETCH = 12;
const MIX_LEAD_SEC = 11; // start blend this many seconds before the end
const INTERJECT_MIN_DUR = 36;
const TTS_WAIT_MS = 1600; // talk now — don't wait on the cloud
const RAMP_UP_MS = 600;
const SETTLE_MS = 180; // after skip storm, announce the track you stayed on

/**
 * @param {object} api
 */
export function createDjRadio(api = {}) {
  let enabled = false;
  let micBusy = false;
  let dropCache = new Map(); // cacheKey (track|kind) -> { text, audio_b64, source, dj, at }
  let inflight = new Map(); // cacheKey -> Promise<data>
  let micAudio = null;
  let micNode = null;
  let voxCtx = null;

  function isIOS() {
    try {
      const ua = navigator.userAgent || "";
      return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
    } catch (_) {
      return false;
    }
  }

  function getVoxCtx() {
    try {
      if (window.__teleVoxCtx) voxCtx = window.__teleVoxCtx;
    } catch (_) {}
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!voxCtx) voxCtx = new Ctx();
    try {
      voxCtx.resume?.();
    } catch (_) {}
    return voxCtx;
  }
  try {
    window.addEventListener("tele-audio-unlock", () => getVoxCtx());
  } catch (_) {}
  let savedMusicVol = null;
  let tick = null;
  let lastStatus = "";
  let saidId = false;
  let rampTimer = null;
  let announceGen = 0;
  let settleTimer = null;
  let lastAnnouncedKey = "";
  /** Songs since last world-truth drop; every 3–4 tracks Vox tells a truth. */
  let songsSinceTruth = 0;
  let truthInterval = 3 + Math.floor(Math.random() * 2); // 3 or 4
  let interjectAt = 0;
  let interjectDoneKey = "";
  let mixArmedKey = "";

  function status(msg) {
    lastStatus = msg || "";
    try {
      api.setStatus?.(lastStatus);
    } catch (_) {}
    try {
      api.onUi?.({ enabled, micBusy, status: lastStatus });
    } catch (_) {}
  }

  function tracks() {
    try {
      const t = api.getTracks?.() || [];
      return Array.isArray(t) ? t : [];
    } catch {
      return [];
    }
  }

  function index() {
    try {
      return Math.max(0, Number(api.getIndex?.()) || 0);
    } catch {
      return 0;
    }
  }

  function trackKey(t) {
    if (!t) return "";
    return String(t.id || t.src || t.title || "").trim().toLowerCase();
  }

  function normalizeKind(kind) {
    const k = (kind || "bridge").toLowerCase();
    if (k === "truth" || k === "world") return "truth";
    if (k === "interject" || k === "talkover" || k === "mid") return "interject";
    if (k === "mix" || k === "remix" || k === "blend") return "mix";
    if (k === "id") return "id";
    return "bridge";
  }

  function cacheKey(t, kind = "bridge") {
    const k = trackKey(t);
    if (!k) return "";
    return `${k}|${normalizeKind(kind)}`;
  }

  /** Most drops are witty bridges; every 3–4 songs a world-truth monologue. */
  function pickDropKind() {
    songsSinceTruth += 1;
    if (songsSinceTruth >= truthInterval) {
      songsSinceTruth = 0;
      truthInterval = 3 + Math.floor(Math.random() * 2); // re-roll 3 or 4
      return "truth";
    }
    return "bridge";
  }

  function trackAt(i) {
    const ts = tracks();
    if (!ts.length) return null;
    const n = ts.length;
    return ts[((i % n) + n) % n];
  }

  function getMusic() {
    try {
      return api.getAudio?.() || null;
    } catch {
      return null;
    }
  }

  function clearRamp() {
    if (rampTimer) {
      clearInterval(rampTimer);
      rampTimer = null;
    }
  }

  function duckMusic(amount) {
    const a = getMusic();
    if (!a) return;
    clearRamp();
    if (savedMusicVol == null) {
      const v = Number(a.volume);
      savedMusicVol = Number.isFinite(v) && v > 0.05 ? v : 0.55;
    }
    try {
      a.volume = Math.min(savedMusicVol, amount != null ? amount : DUCK_VOL);
    } catch (_) {}
  }

  function unduckMusic({ ramp = true } = {}) {
    const a = getMusic();
    const target = savedMusicVol != null ? savedMusicVol : 0.55;
    savedMusicVol = null;
    if (!a) return;
    clearRamp();
    if (!ramp) {
      try {
        a.volume = target;
      } catch (_) {}
      return;
    }
    const start = Number(a.volume) || DUCK_VOL;
    const steps = 12;
    let i = 0;
    rampTimer = setInterval(() => {
      i++;
      const t = Math.min(1, i / steps);
      try {
        a.volume = start + (target - start) * t;
      } catch (_) {}
      if (i >= steps) {
        clearRamp();
        try {
          a.volume = target;
        } catch (_) {}
      }
    }, Math.max(28, RAMP_UP_MS / steps));
  }

  function stopMic() {
    if (micNode) {
      try {
        micNode.stop();
      } catch (_) {}
      micNode = null;
    }
    if (!micAudio) return;
    try {
      micAudio.pause();
      micAudio.removeAttribute("src");
      micAudio.load?.();
    } catch (_) {}
    micAudio = null;
  }

  function resumeBed() {
    unduckMusic({ ramp: true });
    try {
      const m = getMusic();
      if (m && m.paused && !m.ended && api.isWantedOn?.()) {
        m.play()?.catch?.(() => {});
      }
    } catch (_) {}
  }

  function cancelMic() {
    stopMic();
    try {
      window.speechSynthesis?.cancel();
    } catch (_) {}
    micBusy = false;
    resumeBed();
  }

  function playMicB64(b64) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        ok ? resolve() : reject(new Error("mic failed"));
      };
      try {
        stopMic();
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const ctx = getVoxCtx();
        // Web Audio BufferSource — iPhone will pause a second <audio> and kill the song
        if (ctx) {
          ctx.decodeAudioData(bytes.buffer.slice(0), (buf) => {
            try {
              const src = ctx.createBufferSource();
              const gain = ctx.createGain();
              gain.gain.value = 1;
              src.buffer = buf;
              src.connect(gain);
              gain.connect(ctx.destination);
              micNode = src;
              src.onended = () => {
                if (micNode === src) micNode = null;
                done(true);
              };
              src.start(0);
              setTimeout(() => done(true), Math.min(16000, (buf.duration + 0.4) * 1000));
            } catch (err) {
              done(false);
            }
          }, () => done(false));
          return;
        }
        if (isIOS()) {
          done(false);
          return;
        }
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const a = new Audio();
        a.preload = "auto";
        try {
          a.setAttribute("playsinline", "");
          a.playsInline = true;
        } catch (_) {}
        a.src = url;
        a.volume = 1;
        micAudio = a;
        a.addEventListener("ended", () => {
          try {
            URL.revokeObjectURL(url);
          } catch (_) {}
          if (micAudio === a) micAudio = null;
          done(true);
        }, { once: true });
        a.addEventListener("error", () => done(false), { once: true });
        setTimeout(() => done(true), 16000);
        a.play().catch(() => done(false));
      } catch (err) {
        reject(err);
      }
    });
  }

  function djApiBases() {
    // Live → free Luna DJ on telephanti.com (PC off). Try apex + www.
    const bases = [];
    try {
      if (typeof api.getApiBase === "function") {
        const b = String(api.getApiBase() || "").replace(/\/$/, "");
        if (b) bases.push(b);
      }
    } catch (_) {}
    try {
      const h = (location.hostname || "").toLowerCase();
      const port = String(location.port || "");
      if (h === "localhost" || h === "127.0.0.1") {
        if (port === "8767") bases.push("");
        else bases.push("http://127.0.0.1:8767");
      }
    } catch (_) {}
    bases.push("https://telephanti.com", "https://www.telephanti.com");
    return [...new Set(bases.filter((b) => b != null))];
  }

  function localDropText(nextTrack, kind = "bridge") {
    const title = nextTrack?.title || "the next track";
    const artist = nextTrack?.artist || "Telephantix";
    const key = String(title).trim().toLowerCase();
    const kn = normalizeKind(kind);
    if (kn === "interject") {
      const now = nextTrack?.title || "this one";
      const bag = [
        `Vox still in the booth — stay on ${now}. Chorus isn't a suggestion.`,
        `Talk-over: ${now} is doing the work. Phone face down.`,
        `Don't skip ${now}. I'll mix you out when it's time.`,
        `Booth check. ${now} has a second act. Hear it.`,
        `Riding the fader on ${now}. Background is for grocery stores.`,
      ];
      return bag[Math.floor(Math.random() * bag.length)];
    }
    if (kn === "mix") {
      const nxt = nextTrack?.title || "the next record";
      const bag = [
        `Vox blending into ${nxt}. Hands off skip — this is a mix.`,
        `Riding the tail… slamming ${nxt} on top. That's the remix.`,
        `Two records, one pulse. ${nxt} catching the kick. Stay.`,
        `Live mix — ${nxt} coming through the filter. Don't blink.`,
        `We're not stopping. ${nxt} eats the fade. Collision incoming.`,
      ];
      return bag[Math.floor(Math.random() * bag.length)];
    }
    if (kn === "truth") {
      const truths = [
        `Hot take from the booth: we archived our childhoods in the cloud and still can't find Tuesday. Meanwhile — ${title}.`,
        `Truth time: notifications trained us to treat every ping like an emergency. Most are coupons for anxiety. Here's ${title}.`,
        `We optimized dating into a swipe economy then wondered why chemistry feels like customer support. Soft landing: ${title}.`,
        `Fifteen seconds is a clip. Three minutes is a relationship. ${title} is the longer kind. Stay.`,
        `We stacked so many subscriptions we need an app to cancel the apps. Peace is free. ${title} is the receipt.`,
        `Forty-seven tabs open and one feeling you refuse to click. Close the feeling first. Cue ${title}.`,
        `Phone at three percent, soul at three percent — we charge the wrong one. ${title} is the other plug.`,
        `Focus playlist in one ear, doomscroll in the other. Hostage situation. ${title} is the release form.`,
        `I'll start Monday is a religion with terrible attendance. Start in this chorus. Here's ${title}.`,
      ];
      return truths[Math.floor(Math.random() * truths.length)];
    }
    const specials = {
      "odyssey revised": [
        `Vox in the booth — ${title}. Second draft of the journey. Maps are for people who already know who they are. Hit play.`,
        `Incoming: ${title} by ${artist}. Same road, new narrator. Stay in the car.`,
      ],
      "chord that pleased the lord": [
        `One chord, full sermon. ${title} — church in a kick drum. Amen optional. Listening isn't.`,
        `Soft landing into ${title}. Sacred without the brochure. Bass does the pastoral care.`,
      ],
      "decree by fear": [
        `Fear wrote the first draft of the law. ${title} is the appeal. Stay for the verdict.`,
        `Vox on the boards: ${title}. The bass objects. That's the whole brief.`,
      ],
      "shit dont fix": [
        `Title does the honesty: ${title}. Neither does pretending. Four minutes of telling it straight.`,
        `Vox calling it what it is — ${title}. Some problems don't get a patch note. Bass anyway.`,
      ],
    };
    const bridges = [
      `This is ${title} — ${artist} night shift. If corporate radio is a spreadsheet, this is the scribble in the margin.`,
      `Coming up: ${title}. Ego off, volume up. Vox on the boards.`,
      `Plot twist: ${title} might fix the scroll better than another refresh. Spoiler: the bass will try.`,
      `${title}. Telephantix Radio. Stay weird, stay kind — don't @ the algorithm.`,
      `New on the overnight: ${title}. Whole song. No snippet bait. Stay through the second chorus.`,
      `Board note — ${title}. Put the phone face down. If it loved you it would sing. It doesn't. This does.`,
      `Here's ${title} by ${artist}. Three minutes of not being a product. Weird luxury. No checkout.`,
      `Cue ${title}. Your for-you page thinks it knows you. This track is willing to be surprised.`,
      `Vox with ${title} — volume as a boundary. The group chat can sit in the hallway until the fade.`,
      `Dropping ${title}. If you were waiting for a sign, this is a kick drum. More honest than a billboard.`,
      `${title} by ${artist}. Let the lyric clock you. If it stings, that's free diagnostics with a melody.`,
      `Playing ${title}. Not a mood board. A mood. Difference is one of them has drums.`,
    ];
    const extra = specials[key] || [];
    const bag = extra.length ? bridges.concat(extra, extra) : bridges;
    return bag[Math.floor(Math.random() * bag.length)];
  }

  let voxVoice = null;
  function pickVoxVoice(voices) {
    if (voxVoice) return voxVoice;
    const list = voices || [];
    const skip = /new zealand|en-NZ|en_NZ|kiwi|en-AU|en_AU|australia|en-IN|india|en-ZA|south africa|irish|en-IE/i;
    const prefer = /AndrewMultilingual|Andrew Neural|en-US-Andrew|GuyNeural|Microsoft David|Google US English|David Desktop/i;
    voxVoice =
      list.find((v) => prefer.test(v.name) && !skip.test(`${v.name} ${v.lang}`)) ||
      list.find((v) => /en(-|_)US/i.test(v.lang) && /guy|david/i.test(v.name)) ||
      list.find((v) => /en(-|_)US/i.test(v.lang) && !skip.test(`${v.name} ${v.lang}`)) ||
      null;
    return voxVoice;
  }

  function speakBrowser(text) {
    return new Promise((resolve) => {
      if (isIOS()) {
        resolve(false);
        return;
      }
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        resolve(!!ok);
      };
      try {
        const synth = window.speechSynthesis;
        if (!synth || !text) {
          done(false);
          return;
        }
        const speakOnce = (voices) => {
          if (settled) return;
          try {
            synth.cancel();
          } catch (_) {}
          const u = new SpeechSynthesisUtterance(String(text).slice(0, 420));
          u.lang = "en-US";
          u.rate = 1.02;
          u.pitch = 0.92;
          u.volume = 1;
          const male = pickVoxVoice(voices || synth.getVoices?.() || []);
          if (male) u.voice = male;
          u.onend = () => done(true);
          u.onerror = () => done(true);
          synth.speak(u);
        };
        const have = synth.getVoices?.() || [];
        if (have.length) speakOnce(have);
        else {
          let armed = false;
          const go = () => {
            if (armed || settled) return;
            armed = true;
            speakOnce(synth.getVoices() || []);
          };
          synth.addEventListener("voiceschanged", go, { once: true });
          setTimeout(go, 400);
        }
        setTimeout(() => done(true), 14000);
      } catch (_) {
        done(false);
      }
    });
  }

  async function fetchDrop(prevTrack, nextTrack, kind = "bridge") {
    const kindNorm = normalizeKind(kind);
    const body = {
      prev_title: prevTrack?.title || "",
      next_title: nextTrack?.title || "the next track",
      artist: nextTrack?.artist || "Telephantix",
      station: "Telephantix Radio",
      voice: "vox",
      use_llm: false,
      mood: "booth",
      rate: kindNorm === "truth" ? -2 : 0,
      pitch: -1,
      kind: kindNorm,
    };
    const bases = djApiBases();
    let lastErr = null;

    for (const base of bases) {
      const url = `${base}/api/firmament/dj/drop`;
      const attempt = async (ms) => {
        const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
            mode: "cors",
            signal: ctrl?.signal,
          });
          if (!res.ok) {
            const t = await res.text().catch(() => "");
            throw new Error(`HTTP ${res.status} ${t.slice(0, 60)}`);
          }
          const data = await res.json();
          if (!data?.audio_b64 && !data?.text) throw new Error("empty DJ response");
          if (!data.audio_b64) data.browser_speech = true;
          return data;
        } finally {
          if (timer) clearTimeout(timer);
        }
      };

      try {
        status(`Vox · ${base.replace(/^https?:\/\//, "") || "local"}…`);
        return await attempt(8000);
      } catch (err1) {
        lastErr = err1;
        try {
          await fetch(`${base}/api/health`, { cache: "no-store", mode: "cors" }).catch(() => {});
          return await attempt(5000);
        } catch (err2) {
          lastErr = err2 || err1;
        }
      }
    }

    // Free fallback — browser speech so Vox still talks (PC off, no paid API)
    const text = localDropText(nextTrack, kindNorm);
    console.warn("[dj] cloud drop failed, browser voice", lastErr?.message || lastErr);
    return {
      ok: true,
      text,
      source: "browser-speech",
      audio_b64: "",
      browser_speech: true,
      next_title: nextTrack?.title || "",
    };
  }

  /**
   * Ensure we have (or are fetching) a drop for this track + kind.
   * Spotify-style: warm bridge cache so intros land with the song.
   * Truth drops are fetched on demand (not prefetched as bridge).
   */
  function ensureDrop(track, prevTrack, kind = "bridge") {
    const kindNorm = normalizeKind(kind);
    const key = cacheKey(track, kindNorm);
    if (!key) return Promise.resolve(null);
    if (dropCache.has(key)) {
      return Promise.resolve(dropCache.get(key));
    }
    if (inflight.has(key)) return inflight.get(key);

    const p = fetchDrop(prevTrack, track, kindNorm)
      .then((data) => {
        if (data?.audio_b64 || data?.browser_speech) {
          dropCache.set(key, { ...data, at: Date.now(), kind: kindNorm });
          if (dropCache.size > 48) {
            const oldest = [...dropCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
            if (oldest) dropCache.delete(oldest[0]);
          }
        }
        inflight.delete(key);
        return data;
      })
      .catch((err) => {
        console.warn("[dj] fetch", err?.message || err);
        const text = localDropText(track, kindNorm);
        const data = { ok: true, text, source: "browser-speech", audio_b64: "", browser_speech: true };
        dropCache.set(key, { ...data, at: Date.now(), kind: kindNorm });
        try {
          status("Vox · browser voice (cloud sleepy)");
        } catch (_) {}
        inflight.delete(key);
        return data;
      });
    inflight.set(key, p);
    return p;
  }

  /** Prefetch next few tracks as witty bridges (not truth — cadence is live). */
  function warmAhead() {
    if (!enabled) return;
    const ts = tracks();
    if (ts.length < 2) return;
    const i = index();
    const prev = ts[i];
    for (let k = 1; k <= PREFETCH_AHEAD; k++) {
      const t = ts[(i + k) % ts.length];
      const key = cacheKey(t, "bridge");
      if (!key || dropCache.has(key) || inflight.has(key)) continue;
      ensureDrop(t, k === 1 ? prev : ts[(i + k - 1) % ts.length], "bridge");
    }
  }

  /**
   * Speak about track at forIndex if still current when audio is ready.
   * Uses cache first for near-instant Spotify-like intros.
   */
  async function announceTrack(forIndex, prevTrack, opts = {}) {
    if (!enabled) return;
    const gen = ++announceGen;
    const ts = tracks();
    if (!ts.length) return;
    const n = ts.length;
    const ni = ((forIndex % n) + n) % n;
    const next = ts[ni];
    const key = trackKey(next);
    const title = next?.title || "this track";
    const kind =
      opts.kind ||
      (opts.forceKind ? opts.forceKind : pickDropKind());

    // New song's turn — kill previous rant mid-sentence
    cancelMic();

    if (key && key === lastAnnouncedKey && !opts.force) {
      // Already said something for this exact play? Allow force re-announce
      warmAhead();
      return;
    }

    status(kind === "truth" ? `Vox · truth · ${title}…` : `Vox · ${title}…`);

    lastAnnouncedKey = key;
    micBusy = true;
    try {
      duckMusic(DUCK_TALK);
      try {
        const m = getMusic();
        if (m?.paused) await m.play?.();
      } catch (_) {}

      const data = await dropOrTalk(next, prevTrack, kind);
      if (gen !== announceGen || index() !== ni) return;

      const label = data.text || `Vox · ${title}`;
      api.onUi?.({
        enabled: true,
        micBusy: true,
        status: label,
        dropText: data.text,
        source: data.source,
        kind,
        dj: data.dj,
      });
      status(label);
      await speakNow(data, `Vox on the boards — ${title}.`);
    } catch (err) {
      console.warn("[dj] mic", err);
      try {
        await speakBrowser(`Vox · ${title}`);
      } catch (_) {}
    } finally {
      resumeBed();
      if (gen === announceGen) {
        micBusy = false;
        status(`♫ ${title}`);
        try {
          api.onUi?.({ enabled, micBusy: false, status: lastStatus });
        } catch (_) {}
        warmAhead();
      }
    }
  }

  /**
   * After a skip/play: schedule comment for the track we landed on.
   * Debounced slightly so triple-Next only intros the final song — but that song ALWAYS gets a comment.
   * If drop is already cached, fire almost immediately.
   */
  function scheduleAnnounceForCurrent(prevTrack) {
    if (!enabled) return;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    const ni = index();
    const next = trackAt(ni);
    const key = trackKey(next);
    const cached = key && dropCache.has(key);
    const delay = cached ? 40 : SETTLE_MS;

    // Kick bridge fetch immediately (truth cadence decided at announce)
    if (next) ensureDrop(next, prevTrack, "bridge");
    warmAhead();

    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (!enabled) return;
      if (index() !== ni) return;
      void announceTrack(ni, prevTrack, { force: true });
    }, delay);
  }

  function onMusicEnded() {
    if (!enabled) return;
    const ts = tracks();
    if (!ts.length) return;
    const from = index();
    const prev = ts[from];
    const ni = (from + 1) % ts.length;
    // Song first
    try {
      api.playAt?.(ni, { forceReload: true, hard: true, seekTime: 0, quiet: true });
    } catch (_) {
      try {
        api.playAt?.(ni);
      } catch (_) {}
    }
    lastAnnouncedKey = ""; // new play of next track needs its comment
    scheduleAnnounceForCurrent(prev);
  }

  function armInterjectTime(dur) {
    if (!(dur > INTERJECT_MIN_DUR)) {
      interjectAt = 0;
      return;
    }
    // Talk over ~20–35s in so the booth feels live, not a 2-minute wait
    const lo = 18;
    const hi = Math.min(dur - MIX_LEAD_SEC - 10, 36);
    interjectAt = hi > lo ? lo + Math.random() * (hi - lo) : lo;
  }

  async function speakNow(data, fallbackText) {
    const text = (data && data.text) || fallbackText || "";
    if (data?.audio_b64) {
      try {
        await playMicB64(data.audio_b64);
        return;
      } catch (_) {}
    }
    if (text) await speakBrowser(text);
  }

  async function dropOrTalk(track, prev, kind) {
    const instant = localDropText(track, kind);
    const pending = ensureDrop(track, prev, kind);
    let data = null;
    try {
      data = await Promise.race([
        pending,
        new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), TTS_WAIT_MS)),
      ]);
    } catch (_) {
      data = null;
    }
    if (data?.timeout) data = { text: instant, browser_speech: true };
    if (!data?.audio_b64 && !data?.text) data = { text: instant, browser_speech: true };
    return data;
  }

  async function announceInterject() {
    if (!enabled || micBusy) return;
    const cur = trackAt(index());
    if (!cur) return;
    const gen = ++announceGen;
    micBusy = true;
    try {
      duckMusic(DUCK_TALK);
      api.setBoothFx?.({ lowpass: 1400 });
      const data = await dropOrTalk(cur, null, "interject");
      if (gen !== announceGen) return;
      status(data?.text || `Vox · riding ${cur.title}`);
      await speakNow(data, localDropText(cur, "interject"));
    } catch (err) {
      console.warn("[dj] interject", err);
    } finally {
      api.setBoothFx?.({ lowpass: 18000 });
      resumeBed();
      if (gen === announceGen) micBusy = false;
    }
  }

  async function announceMix() {
    if (!enabled) return;
    const ts = tracks();
    if (ts.length < 2) return;
    const i = index();
    const cur = ts[i];
    const nxt = ts[(i + 1) % ts.length];
    if (!cur || !nxt) return;
    const gen = ++announceGen;
    micBusy = true;
    try {
      duckMusic(DUCK_TALK);
      api.setBoothFx?.({ lowpass: 700 });
      const data = await dropOrTalk(nxt, cur, "mix");
      if (gen !== announceGen) return;
      status(data?.text || `Vox mixing into ${nxt.title}`);
      await speakNow(data, localDropText(nxt, "mix"));
      if (gen !== announceGen) return;
      const mixed = api.mixToNext?.();
      lastAnnouncedKey = trackKey(nxt);
      if (mixed === false) {
        try {
          api.playAt?.((i + 1) % ts.length);
        } catch (_) {}
      }
    } catch (err) {
      console.warn("[dj] mix", err);
    } finally {
      api.setBoothFx?.({ lowpass: 18000 });
      resumeBed();
      if (gen === announceGen) micBusy = false;
    }
  }

  function startWatch() {
    if (tick) return;
    tick = setInterval(() => {
      if (!enabled) return;
      warmAhead();
      const music = getMusic();
      if (!music || music.paused) return;
      const dur = Number(music.duration) || 0;
      const t = Number(music.currentTime) || 0;
      const key = trackKey(trackAt(index()));
      if (interjectAt === 0 && dur > INTERJECT_MIN_DUR) {
        armInterjectTime(dur);
      }
      if (dur > MIN_TRACK_FOR_END_PREFETCH && dur - t < PREFETCH_LEAD_SEC) {
        warmAhead();
      }
      // Live talk-over once per song
      if (
        !micBusy &&
        interjectAt > 0 &&
        t >= interjectAt &&
        dur - t > MIX_LEAD_SEC + 6 &&
        key &&
        key !== interjectDoneKey
      ) {
        interjectDoneKey = key;
        void announceInterject();
        return;
      }
      // Mix-out: talk + blend into the next record
      if (
        !micBusy &&
        dur > 40 &&
        dur - t <= MIX_LEAD_SEC &&
        dur - t > 0.4 &&
        key &&
        key !== mixArmedKey
      ) {
        mixArmedKey = key;
        void announceMix();
        return;
      }
      if (api.advanceOnEnded !== false && dur > 2 && t >= dur - 0.12 && music.paused) {
        onMusicEnded();
      }
    }, 450);
  }

  function stopWatch() {
    if (tick) {
      clearInterval(tick);
      tick = null;
    }
  }

  let boundAudio = null;
  function bindEnded(a) {
    // Hub owns ended → next; DJ only announces via onTrackChanged
    if (api.advanceOnEnded === false) return;
    if (boundAudio === a) return;
    if (boundAudio) {
      try {
        boundAudio.removeEventListener("ended", onMusicEnded);
      } catch (_) {}
    }
    boundAudio = a || null;
    if (boundAudio) boundAudio.addEventListener("ended", onMusicEnded);
  }

  function setEnabled(on) {
    enabled = !!on;
    if (enabled) {
      startWatch();
      bindEnded(getMusic());
      status("DJ Vox · live booth · talk-overs + mixes");
      songsSinceTruth = 0;
      truthInterval = 3 + Math.floor(Math.random() * 2);
      warmAhead();
      // Comment on whatever is already playing
      if (api.isWantedOn?.()) {
        lastAnnouncedKey = "";
        scheduleAnnounceForCurrent(null);
        if (!saidId) {
          saidId = true;
        }
      }
    } else {
      announceGen++;
      if (settleTimer) clearTimeout(settleTimer);
      stopWatch();
      cancelMic();
      clearRamp();
      unduckMusic({ ramp: false });
      micBusy = false;
      status("");
    }
    try {
      api.onUi?.({ enabled, micBusy, status: lastStatus });
    } catch (_) {}
  }

  const rebind = setInterval(() => {
    if (!enabled) return;
    const a = getMusic();
    if (a && a !== boundAudio) bindEnded(a);
  }, 2000);

  return {
    setEnabled,
    isEnabled: () => enabled,
    isBusy: () => micBusy,
    getStatus: () => lastStatus,

    /** Immediate song change already done by host — queue this track's comment */
    onTrackChanged(prevTrack) {
      if (!enabled) return;
      lastAnnouncedKey = "";
      mixArmedKey = "";
      interjectDoneKey = "";
      const music = getMusic();
      armInterjectTime(Number(music?.duration) || Number(prevTrack?.duration_sec) || 180);
      scheduleAnnounceForCurrent(prevTrack || null);
    },

    /** Legacy: change song then comment (song first, always) */
    introThenPlay(targetIndex) {
      const ts = tracks();
      const n = Math.max(1, ts.length);
      const ni = ((Number(targetIndex) % n) + n) % n;
      const prev = ts[index()];
      try {
        api.playAt?.(ni, { forceReload: true, hard: true, seekTime: 0, quiet: true });
      } catch (_) {
        try {
          api.playAt?.(ni);
        } catch (_) {}
      }
      lastAnnouncedKey = "";
      if (enabled) scheduleAnnounceForCurrent(prev);
    },

    hush() {
      announceGen++;
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      cancelMic();
    },

    /** Pre-warm whole visible queue (e.g. after shuffle) */
    rewarm() {
      dropCache.clear();
      inflight.clear();
      lastAnnouncedKey = "";
      warmAhead();
    },

    dispose() {
      setEnabled(false);
      clearInterval(rebind);
      clearRamp();
      dropCache.clear();
      if (boundAudio) {
        try {
          boundAudio.removeEventListener("ended", onMusicEnded);
        } catch (_) {}
      }
    },
  };
}

export async function probeDjStatus() {
  try {
    const r = await fetch("/api/firmament/dj/status", { cache: "no-store" });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}
