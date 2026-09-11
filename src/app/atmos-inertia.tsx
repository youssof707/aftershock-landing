"use client";

import { useEffect } from "react";

/* ---------------------------------------------------------------------------
 * Thumb inertia for the atmosphere rig.
 *
 * The rig in globals.css is 45 infinite CSS animations (1 camera + 2 fields +
 * 14 orbs + 28 orb cores) and this file is the only JS on the page. It renders
 * nothing: it snapshots those animations on first gesture and scales their
 * `playbackRate` with the speed of a touch drag or wheel flick, then lets the
 * boost coast back down to 1 and stops.
 *
 * Why playbackRate and not animation-duration: every layer in the rig carries
 * a negative animation-delay, which is the whole decorrelation mechanism (see
 * the comment on ORBS in page.tsx). Remapping duration would rescale those
 * delays and make current-time jump visibly. The playbackRate setter, per
 * spec, preserves currentTime by re-deriving startTime -- so a rate change is
 * position-continuous (C0) and only the velocity steps. That is the one lever
 * that is safe here.
 *
 * Why three groups instead of one lever: they have different safety ceilings.
 *
 *   - `breathe` is the ONLY animation that oscillates opacity (0.367 -> 1 ->
 *     0.367 per cycle) -- that is a real photosensitivity concern (WCAG 2.3.1's
 *     3Hz general-flash threshold) and its ceiling is calculated, not chosen.
 *   - `camera-orbit` swings the entire 3D scene (a rotateY + dolly) in one
 *     loop -- a pure-motion vestibular concern (queasiness), not a flash
 *     concern, so it gets its own, more generous cap.
 *   - Everything else (field-spin, drift-1/2/3, orb-spin) is pure transform
 *     motion with no periodic luminance change at all -- no flash concern, no
 *     whole-scene vestibular concern (each orb is a small, independent,
 *     phase-decorrelated element) -- so this is the group allowed to go
 *     genuinely violent. This is what should visibly explode on a hard flick.
 *
 * Why individual writes and not one lever: there is no group lever. WAAPI has
 * no group playback rate for CSS animations, DocumentTimeline has no settable
 * playbackRate, and there is no `animation-play-rate` property. A single
 * ScrollTimeline would be one lever but is architecturally incompatible -- it
 * is progress-based, so all animations would phase-lock to one input and lose
 * their independent periods and negative delays, which is the entire design.
 * So: three groups of individual writes, each geometrically deduped (see
 * WRITE_EPS) so a full decay costs tens of write batches, not hundreds.
 * ------------------------------------------------------------------------- */

/* The ONLY calculated safety ceiling in this file -- everything else below is
   feel, not safety. Applies exclusively to `breathe`, the one animation that
   oscillates opacity. Fastest breathe period is 7s (page.tsx); the WCAG 2.3.1
   general-flash threshold is 3Hz, i.e. a 1/3s period. 7s / BREATHE_MAX must
   stay above that. At 10x: 0.7s period = 1.43Hz, a >2x margin, kept because
   fourteen orbs breathe on fourteen different periods and the *aggregate*
   flicker has content above any single orb's rate. Do not raise past ~14
   (0.5s = 2Hz) without re-deriving this. */
const BREATHE_MAX = 10;

/* Feel, not safety: the camera moves the whole scene, so it stays well behind
   the orbs to avoid a disorienting whole-frame lurch, but a "violent throw"
   should still be felt in the parallax, not just the lights. */
const CAMERA_MAX = 4;

/* Feel, not safety: no flicker in this group (no opacity animation) and no
   whole-scene vestibular concern (each orb moves independently), so this is
   where "my thumb just threw this, violently" actually lives. At MOTION_MAX
   the fastest drift/spin cycles (7-13s, see ORBS in page.tsx) complete in
   well under a second -- genuinely explosive, not a subtle nudge. */
const MOTION_MAX = 16;

/* Boost per screen-height/second of thumb speed, normalised by innerHeight so
   a flick feels the same on a 667px phone and a 1180px tablet. Deliberately
   high enough that a normal flick (~300px in ~150ms, ~2000px/s on an 844px
   phone, v_norm ~2.37) saturates MOTION_MAX almost immediately -- the ask was
   "violent," not "proportional." Softer, slower drags still land well below
   the ceiling because the clamp against MOTION_MAX-1 only clips the top. */
const GAIN = 10;

/* Wheel/trackpad deliver discrete deltas, not a position stream, so velocity
   is the wrong primitive there -- each event is a direct impulse instead. */
const WHEEL_GAIN = 20;

/* Fast rise (instant, via addBoost), fast-but-felt decay: from a maxed-out
   flick (boost 15) this clears CAMERA_MAX/BREATHE_MAX within a few hundred ms
   of the peak and fully settles (rate snaps to exactly 1, loop stops) around
   ~1.3s. FRICTION is a small linear term on top of the exponential so the
   tail actually reaches zero instead of asymptoting forever -- that is what
   lets the rAF loop stop at a predictable time instead of idling at an
   imperceptible boost. */
const TAU = 0.27; // s, exponential time constant
const FRICTION = 0.35; // s^-1, linear decay term
const REST = 0.02; // boost below this counts as at rest

/* Writing playbackRate marks an animation compositor-pending, so each write
   costs a small teardown/rebuild of that animation's compositor-side
   representation. Quantising geometrically cuts a full decay from hundreds of
   write batches to a few dozen. Steps this small are invisible precisely
   because the setter preserves currentTime: a rate step changes the drift's
   velocity, never its position, on gradients carrying 11-96px of blur.
   Measured live: this costs ~0 layout and a handful of ms of style recalc
   spread across the whole decay, with zero measurable fps impact. */
const WRITE_EPS = 0.06;
const LOG_EPS = Math.log(1 + WRITE_EPS);

const MAX_DT = 0.05; // s -- survive a long frame or a throttled tab

/* Velocity is a windowed average, not an instantaneous dy/dt: consecutive
   touchmove samples can be under a millisecond apart (coalesced events), so a
   per-event velocity either divides by ~zero or reports a spike. Measure the
   newest sample against the oldest one still inside a trailing window, then
   widen the span back out until it is long enough to trust. This is the same
   shape as Android's VelocityTracker and is immune to coalescing by
   construction, whether the browser delivers one move per frame or twelve. */
const VEL_WINDOW = 100; // ms
const MIN_VEL_DT = 8; // ms
const SAMPLES = 6;

/* 45 = 1 camera + 2 fields + 14 orbs + 28 orb cores. Treat a materially
   smaller snapshot as a bad read (e.g. taken before everything mounted) and
   retry on the next gesture rather than silently driving a partial rig. */
const EXPECTED = 40;
const MAX_TRIES = 3;

type NamedAnimation = Animation & { animationName?: string };

function animName(a: Animation): string | undefined {
  return (a as NamedAnimation).animationName;
}

/** Scoped subtree query first (excludes .btn-tickets by construction); falls
 *  back to a filtered document-wide sweep for engines that ignore the
 *  `subtree` option on Element.getAnimations (older Safari). In that fallback
 *  `effect.target` can be a CSSPseudoElement (the .btn-tickets::after
 *  transition), hence the Element check. */
function collectRigAnimations(atmos: Element): Animation[] {
  let list: Animation[] = [];
  if (typeof atmos.getAnimations === "function") {
    try {
      list = atmos.getAnimations({ subtree: true } as GetAnimationsOptions);
    } catch {
      list = [];
    }
  }
  if (list.length < EXPECTED) {
    const wide = document.getAnimations().filter((a) => {
      const effect = a.effect;
      if (!(effect instanceof KeyframeEffect)) return false;
      const target = effect.target;
      return target instanceof Element && target.closest(".atmos") !== null;
    });
    if (wide.length > list.length) list = wide;
  }
  return list;
}

export default function AtmosInertia() {
  useEffect(() => {
    const atmos = document.querySelector<HTMLElement>(".atmos");
    const scene = document.querySelector<HTMLElement>(".scene");
    if (!atmos || !scene) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* ---------------------------------------------------- animation snapshot */
    let cameraAnims: Animation[] = [];
    let breatheAnims: Animation[] = [];
    let motionAnims: Animation[] = [];
    let haveSnapshot = false;
    let tries = 0;

    /* getAnimations() forces a style flush -- call it at most once per
       gesture, never inside the rAF loop. */
    const ensureSnapshot = () => {
      if (haveSnapshot || tries >= MAX_TRIES || reduce.matches) return;
      tries++;
      const list = collectRigAnimations(atmos);
      if (list.length < EXPECTED) return; // retry on the next gesture
      cameraAnims = list.filter((a) => animName(a) === "camera-orbit");
      breatheAnims = list.filter((a) => animName(a) === "breathe");
      motionAnims = list.filter((a) => {
        const n = animName(a);
        return n !== "camera-orbit" && n !== "breathe";
      });
      haveSnapshot = true;
    };

    const clearSnapshot = () => {
      cameraAnims = [];
      breatheAnims = [];
      motionAnims = [];
      haveSnapshot = false;
      tries = 0;
    };

    /* ------------------------------------------------------- rate application */
    let writtenCamera = 1;
    let writtenBreathe = 1;
    let writtenMotion = 1;

    const writeGroup = (
      list: Animation[],
      rate: number,
      last: number,
      force: boolean,
    ): number => {
      if (!force && Math.abs(Math.log(rate / last)) < LOG_EPS) return last;
      for (let i = 0; i < list.length; i++) list[i].playbackRate = rate;
      return rate;
    };

    const applyRate = (rate: number, force = false) => {
      writtenCamera = writeGroup(
        cameraAnims,
        Math.min(rate, CAMERA_MAX),
        writtenCamera,
        force,
      );
      writtenBreathe = writeGroup(
        breatheAnims,
        Math.min(rate, BREATHE_MAX),
        writtenBreathe,
        force,
      );
      writtenMotion = writeGroup(
        motionAnims,
        Math.min(rate, MOTION_MAX),
        writtenMotion,
        force,
      );
    };

    /* ------------------------------------------------------------ decay loop */
    let boost = 0;
    let raf = 0;
    let last = 0;

    const halt = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      boost = 0;
      applyRate(1, true); // land on exactly 1, not 1.0003
    };

    const tick = (now: number) => {
      const dt = Math.min(Math.max(now - last, 0) / 1000, MAX_DT);
      last = now;
      boost = Math.max(0, boost * Math.exp(-dt / TAU) - FRICTION * dt);
      if (boost <= REST) {
        halt(); // the loop ends here; a stationary thumb costs 0 frames
        return;
      }
      applyRate(1 + Math.min(boost, MOTION_MAX - 1));
      raf = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (reduce.matches) return;
      ensureSnapshot();
      if (!haveSnapshot || raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const addBoost = (target: number) => {
      if (target > boost) boost = Math.min(target, MOTION_MAX - 1);
      kick();
    };

    /* -------------------------------------------------------- touch velocity */
    let dragging = false;
    let touchId: number | null = null;
    let yielded = false; // multi-touch: hand the gesture back to the browser
    const ys: number[] = [];
    const ts: number[] = [];

    const pushSample = (y: number, t: number) => {
      ys.push(y);
      ts.push(t);
      if (ys.length > SAMPLES) {
        ys.shift();
        ts.shift();
      }
    };

    /* Windowed velocity in px/s, vertical only ("scroll" is a vertical ask).
       Returns 0 when there is not yet enough history in the window -- the
       sample is still retained, so the next event gets a valid span. */
    const velocity = (y: number, t: number): number => {
      const n = ys.length - 1;
      let i = 0;
      while (i < n && t - ts[i] > VEL_WINDOW) i++;
      while (i > 0 && t - ts[i] < MIN_VEL_DT) i--;
      const span = t - ts[i];
      if (span < MIN_VEL_DT) return 0;
      return (Math.abs(y - ys[i]) * 1000) / span;
    };

    const findTouch = (list: TouchList, id: number | null): Touch | null => {
      if (id === null) return null;
      for (let i = 0; i < list.length; i++) {
        if (list[i].identifier === id) return list[i];
      }
      return null;
    };

    const resetGesture = () => {
      dragging = false;
      yielded = false;
      touchId = null;
      ys.length = 0;
      ts.length = 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (reduce.matches) return;
      if (e.touches.length > 1) {
        /* pinch or two-finger: sample nothing, touch nothing. Any decay
           already in flight is left to coast out on its own. */
        yielded = true;
        dragging = false;
        touchId = null;
        return;
      }
      const t = e.changedTouches[0];
      if (!t) return;
      yielded = false;
      dragging = true;
      touchId = t.identifier;
      ys.length = 0;
      ts.length = 0;
      pushSample(t.clientY, e.timeStamp);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (reduce.matches || yielded || !dragging) return;
      if (e.touches.length > 1) {
        yielded = true;
        dragging = false;
        return;
      }
      const t = findTouch(e.changedTouches, touchId);
      if (!t) return;
      const now = e.timeStamp;
      const v = velocity(t.clientY, now);
      pushSample(t.clientY, now);
      if (v <= 0) return;
      addBoost(GAIN * (v / Math.max(window.innerHeight, 1)));
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) resetGesture();
    };

    const onTouchCancel = (e: TouchEvent) => {
      if (e.touches.length === 0) resetGesture();
    };

    /* ------------------------------------------------------- wheel/trackpad */
    const onWheel = (e: WheelEvent) => {
      if (reduce.matches) return;
      /* deltaMode: 0 = pixels, 1 = lines (~16px/line), 2 = pages. */
      let px = e.deltaY;
      if (e.deltaMode === 1) px *= 16;
      else if (e.deltaMode === 2) px *= window.innerHeight;
      const norm = Math.abs(px) / Math.max(window.innerHeight, 1);
      addBoost(boost + WHEEL_GAIN * norm);
    };

    /* ------------------------------------------------------------- lifecycle */
    /* Hidden tab: drop the boost entirely rather than come back to a stale
       rate and a multi-second dt. */
    const onVisibility = () => {
      if (document.hidden) halt();
    };

    /* A reduced-motion user swiping must never start the rig. The CSS pause
       already guarantees that at the platform level -- writing playbackRate on
       a paused animation cannot resume it, only play() can, and this file
       never calls play/pause/cancel/finish/reverse -- but bail in JS too so
       nothing accumulates. Handle both directions of a live OS toggle: turning
       it ON forces every current rate to exactly 1 *before* the snapshot is
       cleared (order matters -- otherwise a later toggle-off would resume at a
       stale boost forever); turning it OFF clears the snapshot so the next
       gesture re-collects fresh. */
    const onReduceChange = () => {
      if (reduce.matches) {
        halt();
      }
      clearSnapshot();
    };

    const passive = { passive: true } as const;
    window.addEventListener("touchstart", onTouchStart, passive);
    window.addEventListener("touchmove", onTouchMove, passive);
    window.addEventListener("touchend", onTouchEnd, passive);
    window.addEventListener("touchcancel", onTouchCancel, passive);
    window.addEventListener("wheel", onWheel, passive);
    document.addEventListener("visibilitychange", onVisibility);
    reduce.addEventListener("change", onReduceChange);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
      window.removeEventListener("wheel", onWheel);
      document.removeEventListener("visibilitychange", onVisibility);
      reduce.removeEventListener("change", onReduceChange);
      /* StrictMode double-mounts in dev -- leave every rate at exactly 1
         regardless of which mount instance is unwinding. */
      halt();
    };
  }, []);

  return null;
}
