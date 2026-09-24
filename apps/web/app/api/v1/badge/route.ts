import { requireAuthenticatedParticipantProfile } from "@/lib/auth";
import { enqueueBadgeGeneration } from "@/lib/badges/enqueue";
import {
  badgeRegenerationInput,
  updateBadgeProfile,
} from "@/lib/badges/profile";
import { getParticipantBadge } from "@/lib/badges/service";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";

export const GET = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipantProfile(request);
    const badge = await getParticipantBadge(participant.clerkUserId);
    return jsonSuccess(requestId, badge);
  });

export const PATCH = (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireAuthenticatedParticipantProfile(request);
    const input = badgeRegenerationInput(await readJson(request));
    const applicationId = await updateBadgeProfile(participant, input);
    await enqueueBadgeGeneration(applicationId, { force: true });
    return jsonSuccess(
      requestId,
      await getParticipantBadge(participant.clerkUserId),
    );
  });
