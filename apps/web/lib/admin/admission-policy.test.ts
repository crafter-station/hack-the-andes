import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { currentChallengeVersionFor } from "../challenges/engine";
import {
  type AdmissionPolicyDatabase,
  participantHasLatestRankedChallengeResult,
} from "./admission-policy";

describe("challenge admission policy", () => {
  let client: PGlite;
  let database: AdmissionPolicyDatabase;
  let participantId: string;

  beforeEach(async () => {
    client = new PGlite();
    await client.exec(`
      create table challenge_attempts (
        id uuid primary key,
        participant_id uuid not null,
        challenge_slug varchar(64) not null,
        challenge_version varchar(64) not null,
        best_evaluation_id uuid
      );
    `);
    participantId = crypto.randomUUID();
    database = drizzle(client) as unknown as AdmissionPolicyDatabase;
  });

  afterEach(async () => {
    await client.close();
  });

  test("requires a persisted ranked result before acceptance", async () => {
    const latestVersion = currentChallengeVersionFor("broken-agent");
    if (!latestVersion) throw new Error("Broken Agent version is required");
    await client.query(
      `insert into challenge_attempts (
        id, participant_id, challenge_slug, challenge_version
      ) values ($1, $2, 'broken-agent', $3)`,
      [crypto.randomUUID(), participantId, latestVersion],
    );

    expect(
      await participantHasLatestRankedChallengeResult(participantId, database),
    ).toBe(false);

    await client.query(
      "update challenge_attempts set best_evaluation_id = $1 where participant_id = $2",
      [crypto.randomUUID(), participantId],
    );
    expect(
      await participantHasLatestRankedChallengeResult(participantId, database),
    ).toBe(true);
  });

  test("does not accept another participant's result", async () => {
    const latestVersion = currentChallengeVersionFor("broken-agent");
    if (!latestVersion) throw new Error("Broken Agent version is required");
    await client.query(
      `insert into challenge_attempts (
        id, participant_id, challenge_slug, challenge_version,
        best_evaluation_id
      ) values ($1, $2, 'broken-agent', $3, $4)`,
      [
        crypto.randomUUID(),
        crypto.randomUUID(),
        latestVersion,
        crypto.randomUUID(),
      ],
    );

    expect(
      await participantHasLatestRankedChallengeResult(participantId, database),
    ).toBe(false);
  });

  test("does not accept a ranked result from a legacy challenge version", async () => {
    await client.query(
      `insert into challenge_attempts (
        id, participant_id, challenge_slug, challenge_version,
        best_evaluation_id
      ) values ($1, $2, 'broken-agent', 'broken-agent-v1', $3)`,
      [crypto.randomUUID(), participantId, crypto.randomUUID()],
    );

    expect(
      await participantHasLatestRankedChallengeResult(participantId, database),
    ).toBe(false);
  });
});
