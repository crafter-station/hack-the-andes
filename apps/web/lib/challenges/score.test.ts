import { expect, test } from "bun:test";

import { formatChallengeScore } from "./score";

test("formats challenge scores consistently for public and admin rankings", () => {
  expect(formatChallengeScore(0.98765)).toBe("98.77%");
  expect(formatChallengeScore(1)).toBe("100.00%");
});
