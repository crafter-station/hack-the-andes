import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { aptGet } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

const credentialFontFiles = [
  "StackSansNotch-500.ttf",
  "StackSansNotch-700.ttf",
] as const;

const credentialArtworkFiles = [
  "ridge.png",
  "mountain.png",
  "chofex.png",
  "crafter-station.png",
  "peru-tech-week.png",
] as const;

export const credentialFonts = {
  name: "credentialFonts",
  onBuildComplete: async (
    context: { readonly workingDir: string },
    manifest: { readonly outputPath: string },
  ): Promise<void> => {
    const outputDirectory = join(manifest.outputPath, "fonts");
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all(
      credentialFontFiles.map((fileName) =>
        copyFile(
          join(context.workingDir, "app", "fonts", fileName),
          join(outputDirectory, fileName),
        ),
      ),
    );
  },
};

export const credentialArtwork = {
  name: "credentialArtwork",
  onBuildComplete: async (
    context: { readonly workingDir: string },
    manifest: { readonly outputPath: string },
  ): Promise<void> => {
    const outputDirectory = join(manifest.outputPath, "public", "credential");
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all(
      credentialArtworkFiles.map((fileName) =>
        copyFile(
          join(context.workingDir, "public", "credential", fileName),
          join(outputDirectory, fileName),
        ),
      ),
    );
  },
};

export default defineConfig({
  project: "proj_kemqynqfsdzrftzoutsz",
  dirs: ["./trigger"],
  legacyDevProcessCwdBehaviour: false,
  maxDuration: 900,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 2_000,
      maxTimeoutInMs: 30_000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    external: ["next", "sharp"],
    extensions: [
      aptGet({ packages: ["fonts-liberation2"] }),
      credentialFonts,
      credentialArtwork,
    ],
  },
});
