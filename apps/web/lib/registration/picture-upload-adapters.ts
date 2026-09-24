import { db } from "@chofex/db";
import { and, desc, eq, isNull, lt, or, sql } from "@chofex/db/orm";
import {
  acceptanceDetails,
  applications,
  participantBadges,
  participants,
} from "@chofex/db/schema";
import { maximumPictureBytes } from "@chofex/registration-contract";
import { del, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

import { requireAuthenticatedParticipant } from "@/lib/auth";
import { HttpError } from "./http";
import type { PictureUploadDependencies } from "./picture-upload";

const uploadLimit = 5;
const uploadWindowMilliseconds = 24 * 60 * 60 * 1_000;
type UploadIdentity = Parameters<PictureUploadDependencies["reserve"]>[0];

const forUploadTarget = <A>(
  identity: UploadIdentity,
  applicationOperation: () => A,
  badgeOperation: () => A,
): A => {
  if (identity.target === "badge") return badgeOperation();
  return applicationOperation();
};

const authorize: PictureUploadDependencies["authorize"] = async (request) => {
  const authentication = await requireAuthenticatedParticipant(request);
  const [current] = await db
    .select({
      applicationId: applications.id,
      clerkUserId: participants.clerkUserId,
      attendanceCompletedAt: acceptanceDetails.completedAt,
      applicationPendingPicturePathname: applications.pendingPicturePathname,
      badgePendingPicturePathname: participantBadges.pendingPicturePathname,
      status: applications.status,
    })
    .from(participants)
    .innerJoin(applications, eq(applications.participantId, participants.id))
    .leftJoin(
      acceptanceDetails,
      eq(acceptanceDetails.applicationId, applications.id),
    )
    .leftJoin(
      participantBadges,
      eq(participantBadges.applicationId, applications.id),
    )
    .where(eq(participants.clerkUserId, authentication.clerkUserId))
    .orderBy(desc(applications.createdAt))
    .limit(1);
  if (current?.status !== "accepted") {
    throw new HttpError(
      403,
      "PICTURE_UPLOAD_FORBIDDEN",
      "Solo los participantes aceptados pueden subir una foto",
    );
  }
  if (current.attendanceCompletedAt) {
    return {
      applicationId: current.applicationId,
      clerkUserId: current.clerkUserId,
      target: "badge",
      pendingPicturePathname: current.badgePendingPicturePathname ?? undefined,
    };
  }
  return {
    applicationId: current.applicationId,
    clerkUserId: current.clerkUserId,
    target: "application",
    pendingPicturePathname:
      current.applicationPendingPicturePathname ?? undefined,
  };
};

const reserveApplication: PictureUploadDependencies["reserve"] = async (
  identity,
  pathname,
) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - uploadWindowMilliseconds);
  const tokenExpiresAt = new Date(now.getTime() + 10 * 60 * 1_000);
  const [pending] = await db
    .select({
      pathname: applications.pendingPicturePathname,
      expiresAt: applications.pendingPictureExpiresAt,
    })
    .from(applications)
    .where(eq(applications.id, identity.applicationId))
    .limit(1);
  if (pending?.pathname && pending.expiresAt && pending.expiresAt > now) {
    throw new HttpError(
      409,
      "PICTURE_UPLOAD_PENDING",
      "Termina la carga pendiente antes de subir otra foto",
      true,
    );
  }
  const [reserved] = await db
    .update(applications)
    .set({
      pictureUploadWindowStartedAt: sql`case
        when ${applications.pictureUploadWindowStartedAt} is null
          or ${applications.pictureUploadWindowStartedAt} < ${cutoff}
        then ${now}
        else ${applications.pictureUploadWindowStartedAt}
      end`,
      pictureUploadCount: sql`case
        when ${applications.pictureUploadWindowStartedAt} is null
          or ${applications.pictureUploadWindowStartedAt} < ${cutoff}
        then 1
        else ${applications.pictureUploadCount} + 1
      end`,
      pendingPicturePathname: pathname,
      pendingPictureExpiresAt: tokenExpiresAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(applications.id, identity.applicationId),
        eq(applications.status, "accepted"),
        or(
          isNull(applications.pictureUploadWindowStartedAt),
          lt(applications.pictureUploadWindowStartedAt, cutoff),
          lt(applications.pictureUploadCount, uploadLimit),
        ),
        or(
          isNull(applications.pendingPicturePathname),
          isNull(applications.pendingPictureExpiresAt),
          lt(applications.pendingPictureExpiresAt, now),
        ),
      ),
    )
    .returning({ id: applications.id });
  if (!reserved) {
    throw new HttpError(
      429,
      "PICTURE_UPLOAD_RATE_LIMITED",
      "Puedes subir como máximo 5 fotos cada 24 horas",
      true,
    );
  }
  if (pending?.pathname) {
    await del(pending.pathname).catch(() => undefined);
  }
};

const reserveBadge: PictureUploadDependencies["reserve"] = async (
  identity,
  pathname,
) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - uploadWindowMilliseconds);
  const tokenExpiresAt = new Date(now.getTime() + 10 * 60 * 1_000);
  await db
    .insert(participantBadges)
    .values({ applicationId: identity.applicationId, status: "pending" })
    .onConflictDoNothing();
  const [pending] = await db
    .select({
      pathname: participantBadges.pendingPicturePathname,
      expiresAt: participantBadges.pendingPictureExpiresAt,
    })
    .from(participantBadges)
    .where(eq(participantBadges.applicationId, identity.applicationId))
    .limit(1);
  if (pending?.pathname && pending.expiresAt && pending.expiresAt > now) {
    throw new HttpError(
      409,
      "PICTURE_UPLOAD_PENDING",
      "Termina la carga pendiente antes de subir otra foto",
      true,
    );
  }
  const [reserved] = await db
    .update(participantBadges)
    .set({
      pictureUploadWindowStartedAt: sql`case
        when ${participantBadges.pictureUploadWindowStartedAt} is null
          or ${participantBadges.pictureUploadWindowStartedAt} < ${cutoff}
        then ${now}
        else ${participantBadges.pictureUploadWindowStartedAt}
      end`,
      pictureUploadCount: sql`case
        when ${participantBadges.pictureUploadWindowStartedAt} is null
          or ${participantBadges.pictureUploadWindowStartedAt} < ${cutoff}
        then 1
        else ${participantBadges.pictureUploadCount} + 1
      end`,
      pendingPicturePathname: pathname,
      pendingPictureExpiresAt: tokenExpiresAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(participantBadges.applicationId, identity.applicationId),
        or(
          isNull(participantBadges.pictureUploadWindowStartedAt),
          lt(participantBadges.pictureUploadWindowStartedAt, cutoff),
          lt(participantBadges.pictureUploadCount, uploadLimit),
        ),
        or(
          isNull(participantBadges.pendingPicturePathname),
          isNull(participantBadges.pendingPictureExpiresAt),
          lt(participantBadges.pendingPictureExpiresAt, now),
        ),
      ),
    )
    .returning({ applicationId: participantBadges.applicationId });
  if (!reserved) {
    throw new HttpError(
      429,
      "PICTURE_UPLOAD_RATE_LIMITED",
      "Puedes subir como máximo 5 fotos cada 24 horas",
      true,
    );
  }
  if (pending?.pathname) {
    await del(pending.pathname).catch(() => undefined);
  }
};

const reserve: PictureUploadDependencies["reserve"] = (identity, pathname) => {
  return forUploadTarget(
    identity,
    () => reserveApplication(identity, pathname),
    () => reserveBadge(identity, pathname),
  );
};

const issueToken: PictureUploadDependencies["issueToken"] = (options) =>
  generateClientTokenFromReadWriteToken({
    pathname: options.pathname,
    allowedContentTypes: [options.contentType],
    maximumSizeInBytes: options.maximumSizeInBytes,
    validUntil: Date.now() + 10 * 60 * 1_000,
    addRandomSuffix: false,
    allowOverwrite: false,
  });

const discardApplication: PictureUploadDependencies["discard"] = async (
  identity,
  pathname,
) => {
  const [updated] = await db
    .update(applications)
    .set({
      pendingPicturePathname: null,
      pendingPictureExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(applications.id, identity.applicationId),
        eq(applications.status, "accepted"),
        eq(applications.pendingPicturePathname, pathname),
      ),
    )
    .returning({ id: applications.id });
  if (!updated) {
    throw new HttpError(
      409,
      "PICTURE_UPLOAD_NOT_PENDING",
      "Esta carga no está pendiente o ya terminó",
    );
  }
};

const discardBadge: PictureUploadDependencies["discard"] = async (
  identity,
  pathname,
) => {
  const [updated] = await db
    .update(participantBadges)
    .set({
      pendingPicturePathname: null,
      pendingPictureExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(participantBadges.applicationId, identity.applicationId),
        eq(participantBadges.pendingPicturePathname, pathname),
      ),
    )
    .returning({ applicationId: participantBadges.applicationId });
  if (!updated) {
    throw new HttpError(
      409,
      "PICTURE_UPLOAD_NOT_PENDING",
      "Esta carga no está pendiente o ya terminó",
    );
  }
};

const discard: PictureUploadDependencies["discard"] = (identity, pathname) => {
  return forUploadTarget(
    identity,
    () => discardApplication(identity, pathname),
    () => discardBadge(identity, pathname),
  );
};

const inspect: PictureUploadDependencies["inspect"] = async (completion) => {
  let suppliedUrl: URL;
  try {
    suppliedUrl = new URL(completion.url);
  } catch {
    throw new HttpError(
      415,
      "INVALID_PICTURE",
      "La URL de la foto subida no es válida",
    );
  }
  if (
    suppliedUrl.protocol !== "https:" ||
    !suppliedUrl.hostname.endsWith(".blob.vercel-storage.com")
  ) {
    throw new HttpError(
      415,
      "INVALID_PICTURE",
      "La URL de la foto subida no es válida",
    );
  }
  // Resolve the reserved pathname with this app's Blob credentials instead of
  // trusting a client-supplied store URL. A matching pathname can exist in a
  // different Vercel Blob store controlled by an attacker.
  const metadata = await head(completion.pathname);
  if (
    metadata.pathname !== completion.pathname ||
    metadata.url !== completion.url ||
    metadata.size < 1 ||
    metadata.size > maximumPictureBytes ||
    !["image/jpeg", "image/png", "image/webp"].includes(metadata.contentType)
  ) {
    throw new HttpError(415, "INVALID_PICTURE", "La foto subida no es válida");
  }
  const response = await fetch(metadata.url, {
    headers: { range: "bytes=0-11" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new HttpError(
      502,
      "PICTURE_VERIFICATION_FAILED",
      "No se pudo verificar la foto subida",
      true,
    );
  }
  const contentType = metadata.contentType as
    | "image/jpeg"
    | "image/png"
    | "image/webp";
  return {
    contentType,
    size: metadata.size,
    firstBytes: new Uint8Array(await response.arrayBuffer()),
  };
};

const recordApplication: PictureUploadDependencies["record"] = async (
  identity,
  completion,
) => {
  const [current] = await db
    .select({ url: applications.customPictureUrl })
    .from(applications)
    .where(eq(applications.id, identity.applicationId))
    .limit(1);
  const [updated] = await db
    .update(applications)
    .set({
      customPictureUrl: completion.url,
      customPicturePathname: completion.pathname,
      pendingPicturePathname: null,
      pendingPictureExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(applications.id, identity.applicationId),
        eq(applications.status, "accepted"),
        eq(applications.pendingPicturePathname, completion.pathname),
      ),
    )
    .returning({ id: applications.id });
  if (!updated) {
    throw new HttpError(
      409,
      "INVALID_APPLICATION_STATE",
      "La postulación ya no está aceptada",
    );
  }
  return current?.url ?? undefined;
};

const recordBadge: PictureUploadDependencies["record"] = async (
  identity,
  completion,
) => {
  const [current] = await db
    .select({
      url: participantBadges.customPictureUrl,
      selectedUrl: participantBadges.pictureUrl,
    })
    .from(participantBadges)
    .where(eq(participantBadges.applicationId, identity.applicationId))
    .limit(1);
  const [updated] = await db
    .update(participantBadges)
    .set({
      customPictureUrl: completion.url,
      customPicturePathname: completion.pathname,
      pendingPicturePathname: null,
      pendingPictureExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(participantBadges.applicationId, identity.applicationId),
        eq(participantBadges.pendingPicturePathname, completion.pathname),
      ),
    )
    .returning({ applicationId: participantBadges.applicationId });
  if (!updated) {
    throw new HttpError(
      409,
      "INVALID_APPLICATION_STATE",
      "La postulación ya no está aceptada",
    );
  }
  if (current?.url === current?.selectedUrl) return undefined;
  return current?.url ?? undefined;
};

const record: PictureUploadDependencies["record"] = (identity, completion) => {
  return forUploadTarget(
    identity,
    () => recordApplication(identity, completion),
    () => recordBadge(identity, completion),
  );
};

export const pictureUploadDependencies: PictureUploadDependencies = {
  authorize,
  reserve,
  issueToken,
  discard,
  inspect,
  record,
  remove: (url) => del(url),
  randomId: () => crypto.randomUUID(),
};
