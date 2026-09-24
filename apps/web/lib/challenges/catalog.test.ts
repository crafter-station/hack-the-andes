import { expect, test } from "bun:test";
import { challengeBySlug } from "@chofex/challenges-contract";

import { catalogItemFor } from "./catalog";

test("does not advertise an unimplemented challenge as open", () => {
  const challenge = challengeBySlug("last-mile");
  if (!challenge) throw new Error("missing last-mile");

  const item = catalogItemFor(
    challenge,
    new Date("2026-09-25T05:00:00.000Z"),
    false,
  );

  expect(item.playable).toBe(false);
  expect(item.open).toBe(false);
});
