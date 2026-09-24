import { queryOptions } from "@tanstack/react-query";

import type {
  Candidate,
  CandidateFilter,
  CandidatePage,
  CandidateRankingSort,
} from "@/lib/admin/types";

export interface CandidateFilters {
  readonly page: number;
  readonly query: string;
  readonly status?: CandidateFilter;
  readonly ranking?: CandidateRankingSort;
}

interface ApiResponse<A> {
  readonly ok: boolean;
  readonly data?: A;
  readonly error?: { readonly message?: string };
}

export interface CandidateDecisionInput {
  readonly candidateId: string;
  readonly decision: "accepted" | "rejected";
  readonly message: string;
  readonly notify: boolean;
}

export interface CandidateDecisionResult {
  readonly candidate: Candidate;
  readonly emailStatus: "not_requested" | "sent" | "failed";
  readonly emailError?: string;
  readonly badgeStatus:
    | "not_requested"
    | "pending"
    | "running"
    | "completed"
    | "failed";
  readonly badgeError?: string;
}

export const candidateKeys = {
  all: ["admin", "candidates"] as const,
  list: (filters: CandidateFilters) =>
    [
      ...candidateKeys.all,
      "list",
      filters.page,
      filters.query,
      filters.status ?? "all",
      filters.ranking ?? "newest",
    ] as const,
};

const responseData = async <A>(response: Response): Promise<A> => {
  const result = (await response.json().catch(() => undefined)) as
    | ApiResponse<A>
    | undefined;
  if (!response.ok || !result?.ok || result.data === undefined) {
    throw new Error(
      result?.error?.message ?? "The request could not be completed",
    );
  }
  return result.data;
};

const fetchCandidates = async (
  filters: CandidateFilters,
): Promise<CandidatePage> => {
  const parameters = new URLSearchParams({ page: filters.page.toString() });
  if (filters.query) parameters.set("q", filters.query);
  if (filters.status) parameters.set("status", filters.status);
  if (filters.ranking) parameters.set("ranking", filters.ranking);

  const response = await fetch(`/api/admin/applications?${parameters}`, {
    headers: { accept: "application/json" },
  });
  return responseData<CandidatePage>(response);
};

export const candidateListOptions = (filters: CandidateFilters) =>
  queryOptions({
    queryKey: candidateKeys.list(filters),
    queryFn: () => fetchCandidates(filters),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
  });

export const submitCandidateDecision = async (
  input: CandidateDecisionInput,
): Promise<CandidateDecisionResult> => {
  const response = await fetch(
    `/api/admin/applications/${input.candidateId}/decision`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        decision: input.decision,
        message: input.message,
        notify: input.notify,
      }),
    },
  );
  return responseData<CandidateDecisionResult>(response);
};
