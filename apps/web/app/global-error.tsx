"use client";

import { brandColors } from "@chofex/ui/lib/brand-theme";
import { useEffect } from "react";
import {
  claimChunkReload,
  isChunkLoadError,
  shouldAutoReloadChunk,
} from "@/lib/chunk-load-recovery";

/**
 * Top-level error boundary. It replaces the root layout, so every style needed
 * by this fallback stays inline in case a stylesheet or font chunk failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    console.error(error);

    if (
      chunkError &&
      shouldAutoReloadChunk() &&
      claimChunkReload(() => window.sessionStorage)
    ) {
      window.location.reload();
    }
  }, [chunkError, error]);

  const retry = () => {
    if (chunkError) {
      window.location.reload();
      return;
    }
    reset();
  };

  return (
    <html lang="es" style={{ colorScheme: "dark" }}>
      <body
        style={{
          boxSizing: "border-box",
          margin: 0,
          minHeight: "100svh",
          display: "grid",
          placeItems: "center",
          padding: "1.25rem",
          backgroundColor: brandColors.dark.paper,
          backgroundImage:
            "radial-gradient(circle at 24% 18%, rgb(210 22 36 / 8%), transparent 20rem)",
          color: brandColors.dark.ink,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <title>Error | Hack the Andes</title>
        <main
          style={{
            boxSizing: "border-box",
            width: "100%",
            maxWidth: "42rem",
            border: "1px solid rgb(246 243 238 / 22%)",
            padding: "clamp(2rem, 8vw, 4rem) clamp(1.5rem, 6vw, 3rem)",
            backgroundColor: "rgb(246 243 238 / 5%)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              color: brandColors.dark.action,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.75rem",
              letterSpacing: "0.12em",
              lineHeight: 1.35,
              textTransform: "uppercase",
            }}
          >
            Error / 500
          </p>
          <h1
            style={{
              margin: "1.5rem 0 0",
              fontSize: "clamp(2.75rem, 10vw, 4.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 0.9,
              textTransform: "uppercase",
            }}
          >
            Algo salió mal
          </h1>
          <p
            style={{
              maxWidth: "28rem",
              margin: "1.5rem auto 0",
              color: brandColors.dark.muted,
              lineHeight: 1.6,
            }}
          >
            No pudimos cargar la aplicación. Intenta nuevamente.
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              minHeight: "3rem",
              marginTop: "2rem",
              cursor: "pointer",
              border: "1px solid transparent",
              borderRadius: 0,
              padding: "0.625rem 1.75rem",
              backgroundColor: brandColors.dark.action,
              color: brandColors.dark.paper,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.875rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
