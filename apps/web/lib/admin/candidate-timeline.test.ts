import { expect, test } from "bun:test";

import { candidateTimeline } from "./candidate-timeline";

test("builds a chronological candidate timeline from persisted milestones", () => {
  const timeline = candidateTimeline({
    signedUpAt: "2026-09-01T10:00:00.000Z",
    applicationHistory: [
      {
        applicationId: "application-1",
        attemptNumber: 1,
        status: "accepted",
        startedAt: "2026-09-01T10:05:00.000Z",
        submittedAt: "2026-09-02T12:00:00.000Z",
        decidedAt: "2026-09-04T10:00:00.000Z",
      },
    ],
    challenges: [
      {
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
        startedAt: "2026-09-03T09:00:00.000Z",
        completedAt: "2026-09-03T10:00:00.000Z",
      },
    ],
    attendanceCompletedAt: "2026-09-05T10:00:00.000Z",
    checkedInAt: "2026-09-20T14:00:00.000Z",
  });

  expect(timeline.map((event) => event.title)).toEqual([
    "Signed up",
    "Registration started",
    "Registration submitted",
    "Challenge started",
    "Challenge completed",
    "Application approved",
    "Attendance details completed",
    "Checked in",
  ]);
  expect(timeline[3]?.description).toBe("The Shipping Machine");
});

test("omits milestones that have not happened", () => {
  const timeline = candidateTimeline({
    signedUpAt: "2026-09-01T10:00:00.000Z",
    applicationHistory: [
      {
        applicationId: "application-1",
        attemptNumber: 1,
        status: "draft",
        startedAt: "2026-09-01T10:05:00.000Z",
      },
    ],
    challenges: [],
  });

  expect(timeline.map((event) => event.title)).toEqual([
    "Signed up",
    "Registration started",
  ]);
});
