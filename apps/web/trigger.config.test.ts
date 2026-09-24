import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { credentialFonts } from "./trigger.config";

test("copies credential fonts to the Trigger runtime path", async () => {
  const outputPath = await mkdtemp(join(tmpdir(), "chofex-trigger-build-"));
  const workingDir = dirname(fileURLToPath(import.meta.url));

  try {
    await credentialFonts.onBuildComplete({ workingDir }, { outputPath });

    for (const fileName of [
      "StackSansNotch-500.ttf",
      "StackSansNotch-700.ttf",
    ]) {
      const source = await readFile(join(workingDir, "app", "fonts", fileName));
      const deployed = await readFile(join(outputPath, "fonts", fileName));
      expect(deployed).toEqual(source);
    }
  } finally {
    await rm(outputPath, { recursive: true, force: true });
  }
});
