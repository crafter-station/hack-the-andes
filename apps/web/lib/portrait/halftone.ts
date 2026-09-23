/**
 * The portrait as a field of dots.
 *
 * This is what goes on the card, and the reason is measured rather than
 * stylistic: the photo window is 113px on screen, where a dot lands at
 * about 3.4px and reads, and a character lands at 1.38px and does not.
 * A dot carries one value — its radius — while a character needs its
 * shape distinguished, and a shape needs several pixels to have one.
 */

import type { Grid } from "./luminance";

interface HalftoneOptions {
  /** The distance between neighbouring dots, in output pixels. */
  readonly cell: number;
  readonly ink: string;
  /**
   * How far the lattice is turned, in radians. Defaults to a printer's
   * 45°; pass 0 for a square screen.
   */
  readonly angle?: number;
}

/**
 * The angle a black screen is printed at, and the reason this module
 * exists in its current form.
 *
 * A square lattice reads as a pixel grid — the eye follows the rows and
 * sees the raster instead of the face. Turned to 45° the rows stop being
 * horizontal and the same dots read as a printed halftone. Measured off
 * the design file, whose screen is turned and whose horizontal period is
 * therefore the lattice pitch times root two.
 */
const DEFAULT_ANGLE = Math.PI / 4;

/**
 * The largest a dot may grow, as a fraction of its cell.
 *
 * Just past a half, so the brightest dots overlap and the highlight
 * closes into solid ink with diamond holes between them — what a real
 * screen does, and what the design shows. 0.72 was tried and is too
 * much: everything above a middling grey merges, so the top third of the
 * range prints identically and the face loses its modelling.
 */
const MAX_RADIUS = 0.55;

/** Below this a dot is a rounding artefact, not a mark. */
const MIN_RADIUS = 0.3;

/**
 * The transfer curve from brightness to dot area.
 *
 * Above one, which darkens: a straight mapping put the whole face above
 * the radius at which neighbouring dots touch, so it printed as one
 * solid mass with no eyes in it. The design's face sits in the middle of
 * its range with open dots, and only a specular highlight closes — this
 * is the curve that keeps that headroom.
 */
const GAMMA = 1.6;

/**
 * The grid, read between its samples.
 *
 * The lattice is turned and the grid is not, so dots land between grid
 * cells by design. Taking the nearest one instead put a visible stair
 * step along every tonal edge — the screen is coarse enough that each
 * cell is a large diamond, and a mis-stepped diamond is a defect you can
 * point at.
 */
const sample = (grid: Grid, x: number, y: number): number => {
  const cx = Math.min(grid.width - 1, Math.max(0, x));
  const cy = Math.min(grid.height - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(grid.width - 1, x0 + 1);
  const y1 = Math.min(grid.height - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;

  const at = (gx: number, gy: number) => grid.values[gy * grid.width + gx] ?? 0;
  const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx;
  const bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx;
  return top * (1 - fy) + bottom * fy;
};

export const halftoneSvg = (
  grid: Grid,
  { cell, ink, angle = DEFAULT_ANGLE }: HalftoneOptions,
): string => {
  const width = grid.width * cell;
  const height = grid.height * cell;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  /*
    The lattice is infinite and the canvas is a window onto it, so the
    indices are walked over a square large enough to cover the canvas at
    any angle and each point is clipped. The alternative — inverting the
    rotation to find exact index bounds — is arithmetic that goes wrong
    silently at the corners, for a loop that costs a few thousand
    multiplications once per render.
  */
  const reach = Math.ceil((width + height) / cell);
  const dots: string[] = [];
  for (let j = -reach; j <= reach; j += 1) {
    for (let i = -reach; i <= reach; i += 1) {
      const lx = (i + 0.5) * cell;
      const ly = (j + 0.5) * cell;
      const ox = lx * cos - ly * sin;
      const oy = lx * sin + ly * cos;
      // Clipped on the centre, not on the circle. A dot whose centre
      // lies outside grazes the edge at most, and admitting them made
      // the square lattice stop being one dot per cell — which is the
      // property the rest of the pipeline is written against.
      if (ox < 0 || ox >= width || oy < 0 || oy >= height) {
        continue;
      }

      const radius =
        sample(grid, ox / cell - 0.5, oy / cell - 0.5) ** GAMMA *
        MAX_RADIUS *
        cell;
      // Skipped rather than drawn at zero: a few thousand empty circles
      // is a drawing that takes seconds to rasterise for no ink.
      if (radius <= MIN_RADIUS) {
        continue;
      }
      dots.push(
        `<circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="${radius.toFixed(2)}"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g fill="${ink}">${dots.join("")}</g></svg>`;
};
