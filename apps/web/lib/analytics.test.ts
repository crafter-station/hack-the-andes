import { expect, test } from "bun:test";

import {
  campaignPropertiesFromUrl,
  isExtensionNoiseException,
  isPostHogConfigured,
  isSessionRecordingEvent,
  isTrackablePath,
  isTrackableUrl,
  postHogEventForPublicAnalytics,
  replaceCampaignProperties,
} from "./analytics";

test("reads campaign dimensions for conversion events", () => {
  expect(
    campaignPropertiesFromUrl(
      "https://hacktheandes.com/?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch&utm_content=reel-42",
    ),
  ).toEqual({
    $utm_source: "instagram",
    $utm_medium: "organic_social",
    $utm_campaign: "launch",
    $utm_content: "reel-42",
  });
});

test("ignores empty campaign dimensions and bounds their size", () => {
  expect(
    campaignPropertiesFromUrl(
      `https://hacktheandes.com/?utm_source=&utm_campaign=${"a".repeat(250)}`,
    ),
  ).toEqual({ $utm_campaign: "a".repeat(200) });
});

test("recognizes real PostHog configuration", () => {
  expect(isPostHogConfigured("phc_project_key")).toBe(true);
  expect(isPostHogConfigured("phc_replace_me")).toBe(false);
  expect(isPostHogConfigured(undefined)).toBe(false);
});

test("tracks the public marketing funnel", () => {
  expect(isTrackablePath("/")).toBe(true);
  expect(isTrackablePath("/challenges")).toBe(true);
  expect(isTrackablePath("/challenges/black-box")).toBe(true);
  expect(isTrackablePath("/terms")).toBe(true);
});

test("never tracks staff screens that carry participant data", () => {
  expect(isTrackablePath("/admin")).toBe(false);
  expect(isTrackablePath("/admin/participants")).toBe(false);
  expect(isTrackablePath("/admin/utm")).toBe(false);
  expect(isTrackablePath("/sign-in")).toBe(false);
  expect(isTrackablePath("/auth/complete")).toBe(false);
  expect(isTrackablePath("/welcome")).toBe(false);
});

test("does not mistake a prefix for a path segment", () => {
  expect(isTrackablePath("/administration")).toBe(true);
  expect(isTrackablePath("/welcome-back")).toBe(true);
});

test("reads the pathname out of a full url, query string included", () => {
  expect(isTrackableUrl("https://hacktheandes.com/?utm_source=instagram")).toBe(
    true,
  );
  expect(
    isTrackableUrl("https://hacktheandes.com/admin/participants?q=emmy"),
  ).toBe(false);
});

test("fails closed on anything it cannot parse", () => {
  expect(isTrackableUrl("not a url")).toBe(false);
  expect(isTrackableUrl(undefined)).toBe(false);
  expect(isTrackableUrl(null)).toBe(false);
});

test("recognizes session recording snapshots so replay bypasses event shaping", () => {
  expect(
    isSessionRecordingEvent({
      event: "$snapshot",
      properties: { $snapshot_data: [{ type: 2 }] },
    }),
  ).toBe(true);
  expect(isSessionRecordingEvent({ event: "$pageview" })).toBe(false);
  expect(isSessionRecordingEvent(null)).toBe(false);
});

test("the public analytics filter alone would drop session snapshots", () => {
  // A snapshot carries no trackable $current_url, so the public filter returns
  // null. before_send must keep snapshots ahead of this filter, or replay
  // records nothing.
  expect(
    postHogEventForPublicAnalytics({
      event: "$snapshot",
      properties: { $snapshot_data: [{ type: 2 }] },
    }),
  ).toBe(null);
});

test("drops the browser extension promise rejection, whatever its id", () => {
  const extensionEvent = (id: number) => ({
    event: "$exception",
    properties: {
      $exception_list: [
        {
          value: `Non-Error promise rejection captured with value: Object Not Found Matching Id:${id}, MethodName:update, ParamCount:4`,
        },
      ],
    },
  });

  expect(isExtensionNoiseException(extensionEvent(1))).toBe(true);
  expect(isExtensionNoiseException(extensionEvent(2))).toBe(true);
});

test("keeps first-party exceptions and non-exception events", () => {
  expect(
    isExtensionNoiseException({
      event: "$exception",
      properties: {
        $exception_list: [{ value: "Failed to fetch model.glb" }],
      },
    }),
  ).toBe(false);
  expect(isExtensionNoiseException({ event: "$pageview" })).toBe(false);
  expect(
    isExtensionNoiseException({ event: "$exception", properties: {} }),
  ).toBe(false);
});

test("allows identity linking without exposing an excluded URL", () => {
  const identityEvent: {
    $set_once?: Record<string, unknown>;
    event?: string;
    properties?: Record<string, unknown>;
  } = {
    $set_once: {
      $initial_current_url:
        "https://hacktheandes.com/auth/complete?token=private",
      $initial_pathname: "/auth/complete",
      $initial_referrer: "https://accounts.example.com/private",
      acquisition_channel: "campaign",
    },
    event: "$identify",
    properties: {
      $anon_distinct_id: "anonymous-123",
      $current_url:
        "https://hacktheandes.com/admin/participants?q=private@example.com",
      $pathname: "/admin/participants",
      $referrer: "https://hacktheandes.com/auth/complete?token=private",
      distinct_id: "user_test_123",
    },
  };
  expect(postHogEventForPublicAnalytics(identityEvent)).toEqual({
    $set_once: {
      acquisition_channel: "campaign",
    },
    event: "$identify",
    properties: {
      $anon_distinct_id: "anonymous-123",
      distinct_id: "user_test_123",
    },
  });
});

test("removes private initial URLs from identity events on public pages", () => {
  const identityEvent: {
    $set_once?: Record<string, unknown>;
    event?: string;
    properties?: Record<string, unknown>;
  } = {
    $set_once: {
      $initial_current_url:
        "https://hacktheandes.com/auth/complete?token=private",
      $initial_referrer: "https://accounts.example.com/private",
    },
    event: "$identify",
    properties: {
      $current_url: "https://hacktheandes.com/",
      distinct_id: "user_test_123",
    },
  };
  expect(postHogEventForPublicAnalytics(identityEvent)).toEqual({
    $set_once: {},
    event: "$identify",
    properties: {
      distinct_id: "user_test_123",
    },
  });
});

test("removes excluded referrer and history URLs from public events", () => {
  const pageview: {
    $set_once?: Record<string, unknown>;
    event?: string;
    properties?: Record<string, unknown>;
  } = {
    $set_once: {
      $initial_current_url: "https://hacktheandes.com/auth/complete",
    },
    event: "$pageview",
    properties: {
      $current_url:
        "https://hacktheandes.com/challenges?email=private@example.com",
      $prev_pageview_pathname: "/admin/participants",
      $referrer: "https://hacktheandes.com/auth/complete?token=private",
      challenge_count: 1,
    },
  };
  expect(postHogEventForPublicAnalytics(pageview)).toEqual({
    $set_once: {},
    event: "$pageview",
    properties: {
      $current_url: "https://hacktheandes.com/challenges",
      challenge_count: 1,
    },
  });
});

test("replaces stale campaign properties on browser events", () => {
  expect(
    replaceCampaignProperties(
      {
        $initial_utm_campaign: "unvalidated-initial-campaign",
        $utm_campaign: "old-campaign",
        $utm_content: "old-link",
        challenge_count: 1,
      },
      { $utm_campaign: "new-campaign" },
    ),
  ).toEqual({
    $utm_campaign: "new-campaign",
    challenge_count: 1,
  });
  expect(
    replaceCampaignProperties(
      {
        $initial_utm_campaign: "unvalidated-initial-campaign",
        $utm_campaign: "expired",
      },
      {},
    ),
  ).toEqual({});
});
