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

/**
 * The tones, which are an object's and not the brand's.
 *
 * The shell, the printed sheet inside it, and the seam between them —
 * none of these are brand tokens because none of them are brand. The
 * version they replace had the sheet at `paper`, which is far blacker
 * than the design's card and left the shell and the sheet reading as one
 * flat shape.
 */
export const HOLDER = "#282828";
export const SHEET = "#141510";

/** The seam, which is darker than both — not the light hairline it was. */
export const SEAM = "#060604";

/**
 * The photo window carries no fill of its own, only this line.
 *
 * Light enough to be a line. At #2a2a26 — a sample taken off a
 * screenshot rather than off the artwork — it was two levels above the
 * sheet and the window simply did not appear.
 */
export const WINDOW_EDGE = "#6d6d68";

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
 * Resolved against this module, not the working directory.
 *
 * The card is rendered from a Next route, where the working directory is
 * the app; the emailed image is rendered from a Trigger worker, where it
 * is whatever the worker was started in. A path built from `cwd` works
 * in one and throws in the other, and the one it throws in is the one
 * nobody watches.
 */
const fontFile = (name: string): Promise<Buffer> =>
  readFile(new URL(`../../app/fonts/${name}`, import.meta.url));

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
  fontFile("StackSansNotch-700.ttf"),
  fontFile("StackSansNotch-500.ttf"),
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

/**
 * How long a role may be before the line stops fitting.
 *
 * Measured against the sheet at the size the role is set: the line holds
 * about thirty characters.
 */
const ROLE_LIMIT = 30;

/**
 * The role as it is printed, with its default.
 *
 * Shared, because the card and the emailed image both print it and a
 * participant with no role on one and "PARTICIPANTE" on the other is the
 * same drift this module exists to stop.
 */
export const roleFor = (role: string | null): string => {
  const source = (role ?? "PARTICIPANTE").trim();
  // Cut at a word so the line does not end mid-syllable.
  if (source.length <= ROLE_LIMIT) {
    return source;
  }
  const clipped = source.slice(0, ROLE_LIMIT);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${lastSpace > 12 ? clipped.slice(0, lastSpace) : clipped}…`;
};
