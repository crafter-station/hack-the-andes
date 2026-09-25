import type { db } from "@chofex/db";
import { sql } from "@chofex/db/orm";

import { currentChallengeVersionFor } from "../challenges/engine";

export type AdmissionPolicyDatabase = Pick<typeof db, "execute">;

const admissionPolicyDatabase = async (
  database: AdmissionPolicyDatabase | undefined,
): Promise<AdmissionPolicyDatabase> => {
  if (database) return database;
  return (await import("@chofex/db")).db;
};

export const participantHasLatestRankedChallengeResult = async (
  participantId: string,
  database?: AdmissionPolicyDatabase,
): Promise<boolean> => {
  const client = await admissionPolicyDatabase(database);
  const result = await client.execute<{
    readonly challenge_slug: string;
    readonly challenge_version: string;
  }>(sql`
    select "challenge_slug", "challenge_version"
    from "challenge_attempts"
    where
      "participant_id" = ${participantId}
      and "best_evaluation_id" is not null
  `);
  return result.rows.some((attempt) => {
    const latestVersion = currentChallengeVersionFor(attempt.challenge_slug);
    return attempt.challenge_version === latestVersion;
  });
};
