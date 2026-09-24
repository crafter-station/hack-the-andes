import { describe, expect, test } from "bun:test";

import {
  badgeFallbackUrl,
  badgeLinkFor,
  bestChallengePlacement,
  challengePlacementLabel,
} from "./profile";

describe("badge profile", () => {
  test("chooses website, GitHub, then LinkedIn for the QR", () => {
    expect(
      badgeLinkFor({
        websiteUrl: " https://ada.dev ",
        githubUrl: "https://github.com/ada",
        linkedInUrl: "https://linkedin.com/in/ada",
      }),
    ).toBe("https://ada.dev");
    expect(
      badgeLinkFor({
        githubUrl: "https://github.com/ada",
        linkedInUrl: "https://linkedin.com/in/ada",
      }),
    ).toBe("https://github.com/ada");
    expect(badgeLinkFor({ linkedInUrl: "https://linkedin.com/in/ada" })).toBe(
      "https://linkedin.com/in/ada",
    );
    expect(badgeLinkFor({})).toBe(badgeFallbackUrl);
  });

  test("prints the participant's best exact challenge rank", () => {
    const best = bestChallengePlacement([
      { theme: "Black Box", rank: 12 },
      { theme: "Broken Agent", rank: 3 },
    ]);

    expect(challengePlacementLabel(best)).toBe("BROKEN AGENT · #03");
    expect(challengePlacementLabel(undefined)).toBe("PARTICIPANT");
  });
});
