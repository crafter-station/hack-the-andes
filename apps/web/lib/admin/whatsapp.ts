import type { CandidateFunnelStatus } from "./types";

interface WhatsAppMessageInput {
  readonly participantFirstName: string;
  readonly adminFirstName?: string;
  readonly funnelStatus: CandidateFunnelStatus;
  readonly attendanceCompleted: boolean;
}

const funnelStatusMessages: Record<
  Exclude<CandidateFunnelStatus, "approved">,
  string
> = {
  registration_started:
    "Veo que iniciaste el registro, pero aún no lo enviaste. Déjame saber si necesitas ayuda con algo. ¡Esperamos recibir tu postulación pronto!",
  registration_completed:
    "Veo que completaste el registro, pero aún no iniciaste el challenge. Esperamos que puedas hacerlo pronto. Si tienes cualquier duda, aquí estoy.",
  challenge_started:
    "Veo que iniciaste el challenge, pero aún no lo entregas. Esperamos que puedas hacerlo pronto. Si tienes cualquier duda, aquí estoy.",
  challenge_completed:
    "Veo que completaste el challenge. Estamos revisando tu postulación y pronto tendrás noticias. Si tienes cualquier duda, aquí estoy.",
  declined:
    "Quería agradecerte por completar el proceso de Hack the Andes. Si tienes cualquier duda sobre el resultado de tu postulación, aquí estoy.",
};

const statusMessage = (
  funnelStatus: CandidateFunnelStatus,
  attendanceCompleted: boolean,
): string => {
  if (funnelStatus === "approved") {
    if (attendanceCompleted) {
      return "¡Tu participación en Hack the Andes está confirmada! Nos alegra mucho contar contigo. Si tienes cualquier duda sobre los siguientes pasos, aquí estoy.";
    }
    return "¡Tu postulación fue aprobada! Aún falta que completes tus datos de asistencia. Si necesitas ayuda con los siguientes pasos, aquí estoy.";
  }
  return funnelStatusMessages[funnelStatus];
};

export const whatsappMessage = ({
  participantFirstName,
  adminFirstName,
  funnelStatus,
  attendanceCompleted,
}: WhatsAppMessageInput): string => {
  let participantName = participantFirstName.trim();
  if (participantName === "Unknown") participantName = "";
  let greeting = "Hola";
  if (participantName) greeting = `Hola ${participantName}`;
  let introduction = "soy parte del equipo de Hack the Andes";
  if (adminFirstName?.trim()) {
    introduction = `soy ${adminFirstName.trim()} de Hack the Andes`;
  }
  return `${greeting}, ${introduction}. ${statusMessage(funnelStatus, attendanceCompleted)}`;
};

const whatsappPhone = (phone: string): string | undefined => {
  const trimmedPhone = phone.trim();
  let internationalPhone: string;
  if (trimmedPhone.startsWith("+")) {
    internationalPhone = trimmedPhone.slice(1);
  } else if (trimmedPhone.startsWith("00")) {
    internationalPhone = trimmedPhone.slice(2);
  } else {
    return undefined;
  }
  if (/[^\d\s().-]/.test(internationalPhone)) return undefined;

  const digits = internationalPhone.replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(digits) || digits.startsWith("0")) return undefined;
  return digits;
};

export const whatsappUrl = (
  phone: string | undefined,
  message: string,
): string | undefined => {
  if (!phone) return undefined;
  const normalizedPhone = whatsappPhone(phone);
  if (!normalizedPhone) return undefined;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
};
