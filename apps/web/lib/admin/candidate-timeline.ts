import type { Candidate } from "./types";

export interface CandidateTimelineEvent {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly at: string;
}

type CandidateTimelineSource = Pick<
  Candidate,
  | "signedUpAt"
  | "applicationHistory"
  | "challengeHistory"
  | "attendanceCompletedAt"
  | "checkedInAt"
>;

export const candidateTimeline = (
  candidate: CandidateTimelineSource,
): ReadonlyArray<CandidateTimelineEvent> => {
  const events: Array<CandidateTimelineEvent> = [
    {
      id: "signed-up",
      title: "Signed up",
      at: candidate.signedUpAt,
    },
  ];

  for (const application of candidate.applicationHistory) {
    events.push({
      id: `${application.applicationId}-started`,
      title: "Registration started",
      description: `Attempt ${application.attemptNumber}`,
      at: application.startedAt,
    });
    if (application.submittedAt) {
      events.push({
        id: `${application.applicationId}-submitted`,
        title: "Registration submitted",
        description: `Attempt ${application.attemptNumber}`,
        at: application.submittedAt,
      });
    }
    if (application.decidedAt) {
      const approved = application.status === "accepted";
      events.push({
        id: `${application.applicationId}-${application.status}`,
        title: approved ? "Application approved" : "Application declined",
        description: `Attempt ${application.attemptNumber}`,
        at: application.decidedAt,
      });
    }
    if (application.withdrawnAt) {
      events.push({
        id: `${application.applicationId}-withdrawn`,
        title: "Application withdrawn",
        description: `Attempt ${application.attemptNumber}`,
        at: application.withdrawnAt,
      });
    }
  }

  for (const challenge of candidate.challengeHistory) {
    if (challenge.startedAt) {
      events.push({
        id: `${challenge.attemptId}-started`,
        title: "Challenge started",
        description: challenge.title,
        at: challenge.startedAt,
      });
    }
    if (challenge.completedAt) {
      events.push({
        id: `${challenge.attemptId}-completed`,
        title: "Challenge completed",
        description: challenge.title,
        at: challenge.completedAt,
      });
    }
  }

  if (candidate.attendanceCompletedAt) {
    events.push({
      id: "attendance-completed",
      title: "Attendance details completed",
      at: candidate.attendanceCompletedAt,
    });
  }
  if (candidate.checkedInAt) {
    events.push({
      id: "checked-in",
      title: "Checked in",
      at: candidate.checkedInAt,
    });
  }

  events.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  return events;
};

export const candidateLastUpdatedAt = (
  candidate: CandidateTimelineSource,
): string | undefined => {
  const timeline = candidateTimeline(candidate);
  return timeline[timeline.length - 1]?.at;
};
