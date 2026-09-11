import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The social preview card, shared by `opengraph-image` and `twitter-image`.
 *
 * This is rendered by Satori, not a browser, which constrains how it's written:
 *  - Tailwind is invisible here. `className` is inert and the `tw` prop is a
 *    frozen v3 subset that can't see this repo's v4 `@theme` tokens, so every
 *    value below is an inline style with a hex lifted from `globals.css`.
 *  - Only flexbox. Any <div> with more than one non-string child must declare
 *    `display: flex` or Satori throws.
 *  - `filter: invert()` is unreliable, so the wordmark is a pre-inverted white
 *    PNG (`public/aftershock-logo-white.png`) rather than the black source the
 *    page inverts in CSS.
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

// The landscape `.scene` gradient. Ends deep and chromatic, centre stays
// near-black — blue and orange must never average into a muddy band.
const SCENE =
  "linear-gradient(102deg, #07121f 0%, #040509 40%, #040407 60%, #170a03 100%)";

// The `.atmos-wash` gels, trimmed to the four load-bearing lobes (--gx is 1, so
// the calc() wrappers resolve to these literals).
const WASH = [
  "radial-gradient(ellipse 38% 50% at 0% 26%, rgba(12, 132, 255, 0.72), rgba(12, 132, 255, 0.3) 34%, rgba(12, 132, 255, 0.08) 54%, transparent 74%)",
  "radial-gradient(ellipse 30% 38% at -4% 58%, rgba(8, 108, 240, 0.58), rgba(8, 108, 240, 0.24) 34%, rgba(8, 108, 240, 0.06) 54%, transparent 74%)",
  "radial-gradient(ellipse 42% 58% at 100% 40%, rgba(255, 104, 10, 0.76), rgba(255, 104, 10, 0.32) 34%, rgba(255, 104, 10, 0.09) 54%, transparent 74%)",
  "radial-gradient(ellipse 34% 44% at 102% 72%, rgba(255, 90, 8, 0.62), rgba(255, 90, 8, 0.26) 34%, rgba(255, 90, 8, 0.07) 54%, transparent 74%)",
].join(", ");

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
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: WASH,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={740} height={165} alt="Aftershock" />

          <div
            style={{
              marginTop: 44,
              fontSize: 25,
              letterSpacing: 10,
              color: "rgba(255, 255, 255, 0.9)",
            }}
          >
            MONTREAL&apos;S FAVORITE AFTERS
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 40,
              fontSize: 22,
              letterSpacing: 5,
              color: "rgba(244, 246, 250, 0.82)",
            }}
          >
            <div style={{ display: "flex" }}>SAT OCT 3</div>
            {/* the `.tick` divider: blue half, orange half */}
            <div
              style={{
                width: 46,
                height: 2,
                marginLeft: 28,
                marginRight: 28,
                backgroundImage:
                  "linear-gradient(90deg, #1e9dff 0 48%, #ff7b17 52%)",
              }}
            />
            <div style={{ display: "flex" }}>10PM – 3AM</div>
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
