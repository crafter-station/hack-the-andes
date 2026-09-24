import {
  challengeBySlug,
  isChallengeClosedAt,
  isChallengeOpenAt,
} from "@chofex/challenges-contract";
import { Console, Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import {
  evaluateChallenge,
  getChallengeAttempt,
  getChallengeRanking,
  listChallenges,
  queryChallenge,
  testChallenge,
} from "./api-client.js";
import {
  defaultChallengeSlug,
  javascriptSourceFromPath,
  shipmentInput,
} from "./challenge-input.js";
import {
  challengeEvaluateText,
  challengeListText,
  challengeParticipationNotice,
  challengeQueryText,
  challengeRankingText,
  challengeShowText,
  challengeTestText,
  notebookCsvText,
  notebookTableText,
} from "./challenge-output.js";
import {
  type ChallengeScaffoldResult,
  createChallengeScaffold,
} from "./challenge-scaffold.js";
import { root } from "./cli-root.js";
import { cliError } from "./errors.js";
import { execute, printJson } from "./output.js";

const challengeQuickstart = {
  title: "THE SHIPPING MACHINE",
  story: [
    "A delivery company is about to retire the service that prices every shipment.",
    "There is no documentation and no source code—only five controls and the price the machine returns.",
  ],
  mission:
    "Learn the hidden pricing rules, then replace the machine with your own calculateShipping(input) function.",
  rules: [
    "You have 25 oracle queries to gather evidence.",
    "You have 3 official evaluations against hidden shipments.",
    "Local notebook tests are free. Accuracy wins, then exact matches, then fewer oracle queries.",
    "AI tools are welcome, but the hidden rules are personalized to you.",
  ],
  workflow: [
    {
      step: 1,
      action: "Sign in",
      command: "chofex login",
      note: "Opens Clerk authentication in your browser.",
    },
    {
      step: 2,
      action: "Prepare your field kit",
      command: "chofex challenge init",
      note: "Creates a documented shipping.js starter without overwriting existing work.",
    },
    {
      step: 3,
      action: "Check your budget",
      command: "chofex challenge show",
      note: "Shows remaining oracle queries and official evaluations.",
    },
    {
      step: 4,
      action: "Probe the Black Box",
      command:
        "chofex challenge query --distance 10 --weight 3 --hour 14 --fragile false --express false",
      note: "A successful query reveals one shipping price and consumes one query.",
    },
    {
      step: 5,
      action: "Study your observations",
      command: "chofex challenge notebook",
      note: "Compare inputs and outputs to infer the pricing rules.",
    },
    {
      step: 6,
      action: "Edit and test your replacement",
      command: "chofex challenge test --source ./shipping.js",
      note: "Checks your solution against your notebook without consuming an official evaluation.",
    },
    {
      step: 7,
      action: "Submit to the hidden test set",
      command: "chofex challenge evaluate --source ./shipping.js",
      note: "Official evaluations are limited. Use test as often as needed, then evaluate when your solution is ready.",
    },
    {
      step: 8,
      action: "Check the leaderboard",
      command: "chofex challenge ranking",
      note: "Shows the public ranking without consuming budget.",
    },
  ],
  helpCommand: "chofex challenge query --help",
} as const;

const launchNoticeFor = (slug: string): string | undefined => {
  const challenge = challengeBySlug(slug);
  if (!challenge) return undefined;
  return challengeParticipationNotice(
    challenge.theme,
    challenge.opensAt,
    challenge.closesAt,
  );
};

type ChallengeParticipationState = "scheduled" | "open" | "closed";

const participationStateFor = (slug: string): ChallengeParticipationState => {
  const challenge = challengeBySlug(slug);
  if (!challenge) return "scheduled";
  const now = new Date();
  if (isChallengeClosedAt(challenge, now)) return "closed";
  if (isChallengeOpenAt(challenge, now)) return "open";
  return "scheduled";
};

const challengeQuickstartText = (
  participationState: ChallengeParticipationState,
  launchNotice?: string,
): string => {
  const lines: Array<string> = [challengeQuickstart.title];
  if (launchNotice) lines.push("", "LAUNCH NOTICE", launchNotice);
  if (participationState === "closed") {
    lines.push("", "RANKING FINAL", "  chofex challenge ranking");
    return lines.join("\n");
  }
  if (participationState === "scheduled") {
    lines.push("", "PRÓXIMAMENTE", "  chofex challenge list");
    return lines.join("\n");
  }
  lines.push(
    "",
    ...challengeQuickstart.story,
    "",
    "YOUR MISSION",
    challengeQuickstart.mission,
    "",
    "RULES OF THE GAME",
    ...challengeQuickstart.rules.map((rule) => `• ${rule}`),
    "",
    "FIELD GUIDE",
    "",
  );
  for (const item of challengeQuickstart.workflow) {
    lines.push(`${item.step}. ${item.action}`);
    lines.push(`   ${item.command}`);
    lines.push(`   ${item.note}`, "");
  }
  lines.push(`More detail: ${challengeQuickstart.helpCommand}`);
  return lines.join("\n");
};

const optionalString = (name: string, description: string) =>
  Flag.string(name).pipe(Flag.optional, Flag.withDescription(description));

const challengeFlag = Flag.string("challenge").pipe(
  Flag.withDefault(defaultChallengeSlug),
  Flag.withDescription("Challenge slug (default: black-box)"),
);

const sourceFlag = optionalString(
  "source",
  "JavaScript file defining function calculateShipping(input)",
);

const inputFlag = optionalString("input", "JSON file, or - for stdin");

const formatFlag = Flag.choice("format", ["table", "json", "csv"]).pipe(
  Flag.withDefault("table"),
  Flag.withDescription("Notebook format"),
);

const numberFromOption = (value: Option.Option<string>): number | undefined => {
  if (Option.isNone(value)) return undefined;
  return Number(value.value);
};

const booleanFromOption = (
  value: Option.Option<string>,
): boolean | undefined => {
  if (Option.isNone(value)) return undefined;
  if (value.value === "true") return true;
  if (value.value === "false") return false;
};

const challengeInitText = (result: ChallengeScaffoldResult): string => {
  if (result.status === "exists") {
    return [
      `${result.path} already exists. Left it unchanged.`,
      "",
      "Next: keep investigating, then test your current solution",
      "  chofex challenge query",
      `  chofex challenge test --source ./${result.path}`,
    ].join("\n");
  }
  return [
    `Created ${result.path}`,
    "A documented baseline is ready for the rules you discover.",
    "",
    "Next: probe the machine",
    "  chofex challenge query",
    "",
    `Then edit ${result.path} and test it safely:`,
    `  chofex challenge test --source ./${result.path}`,
  ].join("\n");
};

const listCommand = Command.make(
  "list",
  {},
  Effect.fn("challengeListCommand")(function* () {
    const options = yield* root;
    yield* execute(
      options.output,
      listChallenges({ apiUrl: options.apiUrl }),
      challengeListText,
    );
  }),
).pipe(
  Command.withDescription(
    "Discover available challenges, opening dates, and scoring formats. No login required.",
  ),
  Command.withExamples([
    {
      command: "chofex challenge list",
      description: "See which challenge is currently playable",
    },
  ]),
);

const initCommand = Command.make(
  "init",
  {},
  Effect.fn("challengeInitCommand")(function* () {
    const options = yield* root;
    const participationState = participationStateFor(defaultChallengeSlug);
    if (participationState !== "open") {
      const message =
        launchNoticeFor(defaultChallengeSlug) ??
        "El challenge todavía no está disponible.";
      let code = "CHALLENGE_NOT_OPEN";
      if (participationState === "closed") code = "CHALLENGE_CLOSED";
      yield* execute(
        options.output,
        Effect.fail(cliError(code, message)),
        challengeInitText,
      );
      return;
    }
    const operation = createChallengeScaffold().pipe(
      Effect.map((data) => ({
        version: 1 as const,
        ok: true as const,
        requestId: crypto.randomUUID(),
        data,
      })),
    );
    yield* execute(options.output, operation, challengeInitText);
  }),
).pipe(
  Command.withDescription(
    "Create a documented shipping.js starter in the current directory. Existing files are never overwritten.",
  ),
  Command.withExamples([
    {
      command: "chofex challenge init",
      description: "Prepare a safe JavaScript solution file",
    },
  ]),
);

const showCommand = Command.make(
  "show",
  { challenge: challengeFlag },
  Effect.fn("challengeShowCommand")(function* ({ challenge }) {
    const options = yield* root;
    const token = Option.getOrUndefined(options.token);
    yield* execute(
      options.output,
      getChallengeAttempt({ apiUrl: options.apiUrl, token }, challenge),
      challengeShowText,
    );
  }),
).pipe(
  Command.withDescription(
    "Check your Black Box query budget, evaluation budget, score, and saved observations. Requires sign-in.",
  ),
  Command.withExamples([
    {
      command: "chofex challenge show",
      description: "Check your progress before spending limited attempts",
    },
  ]),
);

const queryCommand = Command.make(
  "query",
  {
    challenge: challengeFlag,
    input: inputFlag,
    distance: optionalString("distance", "Shipment distance in whole km"),
    weight: optionalString("weight", "Shipment weight in whole kg"),
    hour: optionalString("hour", "Hour of day, 0-23"),
    fragile: Flag.choice("fragile", ["true", "false"]).pipe(
      Flag.optional,
      Flag.withDescription("Fragile surcharge flag"),
    ),
    express: Flag.choice("express", ["true", "false"]).pipe(
      Flag.optional,
      Flag.withDescription("Express surcharge flag"),
    ),
  },
  Effect.fn("challengeQueryCommand")(function* ({
    challenge,
    input,
    distance,
    weight,
    hour,
    fragile,
    express,
  }) {
    const options = yield* root;
    const token = Option.getOrUndefined(options.token);
    const operation = Effect.gen(function* () {
      const shipment = yield* shipmentInput(Option.getOrUndefined(input), {
        distanceKm: numberFromOption(distance),
        weightKg: numberFromOption(weight),
        hour: numberFromOption(hour),
        fragile: booleanFromOption(fragile),
        express: booleanFromOption(express),
      });
      return yield* queryChallenge(
        { apiUrl: options.apiUrl, token },
        challenge,
        shipment,
      );
    });
    yield* execute(options.output, operation, challengeQueryText);
  }),
).pipe(
  Command.withDescription(
    "Send one shipment to the undocumented oracle. A successful query consumes one limited request. Requires sign-in.",
  ),
  Command.withExamples([
    {
      command:
        "chofex challenge query --distance 10 --weight 3 --hour 14 --fragile false --express false",
      description: "Spend one oracle query",
    },
    {
      command: "chofex challenge query --input shipment.json",
      description: "Read the shipment fields from a JSON file",
    },
  ]),
);

const notebookCommand = Command.make(
  "notebook",
  { challenge: challengeFlag, format: formatFlag },
  Effect.fn("challengeNotebookCommand")(function* ({ challenge, format }) {
    const options = yield* root;
    const token = Option.getOrUndefined(options.token);
    const operation = getChallengeAttempt(
      { apiUrl: options.apiUrl, token },
      challenge,
    );
    yield* execute(options.output, operation, (attempt) => {
      if (format === "csv") return notebookCsvText(attempt.observations);
      if (format === "json") {
        return JSON.stringify(attempt.observations, null, 2);
      }
      return notebookTableText(
        attempt.observations,
        Boolean(attempt.challenge.closed),
      );
    });
  }),
).pipe(
  Command.withDescription(
    "Review every input and price you observed. Export table, JSON, or CSV for analysis. Requires sign-in.",
  ),
  Command.withExamples([
    {
      command: "chofex challenge notebook",
      description: "Read observations in a terminal table",
    },
    {
      command: "chofex challenge notebook --format csv > observations.csv",
      description: "Save observations for a spreadsheet",
    },
  ]),
);

const testCommand = Command.make(
  "test",
  { challenge: challengeFlag, source: sourceFlag },
  Effect.fn("challengeTestCommand")(function* ({ challenge, source }) {
    const options = yield* root;
    const token = Option.getOrUndefined(options.token);
    const operation = Effect.gen(function* () {
      const solution = yield* javascriptSourceFromPath(
        Option.getOrUndefined(source),
      );
      return yield* testChallenge(
        { apiUrl: options.apiUrl, token },
        challenge,
        solution,
      );
    });
    yield* execute(options.output, operation, challengeTestText);
  }),
).pipe(
  Command.withDescription(
    "Check calculateShipping against your saved observations. Safe to repeat; official evaluations are not consumed. Requires sign-in.",
  ),
  Command.withExamples([
    {
      command: "chofex challenge test --source ./shipping.js",
      description: "Test a JavaScript replacement against your notebook",
    },
  ]),
);

const evaluateCommand = Command.make(
  "evaluate",
  { challenge: challengeFlag, source: sourceFlag },
  Effect.fn("challengeEvaluateCommand")(function* ({ challenge, source }) {
    const options = yield* root;
    const token = Option.getOrUndefined(options.token);
    const operation = Effect.gen(function* () {
      const solution = yield* javascriptSourceFromPath(
        Option.getOrUndefined(source),
      );
      return yield* evaluateChallenge(
        { apiUrl: options.apiUrl, token },
        challenge,
        solution,
      );
    });
    yield* execute(options.output, operation, challengeEvaluateText);
  }),
).pipe(
  Command.withDescription(
    "Score calculateShipping on hidden cases. This consumes one limited official evaluation. Requires sign-in.",
  ),
  Command.withExamples([
    {
      command: "chofex challenge evaluate --source ./shipping.js",
      description: "Spend one official evaluation when your solution is ready",
    },
  ]),
);

const rankingCommand = Command.make(
  "ranking",
  { challenge: challengeFlag },
  Effect.fn("challengeRankingCommand")(function* ({ challenge }) {
    const options = yield* root;
    yield* execute(
      options.output,
      getChallengeRanking({ apiUrl: options.apiUrl }, challenge),
      challengeRankingText,
    );
  }),
).pipe(
  Command.withDescription(
    "View the public leaderboard. No login required and no challenge budget consumed.",
  ),
  Command.withExamples([
    {
      command: "chofex challenge ranking",
      description: "Compare official hidden-set scores",
    },
  ]),
);

export const challengeCommand = Command.make(
  "challenge",
  {},
  Effect.fn("challengeQuickstartCommand")(function* () {
    const options = yield* root;
    const participationState = participationStateFor(defaultChallengeSlug);
    const participationOpen = participationState === "open";
    const launchNotice = launchNoticeFor(defaultChallengeSlug);
    if (options.output === "json") {
      let workflow: ReadonlyArray<
        (typeof challengeQuickstart.workflow)[number]
      > = challengeQuickstart.workflow;
      let helpCommand: string = challengeQuickstart.helpCommand;
      let story: ReadonlyArray<string> = challengeQuickstart.story;
      let mission: string = challengeQuickstart.mission;
      let rules: ReadonlyArray<string> = challengeQuickstart.rules;
      if (participationState === "closed") {
        const rankingStep = challengeQuickstart.workflow.at(-1);
        workflow = rankingStep ? [rankingStep] : [];
        helpCommand = "chofex challenge ranking --help";
        story = [];
        mission = "El Challenge 1 terminó. El ranking final sigue disponible.";
        rules = [];
      } else if (participationState === "scheduled") {
        workflow = [];
        helpCommand = "chofex challenge list --help";
        story = [];
        mission = "El challenge todavía no está disponible.";
        rules = [];
      }
      const data: {
        readonly title: string;
        readonly story: typeof story;
        readonly mission: string;
        readonly rules: typeof rules;
        readonly workflow: typeof workflow;
        readonly helpCommand: string;
        readonly open: boolean;
        readonly state: ChallengeParticipationState;
        notice?: string;
      } = {
        ...challengeQuickstart,
        story,
        mission,
        rules,
        workflow,
        helpCommand,
        open: participationOpen,
        state: participationState,
      };
      if (launchNotice) data.notice = launchNotice;
      yield* printJson({
        version: 1,
        ok: true,
        requestId: crypto.randomUUID(),
        data,
      });
      return;
    }
    yield* Console.log(
      challengeQuickstartText(participationState, launchNotice),
    );
  }),
).pipe(
  Command.withDescription(
    "Play mini technical challenges. Start here: learn the Black Box workflow from first query to leaderboard. Run without a subcommand for the guided quickstart.",
  ),
  Command.withExamples([
    {
      command: "chofex challenge",
      description: "Open the guided Black Box quickstart",
    },
    {
      command:
        "chofex challenge query --distance 10 --weight 3 --hour 14 --fragile false --express false",
      description: "Make your first oracle query",
    },
    {
      command: "chofex challenge query --help",
      description: "See flags and examples for the query step",
    },
  ]),
  Command.withSubcommands([
    listCommand,
    initCommand,
    showCommand,
    queryCommand,
    notebookCommand,
    testCommand,
    evaluateCommand,
    rankingCommand,
  ]),
);
