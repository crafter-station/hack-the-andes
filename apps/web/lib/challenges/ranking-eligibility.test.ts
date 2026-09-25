import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { currentChallengeVersionFor } from "./engine";
import type { RankingDatabase } from "./ranking";

mock.module("server-only", () => ({}));
const { rankedEvaluationsFor } = await import("./ranking");

describe("challenge ranking eligibility", () => {
  let client: PGlite;
  let database: RankingDatabase;

  beforeEach(async () => {
    client = new PGlite();
    await client.exec(`
      create table applications (
        id uuid primary key,
        participant_id uuid not null,
        status text not null,
        github_url text,
        linkedin_url text,
        created_at timestamptz not null
      );
      create table participants (
        id uuid primary key,
        created_at timestamptz not null
      );
      create table challenge_attempts (
        id uuid primary key,
        participant_id uuid not null,
        challenge_slug varchar(64) not null,
        challenge_version varchar(64) not null,
        share_code varchar(8) not null,
        evaluations_used integer not null,
        best_evaluation_id uuid
      );
      create table challenge_evaluations (
        id uuid primary key,
        attempt_id uuid not null,
        solution_kind varchar(32) not null,
        solution jsonb not null,
        accuracy double precision not null,
        exact_count integer not null,
        sample_size integer not null,
        mean_error double precision not null,
        queries_used integer not null,
        runtime_ms integer not null,
        execution_cost integer,
        created_at timestamptz not null,
        updated_at timestamptz not null
      );
    `);
    database = drizzle(client) as unknown as RankingDatabase;
  });

  afterEach(async () => {
    await client.close();
  });

  test("ranks every submitted account once and excludes drafts and withdrawals", async () => {
    const scores = [0.437, 0.8, 0.7, 0.6, 1, 0.5, 0.51, 0.65, 0.95];
    const participantIds = Array.from(
      { length: scores.length },
      (_, index) =>
        `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    );
    const attemptIds = Array.from(
      { length: scores.length },
      (_, index) =>
        `10000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    );
    const evaluationIds = Array.from(
      { length: scores.length },
      (_, index) =>
        `20000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    );
    const version = currentChallengeVersionFor("black-box");
    if (!version) throw new Error("Black Box version is required");

    for (const [index, participantId] of participantIds.entries()) {
      await client.query(
        `insert into participants (id, created_at)
         values ($1, $2)`,
        [
          participantId,
          `2026-09-${String(index + 10).padStart(2, "0")}T12:00:00Z`,
        ],
      );
    }

    for (const [index, participantId] of participantIds.entries()) {
      await client.query(
        `insert into challenge_attempts (
          id, participant_id, challenge_slug, challenge_version, share_code,
          evaluations_used, best_evaluation_id
        ) values ($1, $2, 'black-box', $3, $4, 1, $5)`,
        [
          attemptIds[index],
          participantId,
          version,
          `CODE${index}`,
          evaluationIds[index],
        ],
      );
      await client.query(
        `insert into challenge_evaluations (
          id, attempt_id, solution_kind, solution, accuracy, exact_count,
          sample_size, mean_error, queries_used, runtime_ms, created_at,
          updated_at
        ) values ($1, $2, 'javascript_source', '{}', $3, $4, 1000, 0, 25, 50, now(), now())`,
        [
          evaluationIds[index],
          attemptIds[index],
          scores[index],
          Math.round((scores[index] ?? 0) * 1_000),
        ],
      );
    }

    await client.query(
      `insert into applications (
        id, participant_id, status, github_url, linkedin_url, created_at
      ) values
        (gen_random_uuid(), $1, 'submitted', null, 'https://www.linkedin.com/in/same-person/?trk=first', '2026-09-18T12:00:00Z'),
        (gen_random_uuid(), $2, 'submitted', null, null, '2026-09-18T12:00:00Z'),
        (gen_random_uuid(), $2, 'withdrawn', null, null, '2026-09-19T12:00:00Z'),
        (gen_random_uuid(), $2, 'draft', null, null, '2026-09-24T12:00:00Z'),
        (gen_random_uuid(), $3, 'rejected', null, null, '2026-09-18T12:00:00Z'),
        (gen_random_uuid(), $3, 'draft', null, null, '2026-09-24T12:00:00Z'),
        (gen_random_uuid(), $4, 'submitted', null, 'https://pe.linkedin.com/in/SAME-PERSON', '2026-09-22T12:00:00Z'),
        (gen_random_uuid(), $5, 'submitted', null, null, '2026-09-18T12:00:00Z'),
        (gen_random_uuid(), $6, 'submitted', null, null, '2026-09-18T12:00:00Z'),
        (gen_random_uuid(), $7, 'submitted', 'https://github.com/shared-github', null, '2026-09-18T12:00:00Z'),
        (gen_random_uuid(), $8, 'submitted', 'https://www.github.com/SHARED-GITHUB/?tab=repositories', null, '2026-09-18T12:00:00Z'),
        (gen_random_uuid(), $9, 'draft', null, null, '2026-09-18T12:00:00Z')`,
      [
        participantIds[0],
        participantIds[1],
        participantIds[2],
        participantIds[4],
        participantIds[5],
        participantIds[6],
        participantIds[7],
        participantIds[8],
        participantIds[3],
      ],
    );

    const ranked = await rankedEvaluationsFor("black-box", database);
    const rejectedParticipantId = participantIds[2];
    const middleScoreParticipantId = participantIds[6];
    const firstGitHubParticipantId = participantIds[7];
    const fiftyPercentParticipantId = participantIds[5];
    const belowFiftyPercentParticipantId = participantIds[0];
    if (
      !rejectedParticipantId ||
      !middleScoreParticipantId ||
      !firstGitHubParticipantId ||
      !fiftyPercentParticipantId ||
      !belowFiftyPercentParticipantId
    ) {
      throw new Error("Ranking fixtures are required");
    }

    expect(ranked.map((entry) => entry.participantId)).toEqual([
      rejectedParticipantId,
      firstGitHubParticipantId,
      middleScoreParticipantId,
      fiftyPercentParticipantId,
      belowFiftyPercentParticipantId,
    ]);
  });
});
