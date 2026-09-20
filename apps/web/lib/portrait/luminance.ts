/**
 * A picture as one number per cell.
 *
 * Both the halftone on the card and the ASCII in the sweep read from
 * this, so neither can disagree with the other about how bright a face
 * is. Keeping it free of both `sharp` and the DOM is what lets the same
 * arithmetic run on the server and in the browser.
 */

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly values: Float32Array;
}

/** Rec. 709 luma. The green weight is why a green photo is not mud. */
export const lumaFromRgba = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Grid => {
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i += 1) {
    const offset = i * 4;
    values[i] =
      (0.2126 * (data[offset] ?? 0) +
        0.7152 * (data[offset + 1] ?? 0) +
        0.0722 * (data[offset + 2] ?? 0)) /
      255;
  }
  return { width, height, values };
};

/**
 * How hard the contrast is pushed once the range is stretched.
 *
 * A stretch alone is not enough: a face lit from one side still spends
 * most of its pixels in the middle third, and ten ramp levels across that
 * third is four usable levels. 1.65 opens the shadows and the highlights
 * without flattening the cheek into the background.
 */
const CONTRAST = 1.65;

/** Below this there is no range to stretch, only rounding error. */
const MIN_SPAN = 0.0001;

/**
 * Stretch to the full range, then push contrast.
 *
 * A photograph's own histogram is far too flat to survive being quantised
 * to ten levels — without this the face arrives as one mid grey. The
 * guard is not decorative: a blank upload has no range at all and would
 * divide by zero, and the clamp matters because the contrast push
 * overshoots by design while everything downstream assumes 0..1.
 */
export const normalise = (values: Float32Array): Float32Array => {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < lo) {
      lo = value;
    }
    if (value > hi) {
      hi = value;
    }
  }

  const out = new Float32Array(values.length);
  const span = hi - lo;
  if (!Number.isFinite(span) || span < MIN_SPAN) {
    out.fill(0.5);
    return out;
  }

  for (let i = 0; i < values.length; i += 1) {
    const unit = ((values[i] ?? 0) - lo) / span;
    out[i] = Math.min(1, Math.max(0, (unit - 0.5) * CONTRAST + 0.5));
  }
  return out;
};
