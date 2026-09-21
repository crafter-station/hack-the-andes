import { db } from "@chofex/db";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
  sql,
} from "@chofex/db/orm";
import {
  acceptanceDetails,
  applications,
  challengeAttempts,
  challengeEvaluations,
  participantBadges,
  participants,
} from "@chofex/db/schema";
import { clerkClient } from "@clerk/nextjs/server";

import { HttpError } from "@/lib/registration/http";
import { currentChallengeVersion } from "../challenges/engine";
import { challengeProgressForParticipants } from "../challenges/service";
import { candidateAvatarUrl } from "./avatars";
import { type ApplicationDecision, buildDecisionEmail } from "./decision-email";
import {
  candidateFunnelApplicationCondition,
  candidateFunnelStatusExpression,
  candidateFunnelStatusFor,
} from "./funnel-status";
import {
  type Candidate,
  type CandidateCounts,
  type CandidateFilter,
  type CandidatePage,
  candidateFunnelStatuses,
  reviewableCandidateStatuses,
} from "./types";

const pageSize = 10;
const decisionEmailFrom = "hackathons@crafterstation.com";
const decisionEmailReplyTo = "anthony@crafterstation.com";

const optional = <A>(value: A | null | undefined): A | undefined =>
  value ?? undefined;

const dateString = (value: Date | string): string => {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

const instantString = (value: Date | null | undefined): string | undefined => {
  if (!value) return undefined;
  return value.toISOString();
};

type ApplicationRecord = typeof applications.$inferSelect;
type DecidedApplication = ApplicationRecord & {
  readonly status: "accepted" | "rejected";
};
type DecisionRecord = {
  readonly application: DecidedApplication;
  readonly attemptNumber: number;
};
type ApplicationHistoryRecord = {
  readonly application: ApplicationRecord;
  readonly attemptNumber: number;
};

const isDecidedApplication = (
  application: ApplicationRecord,
): application is DecidedApplication =>
  application.status === "accepted" || application.status === "rejected";

type CandidateRecord = {
  readonly application: ApplicationRecord;
  readonly details: typeof acceptanceDetails.$inferSelect | null;
  readonly badge: typeof participantBadges.$inferSelect | null;
  readonly clerkUserId: string;
  readonly participantCreatedAt: Date;
  readonly attemptNumber: number;
  readonly applicationHistory: ReadonlyArray<ApplicationHistoryRecord>;
  readonly decisionHistory: ReadonlyArray<DecisionRecord>;
};

interface ChallengeMilestone {
  readonly startedAt: string;
  readonly completedAt?: string;
}

const challengeMilestonesForParticipants = async (
  participantIds: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, ReadonlyMap<string, ChallengeMilestone>>> => {
  if (participantIds.length === 0) return new Map();
  const attempts = await db
    .select()
    .from(challengeAttempts)
    .where(
      and(
        inArray(challengeAttempts.participantId, participantIds),
        eq(challengeAttempts.challengeVersion, currentChallengeVersion),
      ),
    );
  const attemptIds = attempts.map((attempt) => attempt.id);
  const completedAtByAttemptId = new Map<string, Date>();
  if (attemptIds.length > 0) {
    const evaluations = await db
      .select({
        attemptId: challengeEvaluations.attemptId,
        createdAt: challengeEvaluations.createdAt,
      })
      .from(challengeEvaluations)
      .where(inArray(challengeEvaluations.attemptId, attemptIds));
    for (const evaluation of evaluations) {
      const completedAt = completedAtByAttemptId.get(evaluation.attemptId);
      if (!completedAt || evaluation.createdAt < completedAt) {
        completedAtByAttemptId.set(evaluation.attemptId, evaluation.createdAt);
      }
    }
  }

  const milestonesByParticipant = new Map<
    string,
    Map<string, ChallengeMilestone>
  >();
  for (const attempt of attempts) {
    const participantMilestones =
      milestonesByParticipant.get(attempt.participantId) ?? new Map();
    participantMilestones.set(attempt.challengeSlug, {
      startedAt: attempt.createdAt.toISOString(),
      completedAt: instantString(completedAtByAttemptId.get(attempt.id)),
    });
    milestonesByParticipant.set(attempt.participantId, participantMilestones);
  }
  return milestonesByParticipant;
};

const toCandidate = (
  record: CandidateRecord,
  clerkPictureUrl: string | undefined,
  approvedBy: string | undefined,
  clerkNames: ReadonlyMap<string, string>,
  challenges: Candidate["challenges"],
): Candidate => {
  const { application, details } = record;
  const submittedAt = instantString(application.submittedAt);
  let dateOfBirth: string | undefined;
  if (details?.dateOfBirth) dateOfBirth = dateString(details.dateOfBirth);
  const decisionHistory = record.decisionHistory.map((decisionRecord) => {
    const decision = decisionRecord.application;
    const decidedAt = decision.decidedAt ?? decision.updatedAt;
    const reviewerId = decision.decidedByClerkUserId;
    let decidedBy: string | undefined;
    if (reviewerId) decidedBy = clerkNames.get(reviewerId) ?? reviewerId;
    return {
      applicationId: decision.id,
      attemptNumber: decisionRecord.attemptNumber,
      decision: decision.status,
      at: decidedAt.toISOString(),
      decidedBy,
      message: optional(decision.rejectionReason),
    };
  });
  const applicationHistory = record.applicationHistory.map(
    ({ application: attempt, attemptNumber }) => {
      let decidedAt: string | undefined;
      if (isDecidedApplication(attempt)) {
        decidedAt = (attempt.decidedAt ?? attempt.updatedAt).toISOString();
      }
      let withdrawnAt: string | undefined;
      if (attempt.status === "withdrawn") {
        withdrawnAt = attempt.updatedAt.toISOString();
      }
      return {
        applicationId: attempt.id,
        attemptNumber,
        status: attempt.status,
        startedAt: attempt.createdAt.toISOString(),
        submittedAt: instantString(attempt.submittedAt),
        decidedAt,
        withdrawnAt,
      };
    },
  );

  return {
    id: application.id,
    participantId: application.participantId,
    firstName: application.firstName ?? "Unknown",
    lastName: application.lastName ?? "participant",
    email: application.email ?? "",
    avatarUrl: candidateAvatarUrl(
      optional(application.pictureUrl),
      clerkPictureUrl,
      application.githubUrl,
    ),
    pronouns: optional(application.pronouns),
    countryCode: optional(application.countryCode),
    city: optional(application.city),
    participationMode: optional(application.participationMode),
    organization: optional(application.organization),
    role: optional(application.role),
    applicationPhone: optional(application.phone),
    fieldOfStudy: optional(application.fieldOfStudy),
    graduationYear: optional(application.graduationYear),
    shippedProject: optional(application.shippedProject),
    hackathonProject: optional(application.hackathonProject),
    bio: optional(application.bio),
    githubUrl: optional(application.githubUrl),
    linkedInUrl: optional(application.linkedInUrl),
    portfolioUrl: optional(application.portfolioUrl),
    badgeUrl: optional(record.badge?.badgeUrl),
    teamPreference: optional(application.teamPreference),
    teamName: optional(application.teamName),
    status: application.status,
    funnelStatus: candidateFunnelStatusFor(
      application.status,
      submittedAt,
      challenges,
    ),
    mediaConsent: details?.mediaConsent ?? application.mediaConsent,
    signedUpAt: record.participantCreatedAt.toISOString(),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    submittedAt,
    decidedAt: instantString(application.decidedAt),
    approvedBy,
    attemptNumber: record.attemptNumber,
    applicationHistory,
    decisionHistory,
    documentFullName: optional(details?.fullName),
    phone: optional(details?.phone),
    dateOfBirth,
    shirtSize: optional(details?.shirtSize),
    dietaryRestrictions: optional(details?.dietaryRestrictions),
    accessibilityNeeds: optional(details?.accessibilityNeeds),
    emergencyContactName: optional(details?.emergencyContactName),
    emergencyContactPhone: optional(details?.emergencyContactPhone),
    attendanceCompletedAt: instantString(details?.completedAt),
    checkedInAt: instantString(details?.checkedInAt),
    nationalIdProvided: Boolean(details?.nationalIdNumber),
    challenges,
  };
};

const toCandidates = async (
  records: ReadonlyArray<CandidateRecord>,
): Promise<ReadonlyArray<Candidate>> => {
  const participantIds = [
    ...new Set(records.map((record) => record.application.participantId)),
  ];
  const [clerk, challengeProgressByParticipant, milestonesByParticipant] =
    await Promise.all([
      clerkClient(),
      challengeProgressForParticipants(participantIds),
      challengeMilestonesForParticipants(participantIds),
    ]);
  const clerkUserIds = [
    ...new Set(records.map((record) => record.clerkUserId)),
  ];
  const reviewerIds = records.flatMap((record) =>
    record.decisionHistory.flatMap(({ application: decision }) => {
      const reviewerId = decision.decidedByClerkUserId;
      if (reviewerId) return [reviewerId];
      return [];
    }),
  );
  const approverIds = records.flatMap((record) => {
    if (record.application.status !== "accepted") return [];
    const approverId = record.application.decidedByClerkUserId;
    if (approverId) return [approverId];
    return [];
  });
  const allClerkUserIds = [
    ...new Set([...clerkUserIds, ...reviewerIds, ...approverIds]),
  ];
  const clerkPictures = new Map<string, string>();
  const clerkNames = new Map<string, string>();

  await Promise.all(
    allClerkUserIds.map(async (clerkUserId) => {
      try {
        const user = await clerk.users.getUser(clerkUserId);
        if (user.hasImage) clerkPictures.set(clerkUserId, user.imageUrl);
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
        const primaryEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId,
        )?.emailAddress;
        clerkNames.set(clerkUserId, name || primaryEmail || clerkUserId);
      } catch {
        // A missing Clerk user should not prevent admins from reviewing applications.
      }
    }),
  );

  return records.map((record) => {
    let approvedBy: string | undefined;
    if (record.application.status === "accepted") {
      const approverId = record.application.decidedByClerkUserId;
      if (approverId) approvedBy = clerkNames.get(approverId) ?? approverId;
    }
    const milestones = milestonesByParticipant.get(
      record.application.participantId,
    );
    const challenges = (
      challengeProgressByParticipant.get(record.application.participantId) ?? []
    ).map((challenge) => ({
      ...challenge,
      ...milestones?.get(challenge.slug),
    }));
    return toCandidate(
      record,
      clerkPictures.get(record.clerkUserId),
      approvedBy,
      clerkNames,
      challenges,
    );
  });
};

const addAttemptHistory = async <
  BaseRecord extends Omit<
    CandidateRecord,
    "attemptNumber" | "applicationHistory" | "decisionHistory"
  >,
>(
  records: ReadonlyArray<BaseRecord>,
): Promise<ReadonlyArray<CandidateRecord>> => {
  const participantIds = [
    ...new Set(records.map((record) => record.application.participantId)),
  ];
  if (participantIds.length === 0) return [];

  const history = await db
    .select()
    .from(applications)
    .where(inArray(applications.participantId, participantIds))
    .orderBy(desc(applications.createdAt), desc(applications.id));
  const historyByParticipant = new Map<string, Array<ApplicationRecord>>();
  for (const application of history) {
    const existing = historyByParticipant.get(application.participantId) ?? [];
    existing.push(application);
    historyByParticipant.set(application.participantId, existing);
  }

  return records.map((record) => {
    const attempts =
      historyByParticipant.get(record.application.participantId) ?? [];
    return {
      ...record,
      attemptNumber: attempts.length,
      applicationHistory: attempts.map((attempt, index) => ({
        application: attempt,
        attemptNumber: attempts.length - index,
      })),
      decisionHistory: attempts.flatMap((attempt, index) => {
        if (!isDecidedApplication(attempt)) return [];
        return [
          { application: attempt, attemptNumber: attempts.length - index },
        ];
      }),
    };
  });
};

const candidateRecordById = async (
  applicationId: string,
): Promise<CandidateRecord | undefined> => {
  const [record] = await db
    .select({
      application: applications,
      details: acceptanceDetails,
      badge: participantBadges,
      clerkUserId: participants.clerkUserId,
      participantCreatedAt: participants.createdAt,
    })
    .from(applications)
    .innerJoin(participants, eq(participants.id, applications.participantId))
    .leftJoin(
      acceptanceDetails,
      eq(acceptanceDetails.applicationId, applications.id),
    )
    .leftJoin(
      participantBadges,
      eq(participantBadges.applicationId, applications.id),
    )
    .where(eq(applications.id, applicationId))
    .limit(1);
  if (!record) return undefined;
  const [candidateRecord] = await addAttemptHistory([record]);
  return candidateRecord;
};

type MutableCandidateCounts = {
  -readonly [Key in keyof CandidateCounts]: number;
};

const emptyCounts = (): MutableCandidateCounts => {
  const entries: Array<[keyof CandidateCounts, number]> = [["all", 0]];
  for (const status of candidateFunnelStatuses) entries.push([status, 0]);
  return Object.fromEntries(entries) as MutableCandidateCounts;
};

export interface CandidateListInput {
  readonly page?: number;
  readonly query?: string;
  readonly status?: CandidateFilter;
}

export const listCandidates = async (
  input: CandidateListInput,
): Promise<CandidatePage> => {
  const requestedPage = Math.max(1, Math.floor(input.page ?? 1));
  const search = input.query?.trim();
  let searchCondition: SQL | undefined;
  if (search) {
    searchCondition = or(
      ilike(applications.firstName, `%${search}%`),
      ilike(applications.lastName, `%${search}%`),
      ilike(applications.email, `%${search}%`),
      ilike(applications.organization, `%${search}%`),
    );
  }
  const funnelStatus = candidateFunnelStatusExpression();
  const visibleInFunnel = candidateFunnelApplicationCondition();
  let statusCondition: SQL | undefined;
  if (input.status) statusCondition = sql`${funnelStatus} = ${input.status}`;
  const latestApplications = db
    .selectDistinctOn([applications.participantId], { id: applications.id })
    .from(applications)
    .orderBy(
      applications.participantId,
      desc(applications.createdAt),
      desc(applications.id),
    )
    .as("latest_applications");
  const funnelSummary = db
    .select({ status: funnelStatus.as("status") })
    .from(applications)
    .innerJoin(latestApplications, eq(latestApplications.id, applications.id))
    .where(and(visibleInFunnel, searchCondition))
    .as("funnel_summary");
  const whereCondition = and(visibleInFunnel, searchCondition, statusCondition);

  const [totalResult, statusResults, authenticatedUserCount] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(applications)
        .innerJoin(
          latestApplications,
          eq(latestApplications.id, applications.id),
        )
        .where(whereCondition),
      db
        .select({ status: funnelSummary.status, value: count() })
        .from(funnelSummary)
        .groupBy(funnelSummary.status),
      clerkClient().then((clerk) => clerk.users.getCount()),
    ]);

  const total = totalResult[0]?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const records = await db
    .select({
      application: applications,
      details: acceptanceDetails,
      badge: participantBadges,
      clerkUserId: participants.clerkUserId,
      participantCreatedAt: participants.createdAt,
    })
    .from(applications)
    .innerJoin(latestApplications, eq(latestApplications.id, applications.id))
    .innerJoin(participants, eq(participants.id, applications.participantId))
    .leftJoin(
      acceptanceDetails,
      eq(acceptanceDetails.applicationId, applications.id),
    )
    .leftJoin(
      participantBadges,
      eq(participantBadges.applicationId, applications.id),
    )
    .where(whereCondition)
    .orderBy(desc(applications.createdAt))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  const counts = emptyCounts();
  for (const result of statusResults) {
    counts[result.status] = result.value;
    counts.all += result.value;
  }

  const candidates = await toCandidates(await addAttemptHistory(records));

  return {
    candidates,
    authenticatedUserCount,
    counts,
    page: currentPage,
    pageSize,
    total,
    totalPages,
  };
};

export interface CandidateDecisionInput {
  readonly applicationId: string;
  readonly decision: ApplicationDecision;
  readonly message?: string;
  readonly notify: boolean;
  readonly decidedByClerkUserId: string;
}

export interface CandidateDecisionResult {
  readonly candidate: Candidate;
  readonly emailStatus: "not_requested" | "sent" | "failed";
  readonly emailError?: string;
}

const sendDecisionEmail = async (
  candidate: Candidate,
  decision: CandidateDecisionInput["decision"],
  message: string | undefined,
): Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: string }
> => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Resend is not configured" };
  }
  if (!candidate.email) {
    return { ok: false, error: "Candidate does not have an email address" };
  }

  const email = buildDecisionEmail({
    decision,
    firstName: candidate.firstName,
    message,
  });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": `application-decision/${candidate.id}/${decision}`,
    },
    body: JSON.stringify({
      from: decisionEmailFrom,
      to: [candidate.email],
      reply_to: decisionEmailReplyTo,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => undefined)) as
      | { readonly message?: string }
      | undefined;
    return {
      ok: false,
      error: error?.message ?? `Resend returned HTTP ${response.status}`,
    };
  }
  return { ok: true };
};

export const decideCandidate = async (
  input: CandidateDecisionInput,
): Promise<CandidateDecisionResult> => {
  const message = input.message?.trim() || undefined;
  if (message && message.length > 2_000) {
    throw new HttpError(
      422,
      "MESSAGE_TOO_LONG",
      "The optional message must be 2,000 characters or fewer",
    );
  }

  const [updatedApplication] = await db
    .update(applications)
    .set({
      status: input.decision,
      decidedAt: new Date(),
      decidedByClerkUserId: input.decidedByClerkUserId,
      rejectionReason: input.decision === "rejected" ? message : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(applications.id, input.applicationId),
        inArray(applications.status, [...reviewableCandidateStatuses]),
      ),
    )
    .returning();

  const record = await candidateRecordById(input.applicationId);
  if (!record) {
    throw new HttpError(404, "APPLICATION_NOT_FOUND", "Application not found");
  }
  if (!updatedApplication) {
    const isSameDecision = record.application.status === input.decision;
    const isSameReviewer =
      record.application.decidedByClerkUserId === input.decidedByClerkUserId;
    if (!isSameDecision || !isSameReviewer) {
      throw new HttpError(
        409,
        "APPLICATION_NOT_REVIEWABLE",
        "This application has already been decided or is not ready for review",
      );
    }
  }
  const [candidate] = await toCandidates([record]);
  if (!candidate) throw new Error("Candidate conversion returned no result");

  if (!input.notify) {
    return { candidate, emailStatus: "not_requested" };
  }

  try {
    const email = await sendDecisionEmail(candidate, input.decision, message);
    if (email.ok) return { candidate, emailStatus: "sent" };
    return { candidate, emailStatus: "failed", emailError: email.error };
  } catch (error) {
    console.error("Decision email failed", error);
    return {
      candidate,
      emailStatus: "failed",
      emailError: "The decision was saved, but the email could not be sent",
    };
  }
};
