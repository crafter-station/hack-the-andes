"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  clearChunkReloadGuard,
  clerkUiComponentForPath,
  recoverFromUnhandledChunkError,
} from "@/lib/chunk-load-recovery";

/**
 * Clears the guard once the route has recovered. The guard is shared across the
 * whole session, so any route that renders successfully must clear it, or a
 * single reload elsewhere would block later recovery. Auth routes wait for the
 * Clerk UI; every other route only needs the app shell back.
 */
export function ChunkLoadRecoverySuccess() {
  const pathname = usePathname();
  const clerkComponent = clerkUiComponentForPath(pathname);

  useEffect(() => {
    const clearGuard = () => {
      clearChunkReloadGuard(() => window.sessionStorage);
    };

    const routeHasRecovered = () => {
      return !document.querySelector("[data-app-error-fallback]");
    };

    const criticalUiHasRendered = () => {
      if (!clerkComponent) {
        return true;
      }
      const selector = `[data-clerk-component="${clerkComponent}"]`;
      const root = document.querySelector(selector);
      return Boolean(root?.childElementCount);
    };

    const recoverySucceeded = () => {
      return routeHasRecovered() && criticalUiHasRendered();
    };

    if (recoverySucceeded()) {
      clearGuard();
      return;
    }

    const observer = new MutationObserver(() => {
      if (recoverySucceeded()) {
        clearGuard();
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [clerkComponent]);

  return null;
}

/**
 * Recovers from a chunk failure that never reaches an error boundary. The
 * boundaries only run when React catches the error during render; a dynamic
 * import that rejects outside render arrives as an unhandled rejection or a
 * window error and stays unrecovered, leaving the page blank after a redeploy
 * swaps out the previous build's chunks. These listeners run the same single
 * guarded reload for that case. They never call `preventDefault`, so the
 * exception still reaches error tracking.
 */
export function UnhandledChunkErrorRecovery() {
  useEffect(() => {
    const getStorage = () => window.sessionStorage;
    const reload = () => window.location.reload();

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      recoverFromUnhandledChunkError(event.reason, getStorage, reload);
    };
    const onError = (event: ErrorEvent) => {
      recoverFromUnhandledChunkError(event.error, getStorage, reload);
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);

    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
