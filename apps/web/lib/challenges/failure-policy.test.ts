import { describe, expect, test } from "bun:test";
import { ChallengeEngineError } from "./engine";
import { isConfirmedSolutionExecutionFailure } from "./failure-policy";

describe("challenge evaluation failure policy", () => {
  test("charges only confirmed participant solution failures", () => {
    expect(
      isConfirmedSolutionExecutionFailure(
        new ChallengeEngineError(
          422,
          "SOLUTION_EXECUTION_FAILED",
          "Define function createScheduler(dependencies)",
        ),
      ),
    ).toBe(true);
    expect(
      isConfirmedSolutionExecutionFailure(
        new ChallengeEngineError(
          422,
          "SOLUTION_EXECUTION_FAILED",
          "Solution failed",
        ),
      ),
    ).toBe(true);
    expect(
      isConfirmedSolutionExecutionFailure(
        new ChallengeEngineError(
          503,
          "SOLUTION_EXECUTION_FAILED",
          "Engine failed",
        ),
      ),
    ).toBe(false);
  });

  test("does not charge the sanitized engine catch-all as a used attempt", () => {
    expect(
      isConfirmedSolutionExecutionFailure(
        new ChallengeEngineError(
          422,
          "SOLUTION_EXECUTION_FAILED",
          "Submitted solution could not be evaluated",
        ),
      ),
    ).toBe(false);
  });
});
