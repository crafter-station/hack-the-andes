export const badgeFallbackUrl = "https://hacktheandes.com";

export interface BadgeLinkCandidates {
  readonly websiteUrl?: string | null;
  readonly githubUrl?: string | null;
  readonly linkedInUrl?: string | null;
}

export const badgeLinkFor = (candidates: BadgeLinkCandidates): string => {
  const ordered = [
    candidates.websiteUrl,
    candidates.githubUrl,
    candidates.linkedInUrl,
  ];
  for (const candidate of ordered) {
    const url = candidate?.trim();
    if (url) return url;
  }
  return badgeFallbackUrl;
};

export interface ChallengePlacementCandidate {
  readonly theme: string;
  readonly rank: number;
}

export const bestChallengePlacement = (
  candidates: ReadonlyArray<ChallengePlacementCandidate>,
): ChallengePlacementCandidate | undefined => {
  let best: ChallengePlacementCandidate | undefined;
  for (const candidate of candidates) {
    if (!best || candidate.rank < best.rank) best = candidate;
  }
  return best;
};

export const challengePlacementLabel = (
  placement: ChallengePlacementCandidate | undefined,
): string => {
  if (!placement) return "PARTICIPANT";
  const rank = String(placement.rank).padStart(2, "0");
  return `${placement.theme.toUpperCase()} · #${rank}`;
};
