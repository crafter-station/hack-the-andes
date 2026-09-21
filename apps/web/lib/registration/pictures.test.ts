import { describe, expect, test } from "bun:test";

import { confirmedPictureUrl } from "./pictures";

describe("accepted participant picture confirmation", () => {
  test("uses only the explicitly confirmed source", () => {
    const options = {
      clerkPictureUrl: "https://img.clerk.com/ada.jpg",
      githubUrl: "https://github.com/ada",
      uploadedPictureUrl:
        "https://store.public.blob.vercel-storage.com/ada.jpg",
    };

    expect(confirmedPictureUrl("clerk", options)).toBe(options.clerkPictureUrl);
    // 460, not the 112 this pinned before. What gets confirmed is
    // stored and then drawn at 490px in the credential's photo window
    // and screened into an 800px portrait for the emailed badge; a
    // 112px thumbnail upscaled four times is why the halftone came out
    // as mush. 460 is what GitHub actually serves — asking for more
    // returns the same bytes.
    expect(confirmedPictureUrl("github", options)).toBe(
      "https://github.com/ada.png?size=460",
    );
    expect(confirmedPictureUrl("upload", options)).toBe(
      options.uploadedPictureUrl,
    );
  });

  test("rejects a selected source that is unavailable", () => {
    expect(() => confirmedPictureUrl("github", {})).toThrow(
      "The selected github picture is not available",
    );
  });
});
