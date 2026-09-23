import { clerkAuthorizationUrlWithCampaignAttribution } from "@/lib/oauth-attribution";

export const GET = (request: Request): Response => {
  const authorizationUrl = clerkAuthorizationUrlWithCampaignAttribution(
    request,
    {
      clientId: process.env.CLERK_CLI_OAUTH_CLIENT_ID,
      issuer: process.env.CLERK_OAUTH_ISSUER,
    },
  );
  if (!authorizationUrl) {
    return new Response("Invalid OAuth authorization request", {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }
  return new Response(null, {
    status: 302,
    headers: {
      "cache-control": "no-store",
      location: authorizationUrl,
      "referrer-policy": "no-referrer",
    },
  });
};
