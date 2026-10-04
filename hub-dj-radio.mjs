/**
 * Telephantix DJ Vox — intro then the song.
 *
 * - Every track: Vox speaks first (funny line + eternal truth), then the bed starts.
 * - Next never waits on TTS — skip cancels the old rant and intros the new title.
 * - Prefetch upcoming drops so the booth is ready.
 * - No mid-song talk-over and no mix-out (those cut songs / talk on their own).
 */

const BED_VOL = 1;
const DUCK_VOL = 0.55;
const DUCK_TALK = 0.5;
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
    try {
      a.volume = amount != null ? amount : DUCK_VOL;
    } catch (_) {}
  }

  function unduckMusic({ ramp = true } = {}) {
    const a = getMusic();
    savedMusicVol = null;
    clearRamp();
    try {
      api.setBoothFx?.({ lowpass: 18000 });
    } catch (_) {}
    if (!a) return;
    // Snap back — iPhone often ignores setInterval volume ramps and stays ducked
    try {
      a.volume = BED_VOL;
    } catch (_) {}
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

  function wantedOn() {
    if (api.isUserPaused?.()) return false;
    return api.isWantedOn?.() !== false;
  }

  function resumeBed() {
    unduckMusic({ ramp: true });
    if (!wantedOn()) return;
    try {
      const m = getMusic();
      if (m && m.paused && !m.ended) {
        m.play()?.catch?.(() => {});
      }
    } catch (_) {}
  }

  function holdBedSilent() {
    const a = getMusic();
    clearRamp();
    try {
      api.setIntroLock?.(true);
      api.setVoxHold?.(true);
    } catch (_) {}
    if (a) {
      try {
        a.volume = 0;
      } catch (_) {}
    }
  }

  function releaseBedAfterVox() {
    try {
      api.setVoxHold?.(false);
      api.setIntroLock?.(false);
    } catch (_) {}
    if (!wantedOn()) {
      unduckMusic({ ramp: false });
      return;
    }
    try {
      if (typeof api.startBedAfterVox === "function") {
        api.startBedAfterVox();
        return;
      }
    } catch (_) {}
    resumeBed();
  }

  function cancelMic() {
    stopMic();
    try {
      window.speechSynthesis?.cancel();
    } catch (_) {}
    micBusy = false;
    // Caller decides whether the bed comes back (skip vs pause vs intro done).
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

  function pickOne(bag) {
    return bag[Math.floor(Math.random() * bag.length)];
  }

  function localDropText(nextTrack, kind = "bridge") {
    const title = nextTrack?.title || "the next track";
    const artist = nextTrack?.artist || "Telephantix";
    const key = String(title).trim().toLowerCase();
    const kn = normalizeKind(kind);
    if (kn === "interject") {
      const now = nextTrack?.title || "this one";
      return pickOne([
        `Vox still in the booth — stay on ${now}. Chorus isn't a suggestion.`,
        `Talk-over: ${now} is doing the work. Phone face down.`,
        `Booth check. ${now} has a second act. Hear it.`,
      ]);
    }
    if (kn === "mix") {
      const nxt = nextTrack?.title || "the next record";
      return pickOne([
        `Vox blending into ${nxt}. Hands off skip — this is a mix.`,
        `Two records, one pulse. ${nxt} catching the kick. Stay.`,
        `We're not stopping. ${nxt} eats the fade.`,
      ]);
    }

    const jokes = {
      "odyssey revised": [
        `Vox in the booth — ${title}. Same road, new narrator. Stay in the car.`,
        `Incoming: ${title}. Second draft of the journey. Maps are for people who already know who they are.`,
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
      `Vox says ${title} will not fix your life. It will fix the next four minutes, which is more honest than most self-help.`,
      `Spinning ${title}. Skip culture is a democracy of cowards. Courage is thirty seconds long.`,
      `Soft launch of ${title} except it's a real song, not a brand. Stay through the second chorus.`,
      `Right into ${title}. Shorter than a corporate all-hands, twice as honest.`,
      `Booth signed: ${title}. Windows-down energy in a civilization of loading spinners.`,
      `${title} by ${artist}. Tiny rebellion against the infinite scroll. No streak to maintain. Just ears.`,
    ];
    const truths = [
      `Eternal truth: we taught phones to finish our sentences, then got mad when they finished our personality.`,
      `Eternal truth: notifications trained us to treat every ping like an emergency. Most are coupons for anxiety.`,
      `Eternal truth: we archived our childhoods in the cloud and still can't find Tuesday.`,
      `Eternal truth: fifteen seconds is a clip. Three minutes is a relationship. Stay for the longer kind.`,
      `Eternal truth: we stacked so many subscriptions we need an app to cancel the apps. Peace is free.`,
      `Eternal truth: forty-seven tabs open and one feeling you refuse to click. Close the feeling first.`,
      `Eternal truth: phone at three percent, soul at three percent — we charge the wrong one.`,
      `Eternal truth: I'll start Monday is a religion with terrible attendance. Start in this chorus.`,
      `Eternal truth: we optimized dating into a swipe economy, then wondered why chemistry feels like customer support.`,
      `Eternal truth: sleep is free. We treat it like optional DLC, then buy three apps to fix 2 a.m.`,
      `Eternal truth: the news wants your cortisol. Your people want your Tuesday. Pick the voicemail that still loves you.`,
      `Eternal truth: we're fluent in irony and rusty at sincerity. Joke first is fine. Mean it second.`,
      `Eternal truth: your feed thinks you want more of what made you mad yesterday. That's a casino that learned your tells.`,
      `Eternal truth: group chats are full. Living rooms are empty. Bandwidth without presence is loneliness with typing indicators.`,
      `Eternal truth: everyone wants community until community needs a Tuesday night. Showing up with snacks is religion.`,
      `Eternal truth: we live-stream sunsets and miss the wind. The sky doesn't need your caption to be real.`,
      `Eternal truth: inbox zero is a personality now. Your actual life has three unread feelings and no archive folder.`,
      `Eternal truth: kindness without spine is a welcome mat. Spine without kindness is a locked door. Be a porch light.`,
      `Eternal truth: we want eternal youth and next-day delivery. Time still charges interest. Pay in walks and one honest nap.`,
      `Eternal truth: AI can summarize the meeting. It cannot apologize for the meeting. Still hiring: humans.`,
      `Eternal truth: we call it content so we don't have to call it a cry for connection with better lighting.`,
      `Eternal truth: your nervous system is running prehistoric software on a 2026 update. The saber-tooth is usually a calendar invite.`,
      `Eternal truth: advice is infinite. Follow-through is artisan and small-batch. Doing better is the plot twist.`,
      `Eternal truth: we weather-app the sky instead of looking up. The sky is still free and doesn't need your location.`,
      `Eternal truth: someone will circle back. They will not circle back. The song actually returns to the hook.`,
      `Eternal truth: we outsourced memory to devices and intuition to influencers. Your gut is still free software.`,
      `Eternal truth: craft is slow on purpose. Virality is fast on purpose. One builds a life.`,
      `Eternal truth: public opinion updates every hour. Character updates when nobody's filming.`,
      `Eternal truth: we multitask like it's a sport and wonder why nothing feels finished. Single-tasking is the new luxury.`,
      `Eternal truth: self-care sold us a candle. Friendship still sells nothing and somehow keeps the lights on.`,
      `Eternal truth: we fact-check strangers harder than we fact-check our own excuses. Bias has great PR.`,
      `Eternal truth: love is inconvenient. That's how you know it isn't a subscription.`,
    ];
    const extra = jokes[key] || [];
    const jokeBag = extra.length ? bridges.concat(extra, extra) : bridges;
    const joke = pickOne(jokeBag);
    const truth = pickOne(truths);
    if (kn === "truth") {
      return `${truth} Soft landing: ${title}.`;
    }
    return `${joke} ${truth}`;
  }

  let voxVoice = null;
  function pickVoxVoice(voices) {
    if (voxVoice) return voxVoice;
    const list = voices || [];
    const skip = /new zealand|en-NZ|en_NZ|kiwi|en-AU|en_AU|australia|en-IN|india|en-ZA|south africa|irish|en-IE/i;
    const prefer = /GuyNeural|en-US-Guy|Microsoft David|Google US English|David Desktop/i;
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
    if (!wantedOn()) return;
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
    holdBedSilent();
    try {
      try {
        const m = getMusic();
        if (m?.paused && wantedOn()) await m.play?.();
      } catch (_) {}

      const data = await dropOrTalk(next, prevTrack, kind);
      if (gen !== announceGen || index() !== ni) return;
      if (!wantedOn()) return;

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
      if (gen === announceGen) {
        micBusy = false;
        releaseBedAfterVox();
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
    duckMusic(0);
    try {
      if (data?.audio_b64) {
        try {
          await playMicB64(data.audio_b64);
          return;
        } catch (_) {}
      }
      if (text) await speakBrowser(text);
    } finally {
      // Bed stays silent until announceTrack releases it (speak, then play).
    }
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
    if (!enabled || micBusy || !wantedOn()) return;
    const cur = trackAt(index());
    if (!cur) return;
    const gen = ++announceGen;
    micBusy = true;
    try {
      const data = await dropOrTalk(cur, null, "interject");
      if (gen !== announceGen) return;
      status(data?.text || `Vox · riding ${cur.title}`);
      await speakNow(data, localDropText(cur, "interject"));
    } catch (err) {
      console.warn("[dj] interject", err);
    } finally {
      api.setBoothFx?.({ lowpass: 18000 });
      if (wantedOn()) resumeBed();
      else unduckMusic({ ramp: false });
      if (gen === announceGen) micBusy = false;
    }
  }

  async function announceMix() {
    if (!enabled || !wantedOn()) return;
    const ts = tracks();
    if (ts.length < 2) return;
    const i = index();
    const cur = ts[i];
    const nxt = ts[(i + 1) % ts.length];
    if (!cur || !nxt) return;
    const gen = ++announceGen;
    micBusy = true;
    try {
      const data = await dropOrTalk(nxt, cur, "mix");
      if (gen !== announceGen) return;
      status(data?.text || `Vox mixing into ${nxt.title}`);
      await speakNow(data, localDropText(nxt, "mix"));
      if (gen !== announceGen || !wantedOn()) return;
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
      if (wantedOn()) resumeBed();
      else unduckMusic({ ramp: false });
      if (gen === announceGen) micBusy = false;
    }
  }

  function startWatch() {
    if (tick) return;
    tick = setInterval(() => {
      if (!enabled || !wantedOn()) return;
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
      // No mid-song talk-over and no early mix-out — those cut the track
      // and made Vox speak on its own. Intros still fire on track change.
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
      status("DJ Vox · speaks, then the song");
      songsSinceTruth = 0;
      truthInterval = 3 + Math.floor(Math.random() * 2);
      warmAhead();
      // Intro only if we're at the top of a track — never cut a song already rolling
      const music = getMusic();
      const t = Number(music?.currentTime) || 0;
      if (api.isWantedOn?.() && t < 5) {
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
