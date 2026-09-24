import { db } from "@chofex/db";
import { participantBadges } from "@chofex/db/schema";

import { acceptanceBadgeProfileFor } from "@/lib/credential/profile";

interface AcceptanceBadgeCandidate {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role?: string;
  readonly avatarUrl?: string;
  readonly portfolioUrl?: string;
  readonly githubUrl?: string;
  readonly linkedInUrl?: string;
}

/**
 * Freezes the reviewer-visible identity as the participant's first badge
 * profile. Later confirmation edits the badge profile, not the historical
 * application that the reviewer accepted.
 */
export const storeAcceptanceBadgeProfile = async (
  candidate: AcceptanceBadgeCandidate,
): Promise<void> => {
  const profile = acceptanceBadgeProfileFor({
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    role: candidate.role,
    avatarUrl: candidate.avatarUrl,
    websiteUrl: candidate.portfolioUrl,
    githubUrl: candidate.githubUrl,
    linkedInUrl: candidate.linkedInUrl,
  });

  await db
    .insert(participantBadges)
    .values({
      applicationId: candidate.id,
      status: "pending",
      generationId: null,
      triggerRunId: null,
      ...profile,
    })
    .onConflictDoUpdate({
      target: participantBadges.applicationId,
      set: {
        status: "pending",
        generationId: null,
        triggerRunId: null,
        error: null,
        displayName: profile.displayName,
        oneLiner: profile.oneLiner,
        linkUrl: profile.linkUrl,
        pictureUrl: profile.pictureUrl ?? null,
        updatedAt: new Date(),
      },
    });
};
