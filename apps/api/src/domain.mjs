export class AppError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}
export function requireValue(test, message, status = 422) {
  if (!test) throw new AppError(message, status);
}
export const defaults = {
  version: 1,
  holdMinutes: 30,
  reviewMinutes: 60,
  minBookingHours: 2,
  rescheduleHours: 24,
  cancelHours: 24,
  arrivalMinutes: 15,
  schoolPhone: "",
  yapeNumber: "",
  yapeHolder: "",
  yapeEnabled: false,
  reminderHours: [24, 2],
};
export const activeStatuses = ["Pendiente de Pago", "Confirmada", "En curso"];
export function overlaps(a, b, c, d) {
  return a < d && c < b;
}
export function peruParts(value) {
  const d = new Date(new Date(value).getTime() - 5 * 3600000);
  return {
    date: d.toISOString().slice(0, 10),
    day: d.getUTCDay(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}
export function clock(value) {
  requireValue(/^\d{2}:\d{2}$/.test(value), "Hora inválida");
  const [h, m] = value.split(":").map(Number);
  requireValue(h < 24 && m < 60, "Hora inválida");
  return h * 60 + m;
}
export function validSettings(input) {
  const out = { ...defaults, ...input };
  for (const key of [
    "holdMinutes",
    "reviewMinutes",
    "minBookingHours",
    "rescheduleHours",
    "cancelHours",
    "arrivalMinutes",
  ])
    requireValue(
      Number.isFinite(out[key]) && out[key] > 0 && out[key] <= 1440,
      "Plazo inválido: " + key,
    );
  requireValue(
    !out.yapeEnabled ||
      (/^9\d{8}$/.test(out.yapeNumber) && out.yapeHolder.trim().length > 2),
    "Configura un número Yape válido y su titular",
  );
  requireValue(
    !out.schoolPhone || /^51\d{9}$/.test(out.schoolPhone),
    "WhatsApp: usa 51 seguido de 9 dígitos",
  );
  return out;
}
export function validateResource(kind, data) {
  requireValue(data && typeof data === "object", "Datos inválidos");
  const d = { ...data };
  d.active = Boolean(d.active);
  if (kind === "services") {
    requireValue(d.name?.trim().length >= 3, "Nombre de clase obligatorio");
    requireValue(
      Number.isInteger(d.duration) && d.duration >= 15 && d.duration <= 480,
      "Duración: 15 a 480 minutos",
    );
    requireValue(
      Number.isFinite(d.price) && d.price > 0 && d.price <= 100000,
      "Precio inválido",
    );
  }
  if (kind === "instructors")
    requireValue(
      d.name?.trim() && d.license?.trim(),
      "Nombre y licencia obligatorios",
    );
  if (kind === "vehicles") {
    requireValue(
      d.plate?.trim() && d.model?.trim(),
      "Placa y modelo obligatorios",
    );
    requireValue(
      ["Disponible", "En mantenimiento", "Inactivo"].includes(d.state),
      "Estado inválido",
    );
  }
  if (kind === "schedules") {
    requireValue(
      d.instructorId && Number.isInteger(d.day) && d.day >= 0 && d.day <= 6,
      "Instructor y día obligatorios",
    );
    requireValue(
      clock(d.start) < clock(d.end),
      "La jornada debe terminar después de iniciar",
    );
  }
  return d;
}
