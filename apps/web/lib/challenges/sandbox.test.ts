import { describe, expect, test } from "bun:test";

import { HttpError } from "../registration/http";
import { runShippingSolution } from "./sandbox";

const shipment = {
  distanceKm: 10,
  weightKg: 3,
  hour: 14,
  fragile: false,
  express: false,
};

describe("shipping solution sandbox", () => {
  test("runs a named calculateShipping function", async () => {
    const results = await runShippingSolution(
      "function calculateShipping(input) { return input.distanceKm + input.weightKg; }",
      [shipment],
    );
    expect(results).toEqual([13]);
  });

  test("rejects missing functions and host access", async () => {
    await expect(
      runShippingSolution("const x = 1;", [shipment]),
    ).rejects.toThrow(HttpError);
    await expect(
      runShippingSolution(
        "function calculateShipping() { return process.exit(0); }",
        [shipment],
      ),
    ).rejects.toThrow(HttpError);
    await expect(
      runShippingSolution(
        'function calculateShipping() { return Number.constructor("return process")().pid; }',
        [shipment],
      ),
    ).rejects.toThrow(HttpError);
  });

  test("rejects excess concurrent workers instead of exhausting the host", async () => {
    const blockingSource = "function calculateShipping() { while (true) {} }";
    const activeRuns = Array.from({ length: 4 }, () =>
      runShippingSolution(blockingSource, [shipment]),
    );

    const excessRun = runShippingSolution(blockingSource, [shipment]);
    await expect(excessRun).rejects.toMatchObject({
      status: 503,
      code: "SOLUTION_RUNNER_BUSY",
      retryable: true,
    });
    await Promise.allSettled(activeRuns);
  });
});
