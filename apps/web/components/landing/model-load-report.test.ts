import { expect, test } from "bun:test";

import { heroModelExceptionGrouping } from "./model-load-report";

const STAMPED_URL = "/models/sacred-valley.glb?v=3844d88dba";

test("one asset groups under one fingerprint, whatever the browser calls the abort", () => {
  // The two messages three.js produced for the same aborted fetch: Chromium's
  // "Failed to fetch" and Safari's "Load failed". Same defect, and they must
  // share a fingerprint so error tracking keeps them in one issue.
  const chromium = heroModelExceptionGrouping("sacred-valley");
  const safari = heroModelExceptionGrouping("sacred-valley");

  expect(chromium.$exception_fingerprint).toBe(safari.$exception_fingerprint);
  expect(chromium.$exception_fingerprint).not.toContain("Failed to fetch");
  expect(chromium.$exception_fingerprint).not.toContain("Load failed");
  expect(chromium.$exception_fingerprint).not.toContain(STAMPED_URL);
});

test("distinct assets keep distinct fingerprints", () => {
  const valley = heroModelExceptionGrouping("sacred-valley");
  const structures = heroModelExceptionGrouping("site-structures");

  expect(valley.$exception_fingerprint).not.toBe(
    structures.$exception_fingerprint,
  );
  expect(valley.$issue_name).toContain("sacred-valley");
  expect(structures.$issue_name).toContain("site-structures");
});
