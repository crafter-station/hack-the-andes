import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const cliPackageName = "chofex-cli";
export const upgradeVersion = "latest";

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

const isStandaloneExecutable = (): boolean =>
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
