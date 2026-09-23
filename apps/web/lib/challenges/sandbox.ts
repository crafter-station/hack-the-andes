import * as childProcess from "node:child_process";

import type { Shipment } from "@chofex/challenges-contract";

import { HttpError } from "../registration/http";

const evaluationTimeoutMs = 1_500;
const workerExitGraceMs = 500;
const maximumWorkerOutputBytes = 64 * 1_024;
const maximumConcurrentWorkers = 4;
let activeWorkers = 0;

// Next's output tracer treats direct spawn(..., ["--eval", source]) calls as
// asset references. Keep the process API indirect so the inline worker remains
// runtime data rather than a build-time module path.
const spawnIsolatedProcess = Reflect.get(
  childProcess,
  "spawn",
) as typeof childProcess.spawn;

const workerSource = String.raw`
import vm from "node:vm";

let requestText = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) requestText += chunk;

const reply = (message) => process.stdout.write(JSON.stringify(message));

try {
  const request = JSON.parse(requestText);
  const shipmentsJson = JSON.stringify(request.shipments);
  const scriptSource = [
    '"use strict";',
    "const __loadSolution = () => {",
    "  const module = { exports: {} };",
    "  const exports = module.exports;",
    request.source,
    '  if (typeof calculateShipping === "function") return calculateShipping;',
    "  if (",
    "    module.exports &&",
    '    typeof module.exports === "object" &&',
    '    typeof module.exports.calculateShipping === "function"',
    "  ) {",
    "    return module.exports.calculateShipping;",
    "  }",
    '  if (typeof module.exports === "function") return module.exports;',
    '  throw new Error("Define function calculateShipping(input)");',
    "};",
    "const __calculateShipping = __loadSolution();",
    "const __shipments = JSON.parse(" + JSON.stringify(shipmentsJson) + ");",
    "const __results = __shipments.map((input) => {",
    "  const value = __calculateShipping(input);",
    '  if (typeof value !== "number" || !Number.isFinite(value)) {',
    '    throw new Error("calculateShipping must return a finite number");',
    "  }",
    "  return value;",
    "});",
    "JSON.stringify(__results);",
  ].join("\n");

  const context = vm.createContext(Object.create(null), {
    codeGeneration: { strings: false, wasm: false },
  });
  const script = new vm.Script(scriptSource, { filename: "solution.js" });
  const serializedResults = script.runInContext(context, {
    timeout: ${evaluationTimeoutMs},
    displayErrors: true,
  });
  reply({ ok: true, results: JSON.parse(serializedResults) });
} catch (error) {
  let message = String(error);
  if (error instanceof Error) message = error.message;
  reply({ ok: false, error: message });
}
`;

type WorkerResponse =
  | { readonly ok: true; readonly results: ReadonlyArray<unknown> }
  | { readonly ok: false; readonly error: string };

const executionError = (message: string): HttpError =>
  new HttpError(
    422,
    "SOLUTION_EXECUTION_FAILED",
    `Could not run calculateShipping: ${message}`,
    false,
  );

const parseWorkerResponse = (output: string): Array<number> => {
  let response: WorkerResponse;
  try {
    response = JSON.parse(output) as WorkerResponse;
  } catch {
    throw executionError("The isolated runner returned an invalid response");
  }
  if (!response.ok) throw executionError(response.error);
  if (!Array.isArray(response.results)) {
    throw executionError("calculateShipping did not produce a result list");
  }

  const results: Array<number> = [];
  for (const value of response.results) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw executionError("calculateShipping must return a finite number");
    }
    results.push(value);
  }
  return results;
};

export const runShippingSolution = (
  source: string,
  shipments: ReadonlyArray<Shipment>,
): Promise<Array<number>> => {
  if (activeWorkers >= maximumConcurrentWorkers) {
    return Promise.reject(
      new HttpError(
        503,
        "SOLUTION_RUNNER_BUSY",
        "The solution runner is busy; try again shortly",
        true,
      ),
    );
  }
  activeWorkers += 1;

  return new Promise((resolve, reject) => {
    let child: childProcess.ChildProcessWithoutNullStreams;
    try {
      child = spawnIsolatedProcess(
        "node",
        [
          "--permission",
          "--max-old-space-size=32",
          "--input-type=module",
          "--eval",
          workerSource,
        ],
        {
          env: { NODE_ENV: "production", PATH: process.env.PATH ?? "" },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
    } catch (error) {
      activeWorkers -= 1;
      reject(executionError(String(error)));
      return;
    }
    let output = "";
    let diagnostics = "";
    let settled = false;

    const finish = (result: () => void): void => {
      if (settled) return;
      settled = true;
      activeWorkers -= 1;
      clearTimeout(timeout);
      result();
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(executionError("Execution timed out")));
    }, evaluationTimeoutMs + workerExitGraceMs);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (output.length > maximumWorkerOutputBytes) child.kill("SIGKILL");
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      diagnostics += chunk;
      if (diagnostics.length > maximumWorkerOutputBytes) child.kill("SIGKILL");
    });
    child.on("error", (error) => {
      finish(() => reject(executionError(error.message)));
    });
    child.on("close", (code) => {
      finish(() => {
        if (code !== 0) {
          const message = diagnostics.trim() || "The isolated runner exited";
          reject(executionError(message));
          return;
        }
        try {
          resolve(parseWorkerResponse(output));
        } catch (error) {
          reject(error);
        }
      });
    });

    child.stdin.end(JSON.stringify({ source, shipments }));
  });
};
