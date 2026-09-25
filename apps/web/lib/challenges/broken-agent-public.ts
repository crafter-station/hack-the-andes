import * as childProcess from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChallengeLocalTestResult } from "@chofex/challenges-contract";
import { brokenAgentPublicTestSource } from "@chofex/challenges-contract/broken-agent";

const publicTestCount = 7;
const testTimeoutMs = 3_000;
const maximumOutputBytes = 64 * 1_024;

const spawnIsolatedProcess = Reflect.get(
  childProcess,
  "spawn",
) as typeof childProcess.spawn;

interface ProcessResult {
  readonly exitCode: number | null;
  readonly output: string;
}

const runPublicTestProcess = (directory: string): Promise<ProcessResult> =>
  new Promise((resolve) => {
    const child = spawnIsolatedProcess(
      "node",
      [
        "--permission",
        `--allow-fs-read=${directory}`,
        "--test",
        "--test-isolation=none",
        "--test-reporter=tap",
        "scheduler.test.js",
      ],
      {
        cwd: directory,
        env: { NODE_ENV: "test", PATH: process.env.PATH ?? "" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    let settled = false;

    const finish = (result: ProcessResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const append = (chunk: string): void => {
      output += chunk;
      if (output.length > maximumOutputBytes) child.kill("SIGKILL");
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ exitCode: null, output: "" });
    }, testTimeoutMs);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", append);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", append);
    child.on("error", () => finish({ exitCode: null, output: "" }));
    child.on("close", (exitCode) => finish({ exitCode, output }));
  });

const publicTestResult = (
  processResult: ProcessResult,
): ChallengeLocalTestResult => {
  const passMatch = processResult.output.match(/^# pass (\d+)$/m);
  let matchedObservations = Number(passMatch?.[1] ?? 0);
  if (processResult.exitCode === 0) matchedObservations = publicTestCount;
  matchedObservations = Math.min(publicTestCount, matchedObservations);

  const failureNames = [
    ...processResult.output.matchAll(/^not ok \d+ - (.+)$/gm),
  ]
    .map((match) => match[1]?.trim())
    .filter((name): name is string => Boolean(name))
    .slice(0, publicTestCount);
  if (failureNames.length === 0 && matchedObservations < publicTestCount) {
    failureNames.push(
      "Submitted scheduler could not complete the public suite",
    );
  }

  return {
    kind: "broken_agent",
    matchedObservations,
    observationCount: publicTestCount,
    accuracy: matchedObservations / publicTestCount,
    meanError: (publicTestCount - matchedObservations) / publicTestCount,
    mismatches: failureNames.map((name, index) => ({
      sequence: index + 1,
      expected: "pass",
      actual: name,
    })),
  };
};

export const runBrokenAgentPublicTests = async (
  source: string,
): Promise<ChallengeLocalTestResult> => {
  const directory = await mkdtemp(join(tmpdir(), "chofex-broken-agent-"));
  try {
    const allowedDirectory = await realpath(directory);
    await Promise.all([
      writeFile(join(directory, "scheduler.js"), source, "utf8"),
      writeFile(
        join(directory, "scheduler.test.js"),
        brokenAgentPublicTestSource,
        "utf8",
      ),
    ]);
    return publicTestResult(await runPublicTestProcess(allowedDirectory));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
