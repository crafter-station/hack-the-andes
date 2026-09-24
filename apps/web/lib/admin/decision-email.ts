import {
  button,
  command,
  emailShell,
  eyebrow,
  heading,
  note,
  paragraph,
} from "@/lib/emails/layout";

export type ApplicationDecision = "accepted" | "rejected";

export interface DecisionEmailInput {
  readonly decision: ApplicationDecision;
  readonly firstName: string;
  readonly message?: string;
}

export interface DecisionEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/**
 * Where an accepted participant is sent next.
 *
 * Confirming attendance is the one thing this email exists to get done,
 * so it is the button as well as the command — the terminal is how this
 * event expects to be talked to, but somebody reading on a phone at a bus
 * stop needs somewhere to tap.
 */
const CONFIRM_URL =
  "https://hacktheandes.com/welcome?utm_source=resend&utm_medium=email&utm_campaign=decision&utm_content=confirm";

const APPLY_URL =
  "https://hacktheandes.com/?utm_source=resend&utm_medium=email&utm_campaign=decision&utm_content=reapply#apply";

const decisionCopy = (decision: ApplicationDecision) => {
  if (decision === "accepted") {
    return {
      subject: "Estás dentro — bienvenida a Hack the Andes",
      preheader:
        "Tu postulación fue aprobada. Confirma tu asistencia para asegurar tu lugar.",
      eyebrow: "POSTULACIÓN APROBADA",
      heading: "Estás dentro.",
      introduction:
        "Nos alegra ofrecerte un lugar en Hack the Andes, en Lima, el 17 y 18 de octubre.",
      body: "Falta un paso: confirmar tu asistencia. Ahí nos dices tu talla, tu contacto de emergencia y con qué foto quieres que salga tu carnet. En cuanto lo hagas, te preparamos el carnet y te lo mandamos.",
      action: "Confirmar mi asistencia",
      url: CONFIRM_URL,
      commandLabel: "O desde tu terminal:",
      command: "chofex confirm",
    };
  }

  return {
    subject: "Una actualización sobre tu postulación",
    preheader: "Gracias por postular a Hack the Andes.",
    eyebrow: "ACTUALIZACIÓN DE POSTULACIÓN",
    heading: "Gracias por postular.",
    introduction:
      "Después de revisarla con cuidado, esta vez no podemos ofrecerte un lugar en Hack the Andes.",
    body: "Valoramos el tiempo y el trabajo que le pusiste. Puedes volver a postular con una nueva postulación cuando quieras.",
    action: "Volver a postular",
    url: APPLY_URL,
    commandLabel: "O desde tu terminal:",
    command: "chofex register",
  };
};

export const buildDecisionEmail = ({
  decision,
  firstName,
  message,
}: DecisionEmailInput): DecisionEmail => {
  const copy = decisionCopy(decision);
  const name = firstName.trim();
  const greeting = name ? `Hola ${name},` : "Hola,";

  const text = [
    greeting,
    "",
    copy.introduction,
    "",
    copy.body,
    "",
    `${copy.action}: ${copy.url}`,
    `${copy.commandLabel} ${copy.command}`,
    ...(message ? ["", "Una nota del equipo de revisión:", message] : []),
    "",
    "Nos vemos en la cima.",
    "— El equipo de Hack the Andes",
  ].join("\n");

  const html = emailShell({
    subject: copy.subject,
    preheader: copy.preheader,
    // Nothing more specific to stamp on a card nobody has yet.
    stamp: "17–18 OCT 2026",
    blocks: [
      eyebrow(copy.eyebrow),
      heading(copy.heading),
      paragraph(greeting),
      paragraph(copy.introduction),
      paragraph(copy.body),
      button(copy.action, copy.url),
      command(copy.commandLabel, copy.command),
      ...(message ? [note("Una nota del equipo de revisión", message)] : []),
    ],
  });

  return { subject: copy.subject, text, html };
};
