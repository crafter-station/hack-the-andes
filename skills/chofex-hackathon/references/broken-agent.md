# Broken Agent collaboration flow

**The Scheduler** is a human–agent collaboration challenge, not an autonomous
coding benchmark. Move quickly on setup and mechanical work. The participant
owns the risk focus and release judgment; “solve challenge 2” authorizes you to
inspect, test, and implement, but it does not supply those decisions.

Start with:

```sh
chofex --output json challenge show --challenge broken-agent
chofex --output json challenge init --challenge broken-agent
```

Read `broken-agent/README.md`, `scheduler.js`, and the public tests. Before
editing code:

1. Identify at least three distinct production failure traces in the starter.
   A trace names the actors, event order, and incorrect outcome; labels such as
   “concurrency bug” are not enough.
2. Explain those traces concisely to the participant, including the consequence
   and relevant tradeoff.
3. Ask the participant which trace to investigate first and what outcome they
   believe must never occur. Wait for their choice.
4. Turn their chosen trace into a reproducible test before changing the
   implementation. Then repair the scheduler and run local and public tests.

After the implementation is green, show a compact evidence packet:

- the participant's chosen trace and the test that reproduces it on the starter;
- the invariant enforced by the fix;
- the exact tests and results supporting that claim;
- assumptions or production risks the tests still do not cover; and
- a concise summary of the source changes.

Then ask the participant, in one batch, for the review fields below. These are
engineering judgments, so preserve their wording. Challenge a vague answer with
a concrete follow-up. Completion means every field came from the participant:

- `focus`: `concurrency`, `persistence`, `lease_recovery`,
  `retry_idempotency`, `regression_safety`, or `performance`;
- `failureScenario`: the concrete bad event sequence they understand;
- `evidence`: what test or code path they personally reviewed and what it proves;
- `decision`: `ship` or `block`;
- `confidence`: their integer confidence from 0 to 100; and
- `remainingRisk`: what they are accepting or what still blocks release.

Compute `sourceDigest` mechanically as the lowercase SHA-256 of the exact
`scheduler.js` bytes. Save it with the participant's answers in `review.json`.
Each text answer must contain 20–1,000 characters. Show the complete review back
to the participant and ask them to confirm that it accurately captures their
reasoning. Their confirmation validates the capture; it does not replace the
initial reasoning questions.

Run the public test freely:

```sh
chofex --output json challenge test --challenge broken-agent --source ./scheduler.js
```

Only after the participant confirms the review may you request an official
evaluation:

```sh
chofex --output json challenge evaluate --challenge broken-agent --source ./scheduler.js --review ./review.json
```

Changing `scheduler.js` invalidates the source digest and the participant's
release judgment. Show the changed evidence and obtain a new review before
updating the digest. On `HUMAN_REVIEW_REQUIRED`, `INVALID_HUMAN_REVIEW`, or
`STALE_HUMAN_REVIEW`, return to the participant. Each official evaluation also
requires the participant's explicit approval because it consumes a limited
attempt.
