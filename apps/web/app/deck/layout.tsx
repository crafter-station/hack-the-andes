import type { Metadata } from "next";

import { deckBody } from "./fonts";
import "./deck.css";

export const metadata: Metadata = {
  title: {
    default: "Hack the Andes — Deck de patrocinio",
    template: "%s — Hack the Andes",
  },
  robots: { index: false, follow: false },
};

/**
 * Without JavaScript the pager cannot page, so the deck degrades to every slide
 * stacked vertically and readable by scroll.
 *
 * This is a `<noscript>` stylesheet rather than a class the client strips on
 * boot: the browser applies it only when scripting is off, so there is no state
 * to undo before hydration and no flash of stacked slides on the way in.
 */
const NO_JS_FALLBACK = `
  .deck-pager { height: auto; overflow: visible; }
  .deck-stage { position: relative; inset: auto; }
  .deck-pager .deck-slide {
    position: relative;
    inset: auto;
    min-height: 100svh;
    padding: var(--deck-stage-padding-y) var(--deck-stage-padding-x);
    border-bottom: 1px solid var(--deck-line);
    opacity: 1;
    transform: none;
    pointer-events: auto;
    transition: none;
  }
  .deck-photo[data-interactive-only="true"] { display: none; }
  .deck-photo-row > noscript { display: contents; }
  .deck-backdrop[data-load-backdrop="false"][data-backdrop="summit"] {
    --deck-plate: url("/deck/summit.avif");
  }
  .deck-backdrop[data-load-backdrop="false"][data-backdrop="range"] {
    --deck-plate: url("/deck/range.avif");
  }
  .deck-backdrop[data-load-backdrop="false"][data-backdrop="peak"] {
    --deck-plate: url("/deck/peak.avif");
  }
  .deck-backdrop[data-load-backdrop="false"][data-backdrop="contour"] {
    --deck-plate: url("/deck/contour.avif");
  }
  .deck-backdrop[data-load-backdrop="false"][data-backdrop="canyon"] {
    --deck-plate: url("/deck/canyon.avif");
  }
  .deck-chrome, .deck-controls { display: none; }
`;

/**
 * Decks render under the app's root layout but carry their own type stack and
 * stylesheet — the landing's four faces, not the app's Geist.
 *
 * `landingBrand` is Stack Sans Notch, and it is the one the sponsorship design
 * base sets the event's name in. `fonts.ts` already loaded it for the landing's
 * hero lockup; the decks just never asked for it, so the wordmark fell through
 * to the condensed display face.
 */
export default function DeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={deckBody.variable}>
      <noscript>
        <style>{NO_JS_FALLBACK}</style>
      </noscript>
      {children}
    </div>
  );
}
