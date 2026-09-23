import { db } from "@chofex/db";
import { and, desc, eq, isNull, lt, or, sql } from "@chofex/db/orm";
import { applications, participants } from "@chofex/db/schema";
import { maximumPictureBytes } from "@chofex/registration-contract";
import { del, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

import { requireAuthenticatedParticipant } from "@/lib/auth";
import { HttpError } from "./http";
import type { PictureUploadDependencies } from "./picture-upload";

const uploadLimit = 5;
const uploadWindowMilliseconds = 24 * 60 * 60 * 1_000;

const authorize: PictureUploadDependencies["authorize"] = async (request) => {
  const authentication = await requireAuthenticatedParticipant(request);
  const [current] = await db
    .select({
      applicationId: applications.id,
      clerkUserId: participants.clerkUserId,
      pendingPicturePathname: applications.pendingPicturePathname,
      status: applications.status,
    })
    .from(participants)
    .innerJoin(applications, eq(applications.participantId, participants.id))
    .where(eq(participants.clerkUserId, authentication.clerkUserId))
    .orderBy(desc(applications.createdAt))
    .limit(1);
  if (current?.status !== "accepted") {
    throw new HttpError(
      403,
      "PICTURE_UPLOAD_FORBIDDEN",
      "Only accepted participants can upload a picture",
    );
  }
  return {
    applicationId: current.applicationId,
    clerkUserId: current.clerkUserId,
    pendingPicturePathname: current.pendingPicturePathname ?? undefined,
  };
};

const reserve: PictureUploadDependencies["reserve"] = async (
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
      "Finish the pending picture upload before starting another",
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
      "You can upload at most 5 pictures every 24 hours",
      true,
    );
  }
  if (pending?.pathname) {
    await del(pending.pathname).catch(() => undefined);
  }
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

const discard: PictureUploadDependencies["discard"] = async (
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
      "This picture upload is not pending or was already completed",
    );
  }
};

const inspect: PictureUploadDependencies["inspect"] = async (completion) => {
  let suppliedUrl: URL;
  try {
    suppliedUrl = new URL(completion.url);
  } catch {
    throw new HttpError(
      415,
      "INVALID_PICTURE",
      "Uploaded picture URL is invalid",
    );
  }
  if (
    suppliedUrl.protocol !== "https:" ||
    !suppliedUrl.hostname.endsWith(".blob.vercel-storage.com")
  ) {
    throw new HttpError(
      415,
      "INVALID_PICTURE",
      "Uploaded picture URL is invalid",
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
    throw new HttpError(415, "INVALID_PICTURE", "Uploaded picture is invalid");
  }
  const response = await fetch(metadata.url, {
    headers: { range: "bytes=0-11" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new HttpError(
      502,
      "PICTURE_VERIFICATION_FAILED",
      "Could not verify uploaded picture",
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

const record: PictureUploadDependencies["record"] = async (
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
      "Application is no longer accepted",
    );
  }
  return current?.url ?? undefined;
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
