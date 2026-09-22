"use client";

import { BrandStatusPage } from "@chofex/ui/components/brand";
import { Button } from "@chofex/ui/components/button";
import { useEffect } from "react";
import {
  isChunkLoadError,
  recoverFromChunkError,
} from "@/lib/chunk-load-recovery";

export interface BrandErrorFallbackProps {
  readonly error: unknown;
  readonly reset: () => void;
  readonly retry?: () => void;
  readonly description?: string;
}

export function BrandErrorFallback({
  error,
  reset,
  retry,
  description = "No pudimos cargar esta página. Intenta nuevamente.",
}: BrandErrorFallbackProps) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    console.error(error);

    recoverFromChunkError(
      error,
      () => window.sessionStorage,
      () => window.location.reload(),
    );
  }, [error]);

  const recover = () => {
    if (chunkError) {
      window.location.reload();
      return;
    }
    const retrySegment = retry ?? reset;
    retrySegment();
  };

  return (
    <BrandStatusPage
      data-app-error-fallback=""
      kicker="Error / 500"
      title="Algo salió mal"
      description={description}
    >
      <Button className="mt-8" size="landing" onClick={recover}>
        Intentar de nuevo
      </Button>
    </BrandStatusPage>
  );
}
