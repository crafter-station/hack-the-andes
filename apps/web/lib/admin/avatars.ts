export { githubAvatarUrl } from "@/lib/registration/pictures";

import { AVATAR_PORTRAIT, githubAvatarUrl } from "@/lib/registration/pictures";

export const preferredAvatarUrl = (
  clerkImageUrl: string | undefined,
  githubUrl: string | null | undefined,
): string | undefined => clerkImageUrl ?? githubAvatarUrl(githubUrl);

export const candidateAvatarUrl = (
  confirmedPictureUrl: string | undefined,
  clerkImageUrl: string | undefined,
  githubUrl: string | null | undefined,
): string | undefined =>
  confirmedPictureUrl ?? preferredAvatarUrl(clerkImageUrl, githubUrl);

export const candidateBadgePictureUrl = (
  confirmedPictureUrl: string | undefined,
  clerkImageUrl: string | undefined,
  githubUrl: string | null | undefined,
): string | undefined =>
  confirmedPictureUrl ??
  clerkImageUrl ??
  githubAvatarUrl(githubUrl, AVATAR_PORTRAIT);
