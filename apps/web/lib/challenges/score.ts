import type {
  ChallengeScore,
  ChallengeScoreBreakdown,
} from "@chofex/challenges-contract";

export interface StoredChallengeScore {
  readonly accuracy: number;
  readonly exactCount: number;
  readonly sampleSize: number;
  readonly meanError: number;
  readonly queriesUsed: number;
  readonly runtimeMs: number;
  readonly solution?: unknown;
}

const scoreBreakdownFrom = (
  solution: unknown,
): ChallengeScoreBreakdown | undefined => {
  if (!solution || typeof solution !== "object" || Array.isArray(solution)) {
    return;
  }
  const breakdown = (solution as Record<string, unknown>).scoreBreakdown;
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) {
    return;
  }
  return breakdown as ChallengeScoreBreakdown;
};

export const scoreFromStored = (
  score: StoredChallengeScore,
): ChallengeScore => {
  const stored = {
    accuracy: score.accuracy,
    exactCount: score.exactCount,
    sampleSize: score.sampleSize,
    meanError: score.meanError,
    queriesUsed: score.queriesUsed,
    runtimeMs: score.runtimeMs,
  };
  const breakdown = scoreBreakdownFrom(score.solution);
  if (breakdown) return { ...stored, breakdown };
  return stored;
};
