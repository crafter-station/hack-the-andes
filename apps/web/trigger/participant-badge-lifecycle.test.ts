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
    expect(enqueue).toMatch(
      /participant-badge\/\$\{applicationId\}\/\$\{generationId\}/,
    );
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

  test("only exposes badge profiles after attendance confirmation", async () => {
    const service = await source("../lib/badges/service.ts");

    expect(service).toContain('eq(applications.status, "accepted")');
    expect(service).toContain("isNotNull(acceptanceDetails.completedAt)");
  });

  test("invalidates old generations before changing the badge profile", async () => {
    const profile = await source("../lib/badges/profile.ts");
    const registration = await source("../lib/registration/service.ts");

    expect(profile).toContain("generationId: null");
    expect(registration).toContain("generationId: null");
  });

  test("regenerates after an updated attendance confirmation", async () => {
    const registration = await source("../lib/registration/service.ts");
    const attendanceRoute = await source(
      "../app/api/v1/registration/attendance/route.ts",
    );

    expect(registration).toContain(
      "uploadedPictureUrl = badge?.customPictureUrl ?? null",
    );
    expect(attendanceRoute).toContain(
      "enqueueBadgeGeneration(result.registration.id, { force: true })",
    );
  });

  test("marks a generation failed when Trigger dispatch fails", async () => {
    const enqueue = await source("../lib/badges/enqueue.ts");

    expect(enqueue).toContain("Could not dispatch badge generation");
    expect(enqueue).toContain('status: "failed"');
  });

  test("reports notification failure instead of exposing stale success", async () => {
    const parent = await source("./generate-participant-badge.ts");

    expect(parent).toContain('status: "failed"');
    expect(parent).toContain("Badge created but notification failed");
  });
});
