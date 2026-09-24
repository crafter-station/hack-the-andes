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
      upgrade: async (version) => {
        upgrades.push(version);
      },
    });

    expect(upgrades).toEqual(["0.1.147"]);
    expect(result).toEqual({
      status: "updated",
      previousVersion: "0.1.146",
      version: "0.1.147",
    });
  });

  test("does not reinstall the current or an older npm version", async () => {
    let upgradeCount = 0;
    const upgrade = async (_version: string) => {
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
      upgrade: async (_version) => {
        upgraded = true;
      },
    });

    expect(upgraded).toBe(true);
  });

  test("only runs automatically for global npm or standalone CLIs", async () => {
    const sourceEntry = join("workspace", "apps", "cli", "src", "index.ts");
    const globalNodeModulesPath = join("usr", "local", "lib", "node_modules");
    const installedEntry = join(
      globalNodeModulesPath,
      "chofex-cli",
      "dist",
      "index.js",
    );
    const localEntry = join(
      "workspace",
      "node_modules",
      "chofex-cli",
      "dist",
      "index.js",
    );

    expect(
      await shouldAutoUpdateCli({
        arguments: ["status"],
        entryPath: sourceEntry,
        environmentValue: undefined,
        globalNodeModulesPath,
        standalone: false,
      }),
    ).toBe(false);
    expect(
      await shouldAutoUpdateCli({
        arguments: ["status"],
        entryPath: installedEntry,
        environmentValue: undefined,
        globalNodeModulesPath,
        standalone: false,
      }),
    ).toBe(true);
    expect(
      await shouldAutoUpdateCli({
        arguments: ["status"],
        entryPath: localEntry,
        environmentValue: undefined,
        globalNodeModulesPath,
        standalone: false,
      }),
    ).toBe(false);
    expect(
      await shouldAutoUpdateCli({
        arguments: ["status"],
        entryPath: sourceEntry,
        environmentValue: undefined,
        globalNodeModulesPath,
        standalone: true,
      }),
    ).toBe(true);
  });

  test("supports opt-out and avoids duplicate explicit updates", async () => {
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
      await shouldAutoUpdateCli({
        ...options,
        arguments: ["status"],
        environmentValue: "0",
      }),
    ).toBe(false);
    expect(
      await shouldAutoUpdateCli({
        ...options,
        arguments: ["update"],
        environmentValue: undefined,
      }),
    ).toBe(false);
    expect(
      await shouldAutoUpdateCli({
        ...options,
        arguments: ["upgrade"],
        environmentValue: undefined,
      }),
    ).toBe(false);
  });

  test("does not mistake an option value for the update command", async () => {
    const globalNodeModulesPath = join("usr", "local", "lib", "node_modules");

    expect(
      await shouldAutoUpdateCli({
        arguments: ["validate", "--input", "update"],
        entryPath: join(
          globalNodeModulesPath,
          "chofex-cli",
          "dist",
          "index.js",
        ),
        environmentValue: undefined,
        globalNodeModulesPath,
        standalone: false,
      }),
    ).toBe(true);
    expect(
      await shouldAutoUpdateCli({
        arguments: ["--token", "update", "status"],
        entryPath: join(
          globalNodeModulesPath,
          "chofex-cli",
          "dist",
          "index.js",
        ),
        environmentValue: undefined,
        globalNodeModulesPath,
        standalone: false,
      }),
    ).toBe(true);
  });

  test("recognizes the package inside npm's reported global root", async () => {
    const globalNodeModulesPath = join("usr", "local", "lib", "node_modules");
    const npmCalls: Array<ReadonlyArray<string>> = [];

    const enabled = await shouldAutoUpdateCli({
      arguments: ["status"],
      entryPath: join(globalNodeModulesPath, "chofex-cli", "dist", "index.js"),
      environmentValue: undefined,
      npmRunner: async (arguments_) => {
        npmCalls.push(arguments_);
        return {
          exitCode: 0,
          stdout: globalNodeModulesPath,
          stderr: "",
        };
      },
      standalone: false,
    });

    expect(enabled).toBe(true);
    expect(npmCalls).toEqual([["root", "--global"]]);
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

  test("installs the exact npm version requested by the startup check", async () => {
    const calls: Array<ReadonlyArray<string>> = [];

    await upgradeCli({
      version: "0.1.147",
      npmRunner: async (arguments_) => {
        calls.push(arguments_);
        return { exitCode: 0, stderr: "" };
      },
    });

    expect(calls[0]?.[2]).toBe("chofex-cli@0.1.147");
  });

  test("uses the curl installer for a standalone executable", async () => {
    const installs: Array<{ directory: string; version: string }> = [];

    await upgradeCli({
      standalone: true,
      version: "0.1.147",
      installerRunner: async (installDirectory, version) => {
        installs.push({ directory: installDirectory, version });
        return { exitCode: 0, stderr: "" };
      },
    });

    expect(installs).toEqual([
      { directory: dirname(process.execPath), version: "0.1.147" },
    ]);
  });
});
