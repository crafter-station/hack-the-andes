import { brandColors, brandColorWithAlpha } from "@chofex/ui/lib/brand-theme";

import { badgeEmailFrom, badgeEmailReplyTo } from "../badges/config";
import type { FunnelReminderRecipient, FunnelReminderStage } from "./types";

interface FunnelReminderEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

interface FunnelReminderEmailInput extends FunnelReminderRecipient {
  readonly stage: FunnelReminderStage;
}

interface SendFunnelReminderEmailInput extends FunnelReminderEmailInput {
  readonly clerkUserId: string;
  readonly deliveryScope: string;
}

const colors = {
  page: brandColors.light.paper,
  surface: brandColors.light.surface,
  border: brandColorWithAlpha(brandColors.light.ink, 0.18),
  text: brandColors.light.ink,
  muted: brandColors.light.muted,
  action: brandColors.light.action,
  well: brandColorWithAlpha(brandColors.light.ink, 0.06),
} as const;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const copyFor = (stage: FunnelReminderStage) => {
  if (stage === "registration") {
    return {
      subject: "Tu lugar en Hack the Andes empieza aquí",
      preheader: "Envía tu postulación y da el siguiente paso.",
      eyebrow: "SIGUIENTE PASO / POSTULAR",
      heading: "Hazlo oficial.",
      introduction:
        "Ya diste el primer paso al entrar. Ahora completa y envía tu postulación para acercarte al grupo de hackers que construirá lo que el Perú necesita.",
      action: "Enviar mi postulación",
      url: "https://hacktheandes.com/?utm_source=resend&utm_medium=email&utm_campaign=funnel&utm_content=registration#apply",
      command: "chofex register",
    };
  }

  if (stage === "challenge_start") {
    return {
      subject:
        "Tu postulación está lista. Ahora demuestra lo que puedes construir",
      preheader: "Empieza el challenge de clasificación de Hack the Andes.",
      eyebrow: "SIGUIENTE PASO / EMPEZAR",
      heading: "Entra al challenge.",
      introduction:
        "Tu postulación ya está en carrera. El challenge es tu oportunidad de demostrar cómo piensas, construyes y resuelves problemas reales junto a una comunidad excepcional.",
      action: "Empezar el challenge",
      url: "https://hacktheandes.com/challenges/black-box?utm_source=resend&utm_medium=email&utm_campaign=funnel&utm_content=challenge_start",
      command: "chofex challenge init",
    };
  }

  return {
    subject: "Ya empezaste el challenge. Ahora termínalo",
    preheader: "Convierte tu avance en una evaluación oficial.",
    eyebrow: "SIGUIENTE PASO / TERMINAR",
    heading: "Llévalo hasta el final.",
    introduction:
      "Ya abriste la caja y empezaste a investigar. No dejes tu trabajo a medias: envía una evaluación oficial y demuestra que tienes lo necesario para construir lo que el Perú necesita.",
    action: "Terminar el challenge",
    url: "https://hacktheandes.com/challenges/black-box?utm_source=resend&utm_medium=email&utm_campaign=funnel&utm_content=challenge_finish",
    command: "chofex challenge evaluate --source ./shipping.js",
  };
};

const experience =
  "Vas camino a formar parte de un grupo exclusivo de hackers que construirá lo que el Perú necesita. Te esperan más de S/ 8,000 en premios, apoyo con vuelos a Lima para personas con habilidades excepcionales de otras partes del Perú, comida, bebidas, energy drinks, merch y una experiencia increíble.";

export const buildFunnelReminderEmail = (
  input: FunnelReminderEmailInput,
): FunnelReminderEmail => {
  const copy = copyFor(input.stage);
  const firstName = input.firstName.trim();
  const greeting = firstName ? `Hola ${firstName},` : "Hola,";
  const safeGreeting = escapeHtml(greeting);
  const safeUrl = escapeHtml(copy.url);
  const safeSubject = escapeHtml(copy.subject);
  const text = [
    greeting,
    "",
    copy.introduction,
    "",
    experience,
    "",
    `${copy.action}: ${copy.url}`,
    `O desde tu terminal: ${copy.command}`,
    "",
    "Nos vemos en la cima.",
    "— El equipo de Hack the Andes",
  ].join("\n");

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeSubject}</title></head><body style="margin:0;background:${colors.page};padding:0"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(copy.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${colors.page}"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:${colors.surface};border:1px solid ${colors.border};overflow:hidden"><tr><td style="background:${colors.text};padding:24px 40px;color:${colors.page};font-family:Arial,sans-serif;font-size:18px;font-weight:700">▲&nbsp;&nbsp;Hack the Andes</td></tr><tr><td style="padding:40px 40px 20px"><p style="margin:0 0 16px;color:${colors.action};font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em">${copy.eyebrow}</p><h1 style="margin:0 0 20px;color:${colors.text};font-family:Arial,sans-serif;font-size:36px;line-height:1.1;letter-spacing:-.03em;text-transform:uppercase">${copy.heading}</h1><p style="margin:0 0 16px;color:${colors.text};font-family:Arial,sans-serif;font-size:17px;line-height:1.6">${safeGreeting}</p><p style="margin:0;color:${colors.text};font-family:Arial,sans-serif;font-size:17px;line-height:1.6">${copy.introduction}</p></td></tr><tr><td style="padding:0 40px 28px"><div style="background:${colors.well};padding:20px"><p style="margin:0;color:${colors.text};font-family:Arial,sans-serif;font-size:16px;line-height:1.6">${experience}</p></div></td></tr><tr><td style="padding:0 40px 18px"><a href="${safeUrl}" style="display:inline-block;background:${colors.action};color:${colors.surface};font-family:Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:14px 20px">${copy.action}</a></td></tr><tr><td style="padding:0 40px 36px"><p style="margin:0 0 8px;color:${colors.muted};font-family:Arial,sans-serif;font-size:13px">O desde tu terminal:</p><p style="margin:0;background:${colors.text};color:${colors.page};font-family:monospace;font-size:14px;padding:14px 16px"><span style="color:${colors.action}">$</span>&nbsp; ${copy.command}</p></td></tr><tr><td style="border-top:1px solid ${colors.border};padding:24px 40px;color:${colors.muted};font-family:Arial,sans-serif;font-size:13px;line-height:1.5">Nos vemos en la cima.<br>El equipo de Hack the Andes</td></tr></table></td></tr></table></body></html>`;

  return { subject: copy.subject, text, html };
};

export const sendFunnelReminderEmail = async (
  input: SendFunnelReminderEmailInput,
): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const email = buildFunnelReminderEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": `funnel-reminder/${input.stage}/${input.clerkUserId}/${input.deliveryScope}`,
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
