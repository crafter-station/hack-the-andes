import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { CandidateDashboard } from "@/components/candidate-dashboard";
import { getAdminIdentity } from "@/lib/admin/auth";
import { listCandidates } from "@/lib/admin/candidates";
import {
  parseCandidateFilter,
  parseCandidateRankingSort,
} from "@/lib/admin/types";

export const dynamic = "force-dynamic";

interface HomeProps {
  readonly searchParams: Promise<{
    readonly page?: string;
    readonly q?: string;
    readonly status?: string;
    readonly ranking?: string;
    readonly candidate?: string;
  }>;
}

export default async function ParticipantsAdminPage({
  searchParams,
}: HomeProps) {
  const authentication = await auth();
  if (!authentication.userId) {
    redirect("/sign-in?redirect_url=/admin/participants");
  }

  const admin = await getAdminIdentity();
  if (!admin) redirect("/welcome");

  const parameters = await searchParams;
  const parsedPage = Number.parseInt(parameters.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) ? parsedPage : 1;
  const query = parameters.q?.trim().slice(0, 200) ?? "";
  const status = parseCandidateFilter(parameters.status);
  const ranking = parseCandidateRankingSort(parameters.ranking);
  const data = await listCandidates({ page, query, status, ranking });
  let selection: "first" | "last" | undefined;
  if (parameters.candidate === "first" || parameters.candidate === "last") {
    selection = parameters.candidate;
  }

  return (
    <CandidateDashboard
      key={`${data.page}:${ranking ?? "newest"}:${selection ?? "none"}`}
      data={data}
      initialQuery={query}
      initialStatus={status}
      initialRanking={ranking}
      initialSelection={selection}
    />
  );
}
