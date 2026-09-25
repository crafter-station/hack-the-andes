import {
  type ChallengeCatalogItem,
  type ChallengeDefinition,
  challengeAdmissionNotice,
  challengeCatalog,
  isChallengeClosedAt,
  isChallengeOpenAt,
} from "@chofex/challenges-contract";

import { challengesForceOpen, currentChallengeTime } from "./clock";
import { currentChallengeVersionFor } from "./engine";

export const rankingPathFor = (slug: string): string => `/challenges/${slug}`;

export const catalogItemFor = (
  challenge: ChallengeDefinition,
  now: Date = currentChallengeTime(),
  forceOpen = challengesForceOpen(),
): ChallengeCatalogItem => {
  const closed = !forceOpen && isChallengeClosedAt(challenge, now);
  const open =
    challenge.playable && isChallengeOpenAt(challenge, now, forceOpen);
  const item: ChallengeCatalogItem = {
    slug: challenge.slug,
    number: challenge.number,
    code: challenge.code,
    theme: challenge.theme,
    title: challenge.title,
    summary: challenge.summary,
    coreSkill: challenge.coreSkill,
    format: challenge.format,
    formatLabel: challenge.formatLabel,
    opensAt: challenge.opensAt,
    queryLimit: challenge.queryLimit,
    evaluationLimit: challenge.evaluationLimit,
    playable: challenge.playable,
    open,
    closed,
    rankingPath: rankingPathFor(challenge.slug),
  };
  let publicItem = item;
  const challengeVersion = currentChallengeVersionFor(challenge.slug);
  if (challengeVersion) {
    publicItem = { ...publicItem, challengeVersion };
  }
  if (challenge.closesAt) {
    publicItem = { ...publicItem, closesAt: challenge.closesAt };
  }
  if (challenge.rankingVisibleAt) {
    publicItem = {
      ...publicItem,
      rankingVisibleAt: challenge.rankingVisibleAt,
    };
  }
  return publicItem;
};

export const publicChallengeCatalog = (
  now: Date = currentChallengeTime(),
): ReadonlyArray<ChallengeCatalogItem> =>
  challengeCatalog.map((challenge) => catalogItemFor(challenge, now));

export const listPublicChallenges = (
  now: Date = currentChallengeTime(),
): {
  admission: {
    challengesMandatory: true;
    selectionBasis: "challenge_rankings";
    notice: string;
  };
  challenges: ReadonlyArray<ChallengeCatalogItem>;
} => ({
  admission: {
    challengesMandatory: true,
    selectionBasis: "challenge_rankings",
    notice: challengeAdmissionNotice,
  },
  challenges: publicChallengeCatalog(now),
});
