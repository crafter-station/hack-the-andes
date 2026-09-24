"use client";

/**
 * Holds the two layers the credential is shown in.
 *
 * Underneath, the static card, passed in as a child so it stays a server
 * component: it is the markup a visitor without JavaScript reads. Over
 * it, the simulated lanyard.
 *
 * The static card is hidden the moment JavaScript runs, not when the
 * scene is ready. Those are seconds apart — a model to fetch, shaders to
 * compile — and for those seconds the page showed a flat card and then
 * replaced it with a hanging one, which reads as the page changing its
 * mind. What covers that gap is the sweep, which is what the sweep is
 * for.
 *
 * It comes back if the scene never arrives. Hiding it on hydration alone
 * would leave somebody whose WebGL fails looking at nothing at all,
 * which is the one case the fallback exists for.
 */

import { type ReactNode, useEffect, useState } from "react";

import { CredentialLanyard3D } from "./credential-lanyard-3d";

/**
 * How long the scene is given before the static card is brought back.
 *
 * Long enough to cover a cold fetch of the model on a slow connection,
 * short enough that a failure does not read as a blank page.
 */
const SCENE_GRACE_MS = 9_000;

interface CredentialSceneProps {
  readonly faceUrl?: string;
  /** The static card. A server component; this file never renders one. */
  readonly children: ReactNode;
}

export function CredentialScene({ faceUrl, children }: CredentialSceneProps) {
  const [live, setLive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const timer = setTimeout(() => setGaveUp(true), SCENE_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  // Hidden once JavaScript is running, unless the scene never came up.
  const showFallback = !hydrated || (gaveUp && !live);

  return (
    <div
      className="credential-scene"
      data-fallback={showFallback}
      data-live={live}
    >
      <div className="credential-fallback">{children}</div>
      <CredentialLanyard3D faceUrl={faceUrl} onReady={() => setLive(true)} />
    </div>
  );
}
