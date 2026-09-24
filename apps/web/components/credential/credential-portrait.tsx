"use client";

/**
 * The photo window on the static card.
 *
 * Initials underneath and the picture over them, so a card whose image
 * fails to load falls back to something rather than to a hole. The
 * picture is the generated halftone of the photo the participant confirmed
 * and nothing else. While generation is pending there is no image element,
 * so the fallback never flashes the unscreened original.
 */

import Image from "next/image";
import { useState } from "react";

import { type Credential, initialsFor } from "./credential-model";

interface CredentialPortraitProps {
  readonly credential: Credential;
}

export function CredentialPortrait({ credential }: CredentialPortraitProps) {
  const [failed, setFailed] = useState(false);
  const picture = credential.portraitUrl;

  let photo = null;
  if (picture && !failed) {
    photo = (
      <Image
        alt={`Foto de ${credential.name}`}
        className="credential-card-photo"
        height={460}
        onError={() => setFailed(true)}
        // Unoptimised: this is already a generated, public PNG. Sending it
        // through another optimizer adds a failure point without changing it.
        src={picture}
        unoptimized
        width={460}
      />
    );
  }

  return (
    <div className="credential-card-portrait">
      <span aria-hidden="true" className="credential-card-initials">
        {initialsFor(credential.name)}
      </span>
      {photo}
    </div>
  );
}
