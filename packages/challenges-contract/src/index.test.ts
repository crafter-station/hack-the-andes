import { describe, expect, test } from "bun:test";
import { Schema } from "effect";

import {
  challengeBySlug,
  challengeOpeningNotice,
  compareChallengeScores,
  formatChallengeOpeningInPeru,
  isChallengeOpenAt,
  isChallengeRankingVisibleAt,
  ParticipantChallengeMilestoneSchema,
  ParticipantChallengeProgressSchema,
  ShipmentSchema,
  scoreFromPredictions,
} from "./index.js";

describe("challenge catalog", () => {
  test("keeps Black Box playable and later challenges locked", () => {
    expect(challengeBySlug("last-mile")?.playable).toBe(false);
    expect(challengeBySlug("black-box")?.queryLimit).toBe(25);
    expect(challengeBySlug("black-box")?.evaluationLimit).toBe(3);
  });

  test("opens Black Box on 17 September 2026 at 09:00 UTC-5", () => {
    const challenge = challengeBySlug("black-box");
    if (!challenge) throw new Error("missing black-box");
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-17T13:59:59.999Z")),
    ).toBe(false);
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-17T14:00:00.000Z")),
    ).toBe(true);
    expect(formatChallengeOpeningInPeru(challenge.opensAt)).toBe(
      "September 17, 2026 at 09:00 (UTC-5)",
    );
    expect(challengeOpeningNotice(challenge.title, challenge.opensAt)).toBe(
      "The Shipping Machine opens September 17, 2026 at 09:00 (UTC-5). Queries and evaluations are disabled until then; no attempts will be consumed.",
    );
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-17T00:00:00.000Z"), true),
    ).toBe(true);
  });

  test("closes Black Box before Challenge 2 launches", () => {
    const challenge = challengeBySlug("black-box");
    if (!challenge) throw new Error("missing black-box");

    expect(challenge.closesAt).toBe("2026-09-24T17:20:00.000Z");
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-24T17:19:59.999Z")),
    ).toBe(true);
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-24T17:20:00.000Z")),
    ).toBe(false);
    expect(
      isChallengeOpenAt(challenge, new Date("2026-09-24T17:20:00.000Z"), true),
    ).toBe(true);
  });

  test("reveals the Black Box ranking on 23 September 2026 at 15:00 UTC-5", () => {
    const challenge = challengeBySlug("black-box");
    if (!challenge) throw new Error("missing black-box");

    expect(challenge.rankingVisibleAt).toBe("2026-09-23T20:00:00.000Z");
    expect(
      isChallengeRankingVisibleAt(
        challenge,
        new Date("2026-09-23T19:59:59.999Z"),
      ),
    ).toBe(false);
    expect(
      isChallengeRankingVisibleAt(
        challenge,
        new Date("2026-09-23T20:00:00.000Z"),
      ),
    ).toBe(true);
  });
});

describe("participant challenge progress", () => {
  test("carries the elapsed time to the first completed evaluation", () => {
    const progress = Schema.decodeUnknownSync(
      ParticipantChallengeProgressSchema,
    )({
      slug: "black-box",
      title: "The Shipping Machine",
      theme: "Black Box",
      status: "evaluated",
      open: true,
      playable: true,
      queriesUsed: 10,
      queriesLimit: 25,
      evaluationsUsed: 1,
      evaluationsLimit: 3,
      bestAccuracy: 0.98,
      completionDurationMs: 5_400_000,
    });

    expect(progress.completionDurationMs).toBe(5_400_000);
  });

  test("carries historical challenge milestone timestamps", () => {
    const milestone = Schema.decodeUnknownSync(
      ParticipantChallengeMilestoneSchema,
    )({
      attemptId: "attempt-1",
      slug: "retired-challenge",
      title: "Retired challenge",
      startedAt: "2026-09-03T09:00:00.000Z",
      completedAt: "2026-09-03T10:00:00.000Z",
    });

    expect(milestone.slug).toBe("retired-challenge");
    expect(milestone.completedAt).toBe("2026-09-03T10:00:00.000Z");
  });
});

describe("challenge scoring", () => {
  test("treats exact matches as full accuracy and uses query count as a tie breaker", () => {
    const perfect = scoreFromPredictions([10, 20, 30], [10, 20, 30], 12, 8);
    const close = scoreFromPredictions([10, 20, 30], [10, 20, 35], 4, 1);
    expect(perfect.accuracy).toBe(1);
    expect(perfect.exactCount).toBe(3);
    expect(close.accuracy).toBeCloseTo(2 / 3);
    expect(close.meanError).toBeCloseTo(5 / 3);
    expect(compareChallengeScores(perfect, close)).toBeLessThan(0);

    const fewerQueries = { ...perfect, queriesUsed: 8 };
    expect(compareChallengeScores(fewerQueries, perfect)).toBeLessThan(0);
  });

  test("does not use runtime to break otherwise identical scores", () => {
    const score = scoreFromPredictions([10, 20], [10, 20], 8, 1);
    expect(compareChallengeScores(score, { ...score, runtimeMs: 10_000 })).toBe(
      0,
    );
  });
});

describe("challenge inputs", () => {
  test("accepts only whole distance and weight values", () => {
    const decode = Schema.decodeUnknownSync(ShipmentSchema);
    const base = {
      distanceKm: 10,
      weightKg: 3,
      hour: 14,
      fragile: false,
      express: false,
    };

    expect(decode(base)).toEqual(base);
    expect(() => decode({ ...base, distanceKm: 10.5 })).toThrow();
    expect(() => decode({ ...base, weightKg: 3.5 })).toThrow();
  });
});
