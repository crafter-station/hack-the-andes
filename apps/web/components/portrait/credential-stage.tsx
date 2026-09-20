"use client";

/**
 * The credential, its opening sweep, and the way to change the face on it.
 *
 * Owns the one piece of state the three share: whether the sweep is still
 * running. The scene is mounted underneath the whole time rather than
 * after — WebGL wants to compile its shaders while somebody is watching
 * characters assemble, not in the silence afterwards.
 *
 * The sweep plays on every visit, not once. It is what the page is.
 */

import { type ReactNode, useCallback, useState } from "react";

import { CredentialScene } from "@/components/credential/credential-scene";

import { PortraitPicker } from "./portrait-picker";
import { PortraitSweep } from "./portrait-sweep";

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
  const [sweeping, setSweeping] = useState(true);
  const finish = useCallback(() => setSweeping(false), []);

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
      <div className="credential-stage" data-sweeping={sweeping}>
        <CredentialScene faceUrl={textureUrl}>{children}</CredentialScene>
        {/*
          Kept mounted after it finishes so the css can fade it out. An
          unmount here made the card arrive on a cut, which is the one
          thing a reveal must not do.
        */}
        <PortraitSweep onDone={finish} src={portraitUrl} />
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
