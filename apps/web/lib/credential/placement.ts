import { playableChallenges } from "@chofex/challenges-contract";

import { rankedEvaluationsFor } from "@/lib/challenges/ranking";
import { competitionRanksForEvaluations } from "@/lib/challenges/ranking-policy";

import { bestChallengePlacement, challengePlacementLabel } from "./profile";

export const challengePlacementForParticipant = async (
  participantId: string,
): Promise<string> => {
  const candidates = await Promise.all(
    playableChallenges.map(async (challenge) => {
      const ranked = await rankedEvaluationsFor(challenge.slug);
      const index = ranked.findIndex(
        (entry) => entry.participantId === participantId,
      );
      if (index < 0) return undefined;
      const ranks = competitionRanksForEvaluations(ranked);
      return { theme: challenge.theme, rank: ranks[index] ?? 1 };
    }),
  );

  return challengePlacementLabel(
    bestChallengePlacement(
      candidates.filter(
        (candidate): candidate is NonNullable<typeof candidate> =>
          candidate !== undefined,
      ),
    ),
  );
};
