/**
 * The credential as markup.
 *
 * The layer underneath the simulated lanyard: what a visitor without
 * JavaScript reads, and what the browser paints before hydration or when
 * WebGL is unavailable. It carries the same four things the printed
 * design does — a placement, a picture, a name and a one-liner — so the two
 * layers cannot say different things about the same person.
 *
 * The stats it used to show, and the state line under them, went with the
 * GitHub profile that fed them. A card that exists only for accepted
 * participants has nothing to announce about whether its holder was
 * accepted.
 */

import { brandColors } from "@chofex/ui/lib/brand-theme";
import QRCode from "qrcode";

import { SHEET } from "@/lib/credential/tones";

import type { Credential } from "./credential-model";
import { CredentialPortrait } from "./credential-portrait";

interface CredentialCardProps {
  readonly credential: Credential;
}

export async function CredentialCard({ credential }: CredentialCardProps) {
  const qr = await QRCode.toDataURL(credential.linkUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 160,
    color: { dark: brandColors.dark.ink, light: SHEET },
  });
  return (
    <article className="credential-card">
      {/*
        The punched hole. It is not decoration: it is the point the card
        physically hangs from, so it is also the point every rotation has
        to pivot around, and the css sets transform-origin from it.
      */}
      <span aria-hidden="true" className="credential-card-grommet" />

      <header className="credential-card-head">
        <span className="credential-card-event">HACK THE ANDES</span>
        <span className="credential-card-number">{credential.placement}</span>
      </header>

      <CredentialPortrait credential={credential} />

      <div className="credential-card-identity">
        <h2 className="credential-card-name">{credential.name}</h2>
        <p className="credential-card-one-liner">{credential.oneLiner}</p>
      </div>

      {/* biome-ignore lint/performance/noImgElement: generated data URI */}
      <img
        alt="Enlace QR del participante"
        className="credential-card-qr"
        height={80}
        src={qr}
        width={80}
      />

      <footer className="credential-card-foot">
        <span className="credential-card-date">17–18 OCT 2026 · LIMA</span>
        <span className="credential-card-wordmark">HACKTHEANDES.COM</span>
      </footer>
    </article>
  );
}
