import {
  type ChallengeScore,
  compareChallengeScores,
} from "@chofex/challenges-contract";

const publicRankingEntryLimit = 18;

export const publicRankingEntries = <Entry>(
  ranked: ReadonlyArray<Entry>,
): Array<Entry> => ranked.slice(0, publicRankingEntryLimit);

export const competitionRanks = (
  scores: ReadonlyArray<ChallengeScore>,
): Array<number> => {
  const ranks: Array<number> = [];
  let currentRank = 1;

  for (const [index, score] of scores.entries()) {
    const previous = scores[index - 1];
    if (previous && compareChallengeScores(previous, score) !== 0) {
      currentRank = index + 1;
    }
    ranks.push(currentRank);
  }

  return ranks;
};
