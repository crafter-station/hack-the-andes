import { expect, test } from "bun:test";

const sourceFor = (name: string) =>
  Bun.file(new URL(`./${name}`, import.meta.url)).text();

test("terms are Spanish Términos y Condiciones for the Lima weekend", async () => {
  const terms = await sourceFor("terms.md");

  expect(terms).toContain("# Términos y Condiciones");
  expect(terms).toContain("evento presencial");
  expect(terms).toContain("Lima, Perú");
  expect(terms).toContain("17 y 18 de octubre de 2026");
  expect(terms).toContain("Código de conducta");
  expect(terms).toContain("](/privacy)");
  expect(terms).not.toMatch(/These terms apply/);
  expect(terms).not.toMatch(/Privacy Policy/);
  expect(terms).not.toMatch(/Last updated/);
});

test("privacy is Spanish Privacidad for the Lima weekend", async () => {
  const privacy = await sourceFor("privacy.md");

  expect(privacy).toContain("# Privacidad");
  expect(privacy).toContain("evento presencial");
  expect(privacy).toContain("Lima, Perú");
  expect(privacy).toContain("17 y 18 de octubre de 2026");
  expect(privacy).toContain("](/terms)");
  expect(privacy).toContain("Términos y Condiciones");
  expect(privacy).not.toMatch(/This policy explains/);
  expect(privacy).not.toMatch(/Terms and Code of Conduct/);
  expect(privacy).not.toMatch(/Last updated/);
});
