import { describe, expect, test } from "bun:test";

import { brokenAgentStarterSource } from "@chofex/challenges-contract/broken-agent";

import { runBrokenAgentPublicTests } from "./broken-agent-public";

describe("Broken Agent public tests", () => {
  test("keeps every visible test green for the intentionally flawed starter", async () => {
    const result = await runBrokenAgentPublicTests(brokenAgentStarterSource);

    expect(result).toMatchObject({
      kind: "broken_agent",
      matchedObservations: 7,
      observationCount: 7,
      accuracy: 1,
      mismatches: [],
    });
  });

  test("reports visible failures without exposing server diagnostics", async () => {
    const result = await runBrokenAgentPublicTests(
      "module.exports = { createScheduler: () => ({}) };",
    );

    expect(result.accuracy).toBe(0);
    expect(result.mismatches.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("/Users/");
  });
});
