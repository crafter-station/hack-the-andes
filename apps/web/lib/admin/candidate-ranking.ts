interface ChallengeRankingCandidate {
  readonly participantId: string;
  readonly createdAt: Date;
}

export const sortCandidatesByChallengeRanking = <
  Candidate extends ChallengeRankingCandidate,
>(
  candidates: ReadonlyArray<Candidate>,
  rankedParticipantIds: ReadonlyArray<string>,
): Array<Candidate> => {
  const rankingIndex = new Map(
    rankedParticipantIds.map((participantId, index) => [participantId, index]),
  );

  return [...candidates].sort((left, right) => {
    const leftIndex = rankingIndex.get(left.participantId);
    const rightIndex = rankingIndex.get(right.participantId);
    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return right.createdAt.getTime() - left.createdAt.getTime();
  });
};
