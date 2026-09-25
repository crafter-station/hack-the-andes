import { requireBrowserParticipantProfile } from "@/lib/auth";
import { evaluationApprovalOptions } from "@/lib/challenges/evaluation-approvals";
import { publicRequestOrigin } from "@/lib/public-origin";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";

export const POST = (
  request: Request,
  context: { params: Promise<{ approvalId: string }> },
): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireBrowserParticipantProfile(request);
    const { approvalId } = await context.params;
    const result = await evaluationApprovalOptions(
      participant.clerkUserId,
      participant.email,
      participant.name,
      approvalId,
      publicRequestOrigin(request),
    );
    return jsonSuccess(requestId, result);
  });
