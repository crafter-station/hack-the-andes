import { readFile } from "node:fs/promises";

import { type Shipment, ShipmentSchema } from "@chofex/challenges-contract";
import { Effect, Schema } from "effect";
import { Prompt } from "effect/unstable/cli";
import type * as PromptModule from "effect/unstable/cli/Prompt";

import { CliError, cliError } from "./errors.js";

export const defaultChallengeSlug = "black-box";

const readStdin = async (): Promise<string> => {
  const chunks: Array<Buffer> = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
};

export const readTextFile = (path: string): Effect.Effect<string, CliError> =>
  Effect.tryPromise({
    try: async () => {
      if (path === "-") return readStdin();
      return readFile(path, "utf8");
    },
    catch: (error) =>
      cliError(
        "INVALID_INPUT_FILE",
        `Could not read ${path}: ${String(error)}`,
      ),
  });

export const javascriptSourceFromPath = (
  path: string | undefined,
  challenge = defaultChallengeSlug,
): Effect.Effect<{ kind: "javascript_source"; source: string }, CliError> => {
  if (!path) {
    let expectedFunction = "calculateShipping(input)";
    if (challenge === "broken-agent")
      expectedFunction = "createScheduler(dependencies)";
    return Effect.fail(
      cliError(
        "SOURCE_REQUIRED",
        `Pass --source <file.js> with function ${expectedFunction}`,
      ),
    );
  }
  return readTextFile(path).pipe(
    Effect.map((source) => ({ kind: "javascript_source" as const, source })),
  );
};

const requiredInteger = (message: string): Prompt.Prompt<string> =>
  Prompt.text({
    message,
    validate: (value) => {
      if (value.trim() === "" || !Number.isInteger(Number(value))) {
        return Effect.fail("Must be a whole number");
      }
      return Effect.succeed(value);
    },
  });

const interactiveShipment = (): Effect.Effect<
  Shipment,
  CliError,
  PromptModule.Environment
> =>
  Prompt.run(
    Prompt.all({
      distanceKm: requiredInteger("Distance (whole km)"),
      weightKg: requiredInteger("Weight (whole kg)"),
      hour: requiredInteger("Hour (0-23)"),
      fragile: Prompt.confirm({ message: "Fragile?" }),
      express: Prompt.confirm({ message: "Express?" }),
    }),
  ).pipe(
    Effect.map((input) => ({
      distanceKm: Number(input.distanceKm),
      weightKg: Number(input.weightKg),
      hour: Number(input.hour),
      fragile: input.fragile,
      express: input.express,
    })),
    Effect.flatMap((input) =>
      Schema.decodeUnknownEffect(ShipmentSchema)(input).pipe(
        Effect.mapError((error) => cliError("VALIDATION_ERROR", error.message)),
      ),
    ),
    Effect.mapError((error) => {
      if (error instanceof CliError) return error;
      return cliError("PROMPT_CANCELLED", "Interactive input was cancelled");
    }),
  );

export const shipmentInput = (
  path: string | undefined,
  flags: {
    readonly distanceKm?: number;
    readonly weightKg?: number;
    readonly hour?: number;
    readonly fragile?: boolean;
    readonly express?: boolean;
  },
): Effect.Effect<Shipment, CliError, PromptModule.Environment> => {
  if (path) {
    return readTextFile(path).pipe(
      Effect.flatMap((contents) =>
        Effect.try({
          try: () => JSON.parse(contents) as unknown,
          catch: (error) =>
            cliError(
              "INVALID_INPUT_FILE",
              `Could not parse JSON shipment: ${String(error)}`,
            ),
        }),
      ),
      Effect.flatMap((input) =>
        Schema.decodeUnknownEffect(ShipmentSchema)(input).pipe(
          Effect.mapError((error) =>
            cliError("VALIDATION_ERROR", error.message),
          ),
        ),
      ),
    );
  }

  const hasFlags =
    flags.distanceKm !== undefined &&
    flags.weightKg !== undefined &&
    flags.hour !== undefined &&
    flags.fragile !== undefined &&
    flags.express !== undefined;
  if (hasFlags) {
    return Schema.decodeUnknownEffect(ShipmentSchema)({
      distanceKm: flags.distanceKm,
      weightKg: flags.weightKg,
      hour: flags.hour,
      fragile: flags.fragile,
      express: flags.express,
    }).pipe(
      Effect.mapError((error) => cliError("VALIDATION_ERROR", error.message)),
    );
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Effect.fail(
      cliError(
        "INPUT_REQUIRED",
        "Provide --input shipment.json or --distance, --weight, --hour, --fragile, and --express",
      ),
    );
  }
  return interactiveShipment();
};
