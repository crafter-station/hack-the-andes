import { describe, expect, test } from "bun:test";

import {
  acceptanceBadgeProfileFor,
  badgeFallbackUrl,
  badgeLinkFor,
  badgeOneLinerFor,
  bestChallengePlacement,
  challengePlacementLabel,
  resolveBadgeProfile,
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

  test("resolves application defaults and badge-only overrides in one place", () => {
    expect(
      resolveBadgeProfile(
        {
          firstName: "Ada",
          lastName: "Lovelace",
          role: "Mathematician",
          websiteUrl: "https://ada.dev",
          pictureUrl: "https://images.example/original.png",
        },
        {
          displayName: "Ada L.",
          oneLiner: "Computing pioneer",
          pictureUrl: "https://images.example/badge.png",
        },
      ),
    ).toEqual({
      fullName: "Ada L.",
      oneLiner: "Computing pioneer",
      linkUrl: "https://ada.dev",
      placement: "PARTICIPANT",
      pictureUrl: "https://images.example/badge.png",
      portraitUrl: null,
    });
    const oneLiner = badgeOneLinerFor(
      "A description that cannot fit on one line",
    );
    expect(oneLiner).toEndWith("…");
    expect(oneLiner.length).toBeLessThanOrEqual(30);
  });

  test("captures the reviewer-visible dashboard profile as acceptance defaults", () => {
    expect(
      acceptanceBadgeProfileFor({
        firstName: "Ada",
        lastName: "Lovelace",
        role: "A description that is much too long for the badge",
        avatarUrl: "https://github.com/ada.png?size=112",
        githubUrl: "https://github.com/ada",
        linkedInUrl: "https://linkedin.com/in/ada",
      }),
    ).toEqual({
      displayName: "Ada Lovelace",
      oneLiner: "A description that is much…",
      linkUrl: "https://github.com/ada",
      pictureUrl: "https://github.com/ada.png?size=460",
    });
  });
});
