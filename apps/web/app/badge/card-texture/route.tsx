/**
 * The participant's card, as the texture the glTF model wears.
 *
 * Never cached at the edge. The response depends on who is asking, and a
 * shared cache that did not know that would serve one participant's
 * credential to the next.
 */

import { auth } from "@clerk/nextjs/server";

import { acceptedByClerkUser, credentialFor } from "@/lib/credential/accepted";
import { renderCardTexture } from "@/lib/credential/card-texture";

export const dynamic = "force-dynamic";

export async function GET() {
  const authentication = await auth();
  if (!authentication.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const accepted = await acceptedByClerkUser(authentication.userId);
  if (!accepted) {
    return new Response("Not found", { status: 404 });
  }

  const response = await renderCardTexture(credentialFor(accepted));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
