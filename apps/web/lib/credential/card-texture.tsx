/**
 * The card's faces, as the texture the glTF model expects.
 *
 * `card.glb` maps its two faces onto one atlas: the front samples the left
 * half, the back samples the right. Handing it a single portrait image is
 * what makes a custom card bleed across both sides or arrive cropped — the
 * same problem react-bits PR #977 exists to solve. So this draws both halves
 * into one image, each half at the card's own aspect.
 *
 * Rendered with satori, the same compositor the share image uses, so the two
 * pictures of a credential cannot drift apart in type or palette.
 *
 * A module rather than a route because two routes need it: the public
 * badge, which finds someone by their GitHub handle, and the participant's
 * own page, which knows them from their session. Duplicating five hundred
 * lines of layout is how two cards for one event start to differ.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { brandColors } from "@chofex/ui/lib/brand-theme";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import {
  type Credential,
  initialsFor,
} from "@/components/credential/credential-model";
import {
  ridgeDataUri,
  type Sponsor,
  sponsorDataUri,
  sponsorHeight,
} from "./art";

const fontFile = (name: string): Promise<Buffer> =>
  readFile(join(process.cwd(), "app/fonts", name));

/**
 * The faces, as files, because satori takes bytes and not a CSS variable.
 *
 * `next/font/google` is how the rest of the app loads Stack Sans Notch, and
 * it is no use here: it emits WOFF2, which satori does not read. These are
 * the same family fetched as TrueType and committed beside the condensed
 * face the card already used.
 */
const [brandFont, notchBold, notchMedium] = await Promise.all([
  fontFile("BarlowCondensed-SemiBold.ttf"),
  fontFile("StackSansNotch-700.ttf"),
  fontFile("StackSansNotch-500.ttf"),
]);

/**
 * The shape of the atlas, derived from the model rather than chosen.
 *
 * Both numbers were read straight out of `card.glb`'s accessors, which
 * carry their own bounds:
 *
 * - the card mesh spans 0.716 × 1.0, so that is the aspect a face has to
 *   arrive at or the type gets stretched on its way onto the card;
 * - its `TEXCOORD_0` runs v 0.002 → 0.757, so the bottom quarter of the
 *   image is never sampled by anything.
 *
 * Sizing the image by those two puts the sampled window at exactly the
 * card's aspect, which is what stops the drawing being squeezed, and names
 * the dead strip instead of leaving it as a guessed padding value. The
 * first version used a round 1120 with 156px of bottom padding, and the
 * card shipped with the participant's name sliced in half.
 */
const FACE_WIDTH = 800;
const CARD_ASPECT = 0.716;
const SAMPLED_V = 0.7572;

/** The part of a face that reaches the card. */
const LIVE_HEIGHT = Math.round(FACE_WIDTH / CARD_ASPECT);
const FACE_HEIGHT = Math.round(LIVE_HEIGHT / SAMPLED_V);
/** The strip below it, which the model does not sample at all. */
const DEAD_HEIGHT = FACE_HEIGHT - LIVE_HEIGHT;

const PICTURE_TIMEOUT_MS = 2_500;

const colors = brandColors.dark;

/**
 * The four tones the card is actually built from, sampled off the design.
 *
 * A horizontal sweep across its edge reads, from outside in: pure black
 * for the page, a band of #282828 for the plastic shell, a dark seam where
 * the printed sheet sits inside it, and #141510 for the sheet. None of
 * them are brand tokens because none of them are brand — they are an
 * object. The version they replace had the sheet at `paper`, which is far
 * blacker than the design's card and left the shell and the sheet reading
 * as one flat shape.
 */
const HOLDER = "#282828";
const SHEET = "#141510";
/** The seam, which is darker than both — not the light hairline it was. */
const SEAM = "#060604";
/** The photo window carries no fill of its own, only this line. */
const WINDOW_EDGE = "#2a2a26";

/**
 * How far the ridge sits behind the type.
 *
 * The drawing is dense enough at full strength to turn the lower half of
 * the card into a grey field, and the name has to win. Read off the design
 * rather than picked: the printed card's contour lines measure around a
 * quarter of the ink's brightness.
 */
const RIDGE_FRONT = 0.26;
const RIDGE_BACK = 0.44;

/**
 * Each mark at the width its own proportions want.
 *
 * `peru-tech-week` is a stacked lockup and nearly square; the other two are
 * wordmarks four times as wide as they are tall. One shared width would
 * leave the stacked one towering over the others.
 */
const SPONSOR_WIDTHS: ReadonlyArray<readonly [Sponsor, number]> = [
  ["peru-tech-week", 86],
  ["crafter-station", 176],
  ["chofex", 162],
];

/**
 * The printed sheet and the room inside it, stated rather than grown.
 *
 * Satori runs Yoga, whose `flexShrink` defaults to 0 where CSS defaults to
 * 1, so a child that wants more room than its parent has simply takes it
 * and overflows. The first version sized the sheet with `flex: 1` and a
 * child `width: "100%"`, and a participant whose GitHub bio was a sentence
 * pushed their own name off the right edge of the card. Every box below is
 * a number.
 */
const SHEET_INSET = 26;
const SHEET_WIDTH = FACE_WIDTH - SHEET_INSET * 2;
const SHEET_HEIGHT = LIVE_HEIGHT - SHEET_INSET * 2;
const SHEET_PADDING_X = 54;
const CONTENT_WIDTH = SHEET_WIDTH - SHEET_PADDING_X * 2;

/**
 * The line under the name.
 *
 * An accepted participant's own answer to what they are, which is the
 * field the design prints. Everyone else gets the event's word for them:
 * a GitHub bio in this slot is a sentence, not a role, and the card said
 * things like "WHO WOULD BELIEVE I'D END UP…" under people's names.
 *
 * Still truncated, because the column takes 120 characters and the card
 * holds about thirty.
 */
const ROLE_LIMIT = 30;

const roleFor = (role: string | null): string => {
  const source = (role ?? "PARTICIPANTE").trim();
  // Cut at a word so the line does not end mid-syllable.
  if (source.length <= ROLE_LIMIT) {
    return source;
  }
  const clipped = source.slice(0, ROLE_LIMIT);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${lastSpace > 12 ? clipped.slice(0, lastSpace) : clipped}…`;
};

/**
 * The photo window, as a fraction of the printed sheet.
 *
 * Read off the design file's own node box rather than paced out on a
 * screenshot: the sheet is 319 × 462 there and the window takes 0.655 of
 * its width at a 0.863 aspect. The paced version had it too narrow and a
 * touch too tall.
 */
const PORTRAIT_WIDTH = Math.round(SHEET_WIDTH * 0.655);
const PORTRAIT_HEIGHT = Math.round(PORTRAIT_WIDTH / 0.863);

/**
 * How long the pictures this fetches may be reused.
 *
 * The response itself carries no cache header: this renders one named
 * person's credential, and a module that defaulted to a public cache
 * would be one caller away from serving it to somebody else. Whoever
 * calls it decides, and today the only caller says `private, no-store`.
 */
export const revalidate = 86_400;

/**
 * The confirmed picture, as a data URI.
 *
 * Satori cannot place a remote image, so the bytes have to come here. And
 * it is only ever the picture the participant confirmed: `CONTEXT.md` is
 * explicit that available images are not used until they choose a source,
 * so a card with nothing confirmed falls through to initials rather than
 * reaching for a photograph they did not pick.
 *
 * Every failure returns null rather than throwing. A credential with
 * initials on it is a credential; one that 500s because a picture host
 * was slow is not.
 */
const pictureDataUri = async (url: string | null): Promise<string | null> => {
  if (!url) {
    return null;
  }
  try {
    const response = await fetch(url, {
      next: { revalidate },
      signal: AbortSignal.timeout(PICTURE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const type = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      ?.trim();
    if (!type?.startsWith("image/")) {
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
};

/**
 * The card's own URL, as a QR.
 *
 * Drawn bone-on-nothing rather than the conventional black-on-white: a
 * white quiet zone on a black card is a bright rectangle, and phone
 * scanners have handled inverted codes for years.
 */
const qrDataUri = async (url: string): Promise<string | null> => {
  try {
    const png = await QRCode.toBuffer(url, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 0,
      width: 220,
      color: { dark: colors.ink, light: "#00000000" },
    });
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
};

export interface CardTextureOptions {
  /** Where the QR points. */
  readonly origin: string;
}

export const renderCardTexture = async (
  credential: Credential,
  { origin }: CardTextureOptions,
): Promise<Response> => {
  const [portrait, ridgeFront, ridgeBack, qr, sponsors] = await Promise.all([
    pictureDataUri(credential.pictureUrl),
    ridgeDataUri({ width: SHEET_WIDTH, opacity: RIDGE_FRONT }),
    ridgeDataUri({ width: SHEET_WIDTH, opacity: RIDGE_BACK }),
    qrDataUri(new URL("/carnet", origin).href),
    Promise.all(
      SPONSOR_WIDTHS.map(async ([sponsor, width]) => ({
        sponsor,
        width,
        height: await sponsorHeight(sponsor, width),
        src: await sponsorDataUri(sponsor, width),
      })),
    ),
  ]);

  const role = roleFor(credential.role);

  let portraitNode = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: PORTRAIT_WIDTH,
        height: PORTRAIT_HEIGHT,
        color: colors.muted,
        fontSize: 150,
      }}
    >
      {initialsFor(credential.name)}
    </div>
  );
  if (portrait) {
    portraitNode = (
      // biome-ignore lint/performance/noImgElement: next/image cannot run inside satori
      <img
        alt=""
        height={PORTRAIT_HEIGHT}
        src={portrait}
        // `contain`: the bust is already trimmed to its own extents, and
        // filling a square with it would take the top of the head off.
        style={{ objectFit: "contain" }}
        width={PORTRAIT_WIDTH}
      />
    );
  }

  /** Shared by both halves: the shell, and the printed sheet inside it. */
  /**
   * One printed face inside its shell.
   *
   * `ridge` is a parameter rather than a constant because the two faces
   * want the drawing at different strengths: on the front it is a trace
   * under the type, on the back it is the subject.
   */
  const face = (ridge: string, children: React.ReactNode) => (
    <div
      style={{
        display: "flex",
        width: FACE_WIDTH,
        height: FACE_HEIGHT,
        background: HOLDER,
        // The shell's own wall, plus the strip the model never samples.
        padding: `26px 26px ${DEAD_HEIGHT + 26}px`,
      }}
    >
      <div
        style={{
          display: "flex",
          position: "relative",
          width: SHEET_WIDTH,
          height: SHEET_HEIGHT,
          borderRadius: 14,
          border: `2px solid ${SEAM}`,
          background: SHEET,
          color: colors.ink,
          fontFamily: "Barlow Condensed",
          padding: `38px ${SHEET_PADDING_X}px 44px`,
        }}
      >
        {/*
          The ridge is placed, not set as a background.

          `backgroundImage` put it on the front and silently dropped it on
          the back — same helper, same URI, one face drawn and the other
          bare. An absolutely positioned image is the mechanism the
          portrait already uses on this card and it draws on both.

          Square, at the sheet's own width, standing on the sheet's floor.
          Two earlier sizings each broke one half of that: one scaled it to
          the *face* width, which is wider than the sheet, so the summit sat
          off-centre and the right slope was cut at the card's edge — the
          half a mountain that got reported; the other filled by height and
          climbed the ridge up behind the portrait. The drawing's own
          mountain occupies the lower three fifths of a square, so a square
          this wide lands it in the lower third of the card.
        */}
        {/* biome-ignore lint/performance/noImgElement: next/image cannot run inside satori */}
        <img
          alt=""
          height={SHEET_WIDTH}
          src={ridge}
          style={{ position: "absolute", left: 0, bottom: 0 }}
          width={SHEET_WIDTH}
        />
        {/*
          The column lives here, in a div of its own, and the faces below
          hand this function an array rather than a fragment. Satori does
          not flatten a fragment the way React does: the front's four
          blocks arrived as one opaque child, lost the column they were
          supposed to stack in, and laid themselves out left to right until
          the participant's name was off the edge of the card.
        */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: CONTENT_WIDTH,
            height: SHEET_HEIGHT - 82,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      {/* Front: the left half of the atlas. */}
      {face(ridgeFront, [
        <div
          key="number"
          style={{
            display: "flex",
            width: CONTENT_WIDTH,
            justifyContent: "flex-end",
            fontSize: 26,
            letterSpacing: 3,
          }}
        >
          {`#${credential.number}`}
        </div>,
        // The photo window is a line and nothing else. Sampling the design
        // across its edge finds one pale pixel and then the card's own tone
        // again, so the panel this used to fill was never there.
        <div
          key="portrait"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: PORTRAIT_WIDTH,
            height: PORTRAIT_HEIGHT,
            marginTop: 26,
            border: `1px solid ${WINDOW_EDGE}`,
          }}
        >
          {portraitNode}
        </div>,
        <div
          key="identity"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: CONTENT_WIDTH,
          }}
        >
          <div
            style={{
              fontSize: 70,
              lineHeight: 1,
              letterSpacing: 2,
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            {credential.name}
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 28,
              letterSpacing: 5,
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            {role}
          </div>
        </div>,
        qr ? (
          // biome-ignore lint/performance/noImgElement: next/image cannot run inside satori
          <img
            alt=""
            height={115}
            key="qr"
            src={qr}
            style={{ marginTop: 30 }}
            width={115}
          />
        ) : (
          <div
            key="qr"
            style={{
              display: "flex",
              color: colors.action,
              fontSize: 26,
              letterSpacing: 3,
            }}
          >
            {credential.organization ?? ""}
          </div>
        ),
      ])}

      {/* Back: the right half. Not a second copy of the front — the ridge
          is the subject here, with the event's name laid up its edge the
          way it runs on a real badge. */}
      {face(
        ridgeBack,
        <div
          style={{
            display: "flex",
            alignItems: "center",
            // Against the right edge, the way the name runs up a real badge
            // — centred, it reads as a poster rather than as the back of
            // something.
            justifyContent: "flex-end",
            width: CONTENT_WIDTH,
            height: SHEET_HEIGHT - 82,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: "rotate(90deg)",
            }}
          >
            <div
              style={{
                fontFamily: "Stack Sans Notch",
                fontWeight: 700,
                fontSize: 58,
                letterSpacing: 1,
              }}
            >
              HACK THE ANDES
            </div>
            <div
              style={{
                marginTop: 10,
                color: colors.muted,
                fontSize: 22,
                letterSpacing: 6,
              }}
            >
              LIMA · 17–18 OCT 2026
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 26,
              }}
            >
              {sponsors.map(({ sponsor, width, height, src }) => (
                // biome-ignore lint/performance/noImgElement: next/image cannot run inside satori
                <img
                  alt=""
                  height={height}
                  key={sponsor}
                  src={src}
                  style={{ marginLeft: 18, opacity: 0.72 }}
                  width={width}
                />
              ))}
            </div>
          </div>
        </div>,
      )}
    </div>,
    {
      width: FACE_WIDTH * 2,
      height: FACE_HEIGHT,
      fonts: [
        {
          name: "Barlow Condensed",
          data: brandFont,
          style: "normal",
          weight: 600,
        },
        {
          name: "Stack Sans Notch",
          data: notchMedium,
          style: "normal",
          weight: 500,
        },
        {
          name: "Stack Sans Notch",
          data: notchBold,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
};
