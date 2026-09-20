"use client";

/**
 * The photo window on the static card.
 *
 * Initials underneath and the picture over them, so a card whose image
 * fails to load falls back to something rather than to a hole. The
 * picture is the one the participant confirmed and nothing else — when
 * they have not confirmed one there is simply no image element, because
 * `CONTEXT.md` is explicit that available images are not used until they
 * choose a source.
 */

import Image from "next/image";
import { useState } from "react";

import { type Credential, initialsFor } from "./credential-model";

interface CredentialPortraitProps {
  readonly credential: Credential;
}

export function CredentialPortrait({ credential }: CredentialPortraitProps) {
  const [failed, setFailed] = useState(false);
  const picture = credential.pictureUrl;

  let photo = null;
  if (picture && !failed) {
    photo = (
      <Image
        alt={`Foto de ${credential.name}`}
        className="credential-card-photo"
        height={460}
        onError={() => setFailed(true)}
        // Unoptimised: the confirmed picture may come from Clerk, from a
        // GitHub profile or from an upload, and routing three unrelated
        // hosts through the optimizer buys nothing on an image this size
        // while adding a hop that can fail on its own.
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
