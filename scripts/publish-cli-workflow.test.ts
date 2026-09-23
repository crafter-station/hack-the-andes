import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../.github/workflows/publish-cli.yml", import.meta.url),
  "utf8",
);
const productionWorkflow = readFileSync(
  new URL("../.github/workflows/production-image.yml", import.meta.url),
  "utf8",
);
const releaseSkill = readFileSync(
  new URL("../.agents/skills/release-cli/SKILL.md", import.meta.url),
  "utf8",
);
const automaticReleaseCommit =
  "RELEASE_COMMIT: $" + "{{ inputs.commit_sha || github.sha }}";
const mainPushTrigger = `  push:
    branches:
      - main
  workflow_dispatch:`;

test("publishes the CLI only for main pushes that can affect the package", () => {
  expect(workflow).toContain(mainPushTrigger);
  expect(workflow).toContain("name: Detect CLI release changes");
  expect(workflow).toContain("releases/latest");
  expect(workflow).toContain(
    "npm --prefix apps/cli --workspaces=false view chofex-cli version",
  );
  expect(workflow).toContain('[[ "$latest_tag" != "v$' + '{npm_version}" ]]');
  expect(workflow).toContain("turbo ls --affected --output=json");
  expect(workflow).toContain('.name == "chofex-cli"');
  expect(workflow).toContain("needs: detect-release");
  expect(workflow).toContain(
    "if: needs.detect-release.outputs.should_publish == 'true'",
  );
  expect(workflow).toContain(automaticReleaseCommit);
  const publishJob = workflow.indexOf("  publish:");
  const releaseConcurrency = workflow.indexOf("    concurrency:");
  expect(releaseConcurrency).toBeGreaterThan(publishJob);
  expect(workflow.slice(releaseConcurrency)).toMatch(
    /concurrency:\s+group: publish-cli\s+cancel-in-progress: false/,
  );
});

test("validates manual targets before they enter release concurrency", () => {
  const detectionJob = workflow.slice(0, workflow.indexOf("  publish:"));

  expect(detectionJob).toContain('if [[ "$GITHUB_SHA" != "$RELEASE_COMMIT" ]]');
  expect(detectionJob).toContain(
    'if [[ "$default_branch_sha" != "$RELEASE_COMMIT" ]]',
  );
});

test("requeues the current main tip when a stale release held the queue", () => {
  const publishJob = workflow.slice(workflow.indexOf("  publish:"));

  expect(publishJob).toContain("stale:");
  expect(publishJob).toContain('echo "stale=true" >> "$GITHUB_OUTPUT"');
  expect(publishJob).toContain("needs.publish.outputs.stale == 'true'");
  expect(publishJob).toContain("releases/latest");
  expect(publishJob).toContain("gh run watch");
  expect(publishJob).toContain('if ! existing_runs="$(gh run list');
  expect(publishJob).toContain('.name == "Publish chofex-cli"');
  expect(publishJob).toContain('"$publish_conclusion" == "success"');
  expect(publishJob).toContain("gh workflow run publish-cli.yml");
  expect(publishJob).toContain('--repo "$GITHUB_REPOSITORY"');
});

test("does not reuse an automatic run that skipped publishing", () => {
  expect(releaseSkill).toContain("Publish chofex-cli");
  expect(releaseSkill).toContain('"skipped"');
  expect(releaseSkill).toContain("workflow_dispatch");
  expect(releaseSkill).toContain('if ! automatic_run_id="$(gh run list');
});

test("does not share release concurrency with production deployment", () => {
  expect(productionWorkflow).toMatch(/concurrency:\s+group: production-image-/);
  expect(productionWorkflow).not.toContain("group: publish-cli");
});
