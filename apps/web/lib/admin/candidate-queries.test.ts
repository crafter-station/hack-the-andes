import { expect, test } from "bun:test";

import { candidateListOptions } from "./candidate-queries";

test("keeps an open candidate dashboard synchronized", () => {
  const options = candidateListOptions({ page: 1, query: "" });

  expect(options.refetchInterval).toBe(60_000);
  expect(options.refetchOnWindowFocus).toBe("always");
});
