import type {
  ChallengeAttemptView,
  ChallengeCatalogResponse,
  ChallengeEvaluationResult,
  ChallengeLocalTestResult,
  ChallengeObservation,
  ChallengeQueryResult,
  ChallengeRanking,
} from "@chofex/challenges-contract";
import {
  challengeOpeningNotice,
  formatChallengeOpeningInPeru,
  isChallengeRankingVisibleAt,
} from "@chofex/challenges-contract";
import type { RegistrationResult } from "@chofex/registration-contract";

import { eventName } from "./brand.js";

export const remainingBar = (used: number, limit: number): string => {
  if (limit <= 0) return "";
  const width = 20;
  const remaining = Math.max(0, limit - used);
  const filled = Math.round((remaining / limit) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
};

const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;

export const challengeLaunchNotice = (
  title: string,
  opensAt: string,
  now: Date = new Date(),
): string | undefined => {
  if (now.getTime() >= Date.parse(opensAt)) return undefined;
  return challengeOpeningNotice(title, opensAt);
};

export const challengeParticipationNotice = (
  title: string,
  opensAt: string,
  closesAt: string | undefined,
  now: Date = new Date(),
): string | undefined => {
  if (closesAt && now.getTime() >= Date.parse(closesAt)) {
    return `${title} está cerrado. Las consultas, pruebas locales y evaluaciones oficiales están deshabilitadas.`;
  }
  return challengeLaunchNotice(title, opensAt, now);
};

export const challengeListText = (
  catalog: ChallengeCatalogResponse,
): string => {
  const lines = [`${eventName} challenges`, ""];
  for (const challenge of catalog.challenges) {
    let state = `abre ${formatChallengeOpeningInPeru(challenge.opensAt)}`;
    if (challenge.closed) {
      state = "cerrado";
    } else if (challenge.open && challenge.playable) {
      state = "abierto";
    } else if (!challenge.playable) {
      state = "próximamente";
    }
    const playable = challenge.playable ? "" : " (próximamente)";
    lines.push(
      `${challenge.code}  ${challenge.theme} — ${challenge.title}${playable}`,
    );
    lines.push(
      `    ${challenge.coreSkill} · ${challenge.formatLabel} · ${state}`,
    );
    lines.push(`    Ranking: ${challenge.rankingPath}`);
    lines.push("");
  }
  const hasOpenChallenge = catalog.challenges.some(
    (challenge) => challenge.open && challenge.playable,
  );
  if (hasOpenChallenge) {
    lines.push("Empieza el challenge abierto: chofex challenge");
  } else {
    lines.push(
      "No hay un challenge abierto. Los rankings finales siguen visibles.",
    );
  }
  return lines.join("\n");
};

export const challengeShowText = (attempt: ChallengeAttemptView): string => {
  const { challenge, progress } = attempt;
  const queriesRemaining = progress.queriesLimit - progress.queriesUsed;
  const evaluationsRemaining =
    progress.evaluationsLimit - progress.evaluationsUsed;
  let evidence = `${attempt.observations.length} observations`;
  if (attempt.observations.length === 1) evidence = "1 observation";
  let caseStatus = "AWAITING FIRST CLUE";
  if (attempt.observations.length > 0) caseStatus = "INVESTIGATING";
  if (attempt.latestEvaluation !== undefined) caseStatus = "EVALUATED";
  if (challenge.closed) caseStatus = "CERRADO";
  const lines = [
    `${challenge.title.toUpperCase()} — CASE #${challenge.code}`,
    challenge.summary,
    "",
    `CASE STATUS: ${caseStatus}`,
    "",
    "Your job is to replace the machine, not merely guess its next answer.",
    "The rules are unique to you. AI tools are allowed.",
    "",
    "FIELD NOTES",
    `Evidence       ${evidence}`,
    `Queries        ${queriesRemaining} / ${progress.queriesLimit} remaining`,
    `Evaluations    ${evaluationsRemaining} / ${progress.evaluationsLimit} remaining`,
  ];
  if (progress.bestAccuracy !== undefined) {
    lines.push("", `Best accuracy  ${percent(progress.bestAccuracy)}`);
    if (progress.rank !== undefined)
      lines.push(`Rank           #${progress.rank}`);
    if (progress.shareCode) lines.push(`Share code     #${progress.shareCode}`);
  }
  if (challenge.closed) {
    lines.push(
      "",
      "SIGUIENTE PASO",
      "Revisa tu historial y el ranking final.",
      "  chofex challenge notebook",
      "  chofex challenge ranking",
    );
    return lines.join("\n");
  }
  lines.push("", "YOUR NEXT MOVE");
  if (attempt.observations.length === 0) {
    lines.push(
      "Ask the machine to price one ordinary shipment.",
      "  chofex challenge query",
    );
  } else if (attempt.latestEvaluation === undefined) {
    lines.push(
      "Run controlled experiments, study the notebook, then test your model.",
      "  chofex challenge query",
      "  chofex challenge notebook",
      "  chofex challenge init",
      "  chofex challenge test --source ./shipping.js",
    );
  } else {
    lines.push(
      "Inspect your rank, then use remaining attempts only after improving your model.",
      "  chofex challenge ranking",
      "  chofex challenge test --source ./shipping.js",
    );
  }
  return lines.join("\n");
};

export const challengeQueryText = (result: ChallengeQueryResult): string => {
  const remaining = remainingBar(result.queriesUsed, result.queriesLimit);
  const lines = [
    `Observation #${result.observation.sequence} saved`,
    `Machine output  ${JSON.stringify(result.observation.output)}`,
    "",
    `Query budget  ${result.queriesRemaining} / ${result.queriesLimit} remaining`,
    remaining,
    "",
  ];
  if (result.queriesRemaining > 0) {
    lines.push(
      "Next experiment",
      "Change one variable at a time. Keep the others fixed so the output difference means something.",
      "  chofex challenge query",
      "",
    );
  } else {
    lines.push(
      "The oracle is now silent. Your notebook contains all the evidence you will get.",
      "",
    );
  }
  lines.push(
    "Review your evidence",
    "  chofex challenge notebook",
    "  chofex challenge notebook --format csv > observations.csv",
  );
  return lines.join("\n");
};

const shipmentCells = (
  observation: ChallengeObservation,
): {
  distance: string;
  weight: string;
  hour: string;
  fragile: string;
  express: string;
} => {
  const input = observation.input;
  if (typeof input !== "object" || input === null) {
    return {
      distance: "",
      weight: "",
      hour: "",
      fragile: "",
      express: "",
    };
  }
  const record = input as Record<string, unknown>;
  return {
    distance: String(record.distanceKm ?? ""),
    weight: String(record.weightKg ?? ""),
    hour: String(record.hour ?? ""),
    fragile: String(record.fragile ?? ""),
    express: String(record.express ?? ""),
  };
};

export const notebookTableText = (
  observations: ReadonlyArray<ChallengeObservation>,
  challengeClosed = false,
): string => {
  if (observations.length === 0) {
    if (challengeClosed) {
      return [
        "CASE FILE: no observations",
        "El challenge está cerrado. Revisa el ranking final.",
        "",
        "Siguiente: chofex challenge ranking",
      ].join("\n");
    }
    return [
      "CASE FILE: no observations yet",
      "The machine has not revealed anything. Start with one ordinary shipment.",
      "",
      "Next: chofex challenge query",
    ].join("\n");
  }
  let observationLabel = `${observations.length} observations`;
  if (observations.length === 1) observationLabel = "1 observation";
  const header = [
    "#".padEnd(4),
    "Distance".padEnd(11),
    "Weight".padEnd(9),
    "Hour".padEnd(7),
    "Fragile".padEnd(10),
    "Express".padEnd(10),
    "Output",
  ].join("");
  const rows = observations.map((observation) => {
    const cells = shipmentCells(observation);
    return [
      String(observation.sequence).padEnd(4),
      cells.distance.padEnd(11),
      cells.weight.padEnd(9),
      cells.hour.padEnd(7),
      cells.fragile.padEnd(10),
      cells.express.padEnd(10),
      JSON.stringify(observation.output),
    ].join("");
  });
  const lines = [`CASE FILE: ${observationLabel}`, "", header, ...rows, ""];
  if (challengeClosed) {
    lines.push(
      "El challenge está cerrado. Este cuaderno queda disponible como historial.",
      "Siguiente: chofex challenge ranking",
    );
    return lines.join("\n");
  }
  if (observations.length === 1) {
    lines.push(
      "One answer is a clue, not a rule.",
      "Next: run a controlled experiment. Change one field and keep the other four fixed.",
      "  chofex challenge query",
      "",
    );
  } else {
    lines.push(
      "Look for thresholds, fixed surcharges, and interactions between fields.",
      "Next: test a hypothesis with a controlled query, or encode it in your solution.",
      "  chofex challenge query",
      "",
    );
  }
  lines.push(
    "Prepare your replacement",
    "  chofex challenge init",
    "  chofex challenge test --source ./shipping.js",
  );
  return lines.join("\n");
};

export const notebookCsvText = (
  observations: ReadonlyArray<ChallengeObservation>,
): string => {
  const header = "sequence,distanceKm,weightKg,hour,fragile,express,output";
  const rows = observations.map((observation) => {
    const cells = shipmentCells(observation);
    return [
      observation.sequence,
      cells.distance,
      cells.weight,
      cells.hour,
      cells.fragile,
      cells.express,
      JSON.stringify(observation.output),
    ].join(",");
  });
  return [header, ...rows].join("\n");
};

export const challengeTestText = (result: ChallengeLocalTestResult): string => {
  let verdict = "KEEP WORKING";
  if (result.accuracy === 1) verdict = "NOTEBOOK MATCHED";
  const lines = [
    `NOTEBOOK VERDICT: ${verdict}`,
    "These checks use only evidence you already collected, not hidden shipments.",
    "",
    `Accuracy           ${percent(result.accuracy)}`,
    `Exact predictions  ${result.matchedObservations} / ${result.observationCount}`,
    `Mean error         ${result.meanError.toFixed(2)}`,
  ];
  if (result.mismatches.length > 0) {
    lines.push("", "Mismatches:");
    for (const mismatch of result.mismatches) {
      lines.push(
        `  #${mismatch.sequence} expected ${JSON.stringify(mismatch.expected)} got ${JSON.stringify(mismatch.actual)}`,
      );
    }
  }
  if (result.accuracy === 1) {
    lines.push(
      "",
      "Your model explains the notebook. That is necessary, but hidden cases may expose missing rules.",
      "Next: evaluate only when your experiments cover meaningful boundaries",
      "  chofex challenge evaluate --source ./shipping.js",
    );
  } else {
    lines.push(
      "",
      "Next: edit shipping.js, explain the mismatches, and test again for free",
      "  chofex challenge test --source ./shipping.js",
    );
  }
  return lines.join("\n");
};

export const challengeEvaluateText = (
  result: ChallengeEvaluationResult,
): string => {
  const lines = [
    "OFFICIAL VERDICT — BLACK BOX REPLICATION",
    `Accuracy            ${percent(result.accuracy)}`,
    `Exact predictions   ${result.exactCount} / ${result.sampleSize}`,
    `Mean error          ${result.meanError.toFixed(2)}`,
    `Oracle queries used ${result.queriesUsed}`,
  ];
  if (result.rank !== undefined)
    lines.push(`Rank                #${result.rank}`);
  lines.push(
    `Official evaluations remaining ${result.evaluationsRemaining} / ${result.evaluationsLimit}`,
    "",
    result.shareText,
    "",
    "Next: inspect the leaderboard",
    "  chofex challenge ranking",
  );
  if (result.evaluationsRemaining > 0) {
    lines.push(
      "",
      "Before spending another evaluation, improve and retest your model against the notebook.",
      "  chofex challenge test --source ./shipping.js",
    );
  }
  return lines.join("\n");
};

export const challengeRankingText = (
  ranking: ChallengeRanking,
  now: Date = new Date(),
): string => {
  const lines = [`${ranking.challenge.theme} — ${ranking.challenge.title}`];
  const { rankingVisibleAt } = ranking.challenge;
  if (
    rankingVisibleAt &&
    !isChallengeRankingVisibleAt(ranking.challenge, now)
  ) {
    lines.push(
      "",
      `Ranking available ${formatChallengeOpeningInPeru(rankingVisibleAt)}.`,
    );
    return lines.join("\n");
  }
  lines.push("");
  if (ranking.entries.length === 0) {
    lines.push("No official evaluations yet.");
    return lines.join("\n");
  }
  lines.push("Rank  Accuracy  Exact        Queries  Name");
  for (const entry of ranking.entries.slice(0, 20)) {
    const rank = String(entry.rank).padStart(4, " ");
    const accuracy = percent(entry.accuracy).padStart(8, " ");
    const exact = `${entry.exactCount}/${entry.sampleSize}`.padStart(11, " ");
    const queries = String(entry.queriesUsed).padStart(7, " ");
    lines.push(
      `${rank}  ${accuracy}  ${exact}  ${queries}  ${entry.displayName} #${entry.shareCode}`,
    );
  }
  return lines.join("\n");
};

export const registrationPartsText = (result: RegistrationResult): string => {
  const parts = result.requirements.parts ?? [];
  if (parts.length === 0) return "";
  const lines = ["", "Application parts:"];
  for (const part of parts) {
    const mark = part.complete ? "✓" : "○";
    let detail = "";
    if (!part.complete && part.missing[0]) {
      detail = ` — ${part.missing[0].reason}`;
    }
    lines.push(`  ${mark} ${part.title}${detail}`);
  }
  if (result.requirements.canSubmitApplication) {
    lines.push("", "Ready to submit: chofex register");
  } else if (result.requirements.stage === "draft") {
    lines.push("", "Complete and submit with `chofex register`.");
  }
  return lines.join("\n");
};
