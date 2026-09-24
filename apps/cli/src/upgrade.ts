import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const cliPackageName = "chofex-cli";
export const upgradeVersion = "latest";
const npmRegistryUrl = `https://registry.npmjs.org/${cliPackageName}/latest`;

const npmUpgradeArguments = (cacheDirectory: string) => [
  "install",
  "--global",
  `${cliPackageName}@${upgradeVersion}`,
  "--force",
  "--prefer-online",
  `--cache=${cacheDirectory}`,
];

type ProcessResult = {
  readonly exitCode: number;
  readonly stderr: string;
};

export type NpmRunner = (
  arguments_: ReadonlyArray<string>,
) => Promise<ProcessResult>;

export type InstallerRunner = (
  installDirectory: string,
) => Promise<ProcessResult>;

type UpgradeOptions = {
  readonly standalone?: boolean;
  readonly npmRunner?: NpmRunner;
  readonly installerRunner?: InstallerRunner;
};

type AutoUpdateOptions = {
  readonly fetchLatestVersion?: () => Promise<string>;
  readonly upgrade?: () => Promise<void>;
};

export type AutoUpdateResult =
  | {
      readonly status: "current";
      readonly version: string;
    }
  | {
      readonly status: "updated";
      readonly previousVersion: string;
      readonly version: string;
    };

type AutoUpdateEligibility = {
  readonly arguments: ReadonlyArray<string>;
  readonly entryPath: string;
  readonly environmentValue: string | undefined;
  readonly standalone: boolean;
};

const runProcess = (
  executable: string,
  arguments_: ReadonlyArray<string>,
  input?: string,
): Promise<ProcessResult> =>
  new Promise((resolve, reject) => {
    const stdin = input === undefined ? "ignore" : "pipe";
    const child = spawn(executable, arguments_, {
      stdio: [stdin, "ignore", "pipe"],
    });
    let stderr = "";

    const stderrStream = child.stderr;
    if (stderrStream === null) {
      child.kill();
      reject(new Error(`Could not capture stderr from ${executable}`));
      return;
    }
    stderrStream.setEncoding("utf8");
    stderrStream.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode: exitCode ?? 1, stderr: stderr.trim() });
    });
    if (input !== undefined) {
      const stdinStream = child.stdin;
      if (stdinStream === null) {
        child.kill();
        reject(new Error(`Could not send input to ${executable}`));
        return;
      }
      stdinStream.end(input);
    }
  });

const runNpm: NpmRunner = (arguments_) => {
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  return runProcess(executable, arguments_);
};

const installerUrl = "https://hacktheandes.com/install";

const runInstaller: InstallerRunner = async (installDirectory) => {
  const response = await fetch(installerUrl);
  if (!response.ok) {
    throw new Error(`installer download returned HTTP ${response.status}`);
  }
  const script = await response.text();
  const arguments_ = [
    "-s",
    "--",
    "--install-dir",
    installDirectory,
    "--no-modify-path",
  ];
  if (process.platform === "win32") {
    arguments_.push("--defer-until-pid", String(process.pid));
  }
  return runProcess("bash", arguments_, script);
};

export const isStandaloneExecutable = (): boolean =>
  typeof Bun !== "undefined" && Bun.isStandaloneExecutable;

const assertSuccessful = (result: ProcessResult, program: string): void => {
  if (result.exitCode === 0) return;

  let detail = "";
  if (result.stderr) detail = `: ${result.stderr}`;
  throw new Error(`${program} exited with code ${result.exitCode}${detail}`);
};

export const upgradeCli = async (
  options: UpgradeOptions = {},
): Promise<void> => {
  const standalone = options.standalone ?? isStandaloneExecutable();
  if (standalone) {
    const runner = options.installerRunner ?? runInstaller;
    const result = await runner(dirname(process.execPath));
    assertSuccessful(result, "installer");
    return;
  }

  const runner = options.npmRunner ?? runNpm;
  const cacheDirectory = await mkdtemp(join(tmpdir(), "chofex-npm-cache-"));
  try {
    const result = await runner(npmUpgradeArguments(cacheDirectory));
    assertSuccessful(result, "npm");
  } finally {
    await rm(cacheDirectory, { recursive: true, force: true });
  }
};

type ParsedVersion = {
  readonly core: readonly [number, number, number];
  readonly prerelease: ReadonlyArray<string>;
};

const parseVersion = (version: string): ParsedVersion => {
  const match = version.match(
    /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
  );
  if (match === null) throw new Error(`Invalid CLI version: ${version}`);

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4]?.split(".") ?? [],
  };
};

const comparePrereleaseIdentifier = (left: string, right: string): number => {
  const leftNumber = /^\d+$/.test(left) ? Number(left) : undefined;
  const rightNumber = /^\d+$/.test(right) ? Number(right) : undefined;
  if (leftNumber !== undefined && rightNumber !== undefined) {
    return leftNumber - rightNumber;
  }
  if (leftNumber !== undefined) return -1;
  if (rightNumber !== undefined) return 1;
  return left.localeCompare(right);
};

const compareVersions = (left: string, right: string): number => {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);
  const [leftMajor, leftMinor, leftPatch] = parsedLeft.core;
  const [rightMajor, rightMinor, rightPatch] = parsedRight.core;
  for (const difference of [
    leftMajor - rightMajor,
    leftMinor - rightMinor,
    leftPatch - rightPatch,
  ]) {
    if (difference !== 0) return difference;
  }

  if (parsedLeft.prerelease.length === 0) {
    return parsedRight.prerelease.length === 0 ? 0 : 1;
  }
  if (parsedRight.prerelease.length === 0) return -1;

  const identifierCount = Math.max(
    parsedLeft.prerelease.length,
    parsedRight.prerelease.length,
  );
  for (let index = 0; index < identifierCount; index += 1) {
    const leftIdentifier = parsedLeft.prerelease[index];
    const rightIdentifier = parsedRight.prerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    const difference = comparePrereleaseIdentifier(
      leftIdentifier,
      rightIdentifier,
    );
    if (difference !== 0) return difference;
  }
  return 0;
};

const fetchLatestVersion = async (): Promise<string> => {
  const response = await fetch(npmRegistryUrl, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`npm registry returned HTTP ${response.status}`);
  }

  const metadata: unknown = await response.json();
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("version" in metadata) ||
    typeof metadata.version !== "string"
  ) {
    throw new Error("npm registry returned an invalid package version");
  }
  parseVersion(metadata.version);
  return metadata.version;
};

export const autoUpdateCli = async (
  currentVersion: string,
  options: AutoUpdateOptions = {},
): Promise<AutoUpdateResult> => {
  const latestVersion = await (
    options.fetchLatestVersion ?? fetchLatestVersion
  )();
  if (compareVersions(latestVersion, currentVersion) <= 0) {
    return { status: "current", version: currentVersion };
  }

  await (options.upgrade ?? upgradeCli)();
  return {
    status: "updated",
    previousVersion: currentVersion,
    version: latestVersion,
  };
};

export const shouldAutoUpdateCli = ({
  arguments: arguments_,
  entryPath,
  environmentValue,
  standalone,
}: AutoUpdateEligibility): boolean => {
  if (environmentValue === "0" || environmentValue === "false") return false;
  if (arguments_.includes("update") || arguments_.includes("upgrade")) {
    return false;
  }
  if (environmentValue === "1" || environmentValue === "true") return true;
  if (standalone) return true;
  return entryPath.split(/[\\/]/).includes("node_modules");
};
