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

    const enqueue = await source("../lib/badges/enqueue.ts");
    expect(enqueue).toContain("generationId = crypto.randomUUID()");
    expect(enqueue).toContain("{ applicationId, generationId }");
    expect(parent).toContain("badge?.generationId !== payload.generationId");
    expect(parent).toContain(
      "eq(participantBadges.generationId, payload.generationId)",
    );
    expect(badge).toContain(
      "eq(participantBadges.generationId, payload.generationId)",
    );
    expect(portrait).toContain(
      "eq(participantBadges.generationId, payload.generationId)",
    );
  });

  test("reports notification failure instead of exposing stale success", async () => {
    const parent = await source("./generate-participant-badge.ts");

    expect(parent).toContain('status: "failed"');
    expect(parent).toContain("Badge created but notification failed");
  });
});
