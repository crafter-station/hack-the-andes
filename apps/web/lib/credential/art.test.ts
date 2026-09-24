import { describe, expect, test } from "bun:test";

const source = async (name: string): Promise<string> =>
  await Bun.file(new URL(`./${name}`, import.meta.url)).text();

describe("credential assets", () => {
  test("never builds an asset URL from a variable", async () => {
    /*
      A bundler reads `new URL(…, import.meta.url)` as an asset reference
      and rewrites it to the content-hashed name it emitted. Given a path
      built from a variable it cannot know which file is meant, so the
      rewrite does not line up: the name asked for at runtime matches
      nothing on disk.

      That shipped. The card asked for `ridge.png`, got a sponsor's mark
      in the drawing's place, and every credential carried a logo across
      its lower half. Nothing caught it — not the tests, not a local run,
      not a review — because the bug only exists once the module is
      bundled, and none of those bundle it.

      So this reads the source instead. Every path has to be a literal.
    */
    for (const file of ["art.ts", "printing.ts"]) {
      const text = await source(file);
      const dynamic = text.match(/new URL\(\s*`[^`]*\$\{/g) ?? [];

      expect(dynamic).toEqual([]);
    }
  });

  test("names every file the credential draws with", async () => {
    // The literals are the map, so a mark added to the card without an
    // entry here fails to resolve rather than falling back to another.
    const text = await source("art.ts");

    for (const file of [
      "ridge.png",
      "mountain.png",
      "chofex.png",
      "crafter-station.png",
      "peru-tech-week.png",
    ]) {
      expect(text).toContain(`public/credential/${file}`);
    }
  });
});
