/**
 * The portrait as characters, and when each one arrives.
 *
 * Only the sweep uses this. On the card the same grid would be 1.38px per
 * character, which reads as a rayed smear; played across the page it is
 * 6px per character and reads as a face assembling itself.
 */

/**
 * Ten levels, darkest first, ordered by ink coverage rather than by ASCII
 * value. More levels do not read as more detail at this size — they read
 * as noise, because the eye cannot rank `+` against `*` at 10px.
 */
export const ASCII_RAMP = " .:-=+*#%@";

/** Tuned to IBM Plex Mono's advance at 12px, which is the page's face. */
export const CELL_WIDTH = 6;
export const CELL_HEIGHT = 10;

/** What a cell shows before it resolves. */
export const NOISE_CHARS = "░▒▓#@%&*+=-";

export const charForLuma = (luma: number): string => {
  const safe = Number.isFinite(luma) ? Math.min(1, Math.max(0, luma)) : 0;
  const index = Math.min(
    ASCII_RAMP.length - 1,
    Math.floor(safe * ASCII_RAMP.length),
  );
  return ASCII_RAMP[index] ?? " ";
};

/**
 * A deterministic 0..1 per cell.
 *
 * Random would flicker: the sweep redraws every frame, and a cell that
 * rolled a new number each time would change character while it waited
 * instead of holding one until it resolved.
 */
const jitter = (x: number, y: number): number => {
  let hash = (0x811c9dc5 ^ x) >>> 0;
  hash = Math.imul(hash, 0x01000193) >>> 0;
  hash = (hash ^ y) >>> 0;
  hash = Math.imul(hash, 0x01000193) >>> 0;
  // The final `>>> 0` is load-bearing: `^` yields a *signed* int32, so
  // without it the modulo below goes negative and a cell resolves before
  // the sweep starts.
  hash = (hash ^ (hash >>> 13)) >>> 0;
  return (hash % 1000) / 1000;
};

/**
 * The earliest any cell may resolve.
 *
 * Strictly above zero: a cell that resolved at t=0 would make the sweep
 * start half-built.
 */
const FLOOR = 0.02;

/**
 * How the schedule is split between the diagonal and the grain.
 *
 * The sum is what matters and it is bounded, not chosen for looks: a cell
 * spends `SETTLE_WINDOW` half-resolved after its threshold, so the latest
 * threshold plus that window has to land inside the sweep. At 0.8 and
 * 0.18 the far corner came out at 0.98 and its last characters never
 * resolved at all — the portrait finished with holes in it.
 */
const DIAGONAL_SHARE = 0.72;
const JITTER_SHARE = 0.18;

/** How long a cell shows noise after its threshold before it lands. */
export const SETTLE_WINDOW = 0.06;

/**
 * When a cell stops being noise, as a fraction of the sweep.
 *
 * The distance along the diagonal sets the bulk of it and the cell's own
 * hash nudges the rest, so the front breaks up into grain instead of
 * arriving as a ruled line. The three constants sum to under one on
 * purpose — a threshold past the end of the sweep would leave that cell
 * as noise forever and finish the portrait with holes in it.
 */
export const sweepThreshold = (
  x: number,
  y: number,
  columns: number,
  rows: number,
): number => {
  const along = (x / Math.max(1, columns) + y / Math.max(1, rows)) / 2;
  return FLOOR + along * DIAGONAL_SHARE + jitter(x, y) * JITTER_SHARE;
};

export const noiseChar = (x: number, y: number): string =>
  NOISE_CHARS[Math.floor(jitter(x + 7919, y) * NOISE_CHARS.length)] ?? "#";
