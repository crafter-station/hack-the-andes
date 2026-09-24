import {
  blackBoxChallengeSlug,
  brokenAgentChallengeSlug,
  type ChallengeRanking,
  isChallengeRankingVisibleAt,
} from "@chofex/challenges-contract";
import {
  BrandContainer,
  BrandKicker,
  BrandSectionHeader,
  brandFrameClassName,
  brandSectionClassName,
} from "@chofex/ui/components/brand";
import Link from "next/link";
import { BrokenAgentChallengeGuide } from "./broken-agent-guide";
import { BlackBoxChallengeGuide } from "./challenge-guide";
import { RankingCountdown } from "./ranking-countdown-view";

const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;

const RankingResults = ({
  brokenAgent,
  entries,
}: {
  readonly brokenAgent: boolean;
  readonly entries: ChallengeRanking["entries"];
}) => {
  if (entries.length === 0) {
    return (
      <div className={`p-6 ${brandFrameClassName}`}>
        <p className="text-sm text-[var(--hud-muted)]">
          Nadie ha enviado una evaluación oficial todavía. Las soluciones se
          envían por la CLI; esta página solo muestra el ranking.
        </p>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${brandFrameClassName}`}>
      <table className="min-w-full text-left text-sm">
        <thead className="landing-type-meta text-[var(--hud-muted)]">
          <tr>
            <th className="px-4 py-3">Puesto</th>
            <th className="px-4 py-3">Participante</th>
            <th className="px-4 py-3">{brokenAgent ? "Score" : "Accuracy"}</th>
            <th className="px-4 py-3">{brokenAgent ? "Puntos" : "Exactas"}</th>
            {!brokenAgent && <th className="px-4 py-3">Queries</th>}
            <th className="px-4 py-3">Runtime</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              className="border-[var(--hud-ink)]/10 border-t"
              key={`${entry.shareCode}-${entry.rank}`}
            >
              <td className="px-4 py-3 font-mono text-[var(--hud-action)]">
                #{entry.rank}
              </td>
              <td className="px-4 py-3">
                <div>{entry.displayName}</div>
                <div className="landing-type-meta text-[var(--hud-muted)]">
                  #{entry.shareCode}
                </div>
              </td>
              <td className="px-4 py-3 font-mono">{percent(entry.accuracy)}</td>
              <td className="px-4 py-3 font-mono">
                {entry.exactCount}/{entry.sampleSize}
              </td>
              {!brokenAgent && (
                <td className="px-4 py-3 font-mono">{entry.queriesUsed}</td>
              )}
              <td className="px-4 py-3 font-mono">{entry.runtimeMs} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export function ChallengeRankingView({
  now,
  ranking,
}: {
  readonly now: string;
  readonly ranking: ChallengeRanking;
}) {
  const { challenge, entries } = ranking;
  const brokenAgent = challenge.slug === brokenAgentChallengeSlug;
  const rankingVisible = isChallengeRankingVisibleAt(challenge, new Date(now));
  let cliHint = "chofex challenge list";
  if (challenge.closed) {
    cliHint = `chofex challenge ranking --challenge ${challenge.slug}`;
  } else if (challenge.playable) {
    cliHint = `chofex challenge query --challenge ${challenge.slug}`;
  }
  if (brokenAgent) {
    cliHint = "chofex challenge init --challenge broken-agent";
  }
  let challengeState = "Abierto";
  if (challenge.closed) {
    challengeState = "Cerrado";
  } else if (!challenge.open) {
    challengeState = `Abre ${challenge.opensAt.slice(0, 10)}`;
  }
  let rankingContent = (
    <RankingResults brokenAgent={brokenAgent} entries={entries} />
  );
  if (!rankingVisible && challenge.rankingVisibleAt) {
    rankingContent = (
      <RankingCountdown
        initialNow={now}
        visibleAt={challenge.rankingVisibleAt}
      />
    );
  }
  let challengeGuide = null;
  if (challenge.slug === blackBoxChallengeSlug && !challenge.closed) {
    challengeGuide = <BlackBoxChallengeGuide />;
  }
  if (challenge.slug === brokenAgentChallengeSlug) {
    challengeGuide = <BrokenAgentChallengeGuide />;
  }
  let rankingDescription =
    "Ranking público de solo lectura: accuracy, empates por predicciones exactas y menos queries. Las implementaciones no se publican.";
  if (brokenAgent) {
    rankingDescription =
      "Ranking público de solo lectura: score de producción, menos evaluaciones oficiales, runtime y, al final, hora de envío. Los casos ocultos y las implementaciones no se publican.";
  }

  return (
    <section
      aria-labelledby="challenge-ranking-heading"
      className="bg-[var(--hud-paper)]"
    >
      <BrandContainer className={brandSectionClassName}>
        <BrandKicker className="mb-3 text-[var(--hud-kicker)]">
          <Link
            className="underline-offset-4 hover:text-[var(--hud-ink)] hover:underline"
            href="/challenges"
          >
            challenges
          </Link>{" "}
          / {challenge.theme} #{challenge.code}
        </BrandKicker>
        <BrandSectionHeader
          headingLevel="h1"
          title={challenge.title}
          titleId="challenge-ranking-heading"
        >
          <p className="max-w-2xl text-lg leading-relaxed text-[var(--hud-ink)]/75">
            {challenge.summary}
          </p>
        </BrandSectionHeader>

        <div
          className={`mb-8 grid gap-3 p-5 sm:grid-cols-2 ${brandFrameClassName}`}
        >
          <div>
            <BrandKicker className="text-[var(--hud-muted)]">
              Estado
            </BrandKicker>
            <p className="mt-2 font-mono text-sm uppercase tracking-[0.12em] text-[var(--hud-action)]">
              {challengeState}
            </p>
          </div>
          <div>
            <BrandKicker className="text-[var(--hud-muted)]">CLI</BrandKicker>
            <p className="mt-2 break-words font-mono text-sm">{cliHint}</p>
          </div>
        </div>

        {challengeGuide}

        <section aria-labelledby="ranking-heading" className="mt-14">
          <BrandKicker className="mb-3 text-[var(--hud-kicker)]">
            resultados oficiales
          </BrandKicker>
          <h2
            className="font-display text-4xl leading-none uppercase sm:text-5xl"
            id="ranking-heading"
          >
            Ranking
          </h2>
          <p className="mt-4 mb-8 max-w-2xl text-sm leading-relaxed text-[var(--hud-muted)]">
            {rankingDescription}
          </p>
          {rankingContent}
        </section>
      </BrandContainer>
    </section>
  );
}
