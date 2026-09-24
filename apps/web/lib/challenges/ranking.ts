import {
  type ChallengeRanking,
  type ChallengeRankingEntry,
  type ChallengeScore,
  challengeBySlug,
  compareChallengeScores,
  isChallengeRankingVisibleAt,
} from "@chofex/challenges-contract";
import { db } from "@chofex/db";
import { and, desc, eq, inArray } from "@chofex/db/orm";
import {
  applications,
  challengeAttempts,
  challengeEvaluations,
} from "@chofex/db/schema";
import { HttpError } from "../registration/http";
import { catalogItemFor } from "./catalog";
import { challengesForceOpen, currentChallengeTime } from "./clock";
import { currentChallengeVersion } from "./engine";
import { rankingDisplayName } from "./names";
import { competitionRanks, publicRankingEntries } from "./ranking-policy";
import { scoreFromStored } from "./score";

interface RankedEvaluation {
  readonly attemptId: string;
  readonly participantId: string;
  readonly shareCode: string;
  readonly score: ChallengeScore;
  readonly evaluatedAt: Date;
}

const compareRanked = (
  left: RankedEvaluation,
  right: RankedEvaluation,
): number => {
  const scoreOrder = compareChallengeScores(left.score, right.score);
  if (scoreOrder !== 0) return scoreOrder;
  return left.evaluatedAt.getTime() - right.evaluatedAt.getTime();
};

export const rankedEvaluationsFor = async (
  slug: string,
): Promise<Array<RankedEvaluation>> => {
  const rows = await db
    .select({
      attemptId: challengeAttempts.id,
      participantId: challengeAttempts.participantId,
      shareCode: challengeAttempts.shareCode,
      evaluation: challengeEvaluations,
    })
    .from(challengeAttempts)
    .innerJoin(
      challengeEvaluations,
      eq(challengeEvaluations.id, challengeAttempts.bestEvaluationId),
    )
    .where(
      and(
        eq(challengeAttempts.challengeSlug, slug),
        eq(challengeAttempts.challengeVersion, currentChallengeVersion),
      ),
    );

  return rows
    .map((row) => ({
      attemptId: row.attemptId,
      participantId: row.participantId,
      shareCode: row.shareCode,
      score: scoreFromStored(row.evaluation),
      evaluatedAt: row.evaluation.createdAt,
    }))
    .sort(compareRanked);
};

export const rankForAttempt = (
  ranked: ReadonlyArray<RankedEvaluation>,
  attemptId: string,
): { rank: number; competitorCount: number } | undefined => {
  const index = ranked.findIndex((row) => row.attemptId === attemptId);
  if (index < 0) return undefined;
  const ranks = competitionRanks(ranked.map((row) => row.score));
  return { rank: ranks[index] ?? 1, competitorCount: ranked.length };
};

export const getChallengeRanking = async (
  slug: string,
  now: Date = currentChallengeTime(),
): Promise<ChallengeRanking> => {
  const challenge = challengeBySlug(slug);
  if (!challenge) {
    throw new HttpError(404, "CHALLENGE_NOT_FOUND", "Challenge not found");
  }

  const challengeItem = catalogItemFor(challenge, now, challengesForceOpen());
  if (!isChallengeRankingVisibleAt(challenge, now)) {
    return {
      challenge: challengeItem,
      entries: [],
      competitorCount: 0,
    };
  }

  const ranked = await rankedEvaluationsFor(slug);
  const participantIds = [...new Set(ranked.map((row) => row.participantId))];
  const identityByParticipant = new Map<
    string,
    {
      firstName: string | null;
      lastName: string | null;
      githubUrl: string | null;
    }
  >();

  if (participantIds.length > 0) {
    const applicationRows = await db
      .select({
        participantId: applications.participantId,
        firstName: applications.firstName,
        lastName: applications.lastName,
        githubUrl: applications.githubUrl,
      })
      .from(applications)
      .where(inArray(applications.participantId, participantIds))
      .orderBy(desc(applications.createdAt));

    for (const application of applicationRows) {
      if (identityByParticipant.has(application.participantId)) continue;
      identityByParticipant.set(application.participantId, {
        firstName: application.firstName,
        lastName: application.lastName,
        githubUrl: application.githubUrl,
      });
    }
  }

  const ranks = competitionRanks(ranked.map((row) => row.score));
  const publicRanked = publicRankingEntries(ranked);
  const entries: Array<ChallengeRankingEntry> = publicRanked.map(
    (row, index) => {
      const identity = identityByParticipant.get(row.participantId);
      return {
        rank: ranks[index] ?? 1,
        displayName: rankingDisplayName({
          firstName: identity?.firstName,
          lastName: identity?.lastName,
          githubUrl: identity?.githubUrl,
          shareCode: row.shareCode,
        }),
        shareCode: row.shareCode,
        accuracy: row.score.accuracy,
        exactCount: row.score.exactCount,
        sampleSize: row.score.sampleSize,
        meanError: row.score.meanError,
        queriesUsed: row.score.queriesUsed,
        runtimeMs: row.score.runtimeMs,
        evaluatedAt: row.evaluatedAt.toISOString(),
      };
    },
  );

  return {
    challenge: challengeItem,
    entries,
    competitorCount: ranked.length,
  };
};
