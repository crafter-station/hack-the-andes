import { describe, expect, test } from "bun:test";

import { PORTRAIT_HEIGHT, PORTRAIT_WIDTH } from "@/lib/badges/portrait-image";
import { renderShareBadge } from "@/lib/badges/share-image";

const read = async (png: Buffer) => {
  const { default: sharp } = await import("sharp");
  return await sharp(png).metadata();
};

describe("renderShareBadge", () => {
  test("renders at the shape a shared image is looked at in", async () => {
    const png = await renderShareBadge({
      fullName: "Ada Lovelace",
      role: "PARTICIPANTE",
      number: "009",
      portrait: null,
    });
    const meta = await read(png);

    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1280);
  });

  test("survives a participant with no picture", async () => {
    /*
      The window is drawn from the credential's geometry and the picture
      is composited into it, so a missing one has to leave the frame
      standing rather than collapse the layout under it. A badge is
      emailed the moment the job finishes, and a participant whose
      picture failed still gets one.
    */
    const png = await renderShareBadge({
      fullName: "Ada Lovelace",
      role: "PARTICIPANTE",
      number: "009",
      portrait: null,
    });

    expect(png.byteLength).toBeGreaterThan(1_000);
  });

  test("keeps a long name on the sheet", async () => {
    // Yoga defaults `flexShrink` to 0, so a name with no measure of its
    // own grows past the sheet rather than wrapping.
    const png = await renderShareBadge({
      fullName: "María Fernanda Rodríguez Quispe",
      role: "SOFTWARE DEVELOPER",
      number: "123",
      portrait: null,
    });
    const meta = await read(png);

    expect(meta.width).toBe(1024);
  });

  test("screens the portrait at the window the credential uses", () => {
    // Both surfaces crop to one aspect, so the same face is not framed
    // two ways. The card's window is 0.863 wide to tall.
    expect(PORTRAIT_WIDTH / PORTRAIT_HEIGHT).toBeCloseTo(0.863, 2);
  });
});
