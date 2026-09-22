"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  clearChunkReloadGuard,
  clerkUiComponentForPath,
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
