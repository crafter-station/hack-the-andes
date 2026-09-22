import { recoverFromChunkError } from "./lib/chunk-load-recovery";

const recover = (error: unknown) => {
  recoverFromChunkError(
    error,
    () => window.sessionStorage,
    () => window.location.reload(),
  );
};

// Register synchronously before hydration so startup failures cannot race a
// React effect. Do not prevent either event: error tracking must still observe
// the original failure even when the guarded reload recovers the visitor.
try {
  window.addEventListener("unhandledrejection", (event) => {
    recover(event.reason);
  });
  window.addEventListener("error", (event) => {
    recover(event.error);
  });
} catch {
  // Instrumentation is best-effort and must never block application startup.
}
