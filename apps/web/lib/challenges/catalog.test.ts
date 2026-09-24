import { expect, test } from "bun:test";
import { challengeBySlug } from "@chofex/challenges-contract";

import { catalogItemFor } from "./catalog";

test("does not advertise an unimplemented challenge as open", () => {
  const challenge = challengeBySlug("make-it-fast");
  if (!challenge) throw new Error("missing make-it-fast");

  const item = catalogItemFor(
    challenge,
    new Date("2026-09-25T05:00:00.000Z"),
    false,
  );

  expect(item.playable).toBe(false);
  expect(item.open).toBe(false);
});
