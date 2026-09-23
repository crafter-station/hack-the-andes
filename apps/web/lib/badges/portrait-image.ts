/**
 * The portrait on the emailed badge, screened the way the card's is.
 *
 * This replaces a call to an image model that redrew the photograph as
 * pixel art. Two reasons, and neither is cost alone: the credential the
 * participant opens carries a halftone, so a pixel-art portrait in the
 * image they share is the same person in two visual languages at one
 * event; and a deterministic screen cannot fail, time out or come back
 * with a face that is not theirs.
 *
 * The screen itself is `lib/portrait`, the same module the card uses, so
 * the two surfaces cannot drift apart in pitch or contrast.
 */

import sharp from "sharp";

import { halftoneSvg } from "@/lib/portrait/halftone";
import {
  HALFTONE_CONTRAST,
  lumaFromRgba,
  normalise,
} from "@/lib/portrait/luminance";

/**
 * The window the shared badge reserves for a portrait.
 *
 * Not square any more, and not a size of its own: it is the credential's
 * own window aspect at the size the shared image draws it, so the same
 * face is cropped the same way on both. The square it replaced letterboxed
 * a portrait that the card had already cropped to 0.863.
 */
export const PORTRAIT_WIDTH = 630;

/**
 * How many dots the portrait is screened into.
 *
 * What has to match the card is the size a dot appears to be, not how
 * many there are. The card's window renders about 113px wide, so its 45
 * dots land at 2.5px each; the same 45 across a 630px image are 14px
 * each, five times coarser — and at that pitch a face loses its eyes and
 * its outline goes ragged, which is what the first version of this
 * shipped.
 *
 * Ninety is where the features come back and the screen is still a
 * screen. Past about 130 the dots stop being visible at all and the
 * portrait reads as flat grey, which is a photograph again rather than a
 * printing of one.
 */
const HALFTONE_COLUMNS = 90;
const HALFTONE_CELL = Math.round(PORTRAIT_WIDTH / HALFTONE_COLUMNS);

/**
 * Snapped to whole cells, so the screen ends where the window does.
 *
 * The card learned this the same way: an unsnapped height left the
 * drawing a couple of pixels short of the box it was placed in, which
 * the renderer then stretched.
 */
const PORTRAIT_ROWS = Math.round(PORTRAIT_WIDTH / 0.863 / HALFTONE_CELL);
export const PORTRAIT_HEIGHT = PORTRAIT_ROWS * HALFTONE_CELL;

/** Bone on the card's own near-black, so the two match. */
const INK = "#f6f3ee";

export const halftonePortraitPng = async (
  source: Uint8Array | Buffer,
): Promise<Buffer> => {
  const columns = HALFTONE_COLUMNS;
  const rows = PORTRAIT_ROWS;

  /*
    `top`, not centred, for the same reason the card crops that way: a
    portrait puts the face in the upper half of its frame, and a centre
    crop of a standing photograph takes the head off.
  */
  const { data, info } = await sharp(source)
    .resize(columns, rows, { fit: "cover", position: "top" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data);
  const grid = lumaFromRgba(pixels, info.width, info.height);
  const values = normalise(grid.values, HALFTONE_CONTRAST);

  // Alpha beats luminance: a transparent pixel reads as bright, so a
  // cut-out's erased background would otherwise return as a full field
  // of dots.
  for (let i = 0; i < values.length; i += 1) {
    if ((pixels[i * info.channels + 3] ?? 255) < 128) {
      values[i] = 0;
    }
  }

  const svg = halftoneSvg(
    { width: info.width, height: info.height, values },
    { cell: HALFTONE_CELL, ink: INK },
  );
  return await sharp(Buffer.from(svg)).png().toBuffer();
};
