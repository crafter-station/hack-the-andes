import { describe, expect, test } from "bun:test";
import type { ChallengeScore } from "@chofex/challenges-contract";
import {
  competitionRanks,
  competitionRanksBy,
  publicRankingEntries,
} from "./ranking-policy";

const score = (overrides: Partial<ChallengeScore> = {}): ChallengeScore => ({
  accuracy: 0.9,
  exactCount: 900,
  sampleSize: 1_000,
  meanError: 0.1,
  queriesUsed: 10,
  runtimeMs: 20,
  ...overrides,
});

describe("challenge ranking policy", () => {
  test("gives otherwise identical scores the same rank despite runtime", () => {
    expect(
      competitionRanks([
        score({ runtimeMs: 1_000 }),
        score(),
        score({ accuracy: 0.8, exactCount: 800 }),
      ]),
    ).toEqual([1, 1, 3]);
  });

  test("shows only the first 17 ranked entries", () => {
    const ranked = Array.from({ length: 20 }, (_, index) => ({
      position: index + 1,
    }));

    expect(publicRankingEntries(ranked)).toEqual(ranked.slice(0, 17));
  });

  test("supports final tie breakers that produce distinct ranks", () => {
    const entries = [
      { score: 100, submittedAt: 1 },
      { score: 100, submittedAt: 2 },
      { score: 90, submittedAt: 3 },
    ];

    expect(
      competitionRanksBy(entries, (left, right) => {
        if (left.score !== right.score) return right.score - left.score;
        return left.submittedAt - right.submittedAt;
      }),
    ).toEqual([1, 2, 3]);
  });
});
