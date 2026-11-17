import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../src/store.mjs";
import { bookingService } from "../src/service.mjs";
import { defaults, overlaps, validSettings } from "../src/domain.mjs";
function fixture() {
  let time = Date.parse("2026-11-20T08:00:00-05:00");
  const store = openStore(":memory:");
  const { db } = store;
  const add = (id, kind, data) =>
    db
      .prepare("INSERT INTO resources VALUES(?,?,?)")
      .run(id, kind, JSON.stringify(data));
  const cfg = {
    ...defaults,
    yapeEnabled: true,
    yapeNumber: "999888777",
    yapeHolder: "Escuela de prueba",
  };
  db.prepare("UPDATE settings SET data=?").run(JSON.stringify(cfg));
  db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
    "u",
    "alumno@example.test",
    "Alumno",
    "hash",
    "CLIENT",
  );
  db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
    "v",
    "otro@example.test",
    "Otro",
    "hash",
    "CLIENT",
  );
  add("s", "services", {
    active: true,
    name: "Clase",
    duration: 60,
    price: 80,
  });
  add("i", "instructors", { active: true, name: "Instructor", license: "123" });
  add("j", "instructors", { active: true, name: "Segundo", license: "456" });
  add("v1", "vehicles", {
    active: true,
    model: "Auto",
    plate: "AAA111",
    state: "Disponible",
  });
  for (const id of ["i", "j"])
    add("h" + id, "schedules", {
      active: true,
      instructorId: id,
      day: 5,
      start: "08:00",
      end: "20:00",
    });
  const service = bookingService(store, () => time);
  const user = { id: "u", name: "Alumno", role: "CLIENT" };
  const input = {
    serviceId: "s",
    instructorId: "i",
    start: "2026-11-20T15:00:00.000Z",
    ownVehicle: false,
    policyAccepted: true,
  };
  return {
    store,
    service,
    user,
    input,
    advance: (minutes) => (time += minutes * 60000),
  };
}
test("dos reservas del mismo instructor: una sola gana", () => {
  const f = fixture();
  f.service.reserve(f.user, f.input);
  assert.throws(() => f.service.reserve(f.user, f.input), /no disponible/);
  assert.equal(f.service.list(f.user).length, 1);
});
test("flota compartida no se asigna a dos instructores a la misma hora", () => {
  const f = fixture();
  f.service.reserve(f.user, f.input);
  assert.throws(
    () => f.service.reserve(f.user, { ...f.input, instructorId: "j" }),
    /no disponible/,
  );
});
test("intervalos contiguos sí se permiten", () => {
  const f = fixture();
  f.service.reserve(f.user, f.input);
  f.service.reserve(f.user, { ...f.input, start: "2026-11-20T16:00:00.000Z" });
  assert.equal(f.service.list(f.user).length, 2);
  assert.equal(overlaps(1, 2, 2, 3), false);
});
test("vehículo propio permite compartir flota sin ocuparla", () => {
  const f = fixture();
  f.service.reserve(f.user, f.input);
  const b = f.service.reserve(f.user, {
    ...f.input,
    instructorId: "j",
    ownVehicle: true,
    ownPlate: "BBB222",
    ownModel: "Modelo",
    ownTransmission: "Mecánica",
  });
  assert.equal(b.vehicleId, null);
});
test("reserva vencida libera recursos", () => {
  const f = fixture();
  const b = f.service.reserve(f.user, f.input);
  f.advance(31);
  assert.equal(f.service.get(b.id, f.user).status, "Cancelada");
  assert.doesNotThrow(() =>
    f.service.reserve(f.user, {
      ...f.input,
      start: "2026-11-20T17:00:00.000Z",
    }),
  );
});
test("un comprobante prorroga solo una vez y no confirma", () => {
  const f = fixture();
  const b = f.service.reserve(f.user, f.input);
  f.service.submitReceipt(b.id, f.user, {
    operation: "OP001",
    file: "one",
    mime: "image/png",
  });
  const once = f.service.get(b.id, f.user);
  assert.equal(Date.parse(once.expires) - Date.parse(b.expires), 60 * 60000);
  f.service.submitReceipt(b.id, f.user, {
    operation: "OP002",
    file: "two",
    mime: "image/png",
  });
  assert.equal(f.service.get(b.id, f.user).expires, once.expires);
  assert.equal(once.status, "Pendiente de Pago");
});
test("pago aprobado confirma, aprobación repetida es idempotente", () => {
  const f = fixture();
  const b = f.service.reserve(f.user, f.input);
  const p = f.service.submitReceipt(b.id, f.user, {
    operation: "OP001",
    file: "x",
    mime: "image/png",
  });
  const admin = { id: "admin", role: "ADMIN" };
  f.service.validatePayment(p.id, admin, true);
  f.service.validatePayment(p.id, admin, true);
  assert.equal(f.service.get(b.id, f.user).status, "Confirmada");
});
test("vencimiento antes de aprobación no confirma ni reocupa", () => {
  const f = fixture();
  const b = f.service.reserve(f.user, f.input);
  const p = f.service.submitReceipt(b.id, f.user, {
    operation: "OP001",
    file: "x",
    mime: "image/png",
  });
  f.advance(91);
  assert.throws(
    () => f.service.validatePayment(p.id, { id: "admin", role: "ADMIN" }, true),
    /vencida/,
  );
  assert.equal(f.service.get(b.id, f.user).status, "Cancelada");
});
test("no se permite comprobante de otro alumno ni aprobación sin permiso", () => {
  const f = fixture();
  const b = f.service.reserve(f.user, f.input);
  assert.throws(
    () => f.service.get(b.id, { id: "v", role: "CLIENT" }),
    /permiso/,
  );
  const p = f.service.submitReceipt(b.id, f.user, {
    operation: "OP001",
    file: "x",
    mime: "image/png",
  });
  assert.throws(() => f.service.validatePayment(p.id, f.user, true), /permiso/);
});
test("comprobante tardío se conserva como incidencia", () => {
  const f = fixture();
  const b = f.service.reserve(f.user, f.input);
  f.advance(31);
  const p = f.service.submitReceipt(b.id, f.user, {
    operation: "OP001",
    file: "x",
    mime: "image/png",
  });
  assert.equal(p.late, true);
  assert.equal(f.service.get(b.id, f.user).status, "Cancelada");
});
test("cancelar libera horario, conserva condiciones e informa ajuste", () => {
  const f = fixture();
  const b = f.service.reserve(f.user, f.input);
  f.service.cancel(b.id, f.user, "Cambio de planes");
  assert.equal(f.service.get(b.id, f.user).cancelReason, "Cambio de planes");
  assert.doesNotThrow(() => f.service.reserve(f.user, f.input));
});
test("no se reserva sin medio de cobro ni aceptación de políticas", () => {
  const f = fixture();
  assert.throws(
    () => f.service.reserve(f.user, { ...f.input, policyAccepted: false }),
    /políticas/,
  );
  f.store.db
    .prepare("UPDATE settings SET data=?")
    .run(JSON.stringify(defaults));
  assert.throws(() => f.service.reserve(f.user, f.input), /medio de cobro/);
});
test("servicio mantiene tarifa histórica después de edición", () => {
  const f = fixture();
  const b = f.service.reserve(f.user, f.input);
  f.store.db
    .prepare("UPDATE resources SET data=? WHERE id=?")
    .run(
      JSON.stringify({ active: true, name: "Clase", duration: 60, price: 120 }),
      "s",
    );
  assert.equal(f.service.get(b.id, f.user).price, 80);
});
test("configuración rechaza valores incoherentes", () => {
  assert.throws(() => validSettings({ ...defaults, holdMinutes: -1 }), /Plazo/);
  assert.throws(
    () => validSettings({ ...defaults, yapeEnabled: true }),
    /Yape/,
  );
});
