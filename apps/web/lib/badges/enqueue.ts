import { db } from "@chofex/db";
import { eq } from "@chofex/db/orm";
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

  const placement = await challengePlacementForParticipant(
    application.participantId,
  );
  await db
    .insert(participantBadges)
    .values({ applicationId, status: "pending", placement })
    .onConflictDoUpdate({
      target: participantBadges.applicationId,
      set: {
        status: "pending",
        placement,
        error: null,
        notificationSentAt: null,
        updatedAt: new Date(),
      },
    });

  let idempotencyKey = `participant-badge/${applicationId}`;
  if (options.force) {
    idempotencyKey = `${idempotencyKey}/${crypto.randomUUID()}`;
  }

  const handle = await tasks.trigger<typeof generateParticipantBadge>(
    "generate-participant-badge",
    { applicationId },
    {
      idempotencyKey,
      idempotencyKeyTTL: "1h",
      tags: [`application_${applicationId}`],
    },
  );

  await db
    .update(participantBadges)
    .set({
      status: "pending",
      triggerRunId: handle.id,
      error: null,
      notificationSentAt: null,
      updatedAt: new Date(),
    })
    .where(eq(participantBadges.applicationId, applicationId));
};
