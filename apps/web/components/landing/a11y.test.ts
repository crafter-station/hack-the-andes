import { expect, test } from "bun:test";

test("loads landing-only motion and fallback styles from the route", async () => {
  const page = await Bun.file(
    new URL("../../app/page.tsx", import.meta.url),
  ).text();

  expect(page).toContain('import "@/components/landing/landing.css";');
});

test("preserves the reference landing CTA and selection treatment", async () => {
  const buttons = await Bun.file(
    new URL(
      "../../../../packages/ui/src/components/button.tsx",
      import.meta.url,
    ),
  ).text();
  const darkCss = await Bun.file(new URL("./dark.css", import.meta.url)).text();

  expect(buttons).toMatch(/landing:\s*"[^"]*min-h-12[^"]*tracking-\[0\.12em\]/);
  expect(darkCss).toMatch(/\.landing-dark ::selection[\s\S]*?--hud-ink/);
});

test("ships a decorative static valley when the live hero cannot draw", async () => {
  const fallback = await Bun.file(
    new URL("./terrain-fallback.tsx", import.meta.url),
  ).text();
  const terrain = await Bun.file(
    new URL("./terrain.tsx", import.meta.url),
  ).text();

  expect(fallback).toContain('aria-hidden="true"');
  expect(fallback).not.toMatch(/<img/);
  expect(terrain).toContain("TerrainFallback");
  expect(terrain).toContain("landing-world-fallback");
  expect(terrain).toContain("data-terrain={terrainState}");
});

test("uses a shared tighter vertical rhythm for content sections", async () => {
  const brand = await Bun.file(
    new URL(
      "../../../../packages/ui/src/components/brand.tsx",
      import.meta.url,
    ),
  ).text();
  expect(brand).toContain('brandSectionClassName = "py-14 sm:py-20"');

  const sections = [
    "apply.tsx",
    "event.tsx",
    "faq.tsx",
    "people.tsx",
    "qualifier-challenges.tsx",
    "sponsors.tsx",
    "tracks.tsx",
  ];
  for (const file of sections) {
    const source = await Bun.file(new URL(`./${file}`, import.meta.url)).text();
    expect(source).toContain("brandSectionClassName");
  }
});

test("keeps meaningful landing metadata at a readable rem size", async () => {
  const css = await Bun.file(
    new URL("../../../../packages/ui/src/styles/globals.css", import.meta.url),
  ).text();
  const brand = await Bun.file(
    new URL(
      "../../../../packages/ui/src/components/brand.tsx",
      import.meta.url,
    ),
  ).text();
  const prizes = await Bun.file(
    new URL("./prizes.tsx", import.meta.url),
  ).text();

  expect(css).toMatch(/\.landing-type-meta[\s\S]*?font-size:\s*0\.75rem/);
  expect(css).toContain("forced-colors");
  expect(brand).toContain("brand-kicker");
  expect(brand).not.toMatch(/text-\[10px\]/);
  expect(prizes).toContain("landing-type-meta");
  expect(prizes).not.toMatch(/text-\[10px\]/);
});

test("exposes keyboard-operable installer tabs", async () => {
  const tabs = await Bun.file(
    new URL("./cli-install-tabs.tsx", import.meta.url),
  ).text();

  expect(tabs).toContain('role="tablist"');
  expect(tabs).toContain('role="tab"');
  expect(tabs).toContain('role="tabpanel"');
  expect(tabs).toContain("aria-selected");
  expect(tabs).toContain("ArrowRight");
  expect(tabs).toContain("ArrowLeft");
});
