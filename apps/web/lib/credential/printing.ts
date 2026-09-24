/**
 * What the credential is printed with: its tones and its faces.
 *
 * Extracted because there are two of them. The card a participant opens
 * and the image they are emailed are the same object, and for a while
 * they were not: the card was a near-black sheet set in Stack Sans
 * Notch, and the emailed one was bone with a bright blue band and Arial,
 * because each carried its own copy of the decisions. One participant
 * seeing both saw two events.
 *
 * Anything that decides how the credential looks belongs here rather
 * than beside whichever renderer happened to need it first.
 */

import { readFile } from "node:fs/promises";

export { HOLDER, SEAM, SHEET, WINDOW_EDGE } from "./tones";

/**
 * How far the ridge sits behind the type.
 *
 * The drawing is dense enough at full strength to turn the lower half of
 * the card into a grey field, and the name has to win. Read off the
 * design rather than picked: the printed card's contour lines measure
 * around a quarter of the ink's brightness.
 */
export const RIDGE_FRONT = 0.26;
export const RIDGE_BACK = 0.44;

/**
 * Stack Sans Notch's capitals, as a fraction of the em.
 *
 * Measured by rendering the file and reading the ink back, so that a
 * cap height taken off the design can be turned into a font size.
 */
export const NOTCH_CAP = 0.74;

/**
 * Both faces named in full, for the same reason the artwork is.
 *
 * Resolved against this module because the card is rendered from a Next
 * route and the emailed image from a Trigger worker, and the two have
 * different working directories. Written as literals because a bundler
 * rewrites `new URL(…, import.meta.url)` to a content-hashed name, and a
 * path built from a variable cannot be rewritten to match.
 */
const FONTS = {
  bold: new URL("../../app/fonts/StackSansNotch-700.ttf", import.meta.url),
  medium: new URL("../../app/fonts/StackSansNotch-500.ttf", import.meta.url),
} as const;

/**
 * The faces, as files, because satori takes bytes and not a CSS variable.
 *
 * `next/font/google` is how the rest of the app loads Stack Sans Notch,
 * and it is no use here: it emits WOFF2, which satori does not read.
 * These are the same family fetched as TrueType.
 *
 * One family, both weights. The card set its name in a condensed face
 * until the design was measured against it: the design's name is a plain
 * bold grotesque, and a condensed one at the same cap height is a
 * different voice on a card whose back already speaks in Notch.
 */
const [notchBold, notchMedium] = await Promise.all([
  readFile(FONTS.bold),
  readFile(FONTS.medium),
]);

/** Ready to hand to satori, in the shape it wants. */
export const notchFonts = [
  {
    name: "Stack Sans Notch",
    data: notchMedium,
    style: "normal" as const,
    weight: 500 as const,
  },
  {
    name: "Stack Sans Notch",
    data: notchBold,
    style: "normal" as const,
    weight: 700 as const,
  },
];
