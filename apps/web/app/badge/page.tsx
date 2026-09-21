/**
 * The participant's credential.
 *
 * The badge is for people who were accepted, and this is where that is
 * known rather than inferred: the session says who they are, and
 * everything the card prints comes from their own application.
 *
 * Anyone signed in who is not accepted is sent to the welcome page rather
 * than shown an empty credential. A card that says nothing is a worse
 * answer than being told where to go.
 */

import { BrandCenteredPage, BrandTitle } from "@chofex/ui/components/brand";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import "@/components/credential/credential.css";
import { CredentialCard } from "@/components/credential/credential-card";
import { brandName } from "@/components/landing/content";
import { CredentialStage } from "@/components/portrait/credential-stage";
import {
  acceptedByClerkUser,
  credentialFor,
  portraitFor,
} from "@/lib/credential/accepted";

/** The session decides what this page is, so it cannot be prerendered. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Mi carnet | ${brandName}`,
  description: `Tu credencial para ${brandName}.`,
  // Signed-in, personal, and the card carries a name and a role. Nothing
  // about it belongs in an index.
  robots: { index: false, follow: false },
};

export default async function CarnetPage() {
  const authentication = await auth();
  if (!authentication.userId) {
    redirect("/sign-in?redirect_url=/badge");
  }

  const accepted = await acceptedByClerkUser(authentication.userId);
  if (!accepted) {
    redirect("/welcome");
  }

  const credential = credentialFor(accepted);
  const portrait = portraitFor(accepted);

  return (
    <BrandCenteredPage contentClassName="max-w-3xl text-center">
      <Link className="credential-back-link" href="/">
        {brandName}
      </Link>
      <BrandTitle as="h1">Tu carnet</BrandTitle>
      {/*
        Two layers: the static card is what a visitor without JavaScript
        reads and what the browser paints before hydration, with the
        simulated lanyard mounted over it.
      */}
      <CredentialStage
        confirmed={portrait.confirmed}
        githubAvatarUrl={portrait.confirmed ? null : portrait.url}
        portraitUrl={portrait.url}
        textureUrl="/badge/card-texture"
      >
        <CredentialCard credential={credential} />
      </CredentialStage>
    </BrandCenteredPage>
  );
}
