import { describe, expect, test } from "bun:test";

const source = async (file: string): Promise<string> =>
  await Bun.file(new URL(file, import.meta.url)).text();

describe("participant badge generation lifecycle", () => {
  test("clears old assets before a new generation can fail", async () => {
    const enqueue = await source("../lib/badges/enqueue.ts");

    expect(enqueue).toContain("badgeUrl: null");
    expect(enqueue).toContain("portraitUrl: null");
  });

  test("lets only the current generation publish assets or send email", async () => {
    const parent = await source("./generate-participant-badge.ts");
    const badge = await source("./generate-badge.ts");
    const portrait = await source("./generate-portrait.ts");

    expect(parent).toContain("badge?.triggerRunId !== ctx.run.id");
    expect(parent).toContain("eq(participantBadges.triggerRunId, ctx.run.id)");
    expect(badge).toContain(
      "eq(participantBadges.triggerRunId, payload.generationId)",
    );
    expect(portrait).toContain(
      "eq(participantBadges.triggerRunId, payload.generationId)",
    );
  });
});
