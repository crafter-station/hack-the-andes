/**
 * What a credential is.
 *
 * Every field comes from the holder's accepted application plus its
 * independent badge profile. The application supplies defaults; the badge
 * profile carries later public personalization without rewriting history.
 *
 * It used to carry a GitHub profile as well — a bio, a location, a join
 * year, repository and follower counts — and a `state` saying whether the
 * person on it had actually been let in. None of that survived the badge
 * becoming something only accepted participants have: the counts were
 * decoration, and a card that exists only for accepted people does not
 * need to announce that it is verified. The printed design shows a
 * challenge placement, a picture, a name and a one-liner, and so does this.
 */

export interface Credential {
  /** Their public badge name. */
  readonly name: string;
  /** The participant's public description. The line under the name. */
  readonly oneLiner: string;
  readonly organization: string | null;
  /**
   * The picture currently selected for the badge.
   *
   * This may begin as the reviewer-visible acceptance default and later be
   * replaced during confirmation. A card with nothing here shows initials.
   */
  readonly pictureUrl: string | null;
  /** The generated halftone used by the HTML fallback, or null while pending. */
  readonly portraitUrl: string | null;
  /** Their best exact placement across current playable challenges. */
  readonly placement: string;
  /** The destination encoded in the QR. */
  readonly linkUrl: string;
}

export const truncate = (value: string, max: number): string => {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
};

/**
 * Two letters for a card with no stored picture.
 *
 * Splits on spaces as well as punctuation, so a person's initials are
 * their initials. Falls back to the first two letters of a single name,
 * which fills the slot it was designed for instead of looking like a
 * truncation bug.
 */
export const initialsFor = (name: string): string => {
  const parts = name.split(/[\s\-_.]+/).filter(Boolean);
  const [first, second] = parts;
  if (!first) {
    return "??";
  }
  if (second) {
    return `${first[0]}${second[0]}`.toUpperCase();
  }
  return first.slice(0, 2).toUpperCase();
};
