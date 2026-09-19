const canonicalPublicOrigin = "https://hacktheandes.com";

const isUnroutableHostname = (hostname: string): boolean =>
  hostname === "0.0.0.0" || hostname === "::" || hostname === "[::]";

const firstForwardedValue = (value: string | null): string | undefined => {
  const candidate = value?.split(",")[0]?.trim();
  if (!candidate) return undefined;
  return candidate;
};

export const publicRequestOrigin = (request: Request): string => {
  const forwardedHost = firstForwardedValue(
    request.headers.get("x-forwarded-host"),
  );
  if (
    forwardedHost &&
    !isUnroutableHostname(forwardedHost.split(":")[0] ?? "")
  ) {
    const forwardedProto =
      firstForwardedValue(request.headers.get("x-forwarded-proto")) ?? "https";
    return `${forwardedProto}://${forwardedHost}`;
  }

  const origin = new URL(request.url).origin;
  const { hostname } = new URL(origin);
  if (isUnroutableHostname(hostname)) return canonicalPublicOrigin;
  return origin;
};
