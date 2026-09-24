import { requireAuthenticatedParticipantProfile } from "@/lib/auth";
import { enqueueBadgeGeneration } from "@/lib/badges/enqueue";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";
import { handlePictureUpload } from "@/lib/registration/picture-upload";
import { pictureUploadDependencies } from "@/lib/registration/picture-upload-adapters";
import { changePictureSource } from "@/lib/registration/service";

export const runtime = "nodejs";

const respond = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) =>
    jsonSuccess(
      requestId,
      await handlePictureUpload(request, pictureUploadDependencies),
    ),
  );

export const POST = respond;
export const PUT = respond;

/**
 * Change which picture the badge carries.
 *
 * Separate from POST and PUT above, which move bytes: those store an
 * upload against the badge profile and stop. Only a selection turns one
 * of the available pictures into the `pictureUrl` the card draws,
 * and attendance — where that normally happens — is a one-time
 * submission of private details that a photograph swap has no business
 * re-sending.
 */
export const PATCH = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipantProfile(request);
    const body = (await readJson(request)) as { pictureSource?: unknown };
    const result = await changePictureSource(
      {
        clerkUserId: participant.clerkUserId,
        email: participant.email,
        clerkPictureUrl: participant.clerkPictureUrl,
      },
      body?.pictureSource,
    );
    await enqueueBadgeGeneration(result.registration.id, { force: true });
    return jsonSuccess(requestId, result);
  });
