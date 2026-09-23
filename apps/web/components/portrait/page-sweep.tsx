"use client";

/**
 * The page arriving out of ASCII.
 *
 * A curtain of characters over everything, dissolving on the diagonal
 * until the page beneath it — the card, the type, all of it — is simply
 * there. It replaces a sweep that drew the portrait alone in characters
 * and then stepped aside: that one had to compete with the card's own
 * halftone at a size where a character is barely over a pixel, and it
 * never read as anything.
 *
 * At page scale there is nothing to compete with. The characters are the
 * loading state, and what they uncover is the page.
 */

import { useEffect, useRef, useState } from "react";

import {
  CELL_HEIGHT,
  CELL_WIDTH,
  noiseChar,
  SETTLE_WINDOW,
  sweepThreshold,
} from "@/lib/portrait/ascii";

/**
 * Long enough to read as an arrival, short enough to sit through on every
 * visit. The portrait sweep ran 1800ms over a card; a whole page is read
 * faster than that, and a curtain outstays its welcome sooner than a
 * reveal does.
 */
const DURATION_MS = 1400;

/**
 * How bright the characters are once their cell has been uncovered.
 *
 * They do not vanish at the threshold, they linger for `SETTLE_WINDOW`
 * over the revealed page — which is what makes the edge read as a front
 * of grain rather than as a ruled line travelling across the screen.
 */
const TRAIL_ALPHA = 0.45;

/**
 * How bright the characters are while their cell is still covered.
 *
 * Dim, because a full field of them at full strength reads as a broken
 * signal rather than as a surface — the first render of this was a wall
 * of white noise. What the curtain wants to look like is dark cloth with
 * a grain in it, which is also what the page it covers looks like.
 */
const CURTAIN_ALPHA = 0.5;

export function PageSweep() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setDone(true);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // A curtain wiping across the whole viewport is exactly the motion
      // that setting exists for. Skipping it still has to report done, or
      // the page stays behind an overlay forever.
      setDone(true);
      return;
    }

    const style = getComputedStyle(canvas);
    const ground = style.backgroundColor;
    const ink = style.color;
    const font = `${CELL_HEIGHT - 1}px ${style.fontFamily}`;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    const context = canvas.getContext("2d");
    if (!context) {
      setDone(true);
      return;
    }
    context.scale(ratio, ratio);

    const columns = Math.max(1, Math.ceil(width / CELL_WIDTH));
    const rows = Math.max(1, Math.ceil(height / CELL_HEIGHT));

    let frame = 0;
    let cancelled = false;
    const started = performance.now();

    const step = (now: number) => {
      if (cancelled) {
        return;
      }
      const progress = Math.min(1, (now - started) / DURATION_MS);
      context.clearRect(0, 0, width, height);
      context.font = font;
      context.textBaseline = "top";

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          const threshold = sweepThreshold(x, y, columns, rows);
          if (progress >= threshold + SETTLE_WINDOW) {
            continue;
          }

          const left = x * CELL_WIDTH;
          const top = y * CELL_HEIGHT;
          if (progress < threshold) {
            /*
              Still curtained. The ground is painted per cell rather than
              once behind everything, because the canvas has to be
              genuinely transparent where it has been uncovered — a
              single background fill would hide the page it is supposed
              to be revealing.
            */
            context.globalAlpha = 1;
            context.fillStyle = ground;
            context.fillRect(left, top, CELL_WIDTH, CELL_HEIGHT);
            context.globalAlpha = CURTAIN_ALPHA;
          } else {
            context.globalAlpha = TRAIL_ALPHA;
          }
          context.fillStyle = ink;
          context.fillText(noiseChar(x, y), left, top);
        }
      }
      context.globalAlpha = 1;

      if (progress < 1) {
        frame = requestAnimationFrame(step);
        return;
      }
      setDone(true);
    };

    frame = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, []);

  /*
    Hidden from assistive technology and from the tab order, and never
    hit-testable — not even while it covers the page. Somebody who taps
    where a button is during the first second should press the button,
    not a canvas.
  */
  return (
    <canvas
      aria-hidden="true"
      className="page-sweep"
      data-done={done}
      ref={canvasRef}
      tabIndex={-1}
    />
  );
}
