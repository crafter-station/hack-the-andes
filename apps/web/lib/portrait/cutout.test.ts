import { describe, expect, test } from "bun:test";

const source = async (): Promise<string> =>
  await Bun.file(new URL("./cutout.ts", import.meta.url)).text();

describe("cutout", () => {
  test("loads its runtime and weights from this origin", async () => {
    // Both are fetched by the runtime at call time. From a third party
    // they are the first thing a tightened `connect-src` breaks, and
    // they break silently — the cut-out just stops happening and every
    // portrait ships with its background still on it.
    const module = await source();
    const remote = module.match(/["'`]https?:\/\/[^"'`\s]+/g) ?? [];

    expect(remote).toEqual([]);
    expect(module).toContain('"/vision"');
  });

  test("reaches for the package lazily, never at module scope", async () => {
    // It unpacks to 35 MB. A static import puts its wrapper in the
    // bundle of everybody who opens the credential, including everybody
    // who never touches a photograph.
    const module = await source();
    const statics = module.match(/^import .* from "@mediapipe\/.*"/m) ?? [];

    expect(statics).toEqual([]);
    expect(module).toContain("await import(");
  });

  test("throws rather than answering with the original image", async () => {
    // Handing back the untouched photograph would put somebody's kitchen
    // on their credential without telling them, and the caller could not
    // tell the two results apart.
    const module = await source();

    expect(module).toContain("CutoutError");
    expect(module).not.toMatch(/return\s+image\s*;/);
  });

  test("is the only module that knows about MediaPipe", async () => {
    // One module owns the dependency, so replacing the segmenter later is
    // one file rather than a search across the app.
    //
    // Walks the tree itself rather than shelling out to grep: the first
    // version did, found nothing, and passed — a search that cannot find
    // the file it is standing on proves nothing at all. The control
    // below is there so that failure cannot repeat silently.
    const root = new URL("../../", import.meta.url).pathname;
    const { Glob } = await import("bun");
    const glob = new Glob("{lib,components,app}/**/*.{ts,tsx}");

    const importers: string[] = [];
    let scanned = 0;
    for await (const file of glob.scan({ cwd: root })) {
      const text = await Bun.file(`${root}${file}`).text();
      scanned += 1;
      if (text.includes("@mediapipe/tasks-vision")) {
        importers.push(file);
      }
    }

    // Positive control: a scan that reached nothing would report a clean
    // result for the same reason a broken one does.
    expect(scanned).toBeGreaterThan(20);
    expect(importers.sort()).toEqual([
      "lib/portrait/cutout.test.ts",
      "lib/portrait/cutout.ts",
    ]);
  });
});
