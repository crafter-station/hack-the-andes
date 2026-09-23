import { expect, test } from "bun:test";

import { footerNavigation, legalCopy } from "@/components/landing/content";

const sourceFor = (name: string) =>
  Bun.file(new URL(`./${name}`, import.meta.url)).text();

test("legal pages wear the same dark identity as the landing", async () => {
  const page = await sourceFor("legal-page.tsx");

  expect(page).toContain('"landing-dark flex flex-col"');
  expect(page).toContain("BrandPage");
  expect(page).toContain("BrandKicker");
  expect(page).toContain("text-[var(--hud-kicker)]");
  expect(page).toContain("text-[var(--hud-muted)]");
  expect(page).toContain("bg-[var(--hud-paper)]");
  expect(page).toContain('<LandingSkipLinks applyHref="/#apply" />');
  expect(page).toContain('<LandingFooter sectionHrefPrefix="/" />');
  expect(page).not.toContain("alternateHref");
  expect(page).not.toContain("Privacy Policy");
});

test("legal chrome reuses the footer hrefs for Términos and Privacidad", () => {
  const footerHrefs = footerNavigation.flatMap((group) =>
    group.links.map((link) => link.href),
  );

  expect(legalCopy.termsHref).toBe("/terms");
  expect(legalCopy.privacyHref).toBe("/privacy");
  expect(footerHrefs).toContain(legalCopy.termsHref);
  expect(footerHrefs).toContain(legalCopy.privacyHref);

  const information = footerNavigation.find(
    (group) => group.label === "Información",
  );
  expect(information?.links).toEqual(
    expect.arrayContaining([
      { href: "/terms", label: "Términos" },
      { href: "/privacy", label: "Privacidad" },
    ]),
  );
});

test("legal chrome copy stays Spanish and names the Lima weekend", () => {
  expect(legalCopy.termsTitle).toBe("Términos y Condiciones");
  expect(legalCopy.privacyTitle).toBe("Privacidad");
  expect(legalCopy.home).toBe("Inicio");
  expect(legalCopy.eventKicker).toBe("Lima presencial · 17–18 oct 2026");
  expect(legalCopy.termsDescription).toMatch(/Lima/);
  expect(legalCopy.termsDescription).toMatch(/octubre de 2026/);
  expect(legalCopy.privacyDescription).toMatch(/Lima/);
  expect(legalCopy.privacyDescription).toMatch(/octubre de 2026/);
});

test("terms and privacy routes render LegalPage with Spanish metadata", async () => {
  const [termsPage, privacyPage, creditsPage] = await Promise.all([
    Bun.file(new URL("../app/terms/page.tsx", import.meta.url)).text(),
    Bun.file(new URL("../app/privacy/page.tsx", import.meta.url)).text(),
    Bun.file(new URL("../app/credits/page.tsx", import.meta.url)).text(),
  ]);

  expect(termsPage).toContain("legalCopy.termsTitle");
  expect(termsPage).toContain("content/legal/terms.md");
  expect(termsPage).toContain("<LegalPage>{markdown}</LegalPage>");
  expect(privacyPage).toContain("legalCopy.privacyTitle");
  expect(privacyPage).toContain("content/legal/privacy.md");
  expect(privacyPage).toContain("<LegalPage>{markdown}</LegalPage>");
  expect(creditsPage).toContain("<LegalPage>{markdown}</LegalPage>");
  expect(termsPage).not.toContain("Privacy Policy");
  expect(privacyPage).not.toContain("Terms and Code of Conduct");
});
