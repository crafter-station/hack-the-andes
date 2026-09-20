"use client";

/**
 * The credential assembling itself out of ASCII.
 *
 * Its own layer over the scene rather than the card's texture: that
 * texture is a PNG satori rendered on the server and cannot animate.
 * This draws the same portrait as characters across the whole width —
 * where a cell is 6px and reads — and then steps aside to reveal the
 * hanging card, where the same face is dots at 1.15px because characters
 * do not survive that size.
 */

import { useEffect, useRef } from "react";

import {
  CELL_HEIGHT,
  CELL_WIDTH,
  charForLuma,
  noiseChar,
  SETTLE_WINDOW,
  sweepThreshold,
} from "@/lib/portrait/ascii";
import { lumaFromRgba, normalise } from "@/lib/portrait/luminance";

/** Long enough to read as an assembly, short enough to sit through daily. */
const DURATION_MS = 1800;

interface PortraitSweepProps {
  /** The same picture the card carries, or null when there is none. */
  readonly src: string | null;
  /** Called once the scene underneath should be revealed. */
  readonly onDone: () => void;
}

export function PortraitSweep({ src, onDone }: PortraitSweepProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /*
    Held in a ref, not closed over. The frame loop below starts once and
    runs for the whole sweep; capturing the prop would leave it calling
    whichever `onDone` existed when it started, which is a stale one the
    moment the parent re-renders.
  */
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) {
      done.current();
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // A diagonal wipe across the whole page is exactly the motion that
      // setting exists for. Skipping it still has to report done, or the
      // scene stays behind an overlay forever.
      done.current();
      return;
    }

    let frame = 0;
    let cancelled = false;

    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      if (cancelled) {
        return;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        done.current();
        return;
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;

      const columns = Math.max(1, Math.floor(width / CELL_WIDTH));
      const rows = Math.max(1, Math.floor(height / CELL_HEIGHT));

      /*
        Read once into the cell grid. Doing this per frame would decode
        the picture sixty times a second for a result that never changes.
      */
      const sampler = document.createElement("canvas");
      sampler.width = columns;
      sampler.height = rows;
      const samplerContext = sampler.getContext("2d", {
        willReadFrequently: true,
      });
      if (!samplerContext) {
        done.current();
        return;
      }

      const scale = Math.max(
        columns / image.naturalWidth,
        rows / image.naturalHeight,
      );
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      // Anchored at the top for the same reason the card's crop is: a
      // portrait puts the face in the upper half of its frame.
      samplerContext.drawImage(
        image,
        (columns - drawWidth) / 2,
        0,
        drawWidth,
        drawHeight,
      );

      const { data } = samplerContext.getImageData(0, 0, columns, rows);
      const grid = lumaFromRgba(data, columns, rows);
      const values = normalise(grid.values);

      const style = getComputedStyle(canvas);
      const ink = style.color;
      const ground = style.backgroundColor;
      const font = `${CELL_HEIGHT - 1}px ${style.fontFamily}`;

      const started = performance.now();

      const step = (now: number) => {
        if (cancelled) {
          return;
        }
        const progress = Math.min(1, (now - started) / DURATION_MS);

        context.fillStyle = ground;
        context.fillRect(0, 0, width, height);
        context.font = font;
        context.textBaseline = "top";
        context.fillStyle = ink;

        for (let y = 0; y < rows; y += 1) {
          for (let x = 0; x < columns; x += 1) {
            const index = y * columns + x;
            // Alpha wins over luminance, exactly as on the card: a
            // transparent pixel reads as bright, so the cut-out's erased
            // background would otherwise come back as characters.
            if ((data[index * 4 + 3] ?? 255) < 128) {
              continue;
            }

            const threshold = sweepThreshold(x, y, columns, rows);
            let glyph: string;
            if (progress >= threshold + SETTLE_WINDOW) {
              glyph = charForLuma(values[index] ?? 0);
            } else if (progress >= threshold) {
              glyph = noiseChar(x, y);
            } else {
              continue;
            }

            context.fillText(glyph, x * CELL_WIDTH, y * CELL_HEIGHT);
          }
        }

        if (progress < 1) {
          frame = requestAnimationFrame(step);
          return;
        }
        done.current();
      };

      frame = requestAnimationFrame(step);
    };

    // A picture that will not load must not strand the page behind the
    // overlay; the card underneath is still a credential.
    image.onerror = () => done.current();
    image.src = src;

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [src]);

  /*
    Hidden from assistive technology *and* from the tab order. A canvas
    is focusable, so `aria-hidden` alone leaves it reachable by keyboard
    while announcing nothing — which is worse than either on its own.
    Nothing is lost: the static card underneath carries the same name,
    role and picture as real markup.
  */
  return (
    <canvas
      aria-hidden="true"
      className="portrait-sweep"
      ref={canvasRef}
      tabIndex={-1}
    />
  );
}
