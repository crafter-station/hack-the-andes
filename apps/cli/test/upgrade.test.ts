import { describe, expect, test } from "bun:test";
import { stat } from "node:fs/promises";
import { dirname } from "node:path";

import { upgradeCli } from "../src/upgrade.js";

describe("CLI upgrade", () => {
  test("forces npm to refresh the latest package", async () => {
    const calls: Array<ReadonlyArray<string>> = [];
    let cacheDirectory = "";

    await upgradeCli({
      npmRunner: async (arguments_) => {
        calls.push(arguments_);
        cacheDirectory = (arguments_[5] ?? "").replace("--cache=", "");
        expect((await stat(cacheDirectory)).isDirectory()).toBe(true);
        return { exitCode: 0, stderr: "" };
      },
    });

    expect(calls).toEqual([
      [
        "install",
        "--global",
        "chofex-cli@latest",
        "--force",
        "--prefer-online",
        `--cache=${cacheDirectory}`,
      ],
    ]);
    expect(stat(cacheDirectory)).rejects.toThrow();
  });

  test("reports npm failures", async () => {
    expect(
      upgradeCli({
        npmRunner: async () => ({
          exitCode: 1,
          stderr: "permission denied",
        }),
      }),
    ).rejects.toThrow("npm exited with code 1: permission denied");
  });

  test("uses the curl installer for a standalone executable", async () => {
    const installDirectories: string[] = [];

    await upgradeCli({
      standalone: true,
      installerRunner: async (installDirectory) => {
        installDirectories.push(installDirectory);
        return { exitCode: 0, stderr: "" };
      },
    });

    expect(installDirectories).toEqual([dirname(process.execPath)]);
  });
});
