import { expect, test } from "bun:test";

import { whatsappMessage, whatsappUrl } from "./whatsapp";

const messageFor = (
  funnelStatus:
    | "registration_started"
    | "registration_completed"
    | "challenge_started"
    | "challenge_completed"
    | "approved"
    | "declined",
  attendanceCompleted = false,
) =>
  whatsappMessage({
    participantFirstName: "María",
    adminFirstName: "Anthony",
    funnelStatus,
    attendanceCompleted,
  });

test("personalizes unfinished registration and challenge reminders", () => {
  expect(messageFor("registration_started")).toBe(
    "Hola María, soy Anthony de Hack the Andes. Veo que iniciaste el registro, pero aún no lo enviaste. Déjame saber si necesitas ayuda con algo. ¡Esperamos recibir tu postulación pronto!",
  );
  expect(messageFor("registration_completed")).toContain(
    "aún no iniciaste el challenge",
  );
  expect(messageFor("challenge_started")).toContain(
    "iniciaste el challenge, pero aún no lo entregas",
  );
});

test("uses status-aware follow-ups for completed applications", () => {
  expect(messageFor("challenge_completed")).toContain(
    "Estamos revisando tu postulación",
  );
  expect(messageFor("approved")).toContain(
    "falta que completes tus datos de asistencia",
  );
  expect(messageFor("approved", true)).toContain(
    "participación en Hack the Andes está confirmada",
  );
  expect(messageFor("declined")).toContain("resultado de tu postulación");
});

test("falls back to the team when the admin name is unavailable", () => {
  expect(
    whatsappMessage({
      participantFirstName: "María",
      funnelStatus: "challenge_started",
      attendanceCompleted: false,
    }),
  ).toStartWith("Hola María, soy parte del equipo de Hack the Andes.");
});

test("uses a natural greeting when the participant name is unavailable", () => {
  expect(
    whatsappMessage({
      participantFirstName: " ",
      adminFirstName: "Anthony",
      funnelStatus: "registration_started",
      attendanceCompleted: false,
    }),
  ).toStartWith("Hola, soy Anthony de Hack the Andes.");
});

test("builds a wa.me URL with a normalized international number", () => {
  const message = messageFor("challenge_started");
  expect(whatsappUrl("+51 999 888 777", message)).toBe(
    `https://wa.me/51999888777?text=${encodeURIComponent(message)}`,
  );
  expect(whatsappUrl("0051 999 888 777", message)).toStartWith(
    "https://wa.me/51999888777?text=",
  );
});

test("does not build a link without a usable phone number", () => {
  expect(whatsappUrl(undefined, "Hola")).toBeUndefined();
  expect(whatsappUrl("+ ( )", "Hola")).toBeUndefined();
});
