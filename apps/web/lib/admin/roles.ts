export const APPLICATION_REVIEWER_ROLE = "application_reviewer";

export interface RoleMetadata {
  readonly role?: unknown;
  readonly roles?: unknown;
}

interface ApplicationReviewerAccessInput {
  readonly clerkUserId: string;
  readonly configuredAdminIds: ReadonlySet<string>;
  readonly publicMetadata: RoleMetadata;
  readonly privateMetadata: RoleMetadata;
}

export const configuredAdminIdsFrom = (
  value: string | undefined,
): ReadonlySet<string> =>
  new Set(
    (value ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );

export const grantsApplicationReviewAccess = (
  metadata: RoleMetadata,
): boolean => {
  if (metadata.role === "admin") return true;
  if (metadata.role === APPLICATION_REVIEWER_ROLE) return true;
  if (!Array.isArray(metadata.roles)) return false;

  return (
    metadata.roles.includes("admin") ||
    metadata.roles.includes(APPLICATION_REVIEWER_ROLE)
  );
};

export const userGrantsApplicationReviewAccess = (
  input: ApplicationReviewerAccessInput,
): boolean => {
  if (input.configuredAdminIds.has(input.clerkUserId)) return true;
  if (grantsApplicationReviewAccess(input.publicMetadata)) return true;
  return grantsApplicationReviewAccess(input.privateMetadata);
};
