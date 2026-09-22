"use client";

import { BrandKicker, brandFrameClassName } from "@chofex/ui/components/brand";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  formatRankingVisibleAtInPeru,
  rankingCountdownParts,
} from "./ranking-countdown";

const twoDigits = (value: number): string => String(value).padStart(2, "0");
const rankingRefreshIntervalMs = 10_000;

export function RankingCountdown({
  initialNow,
  visibleAt,
}: {
  readonly initialNow: string;
  readonly visibleAt: string;
}) {
  const router = useRouter();
  const targetTime = Date.parse(visibleAt);
  const [now, setNow] = useState(() => Date.parse(initialNow));
  const remaining = Math.max(0, targetTime - now);
  const parts = rankingCountdownParts(remaining);
  const visibilityLabel = formatRankingVisibleAtInPeru(visibleAt);

  useEffect(() => {
    let lastRefreshAt = 0;
    const update = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      const refreshIsDue =
        currentTime - lastRefreshAt >= rankingRefreshIntervalMs;
      if (currentTime >= targetTime && refreshIsDue) {
        lastRefreshAt = currentTime;
        router.refresh();
      }
    };

    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [router, targetTime]);

  const units = [
    { label: "días", value: parts.days },
    { label: "horas", value: parts.hours },
    { label: "minutos", value: parts.minutes },
    { label: "segundos", value: parts.seconds },
  ];

  return (
    <div className={`p-6 sm:p-8 ${brandFrameClassName}`}>
      <BrandKicker className="text-[var(--hud-kicker)]">
        El ranking se publica en
      </BrandKicker>
      <div
        aria-label={`${parts.days} días, ${parts.hours} horas, ${parts.minutes} minutos y ${parts.seconds} segundos`}
        className="mt-6 grid grid-cols-2 gap-px overflow-hidden border border-[var(--hud-ink)]/15 bg-[var(--hud-ink)]/15 sm:grid-cols-4"
        role="timer"
      >
        {units.map((unit) => (
          <div
            className="bg-[var(--hud-card)] px-3 py-5 text-center sm:py-7"
            key={unit.label}
          >
            <div className="font-display text-4xl leading-none text-[var(--hud-action)] sm:text-5xl">
              {twoDigits(unit.value)}
            </div>
            <BrandKicker className="mt-2 text-[var(--hud-muted)]">
              {unit.label}
            </BrandKicker>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm text-[var(--hud-muted)]">{visibilityLabel}</p>
      {remaining === 0 && (
        <p className="mt-2 text-sm text-[var(--hud-action)]">
          Publicando ranking…
        </p>
      )}
    </div>
  );
}
