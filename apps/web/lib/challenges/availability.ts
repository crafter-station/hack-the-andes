import {
  blackBoxChallengeSlug,
  challengeBySlug,
  isChallengeOpenAt,
} from "@chofex/challenges-contract";

import { challengesForceOpen, currentChallengeTime } from "./clock";

export const isBlackBoxParticipationOpen = (
  now: Date = currentChallengeTime(),
  forceOpen = challengesForceOpen(),
): boolean => {
  const challenge = challengeBySlug(blackBoxChallengeSlug);
  if (!challenge) return false;
  return isChallengeOpenAt(challenge, now, forceOpen);
};
