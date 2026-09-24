import { describe, expect, test } from "bun:test";

import {
  participantDisplayName,
  publicProfileIdentitiesFor,
  publicProfileLinksFor,
  rankingDisplayName,
} from "./names";

describe("ranking display names", () => {
  test("uses the same full application name as the admin dashboard", () => {
    expect(
      rankingDisplayName({
        firstName: "Anthony",
        lastName: "Cueva",
      }),
    ).toBe("Anthony Cueva");
    expect(
      rankingDisplayName({
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    ).toBe("Ada Lovelace");
    expect(rankingDisplayName({ lastName: "Smith" })).toBe("Unknown Smith");
    expect(rankingDisplayName({ firstName: "Madonna", lastName: "" })).toBe(
      "Madonna",
    );
    expect(rankingDisplayName({})).toBe("Unknown participant");
    expect(participantDisplayName({ firstName: "Madonna", lastName: "" })).toBe(
      "Madonna",
    );
  });

  test("publishes only safe GitHub and LinkedIn profile links", () => {
    expect(
      publicProfileLinksFor({
        githubUrl: "https://github.com/example",
        linkedInUrl: "https://linkedin.com/in/example",
      }),
    ).toEqual({
      githubUrl: "https://github.com/example",
      linkedInUrl: "https://linkedin.com/in/example",
    });
    expect(
      publicProfileLinksFor({
        githubUrl: "https://example.com/github-user",
        linkedInUrl: "https://example.com/linkedin-user",
      }),
    ).toEqual({});
    expect(
      publicProfileLinksFor({
        githubUrl: "http://github.com/insecure",
        linkedInUrl: "https://linkedin.com/company/not-a-profile",
      }),
    ).toEqual({});
  });

  test("canonicalizes profile identities across equivalent URLs", () => {
    expect(
      publicProfileIdentitiesFor({
        githubUrl: "https://www.github.com/Example/?tab=repositories",
        linkedInUrl: "https://pe.linkedin.com/in/Example-Person/?trk=public",
      }),
    ).toEqual({
      github: "example",
      linkedIn: "example-person",
    });
    expect(
      publicProfileIdentitiesFor({
        githubUrl: "https://github.com/org/repository",
        linkedInUrl: "https://example.com/in/example-person",
      }),
    ).toEqual({});
  });
});
