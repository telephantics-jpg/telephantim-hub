/**
 * Telephantix DJ Vox — Spotify-style: every track gets a witty comment.
 *
 * - Song always changes instantly on Next (never waits on TTS).
 * - Prefetch + cache bridge drops for upcoming songs so Vox is ready.
 * - Most songs: slightly longer witty bridge naming the track.
 * - Every 3–4 songs: "truth from today's world" then land on the title.
 * - Spam-skip cancels the old rant and starts the new track's intro ASAP.
 */

const DUCK_VOL = 0.2;
const PREFETCH_AHEAD = 3; // next N tracks in queue
const PREFETCH_LEAD_SEC = 22; // also warm near end of current
const MIN_TRACK_FOR_END_PREFETCH = 12;
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

  function cacheKey(t, kind = "bridge") {
    const k = trackKey(t);
    if (!k) return "";
    const kindNorm = (kind || "bridge").toLowerCase() === "truth" ? "truth" : "bridge";
    return `${k}|${kindNorm}`;
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

  function duckMusic() {
    const a = getMusic();
    if (!a) return;
    clearRamp();
    if (savedMusicVol == null) {
      const v = Number(a.volume);
      savedMusicVol = Number.isFinite(v) && v > 0.05 ? v : 0.55;
    }
    try {
      a.volume = Math.min(savedMusicVol, DUCK_VOL);
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
      try {
        stopMic();
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
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
        let settled = false;
        const done = (ok) => {
          if (settled) return;
          settled = true;
          try {
            URL.revokeObjectURL(url);
          } catch (_) {}
          if (micAudio === a) micAudio = null;
          ok ? resolve() : reject(new Error("mic failed"));
        };
        a.addEventListener("ended", () => done(true), { once: true });
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
    if ((kind || "").toLowerCase() === "truth") {
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
    const kindNorm = (kind || "bridge").toLowerCase() === "truth" ? "truth" : kind || "bridge";
    const body = {
      prev_title: prevTrack?.title || "",
      next_title: nextTrack?.title || "the next track",
      artist: nextTrack?.artist || "Telephantix",
      station: "Telephantix Radio",
      voice: "vox",
      use_llm: false,
      mood: kindNorm === "truth" ? "thoughtful" : "happy",
      rate: kindNorm === "truth" ? 10 : 12,
      pitch: -2,
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
          if (!data?.audio_b64) throw new Error("no audio in DJ response");
          return data;
        } finally {
          if (timer) clearTimeout(timer);
        }
      };

      try {
        status(`Vox · calling ${base.replace(/^https?:\/\//, "") || "local"}…`);
        return await attempt(70000);
      } catch (err1) {
        lastErr = err1;
        try {
          status("Waking free DJ cloud…");
          await fetch(`${base}/api/health`, { cache: "no-store", mode: "cors" }).catch(() => {});
          await fetch(`${base}/api/firmament/dj/status`, { cache: "no-store", mode: "cors" }).catch(() => {});
          await new Promise((r) => setTimeout(r, 2500));
          return await attempt(90000);
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
    const kindNorm = (kind || "bridge").toLowerCase() === "truth" ? "truth" : "bridge";
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

    // Prefer kind-matched cache; truth is rarely prefetched
    const ck = cacheKey(next, kind);
    let data = ck && dropCache.has(ck) ? dropCache.get(ck) : null;
    // Bridge may fall back to any bridge cache entry for this track
    if (!data?.audio_b64 && kind === "bridge" && key) {
      const bridgeCk = cacheKey(next, "bridge");
      if (dropCache.has(bridgeCk)) data = dropCache.get(bridgeCk);
    }
    if (!data?.audio_b64) {
      data = await ensureDrop(next, prevTrack, kind);
    }

    if (gen !== announceGen) return; // skipped again
    if (index() !== ni) return; // not this song anymore
    if (!data?.audio_b64 && !data?.browser_speech && !data?.text) {
      status(`♫ ${title}`);
      warmAhead();
      return;
    }

    lastAnnouncedKey = key;
    micBusy = true;
    try {
      duckMusic();
      try {
        const m = getMusic();
        if (m?.paused) await m.play?.();
      } catch (_) {}

      if (gen !== announceGen || index() !== ni) return;

      const label =
        kind === "truth" && data.text
          ? data.text
          : data.text || `Vox · ${title}`;
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
      if (data.audio_b64) {
        try {
          await playMicB64(data.audio_b64);
        } catch (micErr) {
          console.warn("[dj] mic b64 failed, browser voice", micErr);
          await speakBrowser(data.text || label);
        }
      } else {
        await speakBrowser(data.text || label);
      }
    } catch (err) {
      console.warn("[dj] mic", err);
      try {
        await speakBrowser(data?.text || `Vox · ${title}`);
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

  function startWatch() {
    if (tick) return;
    tick = setInterval(() => {
      if (!enabled) return;
      warmAhead();
      const music = getMusic();
      if (!music || micBusy) return;
      const dur = Number(music.duration) || 0;
      const t = Number(music.currentTime) || 0;
      // Near end: make sure next drop is hot
      if (dur > MIN_TRACK_FOR_END_PREFETCH && dur - t < PREFETCH_LEAD_SEC) {
        warmAhead();
      }
      // Only auto-advance when host asked us to (camp). Hub advances itself.
      if (api.advanceOnEnded !== false && dur > 2 && t >= dur - 0.12 && music.paused) {
        onMusicEnded();
      }
    }, 700);
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
      status("DJ Vox · funnier ironic lines · truth every 3–4 songs");
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
