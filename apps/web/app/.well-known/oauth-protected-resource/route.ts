import { publicRequestOrigin } from "@/lib/public-origin";

export const GET = (request: Request): Response => {
  const resource = publicRequestOrigin(request);
  const issuer =
    process.env.CLERK_OAUTH_ISSUER ?? "https://clerk.hacktheandes.com";
  return Response.json(
    {
      resource,
      authorization_servers: [issuer],
      bearer_methods_supported: ["header"],
      scopes_supported: ["openid", "profile", "email", "offline_access"],
    },
    {
      headers: {
        "cache-control": "public, max-age=3600",
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
};
