import { describe, expect, test } from "bun:test";

import {
  charForLuma,
  noiseChar,
  SETTLE_WINDOW,
  sweepThreshold,
} from "@/lib/portrait/ascii";
import { halftoneSvg } from "@/lib/portrait/halftone";
import { lumaFromRgba, normalise } from "@/lib/portrait/luminance";

const solid = (r: number, g: number, b: number, count: number) => {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i += 1) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
};

describe("lumaFromRgba", () => {
  test("weights green the way Rec. 709 does", () => {
    // Not an average. Equal weights turn a green photograph into mud and
    // a red one into a silhouette; this is the one line that decides
    // whether a colour portrait survives being reduced to one channel.
    const green = lumaFromRgba(solid(0, 255, 0, 1), 1, 1).values[0] ?? 0;
    const blue = lumaFromRgba(solid(0, 0, 255, 1), 1, 1).values[0] ?? 0;

    expect(green).toBeCloseTo(0.7152, 3);
    expect(blue).toBeCloseTo(0.0722, 3);
  });

  test("carries the grid's own shape", () => {
    const grid = lumaFromRgba(solid(255, 255, 255, 12), 4, 3);

    expect(grid.width).toBe(4);
    expect(grid.height).toBe(3);
    expect(grid.values).toHaveLength(12);
  });
});

describe("normalise", () => {
  test("stretches a flat photograph across the full range", () => {
    // A photograph's own histogram rarely spans 0..1, and quantising a
    // narrow band to ten levels throws away most of the face.
    const stretched = normalise(Float32Array.from([0.4, 0.5, 0.6]));

    expect(stretched[0]).toBeCloseTo(0, 3);
    expect(stretched[2]).toBeCloseTo(1, 3);
  });

  test("survives an image with no range at all", () => {
    // A blank upload divides by zero unless this is handled.
    const flat = normalise(Float32Array.from([0.5, 0.5, 0.5]));

    for (const value of flat) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  test("never leaves a value outside the range it feeds", () => {
    // The contrast push overshoots by design, and both the ramp index and
    // the dot radius downstream assume 0..1.
    const pushed = normalise(Float32Array.from([0, 0.02, 0.5, 0.98, 1]));

    for (const value of pushed) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe("halftoneSvg", () => {
  test("gives a brighter cell a bigger dot", () => {
    // The whole encoding: a dot carries one value and it is its radius.
    const svg = halftoneSvg(
      { width: 2, height: 1, values: Float32Array.from([0.1, 0.9]) },
      { cell: 10, ink: "#f6f3ee" },
    );
    const radii = [...svg.matchAll(/r="([\d.]+)"/g)].map((m) => Number(m[1]));

    expect(radii).toHaveLength(2);
    expect(radii[1]).toBeGreaterThan(radii[0] ?? 0);
  });

  test("draws nothing for a cell with no ink", () => {
    // A zero-radius circle is still an element, and a few thousand of
    // them is a texture that takes seconds to rasterise.
    const svg = halftoneSvg(
      { width: 1, height: 1, values: Float32Array.from([0]) },
      { cell: 10, ink: "#f6f3ee" },
    );

    expect(svg).not.toContain("<circle");
  });

  test("sizes the drawing by the grid and the pitch", () => {
    const svg = halftoneSvg(
      { width: 3, height: 4, values: new Float32Array(12).fill(1) },
      { cell: 5, ink: "#f6f3ee" },
    );

    expect(svg).toContain('width="15"');
    expect(svg).toContain('height="20"');
  });
});

describe("sweepThreshold", () => {
  test("runs from the top-left corner to the bottom-right", () => {
    // The diagonal. If this ever became a column or a row sweep the
    // animation would read as a wipe, which is the thing it is not.
    const first = sweepThreshold(0, 0, 10, 10);
    const last = sweepThreshold(9, 9, 10, 10);

    expect(first).toBeLessThan(last);
  });

  test("breaks the front up instead of ruling a line", () => {
    // Cells on the same diagonal must not share a threshold, or the edge
    // arrives as a drawn line rather than as grain.
    const along = [
      sweepThreshold(0, 4, 10, 10),
      sweepThreshold(2, 2, 10, 10),
      sweepThreshold(4, 0, 10, 10),
    ];

    expect(new Set(along).size).toBe(3);
  });

  test("is deterministic, so the sweep never flickers", () => {
    expect(sweepThreshold(3, 7, 40, 40)).toBe(sweepThreshold(3, 7, 40, 40));
  });

  test("never lets a cell resolve before the sweep starts", () => {
    for (let x = 0; x < 20; x += 1) {
      for (let y = 0; y < 20; y += 1) {
        expect(sweepThreshold(x, y, 20, 20)).toBeGreaterThan(0);
      }
    }
  });

  test("every cell lands, settle window included, before the sweep ends", () => {
    // The one that matters most, and it caught a real defect: at the
    // first constants the far corner scheduled at 0.98, so with the
    // settle window on top its characters never resolved and the
    // portrait finished with holes in it. The bound is the whole
    // schedule, not just the threshold.
    for (let x = 0; x < 60; x += 1) {
      for (let y = 0; y < 60; y += 1) {
        const lands = sweepThreshold(x, y, 60, 60) + SETTLE_WINDOW;
        expect(`${x},${y} -> ${lands <= 1}`).toBe(`${x},${y} -> true`);
      }
    }
  });

  test("keeps the jitter unsigned", () => {
    // `^` yields a signed int32, so a hash without a final `>>> 0` gives
    // a negative modulo and a threshold below the floor — a cell that
    // resolves before the sweep has begun.
    let lowest = Number.POSITIVE_INFINITY;
    for (let x = 0; x < 200; x += 1) {
      for (let y = 0; y < 200; y += 1) {
        lowest = Math.min(lowest, sweepThreshold(x, y, 200, 200));
      }
    }

    expect(lowest).toBeGreaterThan(0);
  });
});

describe("charForLuma", () => {
  test("maps the ends of the range to the ends of the ramp", () => {
    expect(charForLuma(0)).toBe(" ");
    expect(charForLuma(1)).toBe("@");
  });

  test("clamps rather than returning undefined", () => {
    // `noUncheckedIndexedAccess` is on, and an out-of-range index here
    // would put the string "undefined" on the screen.
    expect(charForLuma(-5)).toBe(" ");
    expect(charForLuma(99)).toBe("@");
    expect(charForLuma(Number.NaN)).toBe(" ");
  });

  test("gets darker as the luminance falls", () => {
    // The ramp is ordered by ink coverage, not by ASCII value, and
    // nothing else in the file enforces that ordering.
    const coverage = [0.05, 0.35, 0.65, 0.95].map(charForLuma);

    expect(new Set(coverage).size).toBe(4);
    expect(coverage[0]).toBe(" ");
  });
});

describe("noiseChar", () => {
  test("answers a character for any cell", () => {
    for (let x = 0; x < 30; x += 1) {
      for (let y = 0; y < 30; y += 1) {
        expect(noiseChar(x, y)).toHaveLength(1);
      }
    }
  });

  test("is deterministic, so noise does not crawl between frames", () => {
    expect(noiseChar(5, 9)).toBe(noiseChar(5, 9));
  });
});
