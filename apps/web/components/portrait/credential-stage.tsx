"use client";

/**
 * The credential, and the way to change the face on it.
 *
 * The opening sweep used to live here, over the card alone. It is now a
 * curtain over the whole page — `PageSweep`, mounted by the page — which
 * is the only scale at which a grid of characters reads: on the card the
 * photo window renders at 113px, where a character lands at 1.38px and
 * a halftone dot at 3.4, so the card keeps the dots and the characters
 * got somewhere they can be seen.
 */

import type { ReactNode } from "react";

import { CredentialScene } from "@/components/credential/credential-scene";

import { PortraitPicker } from "./portrait-picker";

interface CredentialStageProps {
  readonly textureUrl: string;
  /** The picture the sweep assembles, which is the card's own. */
  readonly portraitUrl: string | null;
  readonly githubAvatarUrl: string | null;
  /** False while the card is drawing a proposal nobody has accepted. */
  readonly confirmed: boolean;
  /** The static card, for the layer underneath. */
  readonly children: ReactNode;
}

export function CredentialStage({
  textureUrl,
  portraitUrl,
  githubAvatarUrl,
  confirmed,
  children,
}: CredentialStageProps) {
  /*
    `CONTEXT.md` forbids using an available image before its owner picks
    a source, so a card drawing a GitHub photo nobody confirmed has to
    say so. It is shown, not stored — this note is the difference.
  */
  let proposal = null;
  if (!confirmed && portraitUrl) {
    proposal = (
      <p className="portrait-proposal">
        Esta es tu foto de GitHub. Puedes dejarla o cambiarla.
      </p>
    );
  }

  return (
    <>
      <div className="credential-stage">
        <CredentialScene faceUrl={textureUrl}>{children}</CredentialScene>
      </div>
      {proposal}
      <PortraitPicker
        confirmed={confirmed}
        githubAvatarUrl={githubAvatarUrl}
        onStored={() => window.location.reload()}
      />
    </>
  );
}
