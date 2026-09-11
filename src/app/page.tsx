import Image from "next/image";

/* ---------------------------------------------------------------------------
 * Atmosphere — a depth rig, not a stack of flat layers.
 *
 * The orbs live inside a real CSS `perspective` camera at genuine `translateZ`
 * depths, which means almost every depth cue is *derived* rather than
 * hand-tuned, and therefore internally consistent:
 *
 *   parallax  a far orb and a near orb are displaced by different amounts on
 *             screen for the same world-space motion — automatically, and by
 *             the correct ratio. Under camera rotation the near and far banks
 *             even swing in opposite directions, which is the single most
 *             convincing depth cue here and is essentially impossible to fake
 *             by tuning per-layer speeds.
 *   scale     projected size falls off as p / (p - z). Sizes below are world
 *             space, so the far bank is authored large and lands small.
 *
 * What is *not* derived, and so is specified per band:
 *
 *   blur      depth of field. Note this increases on BOTH sides of the focal
 *             plane — the `fore` band sits in front of focus and is the most
 *             blurred of all. Foreground bokeh is what makes an image read as
 *             seen through a lens rather than merely as "distant = hazy", and
 *             it is the cue most often left out.
 *   colour    aerial perspective: distance desaturates and darkens toward the
 *             medium. The far bank is muted navy/rust, the focal bank is fully
 *             saturated. Cheap to ignore, and everything looks flat if you do.
 *   k         core contrast. Near focus the falloff is punchier and the orb has
 *             a readable form; far away it is pure diffuse wash.
 *   speed     intrinsic drift, *compounding* the perspective parallax: near
 *             things are authored fast as well as being projected fast.
 *
 * Durations stay prime and drift ≠ breathe ≠ spin per orb, so the composite
 * period is their LCM and no loop is findable. Negative delays keep anything
 * from starting phase-aligned.
 *
 * All three per-orb durations were sped up considerably from the first pass —
 * roughly 1.6-1.9x — because the initial tempo, while technically alive, was
 * too subtle to register as motion at a glance. Foreground and focal bands
 * were pushed hardest (drift down to 7-11s) since "close and fast" is also a
 * depth cue: real nearby things cross your field of view quickly.
 * ------------------------------------------------------------------------- */

/* Peak of the breathe cycle. Kept in sync with @keyframes breathe in
   globals.css, which rides *below* this as literal fractions of the peak so the
   animation stays compositable — see the note there before changing it. */
const PEAK = 1.5;

/* Aerial perspective: saturation and luminance both fall off with distance.
 *
 * Every colour here is chosen for a LOW minimum channel, which is the one thing
 * that matters when the layers composite with `screen`. Screen is
 * 1-(1-a)(1-b): the shared floor across R/G/B is what survives every blend, so
 * a colour's min channel is exactly its "whiteness". The near tints used to be
 * pale (cyan at min 125, amber at min 98) and stacking two or three of them
 * converged on milky grey — the washed-out patches. Deep min channels keep the
 * light chromatic no matter how many layers pile up. */
const FAR_BLUE = "12 58 138";
const MID_BLUE = "8 112 245";
const NEAR_CYAN = "34 158 255";
const FAR_RUST = "124 38 6";
const MID_EMBER = "255 88 6";
const NEAR_AMBER = "255 142 24";

/* z is px in the camera's space; the perspective is 1200px (see .atmos).
   Projected scale is 1200 / (1200 - z), so `far` lands at ~0.59x and `fore` at
   ~1.25x — sizes below are authored in world space to account for it.

   `size` is UNITLESS and multiplied by --su in globals.css. It used to be in
   vmax, which is a landscape-only assumption: in portrait vmax is the *height*,
   so a 74-unit foreground orb rendered 612px wide on a 450px phone and draped a
   flat desaturated film over the entire viewport. --su switches to a vmin basis
   in portrait so the composition keeps its intended proportions. */
const BAND = {
  far: { z: -820, blur: 84, o: 0.4, k: 0.72 },
  mid: { z: -380, blur: 46, o: 0.48, k: 0.92 },
  /* The focal band is small and bright rather than large and sharp. In a haze
     scene nothing is genuinely in focus except the light sources themselves, so
     a big, crisp, smooth radial falloff does not read as "in focus" — it reads
     as a ball, which is exactly the giveaway we are avoiding. Small + hot reads
     as a lamp; the haze around it does the atmospheric work. */
  focal: { z: -70, blur: 11, o: 0.5, k: 1.12 },
  /* The single biggest source of grey film: it is huge, near, and covers
     everything behind it. Kept faint and very soft — it should register as a
     lens artefact, never as a shape. */
  fore: { z: 250, blur: 96, o: 0.11, k: 0.72 },
} as const;

const ORBS = [
  // ---- far bank: big, muted, heavily diffused, slow -----------------------
  { ...BAND.far, x: -12, y: 26, size: 105, ar: 1.3, c: FAR_BLUE, path: 1, drift: 31, breathe: 19, spin: 53, delay: -12, ccw: false },
  { ...BAND.far, x: 110, y: 44, size: 112, ar: 1.22, c: FAR_RUST, path: 2, drift: 37, breathe: 23, spin: 59, delay: -7, ccw: true },
  { ...BAND.far, x: 96, y: 90, size: 86, ar: 0.84, c: FAR_RUST, path: 3, drift: 29, breathe: 17, spin: 47, delay: -63, ccw: false },
  // ---- mid bank -----------------------------------------------------------
  { ...BAND.mid, x: -4, y: 62, size: 62, ar: 0.76, c: MID_BLUE, path: 2, drift: 17, breathe: 13, spin: 41, delay: -37, ccw: true },
  { ...BAND.mid, x: 101, y: 34, size: 70, ar: 1.28, c: MID_EMBER, path: 3, drift: 19, breathe: 11, spin: 37, delay: -21, ccw: false },
  { ...BAND.mid, x: 4, y: 2, size: 48, ar: 1.18, c: MID_BLUE, path: 1, drift: 23, breathe: 17, spin: 43, delay: -45, ccw: true },
  { ...BAND.mid, x: 94, y: 78, size: 54, ar: 0.82, c: MID_EMBER, path: 2, drift: 13, breathe: 19, spin: 47, delay: -28, ccw: false },
  // ---- focal plane: smallest, hottest, fastest — reads as the light source
  { ...BAND.focal, x: 3, y: 41, size: 17, ar: 1.24, c: NEAR_CYAN, path: 3, drift: 11, breathe: 7, spin: 29, delay: -5, ccw: false },
  { ...BAND.focal, x: 97, y: 57, size: 19, ar: 0.79, c: NEAR_AMBER, path: 1, drift: 13, breathe: 11, spin: 23, delay: -31, ccw: true },
  { ...BAND.focal, x: 91, y: 15, size: 14, ar: 1.16, c: NEAR_AMBER, path: 2, drift: 7, breathe: 13, spin: 19, delay: -54, ccw: false },
  { ...BAND.focal, x: 8, y: 76, size: 15, ar: 0.86, c: NEAR_CYAN, path: 1, drift: 17, breathe: 19, spin: 31, delay: -68, ccw: true },
  { ...BAND.focal, x: 99, y: 88, size: 13, ar: 1.3, c: NEAR_AMBER, path: 3, drift: 19, breathe: 7, spin: 13, delay: -22, ccw: false },
  // ---- foreground: out of focus on the near side of the plane ------------
  { ...BAND.fore, x: -6, y: 78, size: 74, ar: 1.35, c: NEAR_CYAN, path: 2, drift: 7, breathe: 11, spin: 19, delay: -17, ccw: true },
  { ...BAND.fore, x: 106, y: 12, size: 80, ar: 0.81, c: NEAR_AMBER, path: 1, drift: 11, breathe: 17, spin: 23, delay: -42, ccw: false },
] as const;

export default function Home() {
  return (
    <div className="scene font-mono uppercase">
      {/* background: atmosphere, vignette, axis line, grain — all pure CSS */}
      <div className="atmos" aria-hidden>
        {/* Flat backdrop, deliberately outside the camera: it anchors the
            blue-left / orange-right identity at a fixed place on screen so the
            moving depth rig can never pull the composition out of balance. */}
        <div className="atmos-wash" />

        {/* The camera. Its slow orbit+dolly is what drives the parallax — it
            displaces each depth band by a different amount, and swings the near
            and far banks in opposite directions. */}
        <div className="camera">
          {/* deepest plates, behind everything */}
          <div className="atmos-field atmos-field--blue" />
          <div className="atmos-field atmos-field--amber" />

          {ORBS.map((orb, i) => (
            <div
              key={i}
              className={`orb orb--p${orb.path}${orb.ccw ? " orb--ccw" : ""}`}
              style={
                {
                  /* both unitless: globals.css rescales x about the centreline
                     via --xspread, and tilts y as a function of x via --ytilt,
                     so the bank swings from a left/right split in landscape to
                     a diagonal one in portrait */
                  "--x": orb.x,
                  "--y": orb.y,
                  "--z": `${orb.z}px`,
                  "--size": orb.size,
                  "--ar": orb.ar,
                  "--o": +(orb.o * PEAK).toFixed(4),
                  "--drift": `${orb.drift}s`,
                  "--delay": `${orb.delay}s`,
                } as React.CSSProperties
              }
            >
              <span
                className="orb__core"
                style={
                  {
                    "--c": orb.c,
                    "--k": orb.k,
                    "--blur": `${orb.blur}px`,
                    "--breathe": `${orb.breathe}s`,
                    "--spin": `${orb.spin}s`,
                  } as React.CSSProperties
                }
              />
            </div>
          ))}
        </div>
      </div>
      <div className="vignette" aria-hidden />
      <div className="grain" aria-hidden />

      {/* nav */}
      <header className="relative z-20 flex items-center justify-end px-7 py-7 text-[11px] tracking-[0.35em] sm:px-12">
        <a
          href="https://www.stagelinetickets.com/show/6a9e8ca7f166055c10ef67bc?src=site"
          target="_blank"
          rel="noopener noreferrer"
          className="relative pb-2 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-(--orange) after:shadow-[0_0_8px_rgba(255,123,23,0.7)]"
        >
          Tickets
        </a>
      </header>

      <main className="contents">
        {/* wordmark */}
        <div className="stage">
          <Image
            src="/aftershock_logo.png"
            alt="Aftershock"
            width={3840}
            height={2160}
            priority
            className="logo relative"
          />
        </div>

        <p className="subtitle text-[clamp(0.6rem,1.9vw,0.95rem)] tracking-[clamp(0.18em,1.4vw,0.55em)] text-white/90">
          Montreal&apos;s Favorite Afters
        </p>

        {/* date / time */}
        <div className="daterow flex items-center justify-center gap-[3vw] whitespace-nowrap text-[clamp(0.55rem,2.4vw,1.05rem)] tracking-[clamp(0.08em,0.9vw,0.35em)]">
          <span>Sat Oct 3</span>
          <span className="tick" aria-hidden />
          <span>10pm – 3am</span>
        </div>

        {/* venue — its own line rather than a third cell in the date row: that
            row is `whitespace-nowrap`, and three items plus two ticks overflows
            a phone long before the clamp floors bottom out. */}
        <p className="venue text-[clamp(0.5rem,1.9vw,0.85rem)] tracking-[clamp(0.12em,1.1vw,0.4em)] text-white/65">
          St. Catherine Hall
        </p>

        {/* cta */}
        <a
          href="https://www.stagelinetickets.com/show/6a9e8ca7f166055c10ef67bc?src=site"
          target="_blank"
          rel="noopener noreferrer"
          className="cta btn-tickets flex w-[clamp(230px,34vw,340px)] items-center justify-center py-[1.1rem] text-[clamp(0.8rem,1.9vw,1.05rem)] tracking-[0.4em]"
        >
          Get Tickets
        </a>
      </main>
    </div>
  );
}
