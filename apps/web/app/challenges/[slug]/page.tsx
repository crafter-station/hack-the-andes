import { challengeBySlug, challengeCatalog } from "@chofex/challenges-contract";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChallengesShell } from "@/components/challenges/challenges-shell";
import { ChallengeRankingView } from "@/components/challenges/ranking-view";
import { currentChallengeTime } from "@/lib/challenges/clock";
import { getChallengeRanking } from "@/lib/challenges/ranking";
import { HttpError } from "@/lib/registration/http";

// Every public challenge comes from this catalog, so prerender each route and
// reject unknown slugs instead of falling back to request-time rendering.
export const dynamicParams = false;
export const generateStaticParams = () =>
  challengeCatalog.map((challenge) => ({ slug: challenge.slug }));

// Serve the prerendered response while Next rebuilds it in the background, so
// first paint does not wait on a fresh server render or ranking query.
export const revalidate = 60;

interface ChallengeRankingPageProps {
  readonly params: Promise<{ slug: string }>;
}

export const generateMetadata = async ({
  params,
}: ChallengeRankingPageProps): Promise<Metadata> => {
  const { slug } = await params;
  const challenge = challengeBySlug(slug);
  if (!challenge) return { title: "Challenge | Hack the Andes" };
  return {
    title: `${challenge.title} | Challenge de Hack the Andes`,
    description: challenge.summary,
  };
};

export default async function ChallengeRankingPage({
  params,
}: ChallengeRankingPageProps) {
  const { slug } = await params;
  try {
    const now = currentChallengeTime();
    const ranking = await getChallengeRanking(slug, now);
    return (
      <ChallengesShell>
        <ChallengeRankingView now={now.toISOString()} ranking={ranking} />
      </ChallengesShell>
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
}
