/**
 * What a credential is.
 *
 * Every field comes from the holder's own accepted application, which is
 * the whole shape of the feature now: the badge is for people who were
 * accepted, so there is one source of truth and no second, weaker one to
 * fall back to.
 *
 * It used to carry a GitHub profile as well — a bio, a location, a join
 * year, repository and follower counts — and a `state` saying whether the
 * person on it had actually been let in. None of that survived the badge
 * becoming something only accepted participants have: the counts were
 * decoration, and a card that exists only for accepted people does not
 * need to announce that it is verified. The printed design shows a
 * number, a picture, a name and a role, and so does this.
 */

export interface Credential {
  /** As they wrote it on the form. */
  readonly name: string;
  /** What they said they are. The line under the name. */
  readonly role: string | null;
  readonly organization: string | null;
  /**
   * The picture they confirmed, and only that.
   *
   * Null until they choose one. `CONTEXT.md` is explicit that available
   * images are not used until the participant confirms a source, so a
   * card with nothing here shows initials rather than reaching for a
   * picture they did not pick.
   */
  readonly pictureUrl: string | null;
  /** The seat number. */
  readonly number: string;
}

/**
 * FNV-1a over a string, as an unsigned 32-bit number.
 *
 * Exported because the seat number is not the only thing derived from a
 * name, and two implementations of the same hash would eventually
 * disagree about what a given person means.
 */
export const fnv1a = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

/**
 * The seat number on the card.
 *
 * Deterministic across processes and deploys: the same person must always
 * print the same number, and nothing records one.
 */
export const credentialNumber = (seed: string): string =>
  String(fnv1a(seed) % 1000).padStart(3, "0");

export const truncate = (value: string, max: number): string => {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
};

/**
 * Two letters for a card with no confirmed picture.
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
