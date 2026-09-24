/**
 * What arrives when somebody's credential is ready.
 *
 * It carries the badge — the face, but also the name, the role and the
 * challenge placement, which is what makes it theirs rather than a photograph. The
 * card is still a thing you pick up and swing, so the email sends people
 * to the page where it hangs; what it shows is the printed object.
 *
 * The placement is stamped in the header as well, where a card carries its
 * own, so the sheet the email is laid out as is stamped like the sheet
 * inside it.
 */

import {
  button,
  emailShell,
  eyebrow,
  heading,
  paragraph,
  picture,
} from "@/lib/emails/layout";

import { badgeEmailFrom, badgeEmailReplyTo } from "./config";

export interface BadgeReadyEmailInput {
  readonly applicationId: string;
  readonly email: string;
  readonly firstName: string;
  /** The badge, already uploaded — a mail client cannot read a buffer. */
  readonly badgeUrl: string;
  /** Their best exact challenge placement, stamped where the card carries it. */
  readonly placement: string;
  /** Where the card itself hangs. */
  readonly badgePageUrl: string;
  /** Makes regenerated badge notifications independently deliverable. */
  readonly generationId: string;
}

const SUBJECT = "Tu carnet de Hack the Andes está listo";

export const buildBadgeReadyEmail = (
  input: Omit<BadgeReadyEmailInput, "applicationId" | "email" | "generationId">,
): {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
} => {
  const name = input.firstName.trim();
  const greeting = name ? `Hola ${name},` : "Hola,";
  const introduction =
    "Tu carnet ya está hecho: tu foto tramada, tu nombre, tu presentación y tu mejor posición en los challenges.";
  const body =
    "En el sitio está el carnet completo. Si quieres cambiar la foto, el nombre, la presentación o el enlace del QR, ejecuta chofex badge regenerate.";

  const text = [
    greeting,
    "",
    introduction,
    "",
    body,
    "",
    `Ver mi carnet: ${input.badgePageUrl}`,
    "Personalizar y regenerar: chofex badge regenerate",
    "",
    "Nos vemos en la cima.",
    "— El equipo de Hack the Andes",
  ].join("\n");

  const html = emailShell({
    subject: SUBJECT,
    preheader: "Tu foto está lista. El carnet completo te espera en el sitio.",
    stamp: input.placement,
    /*
      No range at the foot: the badge in the body has one printed on it,
      and the same drawing twice down one column reads as a repeated
      asset rather than as a motif.
    */
    ridge: false,
    blocks: [
      eyebrow("TU CARNET"),
      heading("Ya tienes carnet."),
      paragraph(greeting),
      paragraph(introduction),
      picture(input.badgeUrl, "Tu carnet de Hack the Andes"),
      paragraph(body),
      button("Ver mi carnet", input.badgePageUrl),
      paragraph("Desde tu terminal: chofex badge regenerate"),
    ],
  });

  return { subject: SUBJECT, text, html };
};

export const sendBadgeReadyEmail = async (
  input: BadgeReadyEmailInput,
): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const email = buildBadgeReadyEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": `participant-badge/${input.applicationId}/${input.generationId}`,
    },
    body: JSON.stringify({
      from: badgeEmailFrom,
      to: [input.email],
      reply_to: badgeEmailReplyTo,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (response.ok) return;
  const body = (await response.json().catch(() => undefined)) as
    | { readonly message?: string }
    | undefined;
  throw new Error(body?.message ?? `Resend returned HTTP ${response.status}`);
};
