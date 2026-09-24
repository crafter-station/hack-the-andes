import { requireAuthenticatedParticipantProfile } from "@/lib/auth";
import { enqueueBadgeGeneration } from "@/lib/badges/enqueue";
import { captureProductEvent } from "@/lib/posthog-server";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";
import { submitAcceptedDetails } from "@/lib/registration/service";

export const runtime = "nodejs";

export const PUT = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipantProfile(request);
    const result = await submitAcceptedDetails(
      {
        clerkUserId: participant.clerkUserId,
        email: participant.email,
        clerkPictureUrl: participant.clerkPictureUrl,
      },
      await readJson(request),
    );
    await enqueueBadgeGeneration(result.registration.id, { force: true });
    await captureProductEvent({
      distinctId: participant.clerkUserId,
      event: "attendance_confirmed",
      request,
      properties: {
        auth_token_type: participant.tokenType,
        application_status: result.registration.status,
      },
    });
    return jsonSuccess(requestId, result);
  });
