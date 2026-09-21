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
import { lumaFromRgba, normalise } from "@/lib/portrait/luminance";

/**
 * The square the badge frame reserves for a portrait.
 *
 * `badgeFrameSvg` lays out a 1024×1280 sheet with a 928×928 well inset
 * at 48, and the composite lands inside it.
 */
export const PORTRAIT_SIZE = 800;

/**
 * A coarser pitch than the card's five.
 *
 * The card's window renders at 113px on screen; this one is looked at
 * full size, printed or saved, so the dots can be bigger without
 * dissolving — and at 800px a 5px pitch is 160 dots across, which reads
 * as a texture rather than as a portrait made of dots.
 */
const HALFTONE_CELL = 8;

/** Bone on the card's own near-black, so the two match. */
const INK = "#f6f3ee";

export const halftonePortraitPng = async (
  source: Uint8Array | Buffer,
): Promise<Buffer> => {
  const columns = Math.floor(PORTRAIT_SIZE / HALFTONE_CELL);
  const rows = columns;

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
  const values = normalise(grid.values);

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
