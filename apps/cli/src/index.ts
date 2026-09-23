#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { CliOutput, Command } from "effect/unstable/cli";

import { command } from "./commands.js";
import { printJson } from "./output.js";
import { welcomeFormatter } from "./welcome.js";

declare const CHOFEX_VERSION: string | undefined;

const readCliVersion = (): string => {
  if (typeof CHOFEX_VERSION !== "undefined") return CHOFEX_VERSION;

  const packageMetadata = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  return packageMetadata.version;
};

const cliVersion = readCliVersion();
const arguments_ = process.argv.slice(2);

const jsonOutputRequested = (arguments_: ReadonlyArray<string>): boolean => {
  if (arguments_.includes("--output=json")) return true;
  const outputFlag = arguments_.lastIndexOf("--output");
  return outputFlag >= 0 && arguments_[outputFlag + 1] === "json";
};

const jsonMode = jsonOutputRequested(arguments_);
const jsonHelpRequested =
  jsonMode && (arguments_.includes("--help") || arguments_.includes("-h"));
const jsonVersionRequested =
  jsonMode && (arguments_.includes("--version") || arguments_.includes("-v"));

const quietConsole: Console.Console = Object.assign(Object.create(console), {
  log: () => undefined,
  error: () => undefined,
});

const commandProgram = command.pipe(
  Command.run({ version: cliVersion, renderErrors: !jsonMode }),
  Effect.provide(
    CliOutput.layer(
      welcomeFormatter({
        home: arguments_.length === 0,
        columns: process.stdout.columns ?? 80,
        colors:
          process.stdout.isTTY === true &&
          process.env.NO_COLOR === undefined &&
          process.env.TERM !== "dumb",
      }),
    ),
  ),
  Effect.catch((error) => {
    if (!jsonMode) return Effect.fail(error);
    if (error._tag === "ShowHelp" && error.errors.length === 0) {
      return printJson({
        version: 1,
        ok: true,
        requestId: crypto.randomUUID(),
        data: {
          helpRequested: true,
          commandPath: error.commandPath,
          hint: "Run without --output json to view formatted help",
        },
      });
    }
    process.exitCode = 2;
    const errors = error._tag === "ShowHelp" ? error.errors : [error];
    return printJson({
      version: 1,
      ok: false,
      requestId: crypto.randomUUID(),
      error: {
        code: "CLI_PARSE_ERROR",
        message: errors.map((item) => item.message).join("; "),
        retryable: false,
        details: { types: errors.map((item) => item._tag) },
      },
    });
  }),
  (program) => {
    if (!jsonMode) return program;
    return Effect.provideService(program, Console.Console, quietConsole);
  },
);

const programForArguments = () => {
  if (jsonVersionRequested) {
    return printJson({
      version: 1,
      ok: true,
      requestId: crypto.randomUUID(),
      data: { cliVersion },
    });
  }
  if (jsonHelpRequested) {
    return printJson({
      version: 1,
      ok: true,
      requestId: crypto.randomUUID(),
      data: {
        helpRequested: true,
        hint: "Run without --output json to view formatted help",
      },
    });
  }
  return commandProgram;
};

programForArguments().pipe(Effect.provide(NodeServices.layer), (program) =>
  NodeRuntime.runMain(program, { disableErrorReporting: true }),
);
