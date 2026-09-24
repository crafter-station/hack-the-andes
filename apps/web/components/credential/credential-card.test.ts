import { describe, expect, test } from "bun:test";

const source = async (file: string): Promise<string> =>
  await Bun.file(new URL(file, import.meta.url)).text();

describe("credential-card", () => {
  test("is a server-renderable component with no client hooks", async () => {
    // The card must render without JavaScript. The moment it reaches for a
    // hook it stops being the thing the no-JS fallback depends on.
    //
    // Two traps here, both hit on the way to this version. The file's doc
    // comment mentions "use client" in prose, so a bare toContain cannot
    // tell an explanation from a declaration — hence stripping block
    // comments first. And exact-line equality is defeatable: `"use client";
    // // enabled for interactivity` is a working directive that is not
    // byte-identical to the bare one. Match the directive's shape at the
    // start of a line instead, which is the only position it functions in.
    const card = await source("./credential-card.tsx");
    const code = card.replace(/\/\*[\s\S]*?\*\//g, "");
    const directive = /^\s*["']use client["']\s*;?/;

    expect(code.split("\n").some((line) => directive.test(line))).toBe(false);
    expect(card).not.toContain("useState");
    expect(card).not.toContain("useEffect");
  });

  test("knows nothing about what it hangs from", async () => {
    // The boundary the spec draws: this file is reused by the verified state
    // in Phase 3 and by the OG compositor, neither of which has physics.
    //
    // Matched on the module specifier, not on the words: the boundary is a
    // dependency, and the doc comment is free to discuss the lanyard.
    //
    // Pointed at the modules that exist TODAY. The previous version named
    // the DOM cord modules, and once those were deleted it asserted the
    // absence of things that could not be present — a test that had stopped
    // being able to fail.
    const card = await source("./credential-card.tsx");

    expect(card).not.toMatch(/["']\.\/credential-lanyard-3d["']/);
    expect(card).not.toMatch(/["']\.\/credential-scene["']/);
    expect(card).not.toMatch(/@react-three/);
  });

  test("screens only the confirmed picture onto the card", async () => {
    // The same rule as the static card, now that a second surface draws
    // a face: CONTEXT.md forbids using an available image before the
    // participant picks a source. The texture may read the credential's
    // own picture and nothing else — reaching for a Clerk avatar or a
    // GitHub profile directly is the defect.
    //
    // The proposal shown before anybody confirms is resolved one layer
    // up, in `portraitFor`, so that the choice is visible in one place
    // rather than implied in two.
    const texture = await Bun.file(
      new URL("../../lib/credential/card-texture.tsx", import.meta.url),
    ).text();

    expect(texture).toContain("credential.pictureUrl");
    expect(texture).not.toContain("clerkPictureUrl");
    expect(texture).not.toContain("githubAvatarUrl");
  });

  test("shows no picture the participant did not confirm", async () => {
    // Replaces a test that warned the card carried a stranger's face —
    // true while anyone could generate anyone's badge from a GitHub
    // handle, and impossible now the card only ever exists behind its
    // holder's own session.
    //
    // The rule that took its place is `CONTEXT.md`'s: available images
    // are not used until the participant confirms a source. So the
    // portrait may read exactly one column, and reaching for a Clerk
    // avatar or a GitHub profile directly is the defect.
    const portrait = await source("./credential-portrait.tsx");

    expect(portrait).toContain("credential.portraitUrl");
    expect(portrait).not.toContain("clerk");
    expect(portrait).not.toContain("github");
  });

  test("gives the portrait a real alt text", async () => {
    // The alt lives in the portrait, not the card: the card delegates the
    // image so the initials fallback can hold the one piece of client state
    // this component family needs.
    const portrait = await source("./credential-portrait.tsx");

    expect(portrait).toMatch(/alt=\{/);
  });

  test("stays on the brand type scale", async () => {
    // The faces live in the stylesheet, not the component, so this reads the
    // css. Stack Sans Notch is reserved for the event name and must not
    // appear on a card.
    const css = await source("./credential.css");

    expect(css).toContain("--font-hta-mono");
    expect(css).not.toContain("--font-hta-brand");
  });

  test("falls back to initials when the portrait will not load", async () => {
    // github.com/<login>.png 404s for a handle that does not exist, and a
    // broken-image icon where a face should be is the ugliest failure this
    // feature has.
    const portrait = await source("./credential-portrait.tsx");

    expect(portrait).toContain("initials");
    expect(portrait).toMatch(/onError/);
  });

  test("the card delegates the portrait rather than inlining an img", async () => {
    const card = await source("./credential-card.tsx");

    expect(card).toContain("CredentialPortrait");
    expect(card).not.toContain("<Image");
  });

  test("keeps the participant QR in the no-WebGL fallback", async () => {
    const card = await source("./credential-card.tsx");

    expect(card).toContain("QRCode.toDataURL(credential.linkUrl");
    expect(card).toContain("credential-card-qr");
  });

  test("never lets the model's own demo card be what somebody sees", async () => {
    /*
      `card.glb` ships with the face it was exported with — the demo card
      the lanyard came from, with another product's name on it. The mesh
      wears that until ours is uploaded, so the static card is only
      allowed to step aside once the face has actually arrived.

      This used to report ready when the WebGL context was created, which
      is a good deal earlier, and the load had no error handler at all: an
      expired session or a failed render left that demo card on a
      participant's credential, silently, looking like it had worked.
    */
    const scene = await source("./credential-lanyard-3d.tsx");

    expect(scene).toContain("faceReady");
    // Ready is the conjunction, not the context alone.
    expect(scene).toMatch(/contextReady && \(faceReady \|\| !faceUrl\)/);
    // And the load reports failure by staying quiet rather than throwing.
    expect(scene).not.toMatch(/onCreated=\{[^}]*onReady/);

    /*
      Showing the static card is only half of it: the scene draws over
      that layer, so the canvas has to be invisible too until it has our
      face. Transparent and not `display: none` — a hidden canvas stops
      rendering, and then the face it is waiting for never arrives.
    */
    const css = await source("./credential.css");
    const rule = css.slice(
      css.indexOf('.credential-scene[data-live="false"] .credential-canvas'),
    );

    expect(rule).toContain("opacity: 0");
    expect(rule.slice(0, 120)).not.toContain("display: none");
  });

  test("introduces no colour outside the brand tokens", async () => {
    // Two colours and a drain. A stray hex is how a third hue gets in.
    //
    // One exception, declared rather than scattered: the credential is a
    // printed sheet in a plastic shell and those tones were sampled off
    // the design, so they are not brand and cannot be mixed from it. They
    // live in `--credential-*` custom properties, and this still fails on
    // a hex written anywhere else.
    const css = await source("./credential.css");
    const offenders = css
      .split("\n")
      .filter((line) => /#[0-9a-f]{3,8}\b/i.test(line))
      .filter((line) => !line.trim().startsWith("--credential-"));

    expect(offenders).toEqual([]);
  });
});
