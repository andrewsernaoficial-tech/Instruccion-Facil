import { randomUUID } from "node:crypto";
import {
  requireValue,
  AppError,
  activeStatuses,
  peruParts,
  clock,
} from "./domain.mjs";
export function bookingService(store, now = () => Date.now()) {
  const { db, tx } = store;
  const row = (id) => db.prepare("SELECT * FROM bookings WHERE id=?").get(id);
  const unpack = (b) => ({
    ...JSON.parse(b.data),
    id: b.id,
    clientId: b.user_id,
    instructorId: b.instructor_id,
    vehicleId: b.vehicle_id,
    start: new Date(b.start).toISOString(),
    end: new Date(b.end).toISOString(),
    status: b.status,
    expires: new Date(b.expires).toISOString(),
  });
  function expire() {
    const expired = db
      .prepare(
        "SELECT id FROM bookings WHERE status='Pendiente de Pago' AND expires<=?",
      )
      .all(now());
    for (const b of expired) {
      db.prepare(
        "UPDATE bookings SET status='Cancelada',data=json_set(data,'$.cancelReason','VENCIMIENTO') WHERE id=? AND status='Pendiente de Pago'",
      ).run(b.id);
      store.audit("SYSTEM", "ReservaVencida", { id: b.id });
    }
  }
  function eligible(instructorId, start, end) {
    const ins = store.resource(instructorId);
    if (!ins || ins.kind !== "instructors" || !ins.active) return false;
    const a = peruParts(start),
      b = peruParts(end);
    return (
      a.date === b.date &&
      store
        .resources("schedules")
        .some(
          (s) =>
            s.active &&
            s.instructorId === instructorId &&
            s.day === a.day &&
            clock(s.start) <= a.minutes &&
            clock(s.end) >= b.minutes,
        )
    );
  }
  function free(instructorId, vehicleId, start, end, exclude = "") {
    expire();
    return !db
      .prepare(
        "SELECT id FROM bookings WHERE id<>? AND status IN ('Pendiente de Pago','Confirmada','En curso') AND start<? AND end>? AND (instructor_id=? OR (? IS NOT NULL AND vehicle_id=?))",
      )
      .get(exclude, end, start, instructorId, vehicleId, vehicleId);
  }
  function availability({ date, serviceId, instructorId, ownVehicle = true }) {
    requireValue(/^\d{4}-\d{2}-\d{2}$/.test(date), "Fecha inválida");
    const svc = store.resource(serviceId);
    requireValue(
      svc?.kind === "services" && svc.active,
      "Selecciona una clase activa",
    );
    const instructors = store
      .resources("instructors")
      .filter((i) => i.active && (!instructorId || i.id === instructorId));
    const slots = [];
    const base = Date.parse(date + "T00:00:00-05:00");
    requireValue(Number.isFinite(base), "Fecha inválida");
    const settings = store.settings();
    for (const i of instructors)
      for (let minute = 0; minute + svc.duration <= 1440; minute += 30) {
        const start = base + minute * 60000,
          end = start + svc.duration * 60000;
        if (
          start < now() + settings.minBookingHours * 3600000 ||
          !eligible(i.id, start, end)
        )
          continue;
        let vehicle = null;
        if (!ownVehicle) {
          vehicle = store
            .resources("vehicles")
            .find(
              (v) =>
                v.active &&
                v.state === "Disponible" &&
                free(i.id, v.id, start, end),
            );
          if (!vehicle) continue;
        }
        if (free(i.id, vehicle?.id || null, start, end))
          slots.push({
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            instructorId: i.id,
            instructorName: i.name,
            vehicleId: vehicle?.id || null,
          });
      }
    return slots;
  }
  function reserve(user, input) {
    return tx(() => {
      const cfg = store.settings();
      requireValue(
        cfg.yapeEnabled && cfg.yapeNumber && cfg.yapeHolder,
        "El administrador debe configurar un medio de cobro",
      );
      requireValue(
        input.policyAccepted === true,
        "Acepta las políticas de reserva",
      );
      const start = Date.parse(input.start);
      requireValue(Number.isFinite(start), "Hora inválida");
      const date = peruParts(start).date;
      const slot = availability({
        date,
        serviceId: input.serviceId,
        instructorId: input.instructorId,
        ownVehicle: input.ownVehicle === true,
      }).find((s) => s.start === new Date(start).toISOString());
      requireValue(slot, "Horario no disponible", 409);
      if (input.ownVehicle)
        requireValue(
          input.ownPlate?.trim() &&
            input.ownModel?.trim() &&
            input.ownTransmission,
          "Completa los datos del vehículo propio",
        );
      const svc = store.resource(input.serviceId);
      const id = randomUUID(),
        expires = now() + cfg.holdMinutes * 60000;
      const data = {
        serviceId: svc.id,
        serviceName: svc.name,
        price: svc.price,
        duration: svc.duration,
        ownVehicle: !!input.ownVehicle,
        ownPlate: input.ownPlate || "",
        ownModel: input.ownModel || "",
        ownTransmission: input.ownTransmission || "",
        clientName: user.name,
        policy: cfg,
        reviewExtended: false,
        paymentInstructions: { number: cfg.yapeNumber, holder: cfg.yapeHolder },
        createdAt: new Date(now()).toISOString(),
      };
      db.prepare("INSERT INTO bookings VALUES(?,?,?,?,?,?,?,?,?)").run(
        id,
        user.id,
        slot.instructorId,
        slot.vehicleId,
        start,
        Date.parse(slot.end),
        "Pendiente de Pago",
        expires,
        JSON.stringify(data),
      );
      store.audit(user.id, "CitaReservada", { id });
      return unpack(row(id));
    });
  }
  function get(id, user) {
    expire();
    const b = row(id);
    requireValue(b, "Cita no encontrada", 404);
    requireValue(
      user.role === "ADMIN" || b.user_id === user.id,
      "Sin permiso",
      403,
    );
    return unpack(b);
  }
  function list(user) {
    expire();
    return (
      user.role === "ADMIN"
        ? db.prepare("SELECT * FROM bookings ORDER BY start DESC").all()
        : db
            .prepare(
              "SELECT * FROM bookings WHERE user_id=? ORDER BY start DESC",
            )
            .all(user.id)
    ).map(unpack);
  }
  function submitReceipt(id, user, { operation, file, mime }) {
    return tx(() => {
      const b = get(id, user);
      requireValue(
        operation?.trim().length >= 4 && operation.length <= 100,
        "Número de operación inválido",
      );
      const late = b.status !== "Pendiente de Pago";
      requireValue(
        ["Pendiente de Pago", "Cancelada"].includes(b.status),
        "Esta cita no recibe comprobantes",
      );
      const duplicated = db
        .prepare("SELECT id FROM payments WHERE operation=? AND status<>?")
        .get(operation.trim(), "Rechazado");
      requireValue(
        !duplicated,
        "Operación ya registrada: requiere revisión del administrador",
        409,
      );
      const paymentId = randomUUID();
      db.prepare("INSERT INTO payments VALUES(?,?,?,?,?)").run(
        paymentId,
        id,
        "Pendiente",
        operation.trim(),
        JSON.stringify({
          file,
          mime,
          amount: b.price,
          clientName: user.name,
          late,
          createdAt: new Date(now()).toISOString(),
          receiver: b.paymentInstructions,
        }),
      );
      if (!late && !b.reviewExtended) {
        const expires = Math.min(
          Date.parse(b.expires) + b.policy.reviewMinutes * 60000,
          Date.parse(b.start),
        );
        const raw = JSON.parse(row(id).data);
        raw.reviewExtended = true;
        db.prepare("UPDATE bookings SET expires=?,data=? WHERE id=?").run(
          expires,
          JSON.stringify(raw),
          id,
        );
      }
      store.audit(user.id, "ComprobanteCargado", { id, paymentId, late });
      return { id: paymentId, late };
    });
  }
  function validatePayment(id, user, approved, reason) {
    requireValue(user.role === "ADMIN", "Sin permiso", 403);
    return tx(() => {
      expire();
      const p = db.prepare("SELECT * FROM payments WHERE id=?").get(id);
      requireValue(p, "Pago no encontrado", 404);
      if (p.status !== "Pendiente") {
        requireValue(
          p.status === (approved ? "Aprobado" : "Rechazado"),
          "Pago ya revisado",
          409,
        );
        return { status: p.status };
      }
      const b = row(p.booking_id);
      if (approved)
        requireValue(
          b.status === "Pendiente de Pago" && b.expires > now(),
          "Reserva vencida: gestionar incidencia de pago; no confirmar otro horario",
          409,
        );
      else requireValue(reason?.trim(), "Indica motivo del rechazo");
      const data = {
        ...JSON.parse(p.data),
        reviewer: user.id,
        reason: reason || "",
        reviewedAt: new Date(now()).toISOString(),
      };
      db.prepare("UPDATE payments SET status=?,data=? WHERE id=?").run(
        approved ? "Aprobado" : "Rechazado",
        JSON.stringify(data),
        id,
      );
      if (approved)
        db.prepare("UPDATE bookings SET status='Confirmada' WHERE id=?").run(
          b.id,
        );
      store.audit(user.id, approved ? "PagoAprobado" : "PagoRechazado", {
        paymentId: id,
        bookingId: b.id,
      });
      return { status: approved ? "Aprobado" : "Rechazado" };
    });
  }
  function cancel(id, user, reason) {
    return tx(() => {
      const b = get(id, user);
      requireValue(reason?.trim(), "Indica el motivo");
      requireValue(
        ["Pendiente de Pago", "Confirmada"].includes(b.status),
        "No se puede cancelar este estado",
        409,
      );
      const raw = JSON.parse(row(id).data);
      raw.cancelReason = reason;
      raw.adjustmentRequested =
        b.status === "Confirmada"
          ? Date.parse(b.start) - now() >= b.policy.cancelHours * 3600000
            ? "Devolución o saldo a elección del cliente"
            : "Revisión manual sin pérdida automática"
          : null;
      db.prepare(
        "UPDATE bookings SET status='Cancelada',data=? WHERE id=?",
      ).run(JSON.stringify(raw), id);
      store.audit(user.id, "CitaCancelada", { id, reason });
      return unpack(row(id));
    });
  }
  return {
    availability,
    reserve,
    get,
    list,
    submitReceipt,
    validatePayment,
    cancel,
    expire,
  };
}
