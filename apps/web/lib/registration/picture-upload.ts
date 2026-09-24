import {
  detectPictureContentType,
  maximumPictureBytes,
  type PictureUpload,
  PictureUploadCompletionSchema,
  type PictureUploadGrant,
  PictureUploadRequestSchema,
} from "@chofex/registration-contract";
import { Result, Schema } from "effect";

import { HttpError, readJson } from "./http";

type PictureContentType = PictureUpload["contentType"];

interface UploadIdentity {
  readonly applicationId: string;
  readonly clerkUserId: string;
  /** Attendance uploads belong to the application; later ones to the badge. */
  readonly target: "application" | "badge";
  readonly pendingPicturePathname?: string;
}

interface StoredPicture {
  readonly contentType: PictureContentType;
  readonly size: number;
  readonly firstBytes: Uint8Array;
}

export interface PictureUploadDependencies {
  readonly authorize: (request: Request) => Promise<UploadIdentity>;
  readonly reserve: (
    identity: UploadIdentity,
    pathname: string,
  ) => Promise<void>;
  readonly issueToken: (options: {
    readonly pathname: string;
    readonly contentType: PictureContentType;
    readonly maximumSizeInBytes: number;
  }) => Promise<string>;
  readonly discard: (
    identity: UploadIdentity,
    pathname: string,
  ) => Promise<void>;
  readonly inspect: (completion: {
    readonly pathname: string;
    readonly url: string;
  }) => Promise<StoredPicture>;
  readonly record: (
    identity: UploadIdentity,
    completion: { readonly pathname: string; readonly url: string },
  ) => Promise<string | undefined>;
  readonly remove: (url: string) => Promise<void>;
  readonly randomId: () => string;
}

const parse = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown,
): S["Type"] => {
  const result = Schema.decodeUnknownResult(schema, {
    onExcessProperty: "error",
  })(input);
  if (Result.isSuccess(result)) return result.success;
  throw new HttpError(
    422,
    "VALIDATION_ERROR",
    "Los datos de la foto no son válidos",
    false,
    {
      issues: String(result.failure),
    },
  );
};

const extensionFor = (contentType: PictureContentType): string => {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
};

const beginUpload = async (
  request: Request,
  dependencies: PictureUploadDependencies,
): Promise<PictureUploadGrant> => {
  const input = parse(PictureUploadRequestSchema, await readJson(request));
  const identity = await dependencies.authorize(request);
  const extension = extensionFor(input.contentType);
  const pathname = [
    "profile-pictures",
    identity.clerkUserId,
    identity.applicationId,
    `${dependencies.randomId()}.${extension}`,
  ].join("/");
  await dependencies.reserve(identity, pathname);
  let clientToken: string;
  try {
    clientToken = await dependencies.issueToken({
      pathname,
      contentType: input.contentType,
      maximumSizeInBytes: maximumPictureBytes,
    });
  } catch (error) {
    await dependencies.discard(identity, pathname).catch(() => undefined);
    throw error;
  }
  return { pathname, clientToken };
};

const completeUpload = async (
  request: Request,
  dependencies: PictureUploadDependencies,
): Promise<PictureUpload> => {
  const completion = parse(
    PictureUploadCompletionSchema,
    await readJson(request),
  );
  const identity = await dependencies.authorize(request);
  const expectedPrefix = `profile-pictures/${identity.clerkUserId}/${identity.applicationId}/`;
  if (!completion.pathname.startsWith(expectedPrefix)) {
    throw new HttpError(
      403,
      "PICTURE_UPLOAD_FORBIDDEN",
      "Esta carga no te pertenece",
    );
  }
  if (identity.pendingPicturePathname !== completion.pathname) {
    throw new HttpError(
      409,
      "PICTURE_UPLOAD_NOT_PENDING",
      "Esta carga no está pendiente o ya terminó",
    );
  }

  let picture: StoredPicture;
  try {
    picture = await dependencies.inspect(completion);
  } catch (error) {
    if (error instanceof HttpError && error.code === "INVALID_PICTURE") {
      await dependencies.discard(identity, completion.pathname);
      await dependencies.remove(completion.pathname).catch(() => undefined);
    }
    throw error;
  }
  const validSize = picture.size > 0 && picture.size <= maximumPictureBytes;
  const detectedContentType = detectPictureContentType(picture.firstBytes);
  const validContent = detectedContentType === picture.contentType;
  if (!validSize || !validContent) {
    await dependencies.discard(identity, completion.pathname);
    await dependencies.remove(completion.pathname).catch(() => undefined);
    throw new HttpError(
      415,
      "INVALID_PICTURE",
      "La foto debe ser JPEG, PNG o WebP y pesar como máximo 5 MB",
    );
  }

  const previousUrl = await dependencies.record(identity, completion);
  if (previousUrl && previousUrl !== completion.url) {
    await dependencies.remove(previousUrl).catch(() => undefined);
  }
  return {
    url: completion.url,
    contentType: picture.contentType,
    size: picture.size,
  };
};

export const handlePictureUpload = (
  request: Request,
  dependencies: PictureUploadDependencies,
): Promise<PictureUploadGrant | PictureUpload> => {
  if (request.method === "POST") return beginUpload(request, dependencies);
  if (request.method === "PUT") return completeUpload(request, dependencies);
  throw new HttpError(405, "METHOD_NOT_ALLOWED", "Método no permitido");
};
