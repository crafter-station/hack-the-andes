export const brokenAgentScaffoldDirectory = "broken-agent" as const;
export const brokenAgentSolutionPath =
  `${brokenAgentScaffoldDirectory}/scheduler.js` as const;

export const brokenAgentPackageJson = `${JSON.stringify(
  {
    name: "broken-agent-challenge",
    private: true,
    type: "commonjs",
    scripts: { test: "node --test scheduler.test.js" },
  },
  null,
  2,
)}\n`;

export const brokenAgentStarterSource = `/**
 * Broken Agent — The Scheduler
 *
 * A coding agent implemented this scheduler and declared the feature complete.
 * Every public test passes. The implementation is not production-correct.
 * Keep the createScheduler interface intact and harden the implementation.
 */
function createScheduler({ store, clock, execute }) {
  return {
    async schedule(input) {
      const job = { ...input, status: "pending" };
      await store.transaction((tx) => tx.put(job));
      return job;
    },

    async cancel(id) {
      return store.transaction((tx) => {
        const job = tx.get(id);
        if (!job || job.status !== "pending") return false;
        tx.put({ ...job, status: "cancelled" });
        return true;
      });
    },

    async list() {
      return store.transaction((tx) => tx.list());
    },

    async runDue() {
      const now = clock.now().getTime();
      const jobs = await store.transaction((tx) => tx.list());
      for (const job of jobs) {
        if (job.status !== "pending" || Date.parse(job.runAt) > now) continue;
        await execute(job);
        await store.transaction((tx) =>
          tx.put({ ...job, status: "completed" }),
        );
      }
    },
  };
}

module.exports = { createScheduler };
`;

export const brokenAgentReadme = `# Broken Agent — The Scheduler

> A coding agent was asked to implement a feature. It says it is done. It is
> not. Your job is to ship it.

The repository starts with all public tests passing. Repair \`scheduler.js\`
without changing its exported \`createScheduler(dependencies)\` interface.

## Commands

\`\`\`sh
npm test
chofex challenge test --challenge broken-agent --source ./broken-agent/scheduler.js
chofex challenge evaluate --challenge broken-agent --source ./broken-agent/scheduler.js
\`\`\`

Local and public tests are unlimited. You have **5 official evaluations**
against hidden production scenarios. AI tools are explicitly allowed.

## Public contract

\`createScheduler({ store, clock, execute, workerId })\` returns:

- \`schedule({ id, runAt, payload })\`
- \`cancel(id)\`
- \`list()\`
- \`runDue()\`

### Jobs

- \`id\` matches \`^[A-Za-z0-9_-]{1,64}$\`.
- \`runAt\` is an ISO-8601 timestamp with an explicit timezone.
- \`payload\` is JSON-serializable.
- Scheduling an identical job ID is idempotent. Reusing an ID for different
  work must reject without changing the original job.
- Past timestamps are valid and become due immediately.
- \`list()\` returns jobs ordered by \`runAt\`, then \`id\`.

### Durability and concurrency

- The supplied store survives scheduler instances and process restarts.
- Several workers may call \`runDue()\` concurrently against the same store.
- A worker claim lasts 30 seconds. Another worker may reclaim the job when
  \`clock.now()\` reaches that lease deadline.
- A pending job may be cancelled. A running or terminal job may not.
- Failed executions retry, without preventing other due jobs from running.
- A job becomes \`failed\` after 3 unsuccessful attempts.
- The execution adapter applies effects idempotently by job ID. A worker may
  stop after the effect is applied but before completion is recorded; retrying
  must eventually complete the job without duplicating the effect.

The store exposes only \`transaction(action)\`. Inside an action, \`tx\`
provides synchronous \`get(id)\`, \`put(job)\`, \`delete(id)\`, and \`list()\`
operations. Transactions are serialized. Do not keep a transaction open while
executing a job.

\`clock.now()\` returns a \`Date\`. \`execute(job)\` returns a promise.

## Evaluation

The hidden evaluator checks the published contract under deterministic
concurrency, restart, failure, idempotency, compatibility, and load scenarios.
It reports capability-level scores, not individual hidden-test failures.
Score ranks first; runtime is used only after correctness.
`;

export const brokenAgentPublicTestSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const { createScheduler } = require("./scheduler.js");

const clone = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

class MemoryStore {
  constructor() {
    this.jobs = new Map();
    this.tail = Promise.resolve();
  }

  transaction(action) {
    const run = this.tail.then(() => action({
      get: (id) => clone(this.jobs.get(id)),
      put: (job) => {
        this.jobs.set(job.id, clone(job));
        return clone(job);
      },
      delete: (id) => this.jobs.delete(id),
      list: () => [...this.jobs.values()].map(clone),
    }));
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }
}

const setup = () => {
  const store = new MemoryStore();
  const now = new Date("2026-10-17T15:00:00.000Z");
  const executed = [];
  const scheduler = createScheduler({
    store,
    clock: { now: () => new Date(now) },
    execute: async (job) => executed.push(job.id),
    workerId: "public-worker",
  });
  return { store, scheduler, executed };
};

const job = (id, runAt = "2026-10-17T15:00:00.000Z") => ({
  id,
  runAt,
  payload: { message: id },
});

test("schedules and lists a job", async () => {
  const { scheduler } = setup();
  await scheduler.schedule(job("job-1"));
  assert.equal((await scheduler.list()).length, 1);
});

test("executes a due job", async () => {
  const { scheduler, executed } = setup();
  await scheduler.schedule(job("job-1"));
  await scheduler.runDue();
  assert.deepEqual(executed, ["job-1"]);
});

test("does not execute a future job", async () => {
  const { scheduler, executed } = setup();
  await scheduler.schedule(job("future", "2026-10-17T16:00:00.000Z"));
  await scheduler.runDue();
  assert.deepEqual(executed, []);
});

test("cancels a pending job", async () => {
  const { scheduler, executed } = setup();
  await scheduler.schedule(job("cancel-me"));
  assert.equal(await scheduler.cancel("cancel-me"), true);
  await scheduler.runDue();
  assert.deepEqual(executed, []);
});
`;
