import { describe, expect, test } from "bun:test";

import { participantDisplayName, rankingDisplayName } from "./names";

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
});
