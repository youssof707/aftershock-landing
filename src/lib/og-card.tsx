import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The social preview card, shared by `opengraph-image` and `twitter-image`.
 *
 * Composed for the size it is actually seen at. A Messenger bubble renders this
 * around 320px wide — roughly a quarter of the canvas — and several surfaces
 * (Messenger thumbnails, IG DMs, WhatsApp) centre-crop it to a square. So the
 * card is laid out inside the centred 630x630 safe zone, and the type is sized
 * against its on-screen cap height rather than against the 1200px canvas.
 *
 * This is rendered by Satori, not a browser, which constrains how it's written:
 *  - Tailwind is invisible here. `className` is inert and the `tw` prop is a
 *    frozen v3 subset that can't see this repo's v4 `@theme` tokens, so every
 *    value below is an inline style with a hex lifted from `globals.css`.
 *  - Only flexbox. Any <div> with more than one non-string child must declare
 *    `display: flex` or Satori throws — it reads the raw `props.style.display`,
 *    so inheriting a default does not save you.
 *  - `filter`, `backdrop-filter` and `mix-blend-mode` are not implemented and
 *    are silently ignored. `box-shadow` and `text-shadow` genuinely do work.
 *    `conic-gradient` is silently dropped, which is why the page's `.grain`
 *    has no equivalent here.
 *  - `filter: invert()` being unavailable is why the wordmark is a pre-inverted
 *    white PNG rather than the black source the page inverts in CSS.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "Aftershock — Montreal's Favorite Afters";
export const OG_CONTENT_TYPE = "image/png";

// Read once at module scope so the route stays statically optimized at build
// time rather than becoming a request-time render.
const logoData = await readFile(
  join(process.cwd(), "public/aftershock-logo-white.png"),
  "base64",
);
const logoSrc = `data:image/png;base64,${logoData}`;

const geistMono = await readFile(
  join(process.cwd(), "assets/GeistMono-Regular.ttf"),
);

/* -------------------------------- geometry --------------------------------
   Geist Mono advances exactly 600/1000 em for every glyph used here, and its
   cap height is 710/1000. Satori also applies `letterSpacing` after the *last*
   glyph, so a text box is L px wider than its ink — which means centred
   letterspaced text lands L/2 px left of true centre unless it carries a
   matching `marginLeft` (yoga centres the margin box, so the ink lands dead
   centre). Every letterspaced block below does.

     ink(n, F, L) = n * (0.6F + L) - L

   Square-safe crop is x in [285, 915], so nothing may exceed 502px of ink —
   the width of the wordmark, which stays the widest element so the hierarchy
   reads. Measured against a 320px bubble (scale 0.5079):

     block     text                         n   F   L     ink    cap@320
     wordmark  -                            -   -   -   502.0    (57 tall)
     tagline   MONTREAL'S FAVORITE AFTERS  26  24   5   499.4      8.7
     date      SAT OCT 3                    9  46  10   328.4     16.6
     time      10PM - 3AM                  10  30   8   252.0     10.8
     venue     ST. CATHERINE HALL          18  28   9   455.4     10.1
     cta       GET TICKETS                 11  28  10   284.8     10.1

   The tagline sits under the ~10px comfortable-reading floor on purpose: the
   identical words ship as `og:description` in text right beside the image, so
   the card doesn't need to carry them. It is brand texture, not copy.

   Vertical stack sums to 485, leaving 72.5px above and below inside the 630
   square. `lineHeight` is pinned unitless at 1.25 everywhere — left to default
   it resolves to ~1.30 from hhea and the whole column shifts ~9px. */

const LINE = 1.25;

// The landscape `.scene` gradient. Ends deep and chromatic, centre stays
// near-black — blue and orange must never average into a muddy band.
const SCENE =
  "linear-gradient(102deg, #07121f 0%, #040509 40%, #040407 60%, #170a03 100%)";

/* The `.atmos-wash` gels, restaged for this frame. Two changes from the page:
   the sources are pulled inboard (the old card pinned them at x 0%/100%, so a
   square crop contained none of them and read as a black rectangle), and each
   side gets a large low-alpha haze beneath its bright core plus a small bright
   spark above it — a single ellipse reads as a blob, three depths read as a
   light source.

   First in the list paints on top, so per side: spark, core, secondary, haze.

   The sources have to sit far enough inboard to appear inside the square crop
   (x 285-915) at all — the old card's lobes were at x 0%/100%, which is why a
   square crop of it was a black rectangle.

   The anti-mud guarantee is arithmetic rather than taste. The outermost blue
   stop dies at x=527; the outermost orange stop begins at x=666. 139px in the
   middle carry no alpha from either hue, so they cannot average into grey —
   and the vignette well below sits at 49%+ black across that whole gutter, so
   the last of each falloff is swallowed before it gets near the centreline.

   Every layer ends on `transparent` deliberately: Satori paints a rect of the
   last stop's colour across the whole element before drawing the ellipse, so a
   non-transparent terminal stop on an ellipse that doesn't cover the box floods
   the frame with a hard rectangular edge. */
const WASH = [
  "radial-gradient(ellipse 9% 15% at 16% 14%, rgba(165,212,255,0.44), rgba(80,180,255,0.19) 34%, rgba(44,146,248,0.06) 54%, transparent 72%)",
  "radial-gradient(ellipse 32% 50% at 19% 31%, rgba(40,165,255,0.82), rgba(28,138,246,0.46) 26%, rgba(20,112,230,0.20) 46%, rgba(15,90,196,0.06) 62%, transparent 78%)",
  "radial-gradient(ellipse 25% 36% at 8% 76%, rgba(18,125,250,0.70), rgba(13,105,230,0.34) 30%, rgba(10,84,196,0.10) 52%, transparent 74%)",
  "radial-gradient(ellipse 46% 72% at 4% 50%, rgba(14,78,180,0.40), rgba(13,74,172,0.21) 30%, rgba(10,60,146,0.07) 52%, transparent 74%)",
  "radial-gradient(ellipse 10% 16% at 85% 16%, rgba(255,196,124,0.42), rgba(255,140,44,0.18) 34%, rgba(244,104,14,0.06) 54%, transparent 72%)",
  "radial-gradient(ellipse 34% 54% at 82% 43%, rgba(255,132,30,0.86), rgba(255,108,12,0.47) 26%, rgba(236,88,7,0.20) 46%, rgba(194,66,4,0.06) 62%, transparent 78%)",
  "radial-gradient(ellipse 27% 38% at 95% 80%, rgba(255,104,10,0.72), rgba(238,86,6,0.35) 30%, rgba(194,64,4,0.10) 52%, transparent 74%)",
  "radial-gradient(ellipse 48% 74% at 97% 56%, rgba(178,60,4,0.40), rgba(174,58,4,0.21) 30%, rgba(144,46,3,0.07) 52%, transparent 74%)",
].join(", ");

/* `.vignette`. Layer 1 is the deep well that holds the centre black behind the
   wordmark — at the square's left edge it sits around 25% alpha, which is what
   turns the blue from a bright patch into a wall of light fading into black.
   Its ellipse does not cover the frame corners, so its `transparent` terminal
   stop is load-bearing. Layer 2's ellipse does cover them, so it may end opaque.

   Layer 3 has no equivalent on the page: the square crop keeps full height, so
   floor-and-ceiling bars are the cheapest thing that makes the square read as
   composed rather than sliced.

   Order among the three is irrelevant — they're all the same near-black, and
   compositing identical colours is order-independent. */
const VIGNETTE = [
  "radial-gradient(ellipse 26% 62% at 50% 44%, rgba(2,3,6,0.92), rgba(2,3,6,0.68) 34%, rgba(2,3,6,0.36) 58%, rgba(2,3,6,0.10) 78%, transparent 92%)",
  "radial-gradient(ellipse 76% 90% at 50% 50%, transparent 0%, rgba(2,3,6,0.08) 48%, rgba(2,3,6,0.22) 74%, rgba(3,4,9,0.56) 100%)",
  "linear-gradient(180deg, rgba(2,3,6,0.38) 0%, rgba(2,3,6,0.09) 13%, transparent 26%, transparent 72%, rgba(2,3,6,0.14) 86%, rgba(2,3,6,0.44) 100%)",
].join(", ");

/* The page puts `drop-shadow()` on `.logo` and a text glow on `.btn-tickets`.
   Neither filter exists in Satori, so both are re-expressed as gradients keyed
   to the computed anchors: logo centre y=128.5 (20.4%), CTA rule y=556.5
   (88.3%). This has to be its own layer painted after the vignette — folded in
   with it, the well would eat it.

   The first ellipse reaches x in [374,826], y in [66,191] against a logo at
   [349,851] x [72.5,184.5], so it hugs the glyphs and never shows an edge. */
const GLOW = [
  "radial-gradient(ellipse 23% 12% at 50% 20.4%, rgba(150,190,255,0.13), rgba(120,165,245,0.055) 38%, rgba(90,130,220,0.018) 62%, transparent 82%)",
  "radial-gradient(ellipse 13% 5.5% at 50% 88.3%, rgba(255,140,50,0.22), rgba(255,120,30,0.08) 40%, transparent 76%)",
].join(", ");

const layer = (backgroundImage: string) => ({
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundImage,
});

export function renderOgCard() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#05060a",
          backgroundImage: SCENE,
          fontFamily: "Geist Mono",
        }}
      >
        <div style={layer(WASH)} />
        <div style={layer(VIGNETTE)} />
        <div style={layer(GLOW)} />

        {/* Last child: paint order is tree order, so the column sits on top. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={502} height={112} alt="Aftershock" />

          <div
            style={{
              marginTop: 32,
              marginLeft: 5,
              fontSize: 24,
              letterSpacing: 5,
              lineHeight: LINE,
              color: "rgba(255, 255, 255, 0.82)",
            }}
          >
            MONTREAL&apos;S FAVORITE AFTERS
          </div>

          {/* Billing, stacked rather than in one row. A horizontal row has to
              share the 502px budget between both halves, which is what made it
              illegible; stacking also lets the time keep the page's spaced
              en-dash instead of being squeezed to `10PM-3AM`. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: 40,
            }}
          >
            <div
              style={{
                marginLeft: 10,
                fontSize: 46,
                letterSpacing: 10,
                lineHeight: LINE,
                color: "#f4f6fa",
              }}
            >
              SAT OCT 3
            </div>

            {/* the `.tick` divider: blue half, orange half */}
            <div
              style={{
                marginTop: 16,
                width: 120,
                height: 2,
                backgroundImage:
                  "linear-gradient(90deg, #1e9dff 0 48%, #ff7b17 52%)",
              }}
            />

            <div
              style={{
                marginTop: 16,
                marginLeft: 8,
                fontSize: 30,
                letterSpacing: 8,
                lineHeight: LINE,
                color: "rgba(244, 246, 250, 0.88)",
              }}
            >
              10PM – 3AM
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              marginLeft: 9,
              fontSize: 28,
              letterSpacing: 9,
              lineHeight: LINE,
              color: "rgba(244, 246, 250, 0.66)",
            }}
          >
            ST. CATHERINE HALL
          </div>

          {/* `.btn-tickets`, flattened. No border, deliberately — globals.css is
              explicit that the affordance comes from weight and light rather
              than a box, or it reads as another line of copy. Primacy here is
              three stacked cues: the only pure white on the card, the only
              coloured rule besides the tick, and GLOW's warm lift underneath. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: 40,
            }}
          >
            <div
              style={{
                marginLeft: 10,
                fontSize: 28,
                letterSpacing: 10,
                lineHeight: LINE,
                color: "#ffffff",
                textShadow: "0 0 20px rgba(255,150,60,0.45)",
              }}
            >
              GET TICKETS
            </div>
            <div
              style={{
                marginTop: 12,
                width: 200,
                height: 2,
                opacity: 0.92,
                backgroundImage:
                  "linear-gradient(90deg, rgba(30,157,255,0) 0%, #1e9dff 22%, #ff7b17 78%, rgba(255,123,23,0) 100%)",
                boxShadow: "0 0 14px rgba(255,123,23,0.5)",
              }}
            />
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        {
          name: "Geist Mono",
          data: geistMono,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
