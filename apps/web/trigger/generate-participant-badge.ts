import { eq } from "@chofex/db/orm";
import {
  acceptanceDetails,
  applications,
  participantBadges,
} from "@chofex/db/schema";
import { db } from "@chofex/db/worker";
import { logger, task } from "@trigger.dev/sdk";

import { credentialNumber } from "../components/credential/credential-model";
import { sendBadgeReadyEmail } from "../lib/badges/email";
import { fullNameOf } from "../lib/credential/accepted";
import { roleFor } from "../lib/credential/printing";
import { generateBadge } from "./generate-badge";
import { generatePortrait } from "./generate-portrait";

export interface GenerateParticipantBadgePayload {
  readonly applicationId: string;
}

export const generateParticipantBadge = task<
  "generate-participant-badge",
  GenerateParticipantBadgePayload,
  { readonly badgeUrl: string; readonly portraitUrl: string }
>({
  id: "generate-participant-badge",
  queue: { concurrencyLimit: 5 },
  maxDuration: 900,
  onFailure: async ({ payload, error }) => {
    const [badge] = await db
      .select({ badgeUrl: participantBadges.badgeUrl })
      .from(participantBadges)
      .where(eq(participantBadges.applicationId, payload.applicationId))
      .limit(1);
    let status: "failed" | "completed" = "failed";
    let message = String(error).slice(0, 4_000);
    if (badge?.badgeUrl) {
      status = "completed";
      message = `Badge created but notification failed: ${message}`;
    }
    await db
      .update(participantBadges)
      .set({
        status,
        error: message,
        updatedAt: new Date(),
      })
      .where(eq(participantBadges.applicationId, payload.applicationId));
  },
  run: async (payload: GenerateParticipantBadgePayload, { ctx }) => {
    const [record] = await db
      .select({ application: applications, details: acceptanceDetails })
      .from(applications)
      .leftJoin(
        acceptanceDetails,
        eq(acceptanceDetails.applicationId, applications.id),
      )
      .where(eq(applications.id, payload.applicationId))
      .limit(1);
    if (!record) throw new Error("Application not found");
    if (record.application.status !== "accepted") {
      throw new Error("Only accepted participants can receive a badge");
    }
    if (!record.details?.completedAt) {
      throw new Error("Participant has not completed attendance confirmation");
    }
    const pictureUrl = record.application.pictureUrl;
    if (!pictureUrl) throw new Error("Participant has no confirmed picture");
    /*
      The name the credential prints, which is the application's and not
      the attendance form's. The card seeds its number from the same
      string, so taking a different one here would email somebody a badge
      numbered differently from the one on their own page.
    */
    const credentialName = fullNameOf(
      record.application.firstName,
      record.application.lastName,
    );
    const fullName = credentialName || record.details?.fullName?.trim() || "";
    if (!fullName) throw new Error("Participant has no name");
    const email = record.application.email;
    if (!email) throw new Error("Participant has no email address");

    await db
      .insert(participantBadges)
      .values({
        applicationId: payload.applicationId,
        status: "running",
        triggerRunId: ctx.run.id,
      })
      .onConflictDoUpdate({
        target: participantBadges.applicationId,
        set: {
          status: "running",
          triggerRunId: ctx.run.id,
          error: null,
          updatedAt: new Date(),
        },
      });

    logger.info("Starting participant badge workflow", {
      applicationId: payload.applicationId,
    });
    const portrait = await generatePortrait
      .triggerAndWait(
        { applicationId: payload.applicationId, pictureUrl },
        { idempotencyKey: `portrait/${ctx.run.id}` },
      )
      .unwrap();
    const badge = await generateBadge
      .triggerAndWait(
        {
          applicationId: payload.applicationId,
          fullName: credentialName,
          role: roleFor(record.application.role),
          number: credentialNumber(credentialName),
          portraitUrl: portrait.url,
        },
        { idempotencyKey: `badge/${ctx.run.id}` },
      )
      .unwrap();

    await db
      .update(participantBadges)
      .set({ status: "completed", error: null, updatedAt: new Date() })
      .where(eq(participantBadges.applicationId, payload.applicationId));
    await sendBadgeReadyEmail({
      applicationId: payload.applicationId,
      email,
      firstName: record.application.firstName ?? fullName,
      badgeUrl: badge.url,
    });
    await db
      .update(participantBadges)
      .set({ notificationSentAt: new Date(), updatedAt: new Date() })
      .where(eq(participantBadges.applicationId, payload.applicationId));

    return { badgeUrl: badge.url, portraitUrl: portrait.url };
  },
});
