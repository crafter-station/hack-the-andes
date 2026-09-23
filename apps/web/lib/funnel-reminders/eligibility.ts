import type { FunnelReminderStage } from "./types";

export interface FunnelProgress {
  readonly applicationStatus?: string;
  readonly applicationSubmitted: boolean;
  readonly challengeStarted: boolean;
  readonly challengeCompleted: boolean;
  readonly challengeFinishAvailable: boolean;
}

const challengeCandidateStatuses = new Set([
  "submitted",
  "under_review",
  "waitlisted",
]);

export const needsFunnelReminder = (
  stage: FunnelReminderStage,
  progress: FunnelProgress,
): boolean => {
  if (stage === "registration") return !progress.applicationSubmitted;

  const isActiveCandidate =
    progress.applicationSubmitted &&
    Boolean(
      progress.applicationStatus &&
        challengeCandidateStatuses.has(progress.applicationStatus),
    );
  if (!isActiveCandidate) return false;

  if (stage === "challenge_start") return !progress.challengeStarted;
  return (
    progress.challengeStarted &&
    !progress.challengeCompleted &&
    progress.challengeFinishAvailable
  );
};
