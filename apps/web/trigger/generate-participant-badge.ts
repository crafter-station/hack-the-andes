import { and, eq } from "@chofex/db/orm";
import {
  acceptanceDetails,
  applications,
  participantBadges,
} from "@chofex/db/schema";
import { db } from "@chofex/db/worker";
import { logger, task } from "@trigger.dev/sdk";

import { sendBadgeReadyEmail } from "../lib/badges/email";
import { resolveBadgeProfile } from "../lib/credential/profile";
import { generateBadge } from "./generate-badge";
import { generatePortrait } from "./generate-portrait";

/** Where the email sends people to find the card itself. */
const BADGE_PAGE_URL =
  "https://hacktheandes.com/badge?utm_source=resend&utm_medium=email&utm_campaign=badge&utm_content=view";

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
  onFailure: async ({ payload, ctx, error }) => {
    const [badge] = await db
      .select({
        badgeUrl: participantBadges.badgeUrl,
        triggerRunId: participantBadges.triggerRunId,
      })
      .from(participantBadges)
      .where(eq(participantBadges.applicationId, payload.applicationId))
      .limit(1);
    if (badge?.triggerRunId !== ctx.run.id) return;
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
      .where(
        and(
          eq(participantBadges.applicationId, payload.applicationId),
          eq(participantBadges.triggerRunId, ctx.run.id),
        ),
      );
  },
  run: async (payload: GenerateParticipantBadgePayload, { ctx }) => {
    const [record] = await db
      .select({
        application: applications,
        details: acceptanceDetails,
        badge: participantBadges,
      })
      .from(applications)
      .leftJoin(
        acceptanceDetails,
        eq(acceptanceDetails.applicationId, applications.id),
      )
      .leftJoin(
        participantBadges,
        eq(participantBadges.applicationId, applications.id),
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
    const profile = resolveBadgeProfile(
      {
        ...record.application,
        websiteUrl: record.application.portfolioUrl,
      },
      record.badge,
    );
    const pictureUrl = profile.pictureUrl;
    if (!pictureUrl) throw new Error("Participant has no confirmed picture");
    const fullName = profile.fullName || record.details?.fullName?.trim() || "";
    if (!fullName) throw new Error("Participant has no name");
    const email = record.application.email;
    if (!email) throw new Error("Participant has no email address");

    const [claimed] = await db
      .update(participantBadges)
      .set({ status: "running", error: null, updatedAt: new Date() })
      .where(
        and(
          eq(participantBadges.applicationId, payload.applicationId),
          eq(participantBadges.triggerRunId, ctx.run.id),
        ),
      )
      .returning({ applicationId: participantBadges.applicationId });
    if (!claimed) throw new Error("Badge generation was superseded");

    logger.info("Starting participant badge workflow", {
      applicationId: payload.applicationId,
    });
    const portrait = await generatePortrait
      .triggerAndWait(
        {
          applicationId: payload.applicationId,
          generationId: ctx.run.id,
          pictureUrl,
        },
        { idempotencyKey: `portrait/${ctx.run.id}` },
      )
      .unwrap();
    const badge = await generateBadge
      .triggerAndWait(
        {
          applicationId: payload.applicationId,
          generationId: ctx.run.id,
          fullName,
          role: profile.oneLiner,
          placement: profile.placement,
          linkUrl: profile.linkUrl,
          portraitUrl: portrait.url,
        },
        { idempotencyKey: `badge/${ctx.run.id}` },
      )
      .unwrap();

    const [completed] = await db
      .update(participantBadges)
      .set({ status: "completed", error: null, updatedAt: new Date() })
      .where(
        and(
          eq(participantBadges.applicationId, payload.applicationId),
          eq(participantBadges.triggerRunId, ctx.run.id),
        ),
      )
      .returning({ applicationId: participantBadges.applicationId });
    if (!completed) {
      logger.info("Skipping notification for superseded badge generation", {
        applicationId: payload.applicationId,
      });
      return { badgeUrl: badge.url, portraitUrl: portrait.url };
    }
    await sendBadgeReadyEmail({
      applicationId: payload.applicationId,
      email,
      firstName: record.application.firstName ?? fullName,
      badgeUrl: badge.url,
      placement: profile.placement,
      badgePageUrl: BADGE_PAGE_URL,
      generationId: ctx.run.id,
    });
    await db
      .update(participantBadges)
      .set({ notificationSentAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(participantBadges.applicationId, payload.applicationId),
          eq(participantBadges.triggerRunId, ctx.run.id),
        ),
      );

    return { badgeUrl: badge.url, portraitUrl: portrait.url };
  },
});
