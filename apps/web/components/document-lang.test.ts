import { expect, test } from "bun:test";

import { isEnglishPath } from "./document-lang";

test("treats the marketing landing as Spanish", () => {
  expect(isEnglishPath("/")).toBe(false);
  expect(isEnglishPath("/challenges")).toBe(false);
  expect(isEnglishPath("/challenges/black-box")).toBe(false);
  expect(isEnglishPath("/terms")).toBe(false);
  expect(isEnglishPath("/privacy")).toBe(false);
  expect(isEnglishPath("/credits")).toBe(false);
});

test("keeps admin and auth routes in English", () => {
  expect(isEnglishPath("/admin/participants")).toBe(true);
  expect(isEnglishPath("/welcome")).toBe(true);
  expect(isEnglishPath("/sign-in")).toBe(true);
});
