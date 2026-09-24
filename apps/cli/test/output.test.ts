import { describe, expect, test } from "bun:test";
import type { RegistrationResult } from "@chofex/registration-contract";

import {
  badgeText,
  registrationText,
  requirementsOnlyText,
} from "../src/output.js";

const withdrawnResult: RegistrationResult = {
  registration: {
    id: "application_123",
    status: "withdrawn",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    participationMode: "in_person",
    shippedProject: "An analytical engine simulator.",
    hackathonProject: "A collaborative programming environment.",
    nationalIdProvided: false,
    mediaConsent: false,
    codeOfConductAccepted: true,
    privacyPolicyAccepted: true,
    submittedAt: "2026-09-01T12:00:00.000Z",
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-02T12:00:00.000Z",
    challenges: [],
  },
  requirements: {
    stage: "review",
    canSubmitNewApplication: true,
    canSubmitAcceptedDetails: false,
    canSaveDraft: false,
    canSubmitApplication: false,
    parts: [],
    missing: [],
  },
};

const acceptedResult: RegistrationResult = {
  registration: {
    ...withdrawnResult.registration,
    status: "accepted",
  },
  requirements: {
    stage: "accepted",
    canSubmitNewApplication: false,
    canSubmitAcceptedDetails: true,
    canSaveDraft: false,
    canSubmitApplication: false,
    parts: [],
    missing: [{ field: "phone", reason: "Required after acceptance" }],
  },
};

const completeResult: RegistrationResult = {
  registration: acceptedResult.registration,
  requirements: {
    ...acceptedResult.requirements,
    stage: "complete",
    missing: [],
  },
};

const rejectedResult: RegistrationResult = {
  registration: {
    ...withdrawnResult.registration,
    status: "rejected",
    rejectionReason: "Please add a concrete example of something you shipped.",
  },
  requirements: {
    stage: "rejected",
    canSubmitNewApplication: true,
    canSubmitAcceptedDetails: false,
    canSaveDraft: false,
    canSubmitApplication: false,
    parts: [],
    missing: [],
  },
};

describe("registration output", () => {
  test("shows that a withdrawn participant may apply again", () => {
    const expected = "Application withdrawn. You may submit a new application.";

    expect(requirementsOnlyText(withdrawnResult)).toBe(expected);
    expect(registrationText(withdrawnResult)).toContain(expected);
  });

  test("shows the next command for an accepted participant", () => {
    const expected = "Next command: chofex confirm";

    expect(requirementsOnlyText(acceptedResult)).toContain(expected);
    expect(registrationText(acceptedResult)).toContain(expected);
  });

  test("does not suggest confirmation after registration is complete", () => {
    const unexpected = "chofex confirm";

    expect(requirementsOnlyText(completeResult)).not.toContain(unexpected);
    expect(registrationText(completeResult)).not.toContain(unexpected);
  });

  test("shows reviewer feedback for a rejected application", () => {
    expect(registrationText(rejectedResult)).toContain(
      "Review feedback: Please add a concrete example of something you shipped.",
    );
  });
});

describe("badge output", () => {
  test("explains that a pending badge is not available yet", () => {
    expect(badgeText({ status: "pending" })).toBe(
      "Your badge is being generated.",
    );
  });

  test("prints the badge URL when generation is complete", () => {
    expect(
      badgeText({ status: "completed", url: "https://example.com/badge.png" }),
    ).toBe("https://example.com/badge.png");
  });
});
