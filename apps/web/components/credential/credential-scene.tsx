"use client";

/**
 * Holds the two layers the credential is shown in.
 *
 * Underneath, the static card, passed in as a child so it stays a server
 * component: it is the markup a visitor without JavaScript reads, and what
 * the browser paints before hydration or if WebGL is unavailable. Over it,
 * the simulated lanyard, which reports when it is actually drawing — only
 * then does the static layer step aside.
 *
 * Hiding the fallback on `mounted` rather than on the canvas being ready
 * would blank the card on any machine where WebGL fails, which is the one
 * case the fallback exists for.
 *
 * Knows nothing about the character. `CredentialEditor` is the one that
 * lets somebody change it, and the entry page shows a sample nobody should
 * be editing — so the scene stays a thing that draws what it is handed.
 */

import { type ReactNode, useState } from "react";

import { CredentialLanyard3D } from "./credential-lanyard-3d";

interface CredentialSceneProps {
  readonly faceUrl?: string;
  /** The static card. A server component; this file never renders one. */
  readonly children: ReactNode;
}

export function CredentialScene({ faceUrl, children }: CredentialSceneProps) {
  const [live, setLive] = useState(false);

  return (
    <div className="credential-scene" data-live={live}>
      <div className="credential-fallback">{children}</div>
      <CredentialLanyard3D faceUrl={faceUrl} onReady={() => setLive(true)} />
    </div>
  );
}
