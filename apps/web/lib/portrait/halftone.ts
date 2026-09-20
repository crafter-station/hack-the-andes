/**
 * The portrait as a field of dots.
 *
 * This is what goes on the card, and the reason is measured rather than
 * stylistic: the photo window is 113px on screen, where a dot lands at
 * about 1.15px and reads, and a character lands at 1.38px and does not.
 * A dot carries one value — its radius — while a character needs its
 * shape distinguished, and a shape needs several pixels to have one.
 */

import type { Grid } from "./luminance";

interface HalftoneOptions {
  /** The grid pitch in output pixels. */
  readonly cell: number;
  readonly ink: string;
}

/**
 * The largest a dot may grow, as a fraction of its cell.
 *
 * Slightly over a half, so the brightest dots just touch and read as a
 * solid highlight rather than as a grid that never closes.
 */
const MAX_RADIUS = 0.52;

/** Below this a dot is a rounding artefact, not a mark. */
const MIN_RADIUS = 0.3;

export const halftoneSvg = (
  grid: Grid,
  { cell, ink }: HalftoneOptions,
): string => {
  const dots: string[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const radius = (grid.values[y * grid.width + x] ?? 0) * MAX_RADIUS * cell;
      // Skipped rather than drawn at zero: a few thousand empty circles
      // is a drawing that takes seconds to rasterise for no ink.
      if (radius <= MIN_RADIUS) {
        continue;
      }
      const cx = x * cell + cell / 2;
      const cy = y * cell + cell / 2;
      dots.push(`<circle cx="${cx}" cy="${cy}" r="${radius.toFixed(2)}"/>`);
    }
  }

  const width = grid.width * cell;
  const height = grid.height * cell;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g fill="${ink}">${dots.join("")}</g></svg>`;
};
