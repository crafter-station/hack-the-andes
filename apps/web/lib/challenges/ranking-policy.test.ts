import { describe, expect, test } from "bun:test";
import type { ChallengeScore } from "@chofex/challenges-contract";
import { competitionRanks, publicRankingEntries } from "./ranking-policy";

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
});
