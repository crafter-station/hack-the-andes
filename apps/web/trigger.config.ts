import { aptGet } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_kemqynqfsdzrftzoutsz",
  dirs: ["./trigger"],
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
    extensions: [aptGet({ packages: ["fonts-liberation2"] })],
  },
});
