/**
 * The accepted participant behind a session.
 *
 * The credential is for people who were accepted. Its defaults come from
 * their application, while its public name, one-liner, link and confirmed
 * picture may be changed later through the independent badge profile.
 *
 * There is no lookup by GitHub handle any more, and its absence is the
 * design rather than an omission. A public route keyed on a handle could
 * only reach someone through the optional, free-text link on their form,
 * so it missed every participant who left it blank and let anyone
 * enumerate the ones who did not. The session has neither problem.
 *
 * Two rules out of `CONTEXT.md` bind every query here:
 *
 * - an *active* application is one being drafted, awaiting a decision, or
 *   accepted, and a participant may have only one at a time. Rejected and
 *   withdrawn applications are history. A credential must never be built
 *   from history — someone rejected this year would otherwise keep a
 *   badge from a form they filled in once;
 * - a confirmed profile picture is one the participant *explicitly chose*
 *   during attendance confirmation, and available images are not used
 *   until they do.
 *
 * That second rule is why `pictureUrl` and `githubUrl` arrive here as
 * separate fields rather than one resolved picture. The confirmed one is
 * the picture; the GitHub one is a *proposal*, shown to its owner behind
 * their own session so they can accept or replace it, and never stored,
 * printed or shared until they say so. Collapsing the two here is how a
 * photograph nobody chose ends up on a printed badge.
 */

import { db } from "@chofex/db";
import { and, eq } from "@chofex/db/orm";
import {
  applications,
  participantBadges,
  participants,
} from "@chofex/db/schema";
import type { Credential } from "@/components/credential/credential-model";
import { AVATAR_PORTRAIT, githubAvatarUrl } from "@/lib/registration/pictures";
import { resolveBadgeProfile } from "./profile";

export interface AcceptedParticipant {
  /** Their public badge name, defaulting to the accepted application. */
  readonly name: string;
  /** Their public description. The design's line under the name. */
  readonly oneLiner: string;
  readonly organization: string | null;
  /** Only ever the confirmed one. Null until they choose. */
  readonly pictureUrl: string | null;
  /**
   * What their form said, if anything — a proposal, not a picture.
   *
   * Free text, so it is a URL and not a handle. Only ever offered back
   * to its owner.
   */
  readonly githubUrl: string | null;
  readonly linkUrl: string;
  readonly placement: string;
  /** The generated halftone used by the HTML fallback. */
  readonly portraitUrl: string | null;
}

/**
 * The participant, reached through their session.
 *
 * `participantId` is the join, and the status filter is what makes the
 * single row safe: `CONTEXT.md` allows a participant only one active
 * application, and accepted is active, so this cannot return two rows for
 * one person.
 */
export const acceptedByClerkUser = async (
  clerkUserId: string,
): Promise<AcceptedParticipant | null> => {
  const [row] = await db
    .select({ application: applications, badge: participantBadges })
    .from(applications)
    .innerJoin(participants, eq(applications.participantId, participants.id))
    .leftJoin(
      participantBadges,
      eq(participantBadges.applicationId, applications.id),
    )
    .where(
      and(
        eq(participants.clerkUserId, clerkUserId),
        eq(applications.status, "accepted"),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const profile = resolveBadgeProfile(
    {
      ...row.application,
      websiteUrl: row.application.portfolioUrl,
    },
    row.badge,
  );
  const name = profile.fullName;
  if (name === "") {
    // Accepted but nameless is a data problem, not a credential: a card
    // with an empty name reads as broken rather than as incomplete.
    return null;
  }
  return {
    name,
    oneLiner: profile.oneLiner,
    organization: row.application.organization?.trim() || null,
    pictureUrl: profile.pictureUrl,
    githubUrl: row.application.githubUrl?.trim() || null,
    linkUrl: profile.linkUrl,
    placement: profile.placement,
    portraitUrl: profile.portraitUrl,
  };
};

/**
 * The picture to draw, and whether its owner has agreed to it.
 *
 * `confirmed` is what the page reads to decide between showing the
 * credential and asking about it. A proposal draws exactly the same —
 * somebody should see their own face immediately — but nothing downstream
 * may treat it as settled.
 */
export interface PortraitChoice {
  readonly url: string | null;
  readonly confirmed: boolean;
}

export const portraitFor = (accepted: AcceptedParticipant): PortraitChoice => {
  if (accepted.pictureUrl) {
    return { url: accepted.pictureUrl, confirmed: true };
  }
  return {
    url: githubAvatarUrl(accepted.githubUrl, AVATAR_PORTRAIT) ?? null,
    confirmed: false,
  };
};

/**
 * The same participant, as the thing the card prints.
 *
 * Draws the proposal when nothing is confirmed, so somebody sees their
 * own face the first time they open the page rather than their initials
 * and no explanation. Whether it is settled is a separate question, and
 * `portraitFor` is where the page asks it.
 */
export const credentialFor = (accepted: AcceptedParticipant): Credential => ({
  name: accepted.name,
  oneLiner: accepted.oneLiner,
  organization: accepted.organization,
  pictureUrl: portraitFor(accepted).url,
  portraitUrl: accepted.portraitUrl,
  placement: accepted.placement,
  linkUrl: accepted.linkUrl,
});

/**
 * The generated badge image, and how far along it is.
 *
 * A separate query from the credential because it answers a different
 * question and fails differently: the credential is data somebody
 * already gave, while this is the output of a job that may still be
 * running, may have failed, and may not have been started at all.
 *
 * Its existence is the point. The image used to reach people only as a
 * link in one email, so anybody who lost that email lost the badge; this
 * is what lets the page they can always reach show it to them.
 */
export interface BadgeImage {
  readonly status: "pending" | "running" | "completed" | "failed";
  /** Only ever set once the job finished. */
  readonly url: string | null;
}

export const badgeImageForClerkUser = async (
  clerkUserId: string,
): Promise<BadgeImage | null> => {
  const [row] = await db
    .select({
      status: participantBadges.status,
      badgeUrl: participantBadges.badgeUrl,
    })
    .from(participantBadges)
    .innerJoin(
      applications,
      eq(participantBadges.applicationId, applications.id),
    )
    .innerJoin(participants, eq(applications.participantId, participants.id))
    .where(
      and(
        eq(participants.clerkUserId, clerkUserId),
        eq(applications.status, "accepted"),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }
  return { status: row.status, url: row.badgeUrl };
};
