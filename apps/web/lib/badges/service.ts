import { db } from "@chofex/db";
import { desc, eq } from "@chofex/db/orm";
import {
  applications,
  participantBadges,
  participants,
} from "@chofex/db/schema";
import type { BadgeProfile, BadgeResult } from "@chofex/registration-contract";
import { badgeLinkFor } from "@/lib/credential/profile";

const profileFor = (
  application: typeof applications.$inferSelect,
  badge: typeof participantBadges.$inferSelect | null,
): BadgeProfile => ({
  fullName:
    badge?.displayName?.trim() ||
    [application.firstName?.trim(), application.lastName?.trim()]
      .filter(Boolean)
      .join(" "),
  oneLiner:
    badge?.oneLiner?.trim() || application.role?.trim() || "Participant",
  linkUrl:
    badge?.linkUrl?.trim() ||
    badgeLinkFor({
      websiteUrl: application.portfolioUrl,
      githubUrl: application.githubUrl,
      linkedInUrl: application.linkedInUrl,
    }),
  placement: badge?.placement?.trim() || "PARTICIPANT",
});

export const getParticipantBadge = async (
  clerkUserId: string,
): Promise<BadgeResult> => {
  const [record] = await db
    .select({ application: applications, badge: participantBadges })
    .from(participants)
    .innerJoin(applications, eq(applications.participantId, participants.id))
    .leftJoin(
      participantBadges,
      eq(participantBadges.applicationId, applications.id),
    )
    .where(eq(participants.clerkUserId, clerkUserId))
    .orderBy(desc(applications.createdAt))
    .limit(1);

  if (!record) return { status: "not_started" };
  const profile = profileFor(record.application, record.badge);
  if (!record.badge) return { status: "not_started", profile };
  if (record.badge.status === "completed" && record.badge.badgeUrl) {
    return { status: "completed", url: record.badge.badgeUrl, profile };
  }
  return { status: record.badge.status, profile };
};
