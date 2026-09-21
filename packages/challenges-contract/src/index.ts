import { Schema } from "effect";

export const blackBoxChallengeSlug = "black-box" as const;

export type ChallengeSlug =
  | typeof blackBoxChallengeSlug
  | "last-mile"
  | "make-it-fast"
  | "power-grid"
  | "agent-arena";

export type ChallengeFormat =
  | "accuracy"
  | "optimization"
  | "runtime"
  | "multi_objective";

export interface ChallengeDefinition {
  readonly slug: ChallengeSlug;
  readonly number: number;
  readonly code: string;
  readonly theme: string;
  readonly title: string;
  readonly summary: string;
  readonly coreSkill: string;
  readonly format: ChallengeFormat;
  readonly formatLabel: string;
  readonly opensAt: string;
  readonly rankingVisibleAt?: string;
  readonly queryLimit: number;
  readonly evaluationLimit: number;
  readonly hiddenSampleSize: number;
  readonly playable: boolean;
  readonly solutionKind: "javascript_source" | "json_plan" | "agent_config";
}

export const challengeCatalog: ReadonlyArray<ChallengeDefinition> = [
  {
    slug: blackBoxChallengeSlug,
    number: 1,
    code: "01",
    theme: "Black Box",
    title: "The Shipping Machine",
    summary:
      "Reverse-engineer an undocumented delivery-price service with a limited number of queries, then implement a compatible replacement.",
    coreSkill: "Reverse engineering & experimentation",
    format: "accuracy",
    formatLabel: "Accuracy score",
    opensAt: "2026-09-17T14:00:00.000Z",
    rankingVisibleAt: "2026-09-23T20:00:00.000Z",
    queryLimit: 25,
    evaluationLimit: 3,
    hiddenSampleSize: 1000,
    playable: true,
    solutionKind: "javascript_source",
  },
  {
    slug: "last-mile",
    number: 2,
    code: "02",
    theme: "Last Mile",
    title: "The Delivery Plan",
    summary:
      "Build a delivery plan under capacity, traffic, and deadline constraints. Better heuristics score higher.",
    coreSkill: "Optimization & heuristics",
    format: "optimization",
    formatLabel: "Optimization score",
    opensAt: "2026-09-25T05:00:00.000Z",
    queryLimit: 0,
    evaluationLimit: 3,
    hiddenSampleSize: 1,
    playable: false,
    solutionKind: "json_plan",
  },
  {
    slug: "make-it-fast",
    number: 3,
    code: "03",
    theme: "Make It Fast",
    title: "The Slow Service",
    summary:
      "Produce exactly the same result as a correct but inefficient implementation, ranked by runtime.",
    coreSkill: "Performance engineering",
    format: "runtime",
    formatLabel: "Runtime score",
    opensAt: "2026-10-02T05:00:00.000Z",
    queryLimit: 0,
    evaluationLimit: 3,
    hiddenSampleSize: 1,
    playable: false,
    solutionKind: "javascript_source",
  },
  {
    slug: "power-grid",
    number: 4,
    code: "04",
    theme: "Power Grid",
    title: "The Dispatch Desk",
    summary:
      "Keep a simplified energy grid stable while minimizing cost and blackouts under uncertainty.",
    coreSkill: "Simulation & decision making",
    format: "multi_objective",
    formatLabel: "Multi-objective score",
    opensAt: "2026-10-09T05:00:00.000Z",
    queryLimit: 0,
    evaluationLimit: 3,
    hiddenSampleSize: 1,
    playable: false,
    solutionKind: "javascript_source",
  },
  {
    slug: "agent-arena",
    number: 5,
    code: "05",
    theme: "Agent Arena",
    title: "The Tool-Using Agent",
    summary:
      "Configure an agent that balances accuracy, tool calls, model cost, and latency.",
    coreSkill: "AI engineering & system design",
    format: "multi_objective",
    formatLabel: "Accuracy + cost + latency",
    opensAt: "2026-10-13T05:00:00.000Z",
    queryLimit: 0,
    evaluationLimit: 3,
    hiddenSampleSize: 1,
    playable: false,
    solutionKind: "agent_config",
  },
];

export const playableChallenges = challengeCatalog.filter(
  (challenge) => challenge.playable,
);

export const challengeBySlug = (
  slug: string,
): ChallengeDefinition | undefined =>
  challengeCatalog.find((challenge) => challenge.slug === slug);

export const isChallengeOpenAt = (
  challenge: ChallengeDefinition,
  now: Date,
  forceOpen = false,
): boolean => {
  if (forceOpen && challenge.playable) return true;
  return now.getTime() >= Date.parse(challenge.opensAt);
};

export const isChallengeRankingVisibleAt = (
  challenge: { readonly rankingVisibleAt?: string },
  now: Date,
): boolean => {
  if (!challenge.rankingVisibleAt) return true;
  return now.getTime() >= Date.parse(challenge.rankingVisibleAt);
};

const challengeTimeZoneOffsetMs = 5 * 60 * 60 * 1_000;
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const formatChallengeOpeningInPeru = (opensAt: string): string => {
  const localTime = new Date(Date.parse(opensAt) - challengeTimeZoneOffsetMs);
  const month = monthNames[localTime.getUTCMonth()];
  if (!month || Number.isNaN(localTime.getTime())) {
    throw new Error("Challenge opening time is invalid");
  }
  const day = localTime.getUTCDate();
  const year = localTime.getUTCFullYear();
  const hour = String(localTime.getUTCHours()).padStart(2, "0");
  const minute = String(localTime.getUTCMinutes()).padStart(2, "0");
  return `${month} ${day}, ${year} at ${hour}:${minute} (UTC-5)`;
};

export const challengeOpeningNotice = (
  title: string,
  opensAt: string,
): string =>
  `${title} opens ${formatChallengeOpeningInPeru(opensAt)}. Queries and evaluations are disabled until then; no attempts will be consumed.`;

export const ChallengeSlugSchema = Schema.Literals([
  "black-box",
  "last-mile",
  "make-it-fast",
  "power-grid",
  "agent-arena",
]);

export const ShipmentSchema = Schema.Struct({
  distanceKm: Schema.Int.pipe(
    Schema.check(Schema.isBetween({ minimum: 1, maximum: 2_000 })),
  ),
  weightKg: Schema.Int.pipe(
    Schema.check(Schema.isBetween({ minimum: 1, maximum: 500 })),
  ),
  hour: Schema.Int.pipe(
    Schema.check(Schema.isBetween({ minimum: 0, maximum: 23 })),
  ),
  fragile: Schema.Boolean,
  express: Schema.Boolean,
});

export type Shipment = typeof ShipmentSchema.Type;

export const JavascriptSourceSolutionSchema = Schema.Struct({
  kind: Schema.Literal("javascript_source"),
  source: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(32_768)),
  ),
});

export type JavascriptSourceSolution =
  typeof JavascriptSourceSolutionSchema.Type;

export const ChallengeSolutionSchema = JavascriptSourceSolutionSchema;

export type ChallengeSolution = typeof ChallengeSolutionSchema.Type;

export const ChallengeObservationSchema = Schema.Struct({
  sequence: Schema.Number,
  input: Schema.Unknown,
  output: Schema.Unknown,
  createdAt: Schema.String,
});

export type ChallengeObservation = typeof ChallengeObservationSchema.Type;

export const ChallengeScoreSchema = Schema.Struct({
  accuracy: Schema.Number,
  exactCount: Schema.Number,
  sampleSize: Schema.Number,
  meanError: Schema.Number,
  queriesUsed: Schema.Number,
  runtimeMs: Schema.Number,
});

export type ChallengeScore = typeof ChallengeScoreSchema.Type;

export const ChallengeProgressStatus = Schema.Literals([
  "not_started",
  "in_progress",
  "evaluated",
]);

export const ParticipantChallengeProgressSchema = Schema.Struct({
  slug: ChallengeSlugSchema,
  title: Schema.String,
  theme: Schema.String,
  status: ChallengeProgressStatus,
  open: Schema.Boolean,
  playable: Schema.Boolean,
  queriesUsed: Schema.Number,
  queriesLimit: Schema.Number,
  evaluationsUsed: Schema.Number,
  evaluationsLimit: Schema.Number,
  bestAccuracy: Schema.optional(Schema.Number),
  bestExactCount: Schema.optional(Schema.Number),
  completionDurationMs: Schema.optional(Schema.Number),
  shareCode: Schema.optional(Schema.String),
  rank: Schema.optional(Schema.Number),
});

export type ParticipantChallengeProgress =
  typeof ParticipantChallengeProgressSchema.Type;

export const ParticipantChallengeMilestoneSchema = Schema.Struct({
  attemptId: Schema.String,
  slug: Schema.String,
  title: Schema.String,
  startedAt: Schema.String,
  completedAt: Schema.optional(Schema.String),
});

export type ParticipantChallengeMilestone =
  typeof ParticipantChallengeMilestoneSchema.Type;

export const ChallengeCatalogItemSchema = Schema.Struct({
  slug: ChallengeSlugSchema,
  number: Schema.Number,
  code: Schema.String,
  theme: Schema.String,
  title: Schema.String,
  summary: Schema.String,
  coreSkill: Schema.String,
  format: Schema.Literals([
    "accuracy",
    "optimization",
    "runtime",
    "multi_objective",
  ]),
  formatLabel: Schema.String,
  opensAt: Schema.String,
  rankingVisibleAt: Schema.optional(Schema.String),
  queryLimit: Schema.Number,
  evaluationLimit: Schema.Number,
  playable: Schema.Boolean,
  open: Schema.Boolean,
  rankingPath: Schema.String,
});

export type ChallengeCatalogItem = typeof ChallengeCatalogItemSchema.Type;

const ChallengeEvaluationSummarySchema = Schema.Struct({
  accuracy: Schema.Number,
  exactCount: Schema.Number,
  sampleSize: Schema.Number,
  meanError: Schema.Number,
  queriesUsed: Schema.Number,
  runtimeMs: Schema.Number,
  shareCode: Schema.String,
  rank: Schema.optional(Schema.Number),
  percentile: Schema.optional(Schema.Number),
  createdAt: Schema.String,
});

export const ChallengeAttemptViewSchema = Schema.Struct({
  challenge: ChallengeCatalogItemSchema,
  progress: ParticipantChallengeProgressSchema,
  observations: Schema.Array(ChallengeObservationSchema),
  latestEvaluation: Schema.optional(ChallengeEvaluationSummarySchema),
  aiAllowed: Schema.Literal(true),
  localTestHint: Schema.String,
});

export type ChallengeAttemptView = typeof ChallengeAttemptViewSchema.Type;

export const ChallengeQueryResultSchema = Schema.Struct({
  observation: ChallengeObservationSchema,
  queriesUsed: Schema.Number,
  queriesRemaining: Schema.Number,
  queriesLimit: Schema.Number,
});

export type ChallengeQueryResult = typeof ChallengeQueryResultSchema.Type;

export const ChallengeLocalTestResultSchema = Schema.Struct({
  matchedObservations: Schema.Number,
  observationCount: Schema.Number,
  accuracy: Schema.Number,
  meanError: Schema.Number,
  mismatches: Schema.Array(
    Schema.Struct({
      sequence: Schema.Number,
      expected: Schema.Unknown,
      actual: Schema.Unknown,
    }),
  ),
});

export type ChallengeLocalTestResult =
  typeof ChallengeLocalTestResultSchema.Type;

export const ChallengeEvaluationResultSchema = Schema.Struct({
  accuracy: Schema.Number,
  exactCount: Schema.Number,
  sampleSize: Schema.Number,
  meanError: Schema.Number,
  queriesUsed: Schema.Number,
  runtimeMs: Schema.Number,
  shareCode: Schema.String,
  rank: Schema.optional(Schema.Number),
  competitorCount: Schema.optional(Schema.Number),
  percentile: Schema.optional(Schema.Number),
  evaluationsUsed: Schema.Number,
  evaluationsRemaining: Schema.Number,
  evaluationsLimit: Schema.Number,
  rankingPath: Schema.String,
  shareText: Schema.String,
});

export type ChallengeEvaluationResult =
  typeof ChallengeEvaluationResultSchema.Type;

export const ChallengeRankingEntrySchema = Schema.Struct({
  rank: Schema.Number,
  displayName: Schema.String,
  shareCode: Schema.String,
  accuracy: Schema.Number,
  exactCount: Schema.Number,
  sampleSize: Schema.Number,
  meanError: Schema.Number,
  queriesUsed: Schema.Number,
  runtimeMs: Schema.Number,
  evaluatedAt: Schema.String,
});

export type ChallengeRankingEntry = typeof ChallengeRankingEntrySchema.Type;

export const ChallengeRankingSchema = Schema.Struct({
  challenge: ChallengeCatalogItemSchema,
  entries: Schema.Array(ChallengeRankingEntrySchema),
  competitorCount: Schema.Number,
});

export type ChallengeRanking = typeof ChallengeRankingSchema.Type;

export const ChallengeCatalogSchema = Schema.Struct({
  challenges: Schema.Array(ChallengeCatalogItemSchema),
});

export type ChallengeCatalogResponse = typeof ChallengeCatalogSchema.Type;

export const scoreFromPredictions = (
  expected: ReadonlyArray<number>,
  actual: ReadonlyArray<number>,
  queriesUsed: number,
  runtimeMs: number,
): ChallengeScore => {
  if (expected.length === 0) {
    return {
      accuracy: 0,
      exactCount: 0,
      sampleSize: 0,
      meanError: 0,
      queriesUsed,
      runtimeMs,
    };
  }
  if (expected.length !== actual.length) {
    throw new Error("Prediction count must match the hidden sample size");
  }

  let exactCount = 0;
  let absoluteError = 0;
  for (const [index, expectedValue] of expected.entries()) {
    const actualValue = actual[index];
    if (actualValue === undefined) {
      throw new Error("Prediction count must match the hidden sample size");
    }
    if (expectedValue === actualValue) exactCount += 1;
    absoluteError += Math.abs(expectedValue - actualValue);
  }

  return {
    accuracy: exactCount / expected.length,
    exactCount,
    sampleSize: expected.length,
    meanError: absoluteError / expected.length,
    queriesUsed,
    runtimeMs,
  };
};

export const compareChallengeScores = (
  left: ChallengeScore,
  right: ChallengeScore,
): number => {
  if (left.accuracy !== right.accuracy) return right.accuracy - left.accuracy;
  if (left.exactCount !== right.exactCount) {
    return right.exactCount - left.exactCount;
  }
  if (left.queriesUsed !== right.queriesUsed) {
    return left.queriesUsed - right.queriesUsed;
  }
  return 0;
};
