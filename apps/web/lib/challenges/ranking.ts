import {
  type ChallengeRanking,
  type ChallengeRankingEntry,
  type ChallengeScore,
  challengeBySlug,
  isChallengeRankingVisibleAt,
} from "@chofex/challenges-contract";
import { db } from "@chofex/db";
import { and, desc, eq, inArray, sql } from "@chofex/db/orm";
import {
  applications,
  challengeAttempts,
  challengeEvaluations,
} from "@chofex/db/schema";
import { HttpError } from "../registration/http";
import { catalogItemFor } from "./catalog";
import { challengesForceOpen, currentChallengeTime } from "./clock";
import { currentChallengeVersionFor } from "./engine";
import { rankingDisplayName } from "./names";
import {
  compareRankedChallengeEvaluations,
  competitionRanksForEvaluations,
  publicRankingEntries,
} from "./ranking-policy";
import { scoreFromStored } from "./score";

export interface RankedEvaluation {
  readonly attemptId: string;
  readonly participantId: string;
  readonly shareCode: string;
  readonly score: ChallengeScore;
  readonly evaluatedAt: Date;
}

export type RankingDatabase = Pick<typeof db, "select" | "selectDistinctOn">;

export const rankedEvaluationsFor = async (
  slug: string,
  database: RankingDatabase = db,
): Promise<Array<RankedEvaluation>> => {
  const challengeVersion = currentChallengeVersionFor(slug);
  if (!challengeVersion) return [];
  const latestApplications = database
    .selectDistinctOn([applications.participantId], {
      participantId: applications.participantId,
      status: applications.status,
    })
    .from(applications)
    .orderBy(
      applications.participantId,
      desc(applications.createdAt),
      desc(applications.id),
    )
    .as("ranking_latest_applications");
  const rows = await database
    .select({
      attemptId: challengeAttempts.id,
      participantId: challengeAttempts.participantId,
      shareCode: challengeAttempts.shareCode,
      evaluationsUsed: challengeAttempts.evaluationsUsed,
      evaluation: challengeEvaluations,
    })
    .from(challengeAttempts)
    .innerJoin(
      challengeEvaluations,
      eq(challengeEvaluations.id, challengeAttempts.bestEvaluationId),
    )
    .innerJoin(
      latestApplications,
      eq(latestApplications.participantId, challengeAttempts.participantId),
    )
    .where(
      and(
        eq(challengeAttempts.challengeSlug, slug),
        eq(challengeAttempts.challengeVersion, challengeVersion),
        sql`${latestApplications.status} <> 'withdrawn'`,
      ),
    );

  return rows
    .map((row) => ({
      attemptId: row.attemptId,
      participantId: row.participantId,
      shareCode: row.shareCode,
      score: {
        ...scoreFromStored(row.evaluation),
        evaluationsUsed: row.evaluationsUsed,
      },
      evaluatedAt: row.evaluation.createdAt,
    }))
    .sort(compareRankedChallengeEvaluations);
};

export const rankForAttempt = (
  ranked: ReadonlyArray<RankedEvaluation>,
  attemptId: string,
): { rank: number; competitorCount: number } | undefined => {
  const index = ranked.findIndex((row) => row.attemptId === attemptId);
  if (index < 0) return undefined;
  const ranks = competitionRanksForEvaluations(ranked);
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
    }
  >();

  if (participantIds.length > 0) {
    const applicationRows = await db
      .select({
        participantId: applications.participantId,
        firstName: applications.firstName,
        lastName: applications.lastName,
      })
      .from(applications)
      .where(inArray(applications.participantId, participantIds))
      .orderBy(desc(applications.createdAt), desc(applications.id));

    for (const application of applicationRows) {
      if (identityByParticipant.has(application.participantId)) continue;
      identityByParticipant.set(application.participantId, {
        firstName: application.firstName,
        lastName: application.lastName,
      });
    }
  }

  const ranks = competitionRanksForEvaluations(ranked);
  const publicRanked = publicRankingEntries(ranked);
  const entries: Array<ChallengeRankingEntry> = publicRanked.map(
    (row, index) => {
      const identity = identityByParticipant.get(row.participantId);
      return {
        rank: ranks[index] ?? 1,
        displayName: rankingDisplayName({
          firstName: identity?.firstName,
          lastName: identity?.lastName,
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
    competitorCount: entries.length,
  };
};
