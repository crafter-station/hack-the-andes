/**
 * What arrives when somebody's credential is ready.
 *
 * It carries the badge — the face, but also the name, the one-liner and the
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
    "Tu carnet predeterminado ya está hecho con el nombre, la foto y la presentación que teníamos al aceptar tu postulación.";
  const ranked = input.placement !== "PARTICIPANT";
  const congratulation = ranked
    ? `¡Felicitaciones! Alcanzaste ${input.placement}; tu posición en el challenge también aparece en el carnet.`
    : undefined;
  const body =
    "Ejecuta chofex confirm para cambiar el nombre del carnet, la foto o la presentación de una línea y generar uno nuevo. Completa el comando aunque quieras conservar este carnet: necesitamos tu nombre completo y DNI o pasaporte para autorizar tu ingreso al venue. Comparte también tu teléfono para que podamos contactarte por WhatsApp si necesitamos coordinar contigo.";
  const sharing =
    "Celebra este logro compartiendo tu carnet en LinkedIn e Instagram.";

  const text = [
    greeting,
    "",
    introduction,
    ...(congratulation ? ["", congratulation] : []),
    "",
    body,
    "",
    sharing,
    "",
    `Ver mi carnet: ${input.badgePageUrl}`,
    "Confirmar, personalizar y regenerar: chofex confirm",
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
      ...(congratulation ? [paragraph(congratulation)] : []),
      picture(input.badgeUrl, "Tu carnet de Hack the Andes"),
      paragraph(body),
      paragraph(sharing),
      button("Ver mi carnet", input.badgePageUrl),
      paragraph("Desde tu terminal: chofex confirm"),
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
