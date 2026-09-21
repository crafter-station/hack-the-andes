import type { CandidateFunnelStatus } from "./types";

interface WhatsAppMessageInput {
  readonly participantFirstName: string;
  readonly adminFirstName?: string;
  readonly funnelStatus: CandidateFunnelStatus;
  readonly attendanceCompleted: boolean;
}

const statusMessage = (
  funnelStatus: CandidateFunnelStatus,
  attendanceCompleted: boolean,
): string => {
  if (funnelStatus === "registration_started") {
    return "Veo que iniciaste el registro, pero aún no lo enviaste. Déjame saber si necesitas ayuda con algo. ¡Esperamos recibir tu postulación pronto!";
  }
  if (funnelStatus === "registration_completed") {
    return "Veo que completaste el registro, pero aún no iniciaste el challenge. Esperamos que puedas hacerlo pronto. Si tienes cualquier duda, aquí estoy.";
  }
  if (funnelStatus === "challenge_started") {
    return "Veo que iniciaste el challenge, pero aún no lo entregas. Esperamos que puedas hacerlo pronto. Si tienes cualquier duda, aquí estoy.";
  }
  if (funnelStatus === "challenge_completed") {
    return "Veo que completaste el challenge. Estamos revisando tu postulación y pronto tendrás noticias. Si tienes cualquier duda, aquí estoy.";
  }
  if (funnelStatus === "approved") {
    if (attendanceCompleted) {
      return "¡Tu participación en Hack the Andes está confirmada! Nos alegra mucho contar contigo. Si tienes cualquier duda sobre los siguientes pasos, aquí estoy.";
    }
    return "¡Tu postulación fue aprobada! Aún falta que completes tus datos de asistencia. Si necesitas ayuda con los siguientes pasos, aquí estoy.";
  }
  return "Quería agradecerte por completar el proceso de Hack the Andes. Si tienes cualquier duda sobre el resultado de tu postulación, aquí estoy.";
};

export const whatsappMessage = ({
  participantFirstName,
  adminFirstName,
  funnelStatus,
  attendanceCompleted,
}: WhatsAppMessageInput): string => {
  const participantName = participantFirstName.trim();
  let greeting = "Hola";
  if (participantName) greeting = `Hola ${participantName}`;
  let introduction = "soy parte del equipo de Hack the Andes";
  if (adminFirstName?.trim()) {
    introduction = `soy ${adminFirstName.trim()} de Hack the Andes`;
  }
  return `${greeting}, ${introduction}. ${statusMessage(funnelStatus, attendanceCompleted)}`;
};

const whatsappPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
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
