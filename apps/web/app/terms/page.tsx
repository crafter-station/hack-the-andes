import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { brandName, legalCopy } from "@/components/landing/content";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: `${legalCopy.termsTitle} | ${brandName}`,
  description: legalCopy.termsDescription,
};

export default async function TermsPage() {
  const markdown = await readFile(
    path.join(process.cwd(), "content/legal/terms.md"),
    "utf8",
  );

  return <LegalPage>{markdown}</LegalPage>;
}
