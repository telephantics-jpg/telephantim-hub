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
