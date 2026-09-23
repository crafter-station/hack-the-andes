import { expect, test } from "bun:test";

import { campaignAttributionCookieForLanding } from "./campaign-attribution";
import { clerkAuthorizationUrlWithCampaignAttribution } from "./oauth-attribution";

const capturedAt = Date.UTC(2026, 8, 19, 12);
const landingId = "018f47a2-89ab-7def-8123-456789abcdef";
const clientId = "cli_client";
const issuer = "https://clerk.example.com";

function authorizationRequest(cookie = ""): Request {
  const url = new URL("https://hack.example/api/v1/oauth/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: "http://127.0.0.1:32123/callback",
    code_challenge: "a".repeat(43),
    code_challenge_method: "S256",
    state: "b".repeat(32),
    scope: "openid profile email offline_access",
  }).toString();
  return new Request(url, { headers: { cookie } });
}

test("bridges the latest browser landing through Clerk OAuth state", () => {
  const cookie = campaignAttributionCookieForLanding(
    "https://hack.example/?utm_campaign=cli",
    "",
    capturedAt,
    true,
    landingId,
  );
  const redirect = clerkAuthorizationUrlWithCampaignAttribution(
    authorizationRequest(cookie),
    { clientId, issuer, now: capturedAt },
  );
  const redirectUrl = new URL(redirect ?? "invalid:");

  expect(redirectUrl.origin).toBe(issuer);
  expect(redirectUrl.pathname).toBe("/oauth/authorize");
  expect(redirectUrl.searchParams.get("state")).toBe(
    `${"b".repeat(32)}.${landingId}.${capturedAt}`,
  );
  expect(redirectUrl.searchParams.get("redirect_uri")).toBe(
    "http://127.0.0.1:32123/callback",
  );
});

test("redirects without attribution when the landing cookie is absent", () => {
  const redirect = clerkAuthorizationUrlWithCampaignAttribution(
    authorizationRequest(),
    { clientId, issuer, now: capturedAt },
  );
  expect(new URL(redirect ?? "invalid:").searchParams.get("state")).toBe(
    "b".repeat(32),
  );
});

test("rejects untrusted OAuth clients and callback URLs", () => {
  const wrongClient = new URL(authorizationRequest().url);
  wrongClient.searchParams.set("client_id", "other_client");
  expect(
    clerkAuthorizationUrlWithCampaignAttribution(new Request(wrongClient), {
      clientId,
      issuer,
    }),
  ).toBeUndefined();

  const externalCallback = new URL(authorizationRequest().url);
  externalCallback.searchParams.set(
    "redirect_uri",
    "https://attacker.example/callback",
  );
  expect(
    clerkAuthorizationUrlWithCampaignAttribution(
      new Request(externalCallback),
      { clientId, issuer },
    ),
  ).toBeUndefined();
});
