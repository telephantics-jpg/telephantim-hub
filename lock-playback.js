/**
 * Lock-screen playback decisions for the hub radio and Bio movies.
 * Browsers often emit "pause" while the page still looks visible, then mark
 * the page hidden. A pause is a user pause only if the page stays visible.
 * No silent oscillators and no extra permission prompt.
 */

export const PAUSE_GRACE_MS = 480;

export function createPauseGate({
  hidden,
  onUser,
  onOs,
  graceMs = PAUSE_GRACE_MS,
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancelScheduled = (id) => clearTimeout(id),
} = {}) {
  let timer = null;
  const clear = () => {
    if (timer == null) return;
    cancelScheduled(timer);
    timer = null;
  };
  return {
    notePause({ userMarked = false } = {}) {
      if (userMarked) {
        clear();
        onUser();
        return "user";
      }
      if (hidden()) {
        clear();
        onOs();
        return "os";
      }
      clear();
      timer = schedule(() => {
        timer = null;
        if (hidden()) onOs();
        else onUser();
      }, graceMs);
      return "pending";
    },
    notePageLeft() {
      if (timer == null) return false;
      clear();
      onOs();
      return true;
    },
    pending() {
      return timer != null;
    },
    cancel() {
      clear();
    },
  };
}

let owner = null;

export function claimPlayback(kind) {
  owner = { kind, at: Date.now() };
  return owner.kind;
}

export function releasePlayback(kind) {
  if (owner?.kind === kind) owner = null;
  return playbackOwner();
}

export function playbackOwner() {
  return owner?.kind || null;
}

export function resetPlaybackOwner() {
  owner = null;
}

/** iOS/WebKit only. Other browsers ignore this. Does not grant a new permission. */
export function syncPlaybackSession(active, nav = globalThis.navigator) {
  const session = nav && nav.audioSession;
  if (!session || !("type" in session)) return "unsupported";
  try {
    session.type = active ? "playback" : "auto";
    return session.type;
  } catch (_) {
    return "error";
  }
}

export function shouldWakeMutedBackdrop({ pageHidden, movieUserPause }) {
  return !!(movieUserPause && !pageHidden);
}

export function shouldHandoffMovie({
  pageHidden,
  paused,
  ended,
  muted,
  userPause,
  started,
}) {
  return !!(pageHidden && paused && !ended && !muted && !userPause && started);
}

export function mutedLoopsToHold(videos) {
  return (videos || []).filter(
    (v) => v && !v.paused && !v.ended && (v.muted === true || Number(v.volume) === 0)
  );
}

export function movieResumeTime(audioTime, videoTime) {
  const t = Number(audioTime);
  if (Number.isFinite(t) && t >= 0) return t;
  const v = Number(videoTime);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

export function pageIsHidden(doc = globalThis.document) {
  try {
    return !!(doc && (doc.hidden || doc.visibilityState === "hidden"));
  } catch (_) {
    return false;
  }
}

/** DJ voice/intro cannot start reliably in a locked or hidden tab. */
export function shouldSkipDjIntro({ pageHidden = false, fromMediaKey = false } = {}) {
  return !!(pageHidden || fromMediaKey);
}

/**
 * Chrome Android uses the same notification slots for seek and track skip.
 * When seek handlers are set, the card often shows ±10s instead of prev/next.
 */
export function mediaSeekModeFor(ownerKind) {
  return ownerKind === "movie" ? "seek" : "track";
}

/** Native/hosted radio can keep playing while hidden; iframes cannot. */
export function canPlayTrackWhileHidden(track) {
  if (!track) return false;
  const type = String(track.type || "");
  if (type === "spotify" || type === "youtube") return false;
  if (track.radio === "distrokid") return true;
  const url = String(track.url || "");
  if (/\/releases\/download\/radio-|\/radio-mp3\//i.test(url) && /\.mp3(\?|$)/i.test(url)) {
    return true;
  }
  if (type === "audio" && url && !/suno\.com\/embed/i.test(url)) return true;
  if (track.songId) return true;
  const id = String(track.id || "");
  return !!(id && /^suno-/.test(id));
}

/** Walk to a track that can play natively while the page is hidden. */
export function indexForHiddenSkip(tracks, startIndex, direction) {
  const list = Array.isArray(tracks) ? tracks : [];
  const n = list.length;
  if (!n) return 0;
  const dir = direction < 0 ? -1 : 1;
  let i = ((Number(startIndex) || 0) % n + n) % n;
  for (let step = 0; step < n; step++) {
    if (canPlayTrackWhileHidden(list[i])) return i;
    i = (i + dir + n) % n;
  }
  return ((Number(startIndex) || 0) % n + n) % n;
}
