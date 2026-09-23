import { BrandWordmark, brandPageClassName } from "@chofex/ui/components/brand";
import { buttonVariants } from "@chofex/ui/components/button";
import Link from "next/link";

import { brandName } from "@/components/landing/content";
import { PeakMark } from "@/components/landing/illustrations";

/**
 * The 404 poster.
 *
 * Set from the event's own 404 artwork rather than from the generic status
 * frame the other error surfaces use: the range swept across the right of the
 * screen, the code cut out of an inverted plate on the left, and two pixels
 * stepping off its top corner — the same dissolve the wordmark carries.
 *
 * Only the drawing is an asset. The code, the line and the wordmark are live
 * text in the brand face, which is what lets the plate keep its proportions
 * from a phone to a 27-inch screen and what keeps the Spanish copy editable
 * without going back to the design file.
 */

/**
 * Served as a plain `img`, for the same reason the hero poster is: a next/image
 * srcset of 640–3840w variants buys nothing for a background drawing, and this
 * page is the one place in the app where the response is already a miss.
 */
const RIDGELINE = {
  src: "/not-found/ridgeline.webp",
  width: 2880,
  height: 1620,
} as const;

const notFoundCopy = {
  code: "404",
  title: "Página no encontrada",
  description: "La ruta que buscas no existe o ya no está disponible.",
  action: "Volver al inicio",
} as const;

/**
 * The two pixels that step off the plate's top-right corner, corner to corner.
 *
 * Sized and placed in `em`, so they belong to the plate's type size rather than
 * to a breakpoint: at every width they stay one square wide and land exactly on
 * the corner the poster puts them on.
 */
function PlateSteps() {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute bottom-full left-full size-[0.111em] bg-foreground"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-[calc(100%+0.111em)] left-[calc(100%+0.111em)] size-[0.111em] bg-foreground"
      />
    </>
  );
}

export default function NotFound() {
  return (
    <main className={`${brandPageClassName} relative isolate flex flex-col`}>
      {/*
       * The drawing clips here rather than on the page, so a short viewport in
       * landscape can still push the poster taller than the screen and scroll
       * instead of losing the top of the plate behind the edge.
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/*
         * `mix-blend-screen`, not an opaque drop.
         *
         * The drawing is white line work on black, and the brand's paper is
         * #050406 rather than #000. Screening it over the page lets the paper
         * stay the paper — the black of the artwork falls away and only the
         * ridges are added — so the poster does not sit on the page as a
         * slightly-wrong rectangle of near-black.
         */}
        {/* biome-ignore lint/performance/noImgElement: decorative still; avoid next/image srcset cost */}
        <img
          alt=""
          className="size-full object-cover object-[64%_18%] mix-blend-screen sm:object-[62%_50%]"
          decoding="async"
          height={RIDGELINE.height}
          src={RIDGELINE.src}
          width={RIDGELINE.width}
        />
        {/*
         * One wash, and it changes direction at `sm`.
         *
         * On a wide screen the type has the poster's own empty left third to
         * sit on, so the wash only has to take the density off the lines that
         * run behind the description — dark enough to read against, light
         * enough that the foreground still sweeps under the plate the way the
         * artwork draws it. Portrait has no left third: the cover crop brings
         * the summit straight through where the copy goes, so there the wash
         * runs up from the floor instead.
         */}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--hud-paper)_14%,rgb(5_4_6/0.88)_46%,transparent_88%)] sm:bg-[linear-gradient(100deg,rgb(5_4_6/0.92)_3%,rgb(5_4_6/0.74)_28%,rgb(5_4_6/0.2)_58%,transparent_80%)]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 py-12 sm:px-8 lg:px-10">
        <div className="flex flex-1 flex-col items-start justify-end">
          <h1 className="flex flex-col items-start">
            {/*
             * `mt` reserves the two steps.
             *
             * They hang outside the plate, so on a viewport short enough to
             * push the stack against the top of the screen they are the first
             * thing to go behind the edge. Two squares of margin is exactly
             * what they occupy, and where the stack has room to spare the
             * bottom-anchored column absorbs it and nothing moves.
             */}
            <span className="relative mt-[0.222em] inline-block bg-foreground px-[0.027em] pt-[0.068em] pb-[0.05em] font-brand text-[clamp(7rem,calc(7.79rem+7.95vw),15rem)] leading-[0.74] font-semibold tracking-[-0.012em] text-background">
              {notFoundCopy.code}
              <PlateSteps />
            </span>
            <span className="mt-[1.12em] font-brand text-[clamp(1.5rem,calc(1.57rem+1.6vw),3rem)] leading-none font-semibold tracking-[0.012em] uppercase">
              {notFoundCopy.title}
            </span>
          </h1>
          <p className="mt-6 max-w-sm text-pretty leading-relaxed text-muted-foreground">
            {notFoundCopy.description}
          </p>
          <Link
            className={buttonVariants({ size: "landing", className: "mt-9" })}
            href="/"
          >
            {notFoundCopy.action}
          </Link>
        </div>

        <BrandWordmark className="mt-14 flex items-center gap-[0.13em] text-[clamp(1.05rem,calc(1.02rem+1.04vw),1.95rem)] uppercase">
          <PeakMark className="h-[0.386em] w-[0.601em] shrink-0" />
          {brandName}
        </BrandWordmark>
      </div>
    </main>
  );
}
