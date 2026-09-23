const oauthIssuer =
  process.env.CHOFEX_OAUTH_ISSUER ?? "https://clerk.hacktheandes.com";
const publicSiteUrl =
  process.env.CHOFEX_PUBLIC_SITE_URL ?? "https://hacktheandes.com";

export const config = {
  apiUrl: process.env.CHOFEX_API_URL ?? "https://hacktheandes.com",
  publicSiteUrl,
  oauthClientId: process.env.CHOFEX_OAUTH_CLIENT_ID ?? "HddO78wKpq5PFIEl",
  authorizationUrl: `${oauthIssuer}/oauth/authorize`,
  authorizationBridgeUrl: `${publicSiteUrl}/api/v1/oauth/authorize`,
  tokenUrl: `${oauthIssuer}/oauth/token`,
  revocationUrl: `${oauthIssuer}/oauth/token/revoke`,
};
