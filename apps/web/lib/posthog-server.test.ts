import { expect, test } from "bun:test";

import {
  captureProductEvent,
  productEventWithCampaignAttribution,
} from "./posthog-server";

const capturedAt = Date.UTC(2026, 8, 1, 12);

test("adds attribution without changing application or challenge semantics", async () => {
  const { campaignAttributionCookieForLanding } = await import(
    "./campaign-attribution"
  );
  const cookie = campaignAttributionCookieForLanding(
    "https://hacktheandes.com/challenges/black-box?utm_source=email&utm_campaign=challenge-link",
    "",
    capturedAt,
    true,
  );
  const request = new Request("https://hacktheandes.com/api/v1/test", {
    headers: { cookie: cookie ?? "" },
  });

  const application = productEventWithCampaignAttribution(
    request,
    {
      distinctId: "user_test",
      event: "application_submitted",
      properties: { application_status: "submitted" },
    },
    capturedAt,
  );
  const challenge = productEventWithCampaignAttribution(
    request,
    {
      distinctId: "user_test",
      event: "challenge_evaluation_submitted",
      properties: { challenge_slug: "black-box" },
    },
    capturedAt,
  );

  expect(application.event).toBe("application_submitted");
  expect(application.properties).toMatchObject({
    application_status: "submitted",
    first_utm_source: "email",
    latest_utm_campaign: "challenge-link",
  });
  expect(challenge.event).toBe("challenge_evaluation_submitted");
  expect(challenge.properties).toMatchObject({
    challenge_slug: "black-box",
    first_utm_source: "email",
    latest_utm_campaign: "challenge-link",
  });
});

test("adds an exact landing reference handed off by the CLI", () => {
  const landingId = "018f47a2-89ab-7def-8123-456789abcdef";
  const request = new Request("https://hacktheandes.com/api/v1/registration", {
    headers: {
      "x-chofex-campaign-attribution": `${landingId}.${capturedAt}`,
    },
  });

  expect(
    productEventWithCampaignAttribution(
      request,
      {
        distinctId: "user_123",
        event: "application_submitted",
      },
      capturedAt,
    ),
  ).toMatchObject({
    distinctId: "user_123",
    event: "application_submitted",
    properties: {
      latest_campaign_at: new Date(capturedAt).toISOString(),
      latest_campaign_landing_id: landingId,
    },
  });
});

test("server capture remains a safe no-op without PostHog configuration", async () => {
  await expect(
    captureProductEvent({
      distinctId: "user_test",
      event: "application_draft_saved",
      request: new Request("https://hacktheandes.com/api/v1/registration"),
    }),
  ).resolves.toBeUndefined();
});
