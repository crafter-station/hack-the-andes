import { describe, expect, test } from "bun:test";

import {
  halftonePortraitPng,
  PORTRAIT_HEIGHT,
  PORTRAIT_WIDTH,
} from "@/lib/badges/portrait-image";

const flat = async (
  grey: number,
  alpha: number,
  width = 300,
  height = 360,
): Promise<Buffer> => {
  const { default: sharp } = await import("sharp");
  return await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: grey, g: grey, b: grey, alpha },
    },
  })
    .png()
    .toBuffer();
};

describe("halftonePortraitPng", () => {
  test("fills the square the badge frame reserves", async () => {
    // `badgeFrameSvg` insets a 928 well at 48 on a 1024 sheet, and the
    // composite lands inside it. A portrait that came back at the source
    // photograph's own size would sit wherever it happened to fit.
    const { default: sharp } = await import("sharp");
    const png = await halftonePortraitPng(await flat(200, 1));
    const meta = await sharp(png).metadata();

    expect(meta.width).toBe(PORTRAIT_WIDTH);
    expect(meta.height).toBe(PORTRAIT_HEIGHT);
  });

  test("leaves a transparent background unlit", async () => {
    // The cut-out arrives with its background transparent and a
    // transparent pixel reads as bright, so without alpha beating
    // luminance the erased background returns as a full field of dots
    // and the cut-out was for nothing.
    const { default: sharp } = await import("sharp");
    const png = await halftonePortraitPng(await flat(255, 0));
    const { channels } = await sharp(png).stats();

    expect(channels[0]?.max).toBe(0);
  });

  test("draws more ink for a brighter subject", async () => {
    // The encoding, end to end: a dot carries one value and it is its
    // radius. If this ever inverted, every portrait would come back as
    // a negative and nothing else would notice.
    const { default: sharp } = await import("sharp");
    const inkFor = async (grey: number) => {
      const png = await halftonePortraitPng(await flat(grey, 1));
      const { channels } = await sharp(png).ensureAlpha().stats();
      return channels[3]?.mean ?? 0;
    };

    // Two tones in one image, so `normalise` has a range to stretch:
    // a flat frame is pushed to mid grey by design.
    const { default: sharpLib } = await import("sharp");
    const gradient = await sharpLib({
      create: {
        width: 300,
        height: 360,
        channels: 4,
        background: { r: 20, g: 20, b: 20, alpha: 1 },
      },
    })
      .composite([
        {
          input: await flat(240, 1, 300, 180),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    const png = await halftonePortraitPng(gradient);
    const { data, info } = await sharpLib(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const inkIn = (fromRow: number, toRow: number) => {
      let sum = 0;
      for (let y = fromRow; y < toRow; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          sum += data[(y * info.width + x) * info.channels + 3] ?? 0;
        }
      }
      return sum;
    };

    // The bright half is the top half, because the crop is anchored top.
    expect(inkIn(0, 300)).toBeGreaterThan(inkIn(500, 800));
    expect(await inkFor(255)).toBeGreaterThan(0);
  });
});
