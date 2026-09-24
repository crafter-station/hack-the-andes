import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acceptedDetailsInputFieldNames,
  applicationInputFieldNames,
} from "@chofex/registration-contract";

const cliDirectory = new URL("../", import.meta.url).pathname;
const cliEntry = new URL("../src/index.ts", import.meta.url).pathname;

const runCliFrom = async (
  cwd: string,
  ...arguments_: ReadonlyArray<string>
) => {
  const child = Bun.spawn([process.execPath, cliEntry, ...arguments_], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
};

const runCli = (...arguments_: ReadonlyArray<string>) =>
  runCliFrom(cliDirectory, ...arguments_);

describe("CLI JSON mode", () => {
  test("returns one JSON error document for invalid arguments", async () => {
    const { exitCode, stderr, stdout } = await runCli(
      "--output",
      "json",
      "schema",
      "--stage",
      "invalid",
    );

    expect(exitCode).toBe(2);
    expect(stderr).toBe("");
    expect(stdout.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(stdout)).toMatchObject({
      version: 1,
      ok: false,
      error: {
        code: "CLI_PARSE_ERROR",
        retryable: false,
      },
    });
  });

  test("returns JSON for built-in help and version flags", async () => {
    const help = await runCli("--output", "json", "--help");
    const version = await runCli("--output=json", "--version");

    expect(help.exitCode).toBe(0);
    expect(JSON.parse(help.stdout)).toMatchObject({
      version: 1,
      ok: true,
      data: { helpRequested: true },
    });
    expect(version.exitCode).toBe(0);
    expect(JSON.parse(version.stdout)).toMatchObject({
      version: 1,
      ok: true,
      data: { cliVersion: "0.1.0" },
    });
  });

  test("advertises a command that verifies authentication", async () => {
    const help = await runCli("--help");

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("whoami");
    expect(help.stdout).toContain("Verify the current Clerk authentication");
  });

  test("advertises the equivalent CLI update and upgrade commands", async () => {
    const help = await runCli("--help");

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("update");
    expect(help.stdout).toContain("upgrade");
    expect(help.stdout).toContain("Update chofex-cli to the latest version");
  });

  test("advertises mini technical challenges", async () => {
    const help = await runCli("--help");

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("challenge");
    expect(help.stdout).toContain("Play mini technical challenges");
  });

  test("sends a closed challenge to its final ranking", async () => {
    const result = await runCli("challenge");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("THE SHIPPING MACHINE");
    expect(result.stdout).toContain("está cerrado");
    expect(result.stdout).toContain("chofex challenge ranking");
    expect(result.stdout).not.toContain("chofex challenge query");
    expect(result.stdout).not.toContain("chofex challenge evaluate");
  });

  test("returns the closed challenge status as one JSON document", async () => {
    const result = await runCli("--output", "json", "challenge");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    const document = JSON.parse(result.stdout);
    expect(document).toMatchObject({
      version: 1,
      ok: true,
      data: {
        title: "THE SHIPPING MACHINE",
        open: false,
        state: "closed",
      },
    });
    expect(document.data.workflow[0]).toMatchObject({
      step: 8,
      command: "chofex challenge ranking",
    });
    expect(document.data.workflow).toHaveLength(1);
    expect(document.data.story).toEqual([]);
    expect(document.data.rules).toEqual([]);
  });

  test("does not initialize files for a closed challenge", async () => {
    const directory = await mkdtemp(join(tmpdir(), "chofex-challenge-"));
    const solutionPath = join(directory, "shipping.js");

    try {
      const result = await runCliFrom(directory, "challenge", "init");

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("CHALLENGE_CLOSED");
      expect(result.stderr).toContain("está cerrado");
      expect(await Bun.file(solutionPath).exists()).toBe(false);

      const json = await runCliFrom(
        directory,
        "--output",
        "json",
        "challenge",
        "init",
      );
      expect(json.stderr).toBe("");
      expect(json.stdout.trim().split("\n")).toHaveLength(1);
      expect(JSON.parse(json.stdout)).toMatchObject({
        ok: false,
        error: { code: "CHALLENGE_CLOSED" },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("creates the Broken Agent starter repository without overwriting work", async () => {
    const directory = await mkdtemp(join(tmpdir(), "chofex-broken-agent-"));
    const challengeDirectory = join(directory, "broken-agent");
    const solutionPath = join(challengeDirectory, "scheduler.js");

    try {
      const created = await runCliFrom(
        directory,
        "challenge",
        "init",
        "--challenge",
        "broken-agent",
      );

      expect(created.exitCode).toBe(0);
      expect(created.stderr).toBe("");
      expect(created.stdout).toContain("Created broken-agent");
      expect(created.stdout).toContain("Everything passes");
      expect(await readFile(solutionPath, "utf8")).toContain(
        "function createScheduler",
      );
      expect(
        await readFile(join(challengeDirectory, "README.md"), "utf8"),
      ).toContain("Public contract");
      expect(
        await readFile(join(challengeDirectory, "scheduler.test.js"), "utf8"),
      ).toContain('test("executes a due job"');

      await writeFile(solutionPath, "// repaired by me\n", "utf8");
      const repeated = await runCliFrom(
        directory,
        "challenge",
        "init",
        "--challenge",
        "broken-agent",
      );

      expect(repeated.exitCode).toBe(0);
      expect(repeated.stdout).toContain("broken-agent already exists");
      expect(await readFile(solutionPath, "utf8")).toBe("// repaired by me\n");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("documents the workflow and every challenge subcommand", async () => {
    const challengeHelp = await runCli("challenge", "--help");

    expect(challengeHelp.exitCode).toBe(0);
    expect(challengeHelp.stdout).toContain("Start here");
    expect(challengeHelp.stdout).toContain("Chofex API base URL");
    expect(challengeHelp.stdout).toContain("chofex challenge query --distance");

    const expectedExamples = new Map([
      ["list", "chofex challenge list"],
      ["init", "chofex challenge init"],
      ["show", "chofex challenge show"],
      ["query", "chofex challenge query --input shipment.json"],
      ["notebook", "chofex challenge notebook --format csv"],
      ["test", "chofex challenge test --source ./shipping.js"],
      ["evaluate", "chofex challenge evaluate --source ./shipping.js"],
      ["ranking", "chofex challenge ranking"],
    ]);

    for (const [command, example] of expectedExamples) {
      const help = await runCli("challenge", command, "--help");
      expect(help.exitCode).toBe(0);
      expect(help.stdout).toContain("EXAMPLES");
      expect(help.stdout).toContain(example);
    }
  });

  test("lists challenges from the public catalog without authentication", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-challenges",
          data: {
            challenges: [
              {
                slug: "black-box",
                number: 1,
                code: "01",
                theme: "Black Box",
                title: "The Shipping Machine",
                summary: "Reverse engineer shipping prices.",
                coreSkill: "Reverse engineering",
                format: "accuracy",
                formatLabel: "Accuracy score",
                opensAt: "2026-09-18T05:00:00.000Z",
                queryLimit: 25,
                evaluationLimit: 3,
                playable: true,
                open: true,
                rankingPath: "/challenges/black-box",
              },
            ],
          },
        });
      },
    });

    try {
      const result = await runCli(
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--output",
        "json",
        "challenge",
        "list",
      );
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        data: { challenges: [{ slug: "black-box", playable: true }] },
      });
    } finally {
      server.stop(true);
    }
  });

  test("turns each oracle answer into the next experiment", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-query",
          data: {
            observation: {
              sequence: 1,
              input: {
                distanceKm: 100,
                weightKg: 100,
                hour: 18,
                fragile: true,
                express: false,
              },
              output: 314.5,
              createdAt: "2026-09-16T00:00:00.000Z",
            },
            queriesUsed: 1,
            queriesRemaining: 24,
            queriesLimit: 25,
          },
        });
      },
    });

    try {
      const result = await runCli(
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--token",
        "test-token",
        "challenge",
        "query",
        "--distance",
        "100",
        "--weight",
        "100",
        "--hour",
        "18",
        "--fragile",
        "true",
        "--express",
        "false",
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Observation #1 saved");
      expect(result.stdout).toContain("Change one variable at a time");
      expect(result.stdout).toContain("chofex challenge notebook");
    } finally {
      server.stop(true);
    }
  });

  test("reads a small notebook as evidence instead of an answer", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-notebook",
          data: {
            challenge: {
              slug: "black-box",
              number: 1,
              code: "01",
              theme: "Black Box",
              title: "The Shipping Machine",
              summary: "Reverse engineer shipping prices.",
              coreSkill: "Reverse engineering",
              format: "accuracy",
              formatLabel: "Accuracy score",
              opensAt: "2026-09-18T05:00:00.000Z",
              queryLimit: 25,
              evaluationLimit: 3,
              playable: true,
              open: true,
              rankingPath: "/challenges/black-box",
            },
            progress: {
              slug: "black-box",
              title: "The Shipping Machine",
              theme: "Black Box",
              status: "in_progress",
              open: true,
              playable: true,
              queriesUsed: 1,
              queriesLimit: 25,
              evaluationsUsed: 0,
              evaluationsLimit: 3,
            },
            observations: [
              {
                sequence: 1,
                input: {
                  distanceKm: 100,
                  weightKg: 100,
                  hour: 18,
                  fragile: true,
                  express: false,
                },
                output: 314.5,
                createdAt: "2026-09-16T00:00:00.000Z",
              },
            ],
            aiAllowed: true,
            localTestHint: "Use your notebook before evaluating.",
          },
        });
      },
    });

    try {
      const result = await runCli(
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--token",
        "test-token",
        "challenge",
        "notebook",
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("CASE FILE: 1 observation");
      expect(result.stdout).not.toContain("\t");
      expect(result.stdout).toContain("One answer is a clue, not a rule");
      expect(result.stdout).toContain("Next: run a controlled experiment");
      expect(result.stdout).toContain("chofex challenge init");

      const status = await runCli(
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--token",
        "test-token",
        "challenge",
        "show",
      );
      expect(status.exitCode).toBe(0);
      expect(status.stdout).toContain("CASE STATUS: INVESTIGATING");
      expect(status.stdout).toContain("Evidence       1 observation");
      expect(status.stdout).toContain("Queries        24 / 25 remaining");
      expect(status.stdout).toContain("YOUR NEXT MOVE");
    } finally {
      server.stop(true);
    }
  });

  test("explains what to do after local and official evaluations", async () => {
    const sourcePath = join(
      cliDirectory,
      `.shipping-${crypto.randomUUID()}.js`,
    );
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname;
        if (path.endsWith("/test")) {
          return Response.json({
            version: 1,
            ok: true,
            requestId: "request-test",
            data: {
              matchedObservations: 1,
              observationCount: 2,
              accuracy: 0.5,
              meanError: 10,
              mismatches: [{ sequence: 2, expected: 42, actual: 22 }],
            },
          });
        }
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-evaluate",
          data: {
            accuracy: 0.92,
            exactCount: 920,
            sampleSize: 1_000,
            meanError: 1.2,
            queriesUsed: 12,
            runtimeMs: 5,
            shareCode: "ABCD",
            rank: 3,
            competitorCount: 20,
            percentile: 15,
            evaluationsUsed: 1,
            evaluationsRemaining: 2,
            evaluationsLimit: 3,
            rankingPath: "/challenges/black-box",
            shareText: "92.00% replication",
          },
        });
      },
    });

    try {
      await writeFile(
        sourcePath,
        "function calculateShipping() { return 0; }\n",
        "utf8",
      );
      const commonArguments = [
        "--api-url",
        server.url.toString().replace(/\/$/, ""),
        "--token",
        "test-token",
        "challenge",
      ] as const;
      const local = await runCli(
        ...commonArguments,
        "test",
        "--source",
        sourcePath,
      );
      expect(local.exitCode).toBe(0);
      expect(local.stdout).toContain("NOTEBOOK VERDICT: KEEP WORKING");
      expect(local.stdout).toContain("Next: edit shipping.js");

      const official = await runCli(
        ...commonArguments,
        "evaluate",
        "--source",
        sourcePath,
      );
      expect(official.exitCode).toBe(0);
      expect(official.stdout).toContain("OFFICIAL VERDICT");
      expect(official.stdout).toContain("Next: inspect the leaderboard");
      expect(official.stdout).toContain("chofex challenge ranking");
    } finally {
      server.stop(true);
      await unlink(sourcePath).catch(() => undefined);
    }
  });

  test("advertises local input validation", async () => {
    const help = await runCli("--help");

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("validate");
    expect(help.stdout).toContain("Validate input without submitting it");
  });

  test("advertises the participant badge command", async () => {
    const help = await runCli("--help");

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("badge");
    expect(help.stdout).toContain("Show your generated participant badge");
  });

  test("prints every accepted application input field", async () => {
    const result = await runCli("schema");

    expect(result.exitCode).toBe(0);
    const template = JSON.parse(result.stdout);
    expect(Object.keys(template).sort()).toEqual(
      [...applicationInputFieldNames].sort(),
    );
    expect(template).toHaveProperty("githubUrl");
    expect(template).toHaveProperty("linkedInUrl");
    expect(template).toHaveProperty("fullName");
    expect(template).toHaveProperty("role");
    expect(template).toHaveProperty("phone");
    expect(template).toHaveProperty("bio");
    expect(template).toHaveProperty("portfolioUrl");
    expect(template).toHaveProperty("shippedProject");
    expect(template).toHaveProperty("codeOfConductAccepted");
    expect(template).not.toHaveProperty("email");
    expect(template).not.toHaveProperty("countryCode");
    expect(template).not.toHaveProperty("participationMode");
  });

  test("prints every accepted attendance input field", async () => {
    const result = await runCli("schema", "--stage", "acceptance");

    expect(result.exitCode).toBe(0);
    const template = JSON.parse(result.stdout);
    expect(Object.keys(template).sort()).toEqual(
      [...acceptedDetailsInputFieldNames].sort(),
    );
  });

  test("validates an application without contacting the API", async () => {
    const inputPath = `${cliDirectory}.valid-application-${crypto.randomUUID()}.json`;

    try {
      await Bun.write(
        inputPath,
        JSON.stringify({
          fullName: "Anthony Cueva",
          role: "Builder",
          codeOfConductAccepted: true,
        }),
      );
      const result = await runCli(
        "--output",
        "json",
        "validate",
        "--stage",
        "application",
        "--input",
        inputPath,
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        version: 1,
        ok: true,
        data: {
          valid: true,
          stage: "application",
        },
      });
    } finally {
      await unlink(inputPath).catch(() => undefined);
    }
  });

  test("validates attendance details without echoing private input", async () => {
    const inputPath = `${cliDirectory}.valid-attendance-${crypto.randomUUID()}.json`;
    const nationalIdNumber = "private-passport-number";

    try {
      await Bun.write(
        inputPath,
        JSON.stringify({
          fullName: "Ada Lovelace",
          phone: "+51 999 999 999",
          dateOfBirth: "1990-01-01",
          nationalIdNumber,
          shirtSize: "m",
          emergencyContactName: "Grace Hopper",
          emergencyContactPhone: "+1 555 0100",
          pictureSource: "clerk",
        }),
      );
      const result = await runCli(
        "--output",
        "json",
        "validate",
        "--stage",
        "acceptance",
        "--input",
        inputPath,
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        data: {
          valid: true,
          stage: "acceptance",
        },
      });
      expect(result.stdout).not.toContain(nationalIdNumber);
    } finally {
      await unlink(inputPath).catch(() => undefined);
    }
  });

  test("returns accepted field names for invalid input", async () => {
    const inputPath = `${cliDirectory}.invalid-application-${crypto.randomUUID()}.json`;

    try {
      await Bun.write(
        inputPath,
        JSON.stringify({
          fullName: "Anthony Cueva",
          role: "Builder",
          github: "https://github.com/cuevaio",
          codeOfConductAccepted: true,
        }),
      );
      const result = await runCli(
        "--output",
        "json",
        "validate",
        "--stage",
        "application",
        "--input",
        inputPath,
      );

      expect(result.exitCode).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          details: {
            acceptedFields: expect.arrayContaining([
              "fullName",
              "role",
              "bio",
              "portfolioUrl",
              "shippedProject",
              "githubUrl",
              "linkedInUrl",
            ]),
          },
        },
      });
    } finally {
      await unlink(inputPath).catch(() => undefined);
    }
  });

  test("submits a normalized on-site application without identity fields", async () => {
    let submittedBody: unknown;
    let submittedMethod: string | undefined;
    let submittedPath: string | undefined;
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        if (request.method === "GET") {
          return Response.json(
            {
              version: 1,
              ok: false,
              requestId: "request-no-registration",
              error: {
                code: "REGISTRATION_NOT_FOUND",
                message: "Registration not found",
                retryable: false,
              },
            },
            { status: 404 },
          );
        }
        submittedMethod = request.method;
        submittedPath = new URL(request.url).pathname;
        submittedBody = await request.json();
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-registration",
          data: {
            registration: {
              id: "registration-123",
              status: "submitted",
              firstName: "Anthony",
              lastName: "Cueva",
              email: "hi@cueva.io",
              role: "Builder",
              participationMode: "in_person",
              githubUrl: "https://github.com/cuevaio",
              nationalIdProvided: false,
              mediaConsent: false,
              codeOfConductAccepted: true,
              privacyPolicyAccepted: true,
              createdAt: "2026-09-09T00:00:00.000Z",
              updatedAt: "2026-09-09T00:00:00.000Z",
              challenges: [],
            },
            requirements: {
              stage: "review",
              canSubmitNewApplication: false,
              canSubmitAcceptedDetails: false,
              canSaveDraft: false,
              canSubmitApplication: false,
              parts: [],
              missing: [],
            },
          },
        });
      },
    });
    const inputPath = `${cliDirectory}.application-${crypto.randomUUID()}.json`;

    try {
      await Bun.write(
        inputPath,
        JSON.stringify({
          fullName: " Anthony Cueva ",
          role: "Builder",
          phone: "+51 999 999 999",
          bio: "I build developer tools.",
          portfolioUrl: "cueva.io",
          shippedProject: "A collaborative coding environment.",
          githubUrl: "github.com/cuevaio",
          codeOfConductAccepted: true,
        }),
      );
      const apiUrl = server.url.toString().replace(/\/$/, "");
      const result = await runCli(
        "--api-url",
        apiUrl,
        "--token",
        "oauth-token",
        "--output",
        "json",
        "register",
        "--input",
        inputPath,
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        data: { registration: { status: "submitted" } },
      });
      expect(submittedMethod).toBe("POST");
      expect(submittedPath).toBe("/api/v1/registrations");
      expect(submittedBody).toEqual({
        fullName: "Anthony Cueva",
        role: "Builder",
        phone: "+51 999 999 999",
        bio: "I build developer tools.",
        portfolioUrl: "https://cueva.io",
        shippedProject: "A collaborative coding environment.",
        githubUrl: "https://github.com/cuevaio",
        codeOfConductAccepted: true,
      });
      expect(submittedBody).not.toHaveProperty("email");
      expect(submittedBody).not.toHaveProperty("countryCode");
      expect(submittedBody).not.toHaveProperty("participationMode");
      expect(submittedBody).not.toHaveProperty("firstName");
      expect(submittedBody).not.toHaveProperty("lastName");
    } finally {
      server.stop(true);
      await unlink(inputPath).catch(() => undefined);
    }
  });

  for (const scenario of [
    {
      name: "an application awaits approval",
      status: "submitted",
      requirements: {
        stage: "review",
        canSubmitNewApplication: false,
        canSubmitAcceptedDetails: false,
        canSaveDraft: false,
        canSubmitApplication: false,
        parts: [],
        missing: [],
      },
      expectedMessage: "Already registered. Wait for approval.",
    },
    {
      name: "an application is accepted",
      status: "accepted",
      requirements: {
        stage: "accepted",
        canSubmitNewApplication: false,
        canSubmitAcceptedDetails: true,
        canSaveDraft: false,
        canSubmitApplication: false,
        parts: [],
        missing: [{ field: "phone", reason: "Required after acceptance" }],
      },
      expectedMessage:
        "Already accepted. Run `chofex confirm` to complete your registration.",
    },
    {
      name: "an accepted registration is complete",
      status: "accepted",
      requirements: {
        stage: "complete",
        canSubmitNewApplication: false,
        canSubmitAcceptedDetails: true,
        canSaveDraft: false,
        canSubmitApplication: false,
        parts: [],
        missing: [],
      },
      expectedMessage: "Already accepted. Your registration is complete.",
    },
  ] as const) {
    test(`stops before collecting input when ${scenario.name}`, async () => {
      let postRequested = false;
      const server = Bun.serve({
        port: 0,
        fetch(request) {
          if (request.method === "POST") postRequested = true;
          return Response.json({
            version: 1,
            ok: true,
            requestId: "request-existing-registration",
            data: {
              registration: {
                id: "registration-123",
                status: scenario.status,
                firstName: "Anthony",
                lastName: "Cueva",
                email: "hi@cueva.io",
                role: "Builder",
                participationMode: "in_person",
                nationalIdProvided: false,
                mediaConsent: false,
                codeOfConductAccepted: true,
                privacyPolicyAccepted: true,
                submittedAt: "2026-09-09T00:00:00.000Z",
                createdAt: "2026-09-09T00:00:00.000Z",
                updatedAt: "2026-09-09T00:00:00.000Z",
                challenges: [],
              },
              requirements: scenario.requirements,
            },
          });
        },
      });

      try {
        const apiUrl = server.url.toString().replace(/\/$/, "");
        const result = await runCli(
          "--api-url",
          apiUrl,
          "--token",
          "oauth-token",
          "register",
          "--input",
          "does-not-exist.json",
        );

        expect(result.exitCode).toBe(2);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain(scenario.expectedMessage);
        expect(postRequested).toBe(false);
      } finally {
        server.stop(true);
      }
    });
  }

  test("renders verified authentication in human and JSON modes", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (
          new URL(request.url).pathname !== "/api/v1/me" ||
          request.method !== "GET" ||
          request.headers.get("authorization") !== "Bearer oauth-token"
        ) {
          return new Response(null, { status: 404 });
        }
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-whoami",
          data: {
            authenticated: true,
            userId: "user_123",
            email: "ada@example.com",
            tokenType: "oauth_token",
          },
        });
      },
    });

    try {
      const apiUrl = server.url.toString().replace(/\/$/, "");
      const human = await runCli(
        "--api-url",
        apiUrl,
        "--token",
        "oauth-token",
        "whoami",
      );
      const json = await runCli(
        "--api-url",
        apiUrl,
        "--token",
        "oauth-token",
        "--output",
        "json",
        "whoami",
      );

      expect(human.exitCode).toBe(0);
      expect(human.stdout.trim()).toBe(
        "Authenticated as ada@example.com (user_123, oauth_token).",
      );
      expect(json.exitCode).toBe(0);
      expect(JSON.parse(json.stdout)).toMatchObject({
        ok: true,
        data: {
          authenticated: true,
          userId: "user_123",
          email: "ada@example.com",
          tokenType: "oauth_token",
        },
      });
    } finally {
      server.stop(true);
    }
  });

  test("prints structured API validation details in human mode", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return Response.json(
          {
            version: 1,
            ok: false,
            requestId: "request-validation",
            error: {
              code: "VALIDATION_ERROR",
              message: "Input validation failed",
              retryable: false,
              details: {
                issues: [{ field: "teamName", reason: "Required" }],
              },
            },
          },
          { status: 422 },
        );
      },
    });

    try {
      const apiUrl = server.url.toString().replace(/\/$/, "");
      const result = await runCli(
        "--api-url",
        apiUrl,
        "--token",
        "oauth-token",
        "status",
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("teamName: Required");
      expect(result.stderr).toContain("Request ID: request-validation");
    } finally {
      server.stop(true);
    }
  });

  for (const command of ["status", "requirements"] as const) {
    test(`${command} invites a participant without an application to register`, async () => {
      const server = Bun.serve({
        port: 0,
        fetch() {
          return Response.json(
            {
              version: 1,
              ok: false,
              requestId: "request-no-registration",
              error: {
                code: "REGISTRATION_NOT_FOUND",
                message: "Registration not found",
                retryable: false,
              },
            },
            { status: 404 },
          );
        },
      });

      try {
        const apiUrl = server.url.toString().replace(/\/$/, "");
        const result = await runCli(
          "--api-url",
          apiUrl,
          "--token",
          "oauth-token",
          command,
        );

        expect(result.exitCode).toBe(4);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("No registration found.");
        expect(result.stderr).toContain("Next command: chofex register");
        expect(result.stderr).toContain("Request ID: request-no-registration");
      } finally {
        server.stop(true);
      }
    });
  }

  test("requires a computer path when an accepted participant chooses upload", async () => {
    const inputPath = `${cliDirectory}.attendance-${crypto.randomUUID()}.json`;
    let attendanceSubmitted = false;
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === "/api/v1/me") {
          return Response.json({
            version: 1,
            ok: true,
            requestId: "request-me",
            data: {
              authenticated: true,
              userId: "user-123",
              email: "ada@example.com",
              tokenType: "oauth_token",
            },
          });
        }
        if (request.method === "PUT") attendanceSubmitted = true;
        return Response.json({
          version: 1,
          ok: true,
          requestId: "request-registration",
          data: {
            registration: {
              id: "application-123",
              status: "accepted",
              firstName: "Ada",
              lastName: "Lovelace",
              email: "ada@example.com",
              participationMode: "in_person",
              nationalIdProvided: false,
              mediaConsent: false,
              codeOfConductAccepted: true,
              privacyPolicyAccepted: true,
              submittedAt: "2026-09-09T00:00:00.000Z",
              createdAt: "2026-09-09T00:00:00.000Z",
              updatedAt: "2026-09-09T00:00:00.000Z",
              challenges: [],
            },
            requirements: {
              stage: "accepted",
              canSubmitNewApplication: false,
              canSubmitAcceptedDetails: true,
              canSaveDraft: false,
              canSubmitApplication: false,
              parts: [],
              missing: [],
            },
          },
        });
      },
    });

    try {
      await Bun.write(
        inputPath,
        JSON.stringify({
          fullName: "Ada Lovelace",
          phone: "+51 999 999 999",
          dateOfBirth: "1990-01-01",
          nationalIdNumber: "private-passport-number",
          shirtSize: "m",
          emergencyContactName: "Grace Hopper",
          emergencyContactPhone: "+1 555 0100",
          pictureSource: "upload",
        }),
      );
      const result = await runCli(
        "--api-url",
        server.url.toString(),
        "--token",
        "oauth-token",
        "confirm",
        "--input",
        inputPath,
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Use --picture <path>");
      expect(attendanceSubmitted).toBe(false);
    } finally {
      server.stop(true);
      await unlink(inputPath).catch(() => undefined);
    }
  });
});
