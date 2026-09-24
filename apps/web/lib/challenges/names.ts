interface ParticipantName {
  readonly firstName: string;
  readonly lastName: string;
}

export const participantDisplayName = (identity: ParticipantName): string =>
  `${identity.firstName} ${identity.lastName}`.trim();

export const rankingDisplayName = (identity: {
  readonly firstName?: string | null;
  readonly lastName?: string | null;
}): string =>
  participantDisplayName({
    firstName: identity.firstName ?? "Unknown",
    lastName: identity.lastName ?? "participant",
  });

export interface PublicProfileLinks {
  readonly githubUrl?: string;
  readonly linkedInUrl?: string;
}

const safePublicProfileUrl = (
  value: string | null | undefined,
  hostMatches: (hostname: string) => boolean,
  pathMatches: (pathname: string) => boolean,
): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      hostMatches(url.hostname.toLowerCase()) &&
      pathMatches(url.pathname)
    ) {
      return url.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export const publicProfileLinksFor = (identity: {
  readonly githubUrl?: string | null;
  readonly linkedInUrl?: string | null;
}): PublicProfileLinks => {
  const links: { githubUrl?: string; linkedInUrl?: string } = {};
  const githubUrl = safePublicProfileUrl(
    identity.githubUrl,
    (hostname) => hostname === "github.com" || hostname === "www.github.com",
    (pathname) => pathname.split("/").filter(Boolean).length >= 1,
  );
  const linkedInUrl = safePublicProfileUrl(
    identity.linkedInUrl,
    (hostname) =>
      hostname === "linkedin.com" || hostname.endsWith(".linkedin.com"),
    (pathname) => pathname.toLowerCase().startsWith("/in/"),
  );
  if (githubUrl) links.githubUrl = githubUrl;
  if (linkedInUrl) links.linkedInUrl = linkedInUrl;
  return links;
};
