import { describe, expect, test } from "bun:test";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  autoUpdateCli,
  shouldAutoUpdateCli,
  upgradeCli,
} from "../src/upgrade.js";

describe("automatic CLI updates", () => {
  test("installs a newer version published to npm", async () => {
    const upgrades: string[] = [];

    const result = await autoUpdateCli("0.1.146", {
      fetchLatestVersion: async () => "0.1.147",
      upgrade: async () => {
        upgrades.push("upgrade");
      },
    });

    expect(upgrades).toEqual(["upgrade"]);
    expect(result).toEqual({
      status: "updated",
      previousVersion: "0.1.146",
      version: "0.1.147",
    });
  });

  test("does not reinstall the current or an older npm version", async () => {
    let upgradeCount = 0;
    const upgrade = async () => {
      upgradeCount += 1;
    };

    const current = await autoUpdateCli("0.1.147", {
      fetchLatestVersion: async () => "0.1.147",
      upgrade,
    });
    const ahead = await autoUpdateCli("0.2.0", {
      fetchLatestVersion: async () => "0.1.147",
      upgrade,
    });

    expect(upgradeCount).toBe(0);
    expect(current.status).toBe("current");
    expect(ahead.status).toBe("current");
  });

  test("treats stable releases as newer than prereleases", async () => {
    let upgraded = false;

    await autoUpdateCli("1.0.0-rc.2", {
      fetchLatestVersion: async () => "1.0.0",
      upgrade: async () => {
        upgraded = true;
      },
    });

    expect(upgraded).toBe(true);
  });

  test("only runs automatically for installed or standalone CLIs", () => {
    const sourceEntry = join("workspace", "apps", "cli", "src", "index.ts");
    const installedEntry = join(
      "usr",
      "local",
      "lib",
      "node_modules",
      "chofex-cli",
      "dist",
      "index.js",
    );

    expect(
      shouldAutoUpdateCli({
        arguments: ["status"],
        entryPath: sourceEntry,
        environmentValue: undefined,
        standalone: false,
      }),
    ).toBe(false);
    expect(
      shouldAutoUpdateCli({
        arguments: ["status"],
        entryPath: installedEntry,
        environmentValue: undefined,
        standalone: false,
      }),
    ).toBe(true);
    expect(
      shouldAutoUpdateCli({
        arguments: ["status"],
        entryPath: sourceEntry,
        environmentValue: undefined,
        standalone: true,
      }),
    ).toBe(true);
  });

  test("supports opt-out and avoids duplicate explicit updates", () => {
    const installedEntry = join(
      "node_modules",
      "chofex-cli",
      "dist",
      "index.js",
    );
    const options = {
      entryPath: installedEntry,
      standalone: false,
    };

    expect(
      shouldAutoUpdateCli({
        ...options,
        arguments: ["status"],
        environmentValue: "0",
      }),
    ).toBe(false);
    expect(
      shouldAutoUpdateCli({
        ...options,
        arguments: ["update"],
        environmentValue: undefined,
      }),
    ).toBe(false);
    expect(
      shouldAutoUpdateCli({
        ...options,
        arguments: ["upgrade"],
        environmentValue: undefined,
      }),
    ).toBe(false);
  });
});

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
