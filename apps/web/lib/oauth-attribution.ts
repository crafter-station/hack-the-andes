import { oauthStateWithCampaignAttribution } from "@chofex/registration-contract";

import { campaignAttributionHandoff } from "./campaign-attribution";

const oauthParameters = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "state",
  "scope",
] as const;

function isCliCallback(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      Boolean(url.port) &&
      url.pathname === "/callback" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function clerkAuthorizationUrlWithCampaignAttribution(
  request: Request,
  options: {
    readonly clientId: string | undefined;
    readonly issuer: string | undefined;
    readonly now?: number;
  },
): string | undefined {
  if (!options.clientId || !options.issuer) return;
  const requestUrl = new URL(request.url);
  const parameters = requestUrl.searchParams;
  if (parameters.get("response_type") !== "code") return;
  if (parameters.get("client_id") !== options.clientId) return;
  if (parameters.get("code_challenge_method") !== "S256") return;

  const redirectUri = parameters.get("redirect_uri");
  if (!redirectUri || !isCliCallback(redirectUri)) return;
  const codeChallenge = parameters.get("code_challenge");
  if (!codeChallenge || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) return;
  const state = parameters.get("state");
  if (!state || !/^[A-Za-z0-9_-]{32}$/.test(state)) return;
  const scope = parameters.get("scope");
  if (scope !== "openid profile email offline_access") return;

  let authorizationUrl: URL;
  try {
    authorizationUrl = new URL("/oauth/authorize", options.issuer);
  } catch {
    return;
  }
  if (authorizationUrl.protocol !== "https:") return;
  for (const parameter of oauthParameters) {
    const value = parameters.get(parameter);
    if (value) authorizationUrl.searchParams.set(parameter, value);
  }

  const handoff = campaignAttributionHandoff(
    request.headers.get("cookie"),
    options.now,
  );
  authorizationUrl.searchParams.set(
    "state",
    oauthStateWithCampaignAttribution(state, handoff),
  );
  return authorizationUrl.toString();
}
