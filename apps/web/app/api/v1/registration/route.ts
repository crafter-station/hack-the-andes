import {
  requireAuthenticatedParticipantProfile,
  requireParticipantUserId,
} from "@/lib/auth";
import { captureProductEvent } from "@/lib/posthog-server";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";
import {
  getRegistration,
  saveRegistrationDraft,
} from "@/lib/registration/service";

export const runtime = "nodejs";

export const GET = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participantUserId = await requireParticipantUserId(request);
    return jsonSuccess(requestId, await getRegistration(participantUserId));
  });

export const PUT = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipantProfile(request);
    const result = await saveRegistrationDraft(
      {
        clerkUserId: participant.clerkUserId,
        email: participant.email,
        name: participant.name,
      },
      await readJson(request),
    );
    await captureProductEvent({
      distinctId: participant.clerkUserId,
      event: "application_draft_saved",
      request,
      properties: {
        auth_token_type: participant.tokenType,
        missing_requirement_count: result.requirements.missing.length,
        can_submit_application: result.requirements.canSubmitApplication,
      },
    });
    return jsonSuccess(requestId, result);
  });
