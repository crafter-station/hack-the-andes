import { requireAdminIdentity } from "@/lib/admin/auth";
import { listCandidates } from "@/lib/admin/candidates";
import {
  parseCandidateFilter,
  parseCandidateRankingSort,
} from "@/lib/admin/types";
import { jsonSuccess, withApiHandler } from "@/lib/registration/http";

export const runtime = "nodejs";

export const GET = async (request: Request): Promise<Response> =>
  withApiHandler(request, async (requestId) => {
    await requireAdminIdentity();

    const parameters = new URL(request.url).searchParams;
    const parsedPage = Number.parseInt(parameters.get("page") ?? "1", 10);
    const page = Number.isFinite(parsedPage) ? parsedPage : 1;
    const query = parameters.get("q")?.trim().slice(0, 200) ?? "";
    const status = parseCandidateFilter(parameters.get("status") ?? undefined);
    const ranking = parseCandidateRankingSort(
      parameters.get("ranking") ?? undefined,
    );
    const candidates = await listCandidates({ page, query, status, ranking });

    return jsonSuccess(requestId, candidates);
  });
