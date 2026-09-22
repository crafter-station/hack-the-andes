/**
 * Error-tracking grouping fields for a hero mesh that failed to load, keyed on
 * the asset rather than on the loader's message.
 *
 * three.js reports a load abort as `Could not load <url>: <reason>`, and it
 * folds the browser's own wording for that abort straight into `<reason>` —
 * "Failed to fetch" on Chromium, "Load failed" on Safari. The default
 * fingerprint reads the message, and the mesh URL also carries a content stamp
 * that changes on every rebuild, so one flaky client network split into a fresh
 * issue per browser family and per mesh build.
 *
 * A fixed fingerprint keyed on the asset folds all of that back into one issue:
 * the browser wording and the stamp stop mattering, and only the asset does.
 * `$issue_name` names that issue when it is first created; PostHog keeps the
 * name on later events with the same fingerprint.
 */
export function heroModelExceptionGrouping(model: string) {
  return {
    $exception_fingerprint: `hero-model-load-failed:${model}`,
    $issue_name: `Hero mesh failed to load: ${model}`,
  };
}
