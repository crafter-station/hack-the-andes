import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Créditos | Hack the Andes",
  description: "Fuentes y atribuciones de Hack the Andes.",
};

export default async function CreditsPage() {
  const markdown = await readFile(
    path.join(process.cwd(), "content/legal/credits.md"),
    "utf8",
  );

  return <LegalPage>{markdown}</LegalPage>;
}
