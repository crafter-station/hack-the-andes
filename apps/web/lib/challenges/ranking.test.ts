import { describe, expect, test } from "bun:test";

import type { ChallengeScoreBreakdown } from "@chofex/challenges-contract";

import {
  compareRankedChallengeEvaluations,
  competitionRanksForEvaluations,
  type EvaluatedChallengeScore,
} from "./ranking-policy";

const breakdown: ChallengeScoreBreakdown = {
  coreBehavior: { earned: 10, available: 10 },
  persistence: { earned: 15, available: 15 },
  concurrency: { earned: 20, available: 20 },
  failureRecovery: { earned: 20, available: 20 },
  idempotency: { earned: 15, available: 15 },
  regressionSafety: { earned: 15, available: 15 },
  performance: { earned: 5, available: 5 },
};

const evaluation = (
  evaluatedAt: string,
  scoreOverrides: Partial<EvaluatedChallengeScore["score"]> = {},
): EvaluatedChallengeScore => ({
  evaluatedAt: new Date(evaluatedAt),
  score: {
    accuracy: 1,
    exactCount: 100,
    sampleSize: 100,
    meanError: 0,
    queriesUsed: 0,
    runtimeMs: 50,
    executionCost: 50,
    evaluationsUsed: 1,
    breakdown,
    ...scoreOverrides,
  },
});

describe("challenge ranking", () => {
  test("does not let a cheaper Broken Agent run outrank an earlier equal score", () => {
    const ranked = [
      evaluation("2026-09-25T15:00:00.000Z", { executionCost: 900 }),
      evaluation("2026-09-25T15:01:00.000Z", { executionCost: 100 }),
    ];

    expect(competitionRanksForEvaluations(ranked)).toEqual([1, 2]);
  });

  test("uses submission time as the final Broken Agent tie breaker", () => {
    const ranked = [
      evaluation("2026-09-25T15:00:00.000Z"),
      evaluation("2026-09-25T15:01:00.000Z"),
    ];

    expect(competitionRanksForEvaluations(ranked)).toEqual([1, 2]);
  });

  test("keeps identical Black Box scores tied regardless of submission time", () => {
    const ranked = [
      evaluation("2026-09-25T15:00:00.000Z", {
        breakdown: undefined,
      }),
      evaluation("2026-09-25T15:01:00.000Z", {
        breakdown: undefined,
      }),
    ];

    expect(competitionRanksForEvaluations(ranked)).toEqual([1, 1]);
  });

  test("breaks Black Box ties by runtime", () => {
    const ranked = [
      evaluation("2026-09-25T15:01:00.000Z", {
        breakdown: undefined,
        runtimeMs: 70,
      }),
      evaluation("2026-09-25T15:00:00.000Z", {
        breakdown: undefined,
        runtimeMs: 50,
      }),
    ].sort(compareRankedChallengeEvaluations);

    expect(ranked.map((entry) => entry.score.runtimeMs)).toEqual([50, 70]);
    expect(competitionRanksForEvaluations(ranked)).toEqual([1, 2]);
  });
});
