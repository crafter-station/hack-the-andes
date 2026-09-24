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
