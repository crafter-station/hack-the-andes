/**
 * The credential's printed artwork, as data URIs satori can place.
 *
 * The ridge and the three sponsor marks are the event's own files, lifted
 * out of the design export in `docs/design/` and stored under
 * `public/credential/`. An earlier version of this module generated the
 * ridge from summed sines, which was a passable imitation and not the
 * artwork: the real drawing has a summit that the sine version simply does
 * not, and nobody should have to notice that the card is wearing a copy.
 *
 * The design export pairs every mark with its own mask, and the two sit
 * next to each other in the file looking almost alike. The mask is the
 * one that renders as a bold smear at any real size; all three sponsor
 * marks shipped from the mask before the two were put side by side at the
 * size the card gives them. If these are ever re-extracted, compare the
 * candidates at the printed size first.
 *
 * Every asset is stored as **alpha only** — white pixels carrying the
 * drawing's coverage in their alpha channel. Two reasons, both load-bearing:
 * the black background of the original would otherwise land on the card as
 * a rectangle, and alpha lets the same file be tinted or dimmed without a
 * second file per variant.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

/**
 * Resolved against this module, not the working directory.
 *
 * The card is drawn from a Next route, where the working directory is the
 * app. The emailed badge is drawn from a Trigger worker and the tests run
 * from the repository root, and in both of those a path built from `cwd`
 * points at nothing — which surfaces as a badge with no ridge on it, or
 * as an ENOENT nobody sees until a participant is waiting for an email.
 */
const assetPath = (file: string): string =>
  fileURLToPath(new URL(`../../public/credential/${file}`, import.meta.url));

/**
 * Memoised by every argument that changes the bytes.
 *
 * These depend on the card's geometry and nothing about the person, so
 * each distinct request renders one identical bitmap forever. Without this
 * a 900px ridge is decoded, resized and base64'd once per credential.
 */
const cache = new Map<string, Promise<string>>();

const memo = (key: string, render: () => Promise<Buffer>): Promise<string> => {
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  const started = render().then(
    (png) => `data:image/png;base64,${png.toString("base64")}`,
  );
  cache.set(key, started);
  return started;
};

/**
 * Scales the coverage the drawing already carries.
 *
 * Done to the bitmap rather than with a CSS `opacity` on the element:
 * satori's opacity handling differs between an element and its background
 * image, and the ridge is used as both.
 */
const dim = async (png: Buffer, opacity: number): Promise<Buffer> => {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const alpha = pixel * info.channels + 3;
    data[alpha] = Math.round((data[alpha] ?? 0) * opacity);
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
};

interface RidgeOptions {
  readonly width: number;
  /** How far the drawing is knocked back behind the type, 0 to 1. */
  readonly opacity: number;
}

/** The contour mountain the card is printed over. */
export const ridgeDataUri = ({
  width,
  opacity,
}: RidgeOptions): Promise<string> =>
  memo(`ridge:${width}:${opacity}`, async () => {
    const source = await readFile(assetPath("ridge.png"));
    const scaled = await sharp(source).resize({ width }).png().toBuffer();
    return dim(scaled, opacity);
  });

/**
 * The event's own mark, for the back's lockup and the lanyard's weave.
 *
 * The favicon, not the plain triangle that stood in for it: at the size
 * the strap gives it the facets still read, and a smooth triangle reads
 * as a generic arrow.
 */
export const mountainDataUri = (width: number): Promise<string> =>
  memo(`mountain:${width}`, async () => {
    const source = await readFile(assetPath("mountain.png"));
    return sharp(source).resize({ width }).png().toBuffer();
  });

/** Its own aspect, so a caller can reserve the right box. */
export const MOUNTAIN_ASPECT = 512 / 328;

export const SPONSORS = [
  "peru-tech-week",
  "crafter-station",
  "chofex",
] as const;

export type Sponsor = (typeof SPONSORS)[number];

/** One sponsor's mark, at the width the back of the card gives it. */
export const sponsorDataUri = (
  sponsor: Sponsor,
  width: number,
): Promise<string> =>
  memo(`sponsor:${sponsor}:${width}`, async () => {
    const source = await readFile(assetPath(`${sponsor}.png`));
    return sharp(source).resize({ width }).png().toBuffer();
  });

/** The mark's own aspect, so the card can reserve the right box for it. */
export const sponsorHeight = async (
  sponsor: Sponsor,
  width: number,
): Promise<number> => {
  const source = await readFile(assetPath(`${sponsor}.png`));
  const { width: natural, height } = await sharp(source).metadata();
  if (!natural || !height) {
    return width;
  }
  return Math.round((height / natural) * width);
};
