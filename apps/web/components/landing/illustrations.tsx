/**
 * Original SVG illustrations for Hack the Andes.
 *
 * Andean identity combined with an engineering aesthetic:
 *
 *   ContourSeal    — topographic rings viewed from directly above.
 *                    Each challenge card receives a unique formation, communicating
 *                    "sealed depth" — an unknown peak you have to discover.
 *
 * All are pure inline SVG: zero JS, static under prefers-reduced-motion,
 * with appropriate aria treatment per use case.
 */

import type { SVGProps } from "react";

// ─── ContourSeal ─────────────────────────────────────────────────────────────

type ContourSealProps = SVGProps<SVGSVGElement> & {
  /** Half-width of the outermost ring (default 96 SVG units). */
  rxOuter?: number;
  /** Half-height of the outermost ring (default 74 SVG units). */
  ryOuter?: number;
  /** Rotation of the ring stack in degrees (default 0). */
  rotateDeg?: number;
};

const CONTOUR_RING_SCALES = [
  { scale: 1.0, opacity: 0.055 },
  { scale: 0.81, opacity: 0.07 },
  { scale: 0.635, opacity: 0.09 },
  { scale: 0.48, opacity: 0.11 },
  { scale: 0.32, opacity: 0.135 },
  { scale: 0.175, opacity: 0.165 },
] as const;

/**
 * An Andean peak viewed from directly above: concentric ellipses that narrow
 * toward a summit dot. Formation parameters let each challenge card carry a
 * distinct topo signature — different ridge shapes, different geologies.
 *
 * Always aria-hidden — placed behind card content as background illustration.
 */
export function ContourSeal({
  rxOuter = 96,
  ryOuter = 74,
  rotateDeg = 0,
  className,
  ...props
}: ContourSealProps) {
  const groupTransform =
    rotateDeg !== 0 ? `rotate(${rotateDeg}, 100, 100)` : undefined;

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform={groupTransform}>
        {CONTOUR_RING_SCALES.map(({ scale, opacity }) => (
          <ellipse
            key={scale}
            cx="100"
            cy="100"
            fill="none"
            opacity={opacity}
            rx={rxOuter * scale}
            ry={ryOuter * scale}
            stroke="currentColor"
            strokeWidth="1"
          />
        ))}
        {/* Summit: the single point all contours converge toward */}
        <circle cx="100" cy="100" fill="currentColor" opacity="0.22" r="2.5" />
      </g>
    </svg>
  );
}

// ─── PeakMark ────────────────────────────────────────────────────────────────

/**
 * The summit mark that sits ahead of the wordmark on the event's 404 poster.
 *
 * Lifted from the poster artwork rather than redrawn: a filled peak with its
 * ridges and couloirs cut out of the fill, which is what keeps it legible at
 * the half-cap-height it is set at. Sized in `em` by its caller so it tracks
 * whatever the wordmark beside it is set in.
 *
 * Always aria-hidden — the wordmark next to it already names the event.
 */
export function PeakMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 18.82 12.07"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M 15.71 7.98 L 14.61 7.57 L 13.79 6.27 L 13.65 5.8 L 13.04 5.15 L 12.79 4.12 L 12.18 3.03 L 12.12 2.93 L 11.75 2.61 L 10.52 0.98 L 9.59 0 L 9.44 0.21 L 8.54 1.53 L 7.93 1.78 L 7.48 2.48 L 6.02 4.04 L 6 5.23 L 5.27 5.9 L 4.55 7.11 L 3.37 7.64 L 0 12.05 L 18.83 12.05 Z M 11.09 2.04 L 10.54 1.87 L 11.48 2.92 L 12.06 3.09 L 12.21 4 L 12.82 5.11 L 12.88 5.23 L 13.39 6.28 L 11.61 4.81 L 11.74 5.35 L 10.41 3.45 L 11.12 3.98 L 10.38 2.41 L 9.63 3.16 L 9.58 1.24 L 9.95 1.59 L 9.57 0.31 Z M 8.04 1.91 L 8.49 1.8 L 7.73 2.77 Z M 10.91 8.04 L 10.53 8.8 L 8.07 4.9 L 8.89 9.53 L 7.36 6.5 L 5.14 9.62 L 8.08 4.1 L 9.37 5.38 L 8.82 4.1 L 9.91 3.58 L 12.21 6.6 L 11.03 7.5 L 9.85 6.41 Z M 12.65 7.95 L 11.47 9.27 L 12.97 6.51 L 15.34 8.9 L 15.86 10.26 L 13.86 8.23 L 14.03 9.62 Z M 12.65 7.95" />
    </svg>
  );
}
