/**
 * Copies MediaPipe's runtime and the segmenter's weights into `public`.
 *
 * They are served from this origin rather than a CDN because the runtime
 * fetches them itself at call time: from a third party they are the first
 * thing a tightened `connect-src` breaks, and they break silently — the
 * cut-out simply stops happening and every portrait ships with its
 * background still on it.
 *
 * Copied at build time rather than committed. The wasm is 33 MB across
 * three builds, the lockfile already pins which version those come from,
 * and a binary in git is a binary somebody eventually forgets to update
 * alongside the package.
 *
 * The weights are the one file not in the package. They are fetched once
 * and cached, so a build without network still works after the first.
 */

import { createWriteStream } from "node:fs";
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..");
const target = join(app, "public/vision");

/**
 * Pinned by digest-bearing path, not by `latest`.
 *
 * Google serves these under a version segment; `1` is the release the
 * float16 selfie segmenter ships as. A moving URL here would change the
 * model under a build that nothing else in the repo records.
 */
const WEIGHTS_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite";

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const main = async () => {
  await mkdir(target, { recursive: true });

  const wasm = join(app, "../../node_modules/@mediapipe/tasks-vision/wasm");
  if (!(await exists(wasm))) {
    throw new Error(
      "@mediapipe/tasks-vision is not installed; run `bun install` first",
    );
  }

  // Every file, not the SIMD build alone: the resolver picks between the
  // SIMD and no-SIMD variants at runtime, so shipping one 404s on the
  // browsers that need the other.
  for (const name of await readdir(wasm)) {
    await copyFile(join(wasm, name), join(target, name));
  }

  const weights = join(target, "selfie_segmenter.tflite");
  if (await exists(weights)) {
    console.log("vision: runtime copied, weights already present");
    return;
  }

  const response = await fetch(WEIGHTS_URL);
  if (!response.ok || !response.body) {
    throw new Error(`vision: weights fetch failed with ${response.status}`);
  }
  await pipeline(response.body, createWriteStream(weights));
  console.log("vision: runtime copied, weights fetched");
};

await main();
