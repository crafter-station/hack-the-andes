import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { auditTimestamps } from "./common";
import { participants } from "./participants";

export const challengeAttempts = pgTable(
  "challenge_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    challengeSlug: varchar("challenge_slug", { length: 64 }).notNull(),
    challengeVersion: varchar("challenge_version", { length: 64 })
      .default("black-box-v1")
      .notNull(),
    shareCode: varchar("share_code", { length: 8 }).notNull(),
    queriesUsed: integer("queries_used").default(0).notNull(),
    querySequence: integer("query_sequence").default(0).notNull(),
    queriesPending: integer("queries_pending").default(0).notNull(),
    queriesLimit: integer("queries_limit").notNull(),
    evaluationsUsed: integer("evaluations_used").default(0).notNull(),
    evaluationsPending: integer("evaluations_pending").default(0).notNull(),
    evaluationsLimit: integer("evaluations_limit").notNull(),
    bestEvaluationId: uuid("best_evaluation_id"),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("challenge_attempts_participant_slug_version_unique").on(
      table.participantId,
      table.challengeSlug,
      table.challengeVersion,
    ),
    uniqueIndex("challenge_attempts_share_code_unique").on(table.shareCode),
    index("challenge_attempts_slug_index").on(table.challengeSlug),
  ],
);

export const challengeReservations = pgTable(
  "challenge_reservations",
  {
    id: uuid("id").primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => challengeAttempts.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 16 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...auditTimestamps(),
  },
  (table) => [
    index("challenge_reservations_attempt_expiry_index").on(
      table.attemptId,
      table.expiresAt,
    ),
  ],
);

export const participantPasskeys = pgTable(
  "participant_passkeys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    counter: bigint("counter", { mode: "number" }).default(0).notNull(),
    transports: jsonb("transports").$type<string[]>().default([]).notNull(),
    deviceType: varchar("device_type", { length: 16 }).notNull(),
    backedUp: boolean("backed_up").default(false).notNull(),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("participant_passkeys_credential_id_unique").on(
      table.credentialId,
    ),
    index("participant_passkeys_participant_id_index").on(table.participantId),
  ],
);

export const challengeEvaluationApprovals = pgTable(
  "challenge_evaluation_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => challengeAttempts.id, { onDelete: "cascade" }),
    sourceDigest: varchar("source_digest", { length: 64 }).notNull(),
    reviewDigest: varchar("review_digest", { length: 64 }).notNull(),
    review: jsonb("review").notNull(),
    ceremonyChallenge: text("ceremony_challenge"),
    ceremonyKind: varchar("ceremony_kind", { length: 16 }),
    webauthnOrigin: text("webauthn_origin"),
    relyingPartyId: varchar("relying_party_id", { length: 255 }),
    credentialId: text("credential_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("challenge_evaluation_approvals_active_unique")
      .on(table.attemptId, table.sourceDigest, table.reviewDigest)
      .where(sql`${table.consumedAt} is null`),
    index("challenge_evaluation_approvals_attempt_index").on(
      table.attemptId,
      table.expiresAt,
    ),
  ],
);

export const challengeObservations = pgTable(
  "challenge_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => challengeAttempts.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    input: jsonb("input").notNull(),
    output: jsonb("output").notNull(),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("challenge_observations_attempt_sequence_unique").on(
      table.attemptId,
      table.sequence,
    ),
    uniqueIndex("challenge_observations_attempt_input_unique").on(
      table.attemptId,
      table.input,
    ),
    index("challenge_observations_attempt_id_index").on(table.attemptId),
  ],
);

export const challengeEvaluations = pgTable(
  "challenge_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => challengeAttempts.id, { onDelete: "cascade" }),
    solutionKind: varchar("solution_kind", { length: 32 }).notNull(),
    solution: jsonb("solution").notNull(),
    accuracy: doublePrecision("accuracy").notNull(),
    exactCount: integer("exact_count").notNull(),
    sampleSize: integer("sample_size").notNull(),
    meanError: doublePrecision("mean_error").notNull(),
    queriesUsed: integer("queries_used").notNull(),
    runtimeMs: integer("runtime_ms").notNull(),
    executionCost: integer("execution_cost"),
    ...auditTimestamps(),
  },
  (table) => [
    index("challenge_evaluations_attempt_id_index").on(table.attemptId),
    index("challenge_evaluations_ranking_index").on(
      table.attemptId,
      table.accuracy,
      table.exactCount,
      table.queriesUsed,
    ),
  ],
);

export const challengeBestEvaluations = pgTable("challenge_best_evaluations", {
  attemptId: uuid("attempt_id")
    .primaryKey()
    .references(() => challengeAttempts.id, { onDelete: "cascade" }),
  evaluationId: uuid("evaluation_id")
    .notNull()
    .references(() => challengeEvaluations.id, { onDelete: "cascade" }),
  accuracy: doublePrecision("accuracy").notNull(),
  exactCount: integer("exact_count").notNull(),
  queriesUsed: integer("queries_used").notNull(),
  runtimeMs: integer("runtime_ms").notNull(),
  executionCost: integer("execution_cost"),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull(),
  ...auditTimestamps(),
});

export type ChallengeAttempt = typeof challengeAttempts.$inferSelect;
export type ChallengeReservation = typeof challengeReservations.$inferSelect;
export type ParticipantPasskey = typeof participantPasskeys.$inferSelect;
export type ChallengeEvaluationApproval =
  typeof challengeEvaluationApprovals.$inferSelect;
export type ChallengeObservation = typeof challengeObservations.$inferSelect;
export type ChallengeEvaluation = typeof challengeEvaluations.$inferSelect;
export type ChallengeBestEvaluation =
  typeof challengeBestEvaluations.$inferSelect;
