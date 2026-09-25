import { requireBrowserParticipantProfile } from "@/lib/auth";
import { verifyEvaluationApproval } from "@/lib/challenges/evaluation-approvals";
import { jsonSuccess, readJson, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";

export const POST = (
  request: Request,
  context: { params: Promise<{ approvalId: string }> },
): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    const participant = await requireBrowserParticipantProfile(request);
    const { approvalId } = await context.params;
    const response = await readJson(request);
    const approval = await verifyEvaluationApproval(
      participant.clerkUserId,
      approvalId,
      response,
    );
    return jsonSuccess(requestId, approval);
  });
