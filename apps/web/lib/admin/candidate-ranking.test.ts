import { describe, expect, test } from "bun:test";

import { sortCandidatesByChallengeRanking } from "./candidate-ranking";

interface CandidateRecord {
  readonly id: string;
  readonly participantId: string;
  readonly createdAt: Date;
}

const candidate = (
  id: string,
  participantId: string,
  createdAt: string,
): CandidateRecord => ({ id, participantId, createdAt: new Date(createdAt) });

describe("candidate challenge ranking sort", () => {
  test("uses the public ranking order and puts unranked candidates last", () => {
    const records = [
      candidate("new-unranked", "participant-3", "2026-09-24T12:00:00Z"),
      candidate("second", "participant-2", "2026-09-23T12:00:00Z"),
      candidate("first", "participant-1", "2026-09-22T12:00:00Z"),
      candidate("old-unranked", "participant-4", "2026-09-21T12:00:00Z"),
    ];

    const sorted = sortCandidatesByChallengeRanking(records, [
      "participant-1",
      "participant-2",
    ]);

    expect(sorted.map((record) => record.id)).toEqual([
      "first",
      "second",
      "new-unranked",
      "old-unranked",
    ]);
  });

  test("does not mutate the query result", () => {
    const records = [
      candidate("second", "participant-2", "2026-09-23T12:00:00Z"),
      candidate("first", "participant-1", "2026-09-22T12:00:00Z"),
    ];

    sortCandidatesByChallengeRanking(records, [
      "participant-1",
      "participant-2",
    ]);

    expect(records.map((record) => record.id)).toEqual(["second", "first"]);
  });
});
