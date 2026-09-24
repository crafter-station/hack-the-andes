import { playableChallenges } from "@chofex/challenges-contract";
import { and, desc, eq, gt, inArray } from "@chofex/db/orm";
import {
  applications,
  challengeAttempts,
  challengeEvaluations,
  challengeReservations,
  funnelEmailDeliveries,
  participants,
} from "@chofex/db/schema";
import { db } from "@chofex/db/worker";
import { logger, task, wait } from "@trigger.dev/sdk";

import { isBlackBoxParticipationOpen } from "../lib/challenges/availability";
import { currentChallengeVersion } from "../lib/challenges/engine";
import {
  type FunnelProgress,
  needsFunnelReminder,
} from "../lib/funnel-reminders/eligibility";
import { sendFunnelReminderEmail } from "../lib/funnel-reminders/email";
import type {
  FunnelReminderPayload,
  FunnelReminderRecipient,
} from "../lib/funnel-reminders/types";

interface ReminderContext {
  readonly deliveryScope: string;
  readonly pendingEvaluationUntil?: Date;
  readonly progress: FunnelProgress;
  readonly recipient?: FunnelReminderRecipient;
}

interface FunnelReminderResult {
  readonly status: "sent" | "skipped" | "duplicate";
}

const playableChallengeSlugs = playableChallenges.map(
  (challenge) => challenge.slug,
);

interface ApplicationContext {
  readonly participantId: string;
  readonly application?: typeof applications.$inferSelect;
}

const loadApplicationContext = async (
  payload: FunnelReminderPayload,
): Promise<ApplicationContext | undefined> => {
  if (payload.applicationId) {
    const [record] = await db
      .select({ participantId: participants.id, application: applications })
      .from(participants)
      .innerJoin(applications, eq(applications.participantId, participants.id))
      .where(
        and(
          eq(participants.clerkUserId, payload.clerkUserId),
          eq(applications.id, payload.applicationId),
        ),
      )
      .limit(1);
    return record;
  }

  const [record] = await db
    .select({ participantId: participants.id, application: applications })
    .from(participants)
    .leftJoin(applications, eq(applications.participantId, participants.id))
    .where(eq(participants.clerkUserId, payload.clerkUserId))
    .orderBy(desc(applications.createdAt))
    .limit(1);
  if (!record) return undefined;
  return {
    participantId: record.participantId,
    application: record.application ?? undefined,
  };
};

const loadReminderContext = async (
  payload: FunnelReminderPayload,
): Promise<ReminderContext> => {
  const record = await loadApplicationContext(payload);
  const application = record?.application ?? undefined;

  let challengeStarted = false;
  let challengeCompleted = false;
  let challengeFinishAvailable = false;
  let pendingEvaluationUntil: Date | undefined;
  if (record && playableChallengeSlugs.length > 0) {
    const attempts = await db
      .select({
        evaluationsLimit: challengeAttempts.evaluationsLimit,
        id: challengeAttempts.id,
        queriesUsed: challengeAttempts.queriesUsed,
        evaluationsUsed: challengeAttempts.evaluationsUsed,
      })
      .from(challengeAttempts)
      .where(
        and(
          eq(challengeAttempts.participantId, record.participantId),
          eq(challengeAttempts.challengeVersion, currentChallengeVersion),
          inArray(challengeAttempts.challengeSlug, playableChallengeSlugs),
        ),
      );
    const startedAttempts = attempts.filter(
      (attempt) => attempt.queriesUsed > 0 || attempt.evaluationsUsed > 0,
    );
    challengeStarted = startedAttempts.length > 0;
    challengeFinishAvailable = startedAttempts.some(
      (attempt) => attempt.evaluationsUsed < attempt.evaluationsLimit,
    );

    const attemptIds = attempts.map((attempt) => attempt.id);
    if (attemptIds.length > 0) {
      const now = new Date();
      const [[evaluation], [pendingEvaluation]] = await Promise.all([
        db
          .select({ id: challengeEvaluations.id })
          .from(challengeEvaluations)
          .where(inArray(challengeEvaluations.attemptId, attemptIds))
          .limit(1),
        db
          .select({ expiresAt: challengeReservations.expiresAt })
          .from(challengeReservations)
          .where(
            and(
              inArray(challengeReservations.attemptId, attemptIds),
              eq(challengeReservations.kind, "evaluation"),
              gt(challengeReservations.expiresAt, now),
            ),
          )
          .orderBy(desc(challengeReservations.expiresAt))
          .limit(1),
      ]);
      challengeCompleted = Boolean(evaluation);
      pendingEvaluationUntil = pendingEvaluation?.expiresAt;
    }
  }

  let recipient = payload.recipient;
  if (application?.email) {
    recipient = {
      email: application.email,
      firstName: application.firstName ?? payload.recipient?.firstName ?? "",
    };
  }

  return {
    deliveryScope: application?.id ?? "participant",
    pendingEvaluationUntil,
    progress: {
      applicationStatus: application?.status,
      applicationSubmitted: Boolean(application?.submittedAt),
      challengeStarted,
      challengeCompleted,
      challengeFinishAvailable,
    },
    recipient,
  };
};

const loadSettledReminderContext = async (
  payload: FunnelReminderPayload,
): Promise<ReminderContext> => {
  let reminder = await loadReminderContext(payload);
  while (
    payload.stage === "challenge_finish" &&
    reminder.pendingEvaluationUntil
  ) {
    const afterReservationExpires = new Date(
      Math.max(
        reminder.pendingEvaluationUntil.getTime() + 1_000,
        Date.now() + 1_000,
      ),
    );
    logger.info("Waiting for pending challenge evaluation", {
      clerkUserId: payload.clerkUserId,
      recheckAt: afterReservationExpires.toISOString(),
    });
    await wait.until({ date: afterReservationExpires });
    reminder = await loadReminderContext(payload);
  }
  return reminder;
};

const claimDelivery = async (
  payload: FunnelReminderPayload,
  deliveryScope: string,
  triggerRunId: string,
): Promise<boolean> => {
  const now = new Date();
  const [created] = await db
    .insert(funnelEmailDeliveries)
    .values({
      clerkUserId: payload.clerkUserId,
      stage: payload.stage,
      scopeId: deliveryScope,
      status: "sending",
      triggerRunId,
    })
    .onConflictDoNothing()
    .returning({ id: funnelEmailDeliveries.id });
  if (created) return true;

  const [delivery] = await db
    .select({
      status: funnelEmailDeliveries.status,
      triggerRunId: funnelEmailDeliveries.triggerRunId,
    })
    .from(funnelEmailDeliveries)
    .where(
      and(
        eq(funnelEmailDeliveries.clerkUserId, payload.clerkUserId),
        eq(funnelEmailDeliveries.stage, payload.stage),
        eq(funnelEmailDeliveries.scopeId, deliveryScope),
      ),
    )
    .limit(1);
  if (!delivery || delivery.status === "sent") return false;
  if (delivery.status === "sending") {
    return delivery.triggerRunId === triggerRunId;
  }

  const [claimed] = await db
    .update(funnelEmailDeliveries)
    .set({
      status: "sending",
      triggerRunId,
      error: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(funnelEmailDeliveries.clerkUserId, payload.clerkUserId),
        eq(funnelEmailDeliveries.stage, payload.stage),
        eq(funnelEmailDeliveries.scopeId, deliveryScope),
        eq(funnelEmailDeliveries.status, "failed"),
      ),
    )
    .returning({ id: funnelEmailDeliveries.id });
  return Boolean(claimed);
};

const updateDelivery = async (
  payload: FunnelReminderPayload,
  deliveryScope: string,
  triggerRunId: string,
  update:
    | { readonly status: "sent"; readonly sentAt: Date; readonly error: null }
    | { readonly status: "failed"; readonly error: string },
): Promise<void> => {
  await db
    .update(funnelEmailDeliveries)
    .set({ ...update, updatedAt: new Date() })
    .where(
      and(
        eq(funnelEmailDeliveries.clerkUserId, payload.clerkUserId),
        eq(funnelEmailDeliveries.stage, payload.stage),
        eq(funnelEmailDeliveries.scopeId, deliveryScope),
        eq(funnelEmailDeliveries.triggerRunId, triggerRunId),
      ),
    );
};

export const sendFunnelReminder = task<
  "send-funnel-reminder",
  FunnelReminderPayload,
  FunnelReminderResult
>({
  id: "send-funnel-reminder",
  queue: { concurrencyLimit: 5 },
  onFailure: async ({ payload, ctx, error }) => {
    try {
      const reminder = await loadReminderContext(payload);
      await updateDelivery(payload, reminder.deliveryScope, ctx.run.id, {
        status: "failed",
        error: String(error).slice(0, 4_000),
      });
    } catch (hookError) {
      logger.error("Could not mark funnel reminder as failed", {
        clerkUserId: payload.clerkUserId,
        stage: payload.stage,
        error: String(hookError),
      });
    }
  },
  run: async (payload: FunnelReminderPayload, { ctx }) => {
    const reminder = await loadSettledReminderContext(payload);
    if (
      !needsFunnelReminder(
        payload.stage,
        reminder.progress,
        isBlackBoxParticipationOpen(),
      )
    ) {
      logger.info("Skipping stale funnel reminder", {
        clerkUserId: payload.clerkUserId,
        stage: payload.stage,
      });
      return { status: "skipped" as const };
    }
    if (!reminder.recipient?.email) {
      throw new Error("Funnel reminder recipient has no email address");
    }

    const claimed = await claimDelivery(
      payload,
      reminder.deliveryScope,
      ctx.run.id,
    );
    if (!claimed) {
      logger.info("Skipping duplicate funnel reminder", {
        clerkUserId: payload.clerkUserId,
        deliveryScope: reminder.deliveryScope,
        stage: payload.stage,
      });
      return { status: "duplicate" as const };
    }

    try {
      await sendFunnelReminderEmail({
        clerkUserId: payload.clerkUserId,
        deliveryScope: reminder.deliveryScope,
        stage: payload.stage,
        ...reminder.recipient,
      });
    } catch (error) {
      await updateDelivery(payload, reminder.deliveryScope, ctx.run.id, {
        status: "failed",
        error: String(error).slice(0, 4_000),
      });
      throw error;
    }

    await updateDelivery(payload, reminder.deliveryScope, ctx.run.id, {
      status: "sent",
      sentAt: new Date(),
      error: null,
    });
    logger.info("Sent funnel reminder", {
      clerkUserId: payload.clerkUserId,
      stage: payload.stage,
    });
    return { status: "sent" as const };
  },
});
