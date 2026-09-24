import { db } from "@chofex/db";
import { and, eq } from "@chofex/db/orm";
import { applications, participantBadges } from "@chofex/db/schema";
import { tasks } from "@trigger.dev/sdk";

import { challengePlacementForParticipant } from "@/lib/credential/placement";

import type { generateParticipantBadge } from "../../trigger/generate-participant-badge";

export const enqueueBadgeGeneration = async (
  applicationId: string,
  options: { readonly force?: boolean } = {},
): Promise<void> => {
  const [[application], [badge]] = await Promise.all([
    db
      .select({ participantId: applications.participantId })
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1),
    db
      .select({ status: participantBadges.status })
      .from(participantBadges)
      .where(eq(participantBadges.applicationId, applicationId))
      .limit(1),
  ]);
  if (!application) throw new Error("Application not found");
  if (badge?.status === "completed" && !options.force) return;

  const generationId = crypto.randomUUID();
  await db
    .insert(participantBadges)
    .values({ applicationId, status: "pending", generationId })
    .onConflictDoUpdate({
      target: participantBadges.applicationId,
      set: {
        status: "pending",
        generationId,
        triggerRunId: null,
        error: null,
        notificationSentAt: null,
        portraitUrl: null,
        portraitPathname: null,
        badgeUrl: null,
        badgePathname: null,
        updatedAt: new Date(),
      },
    });

  const idempotencyKey = `participant-badge/${applicationId}/${generationId}`;

  let handle: { readonly id: string };
  try {
    const placement = await challengePlacementForParticipant(
      application.participantId,
    );
    await db
      .update(participantBadges)
      .set({ placement, updatedAt: new Date() })
      .where(
        and(
          eq(participantBadges.applicationId, applicationId),
          eq(participantBadges.generationId, generationId),
        ),
      );
    handle = await tasks.trigger<typeof generateParticipantBadge>(
      "generate-participant-badge",
      { applicationId, generationId },
      {
        idempotencyKey,
        idempotencyKeyTTL: "1h",
        tags: [`application_${applicationId}`],
      },
    );
  } catch (error) {
    await db
      .update(participantBadges)
      .set({
        status: "failed",
        error: `Could not enqueue badge generation: ${String(error)}`.slice(
          0,
          4_000,
        ),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(participantBadges.applicationId, applicationId),
          eq(participantBadges.generationId, generationId),
        ),
      );
    throw error;
  }

  await db
    .update(participantBadges)
    .set({
      triggerRunId: handle.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(participantBadges.applicationId, applicationId),
        eq(participantBadges.generationId, generationId),
      ),
    );
};
