/**
 * The credential as an image somebody can share.
 *
 * The same object as the card at `/badge`, drawn for a different frame:
 * squarer, because it is posted rather than hung, and larger, because it
 * is looked at rather than glanced at. Everything that decides how it
 * looks — the tones, the faces, the ridge, the screen's pitch — comes
 * from the same place the card takes them from.
 *
 * It replaces a bone sheet with a bright blue band set in Arial. That
 * version was not a worse design so much as a different one: a
 * participant who opened their card and then saw the image they had been
 * emailed saw two events.
 */

import { brandColors } from "@chofex/ui/lib/brand-theme";
import { ImageResponse } from "next/og";

import { mountainDataUri, ridgeDataUri } from "@/lib/credential/art";
import {
  HOLDER,
  notchFonts,
  RIDGE_FRONT,
  SEAM,
  SHEET,
  WINDOW_EDGE,
} from "@/lib/credential/printing";

import { PORTRAIT_HEIGHT, PORTRAIT_WIDTH } from "./portrait-image";

const colors = brandColors.dark;

/**
 * Four by five, which is what a shared image is.
 *
 * The card's own face is 0.716 because that is the aspect of the mesh it
 * wraps. Nothing wraps this one, so it takes the shape that survives a
 * timeline and a message thread instead.
 */
const WIDTH = 1024;
const HEIGHT = 1280;

/** The plastic shell, and the printed sheet sitting inside it. */
const SHEET_INSET = 34;
const SHEET_WIDTH = WIDTH - SHEET_INSET * 2;
const SHEET_HEIGHT = HEIGHT - SHEET_INSET * 2;
const SHEET_PADDING_X = 70;
const CONTENT_WIDTH = SHEET_WIDTH - SHEET_PADDING_X * 2;

/**
 * Type sizes, carried over from the card as fractions of its width.
 *
 * The card was measured against the design by cap height — the name
 * stands 0.065 of the face, the role 0.024 — so the same fractions of a
 * wider frame keep the two in step. Divided by Notch's cap ratio,
 * because what satori takes is an em.
 */
const NOTCH_CAP = 0.74;
const capSize = (fraction: number): number =>
  Math.round((WIDTH * fraction) / NOTCH_CAP);
const NAME_SIZE = capSize(0.065);
const ROLE_SIZE = capSize(0.024);
const NUMBER_SIZE = capSize(0.0185);
const WORDMARK_SIZE = capSize(0.028);

/** How tall the ridge stands behind the type. */
const RIDGE_HEIGHT = Math.round(SHEET_WIDTH * 0.62);

export interface ShareBadgeInput {
  readonly fullName: string;
  readonly role: string;
  /** Already screened into dots, as a data URI, or null for no picture. */
  readonly portrait: string | null;
  readonly number: string;
}

export const renderShareBadge = async (
  input: ShareBadgeInput,
): Promise<Buffer> => {
  const [ridge, mountain] = await Promise.all([
    ridgeDataUri({ width: SHEET_WIDTH, opacity: RIDGE_FRONT }),
    mountainDataUri(Math.round(WORDMARK_SIZE * 0.9)),
  ]);

  /*
    A keyed array, not a fragment. Satori does not flatten fragments the
    way React does: handed one, it takes the whole group as a single
    child, which loses the column they are supposed to stack in and lays
    them out left to right instead.
  */
  const blocks = [
    <div
      key="number"
      style={{
        display: "flex",
        width: PORTRAIT_WIDTH,
        justifyContent: "flex-end",
        fontSize: NUMBER_SIZE,
        color: colors.ink,
      }}
    >
      {`#${input.number}`}
    </div>,
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
      {input.portrait ? (
        // biome-ignore lint/performance/noImgElement: next/image cannot run inside satori
        <img
          alt=""
          height={PORTRAIT_HEIGHT}
          src={input.portrait}
          style={{ objectFit: "contain" }}
          width={PORTRAIT_WIDTH}
        />
      ) : (
        <div style={{ display: "flex" }} />
      )}
    </div>,
    <div
      key="identity"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: CONTENT_WIDTH,
        marginTop: 46,
      }}
    >
      {/*
        The width is what lets a long name wrap instead of running off
        the sheet, and `justifyContent` is what centres it: a div here is
        a flex container, so the text is a flex item and `textAlign`
        governs the lines inside it rather than the box.
      */}
      <div
        style={{
          width: CONTENT_WIDTH,
          justifyContent: "center",
          fontSize: NAME_SIZE,
          fontWeight: 700,
          lineHeight: 1.05,
          textAlign: "center",
          textTransform: "uppercase",
          color: colors.ink,
        }}
      >
        {input.fullName}
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: ROLE_SIZE,
          fontWeight: 700,
          textAlign: "center",
          textTransform: "uppercase",
          color: colors.ink,
        }}
      >
        {input.role}
      </div>
    </div>,
    <div
      key="wordmark"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: CONTENT_WIDTH,
        marginTop: 52,
        color: colors.ink,
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: next/image cannot run inside satori */}
      <img alt="" src={mountain} width={Math.round(WORDMARK_SIZE * 0.9)} />
      <div
        style={{
          marginLeft: 18,
          fontSize: WORDMARK_SIZE,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        HACK THE ANDES
      </div>
    </div>,
  ];

  const response = new ImageResponse(
    <div
      style={{
        display: "flex",
        width: WIDTH,
        height: HEIGHT,
        alignItems: "center",
        justifyContent: "center",
        background: HOLDER,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: SHEET_WIDTH,
          height: SHEET_HEIGHT,
          borderRadius: 18,
          border: `2px solid ${SEAM}`,
          background: SHEET,
          fontFamily: "Stack Sans Notch",
          fontWeight: 500,
          padding: `54px ${SHEET_PADDING_X}px 54px`,
        }}
      >
        {/*
          Placed, not set as a background. `backgroundImage` drew the
          ridge on one face of the card and silently dropped it on the
          other, for the same helper and the same URI.
        */}
        {/* biome-ignore lint/performance/noImgElement: next/image cannot run inside satori */}
        <img
          alt=""
          height={RIDGE_HEIGHT}
          src={ridge}
          style={{ position: "absolute", left: 0, bottom: 0 }}
          width={SHEET_WIDTH}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: CONTENT_WIDTH,
          }}
        >
          {blocks}
        </div>
      </div>
    </div>,
    { width: WIDTH, height: HEIGHT, fonts: notchFonts },
  );

  return Buffer.from(await response.arrayBuffer());
};
