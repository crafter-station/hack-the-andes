import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { brandName, legalCopy } from "@/components/landing/content";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: `${legalCopy.privacyTitle} | ${brandName}`,
  description: legalCopy.privacyDescription,
};

export default async function PrivacyPage() {
  const markdown = await readFile(
    path.join(process.cwd(), "content/legal/privacy.md"),
    "utf8",
  );

  return <LegalPage>{markdown}</LegalPage>;
}
