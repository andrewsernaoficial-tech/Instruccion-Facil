import { Component, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
type Row = Record<string, any>;
@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./app.html",
})
export class AppComponent {
  page = signal("inicio");
  user = signal<Row | null>(null);
  catalog = signal<Row>({ services: [], instructors: [], settings: {} });
  bookings = signal<Row[]>([]);
  payments = signal<Row[]>([]);
  resources = signal<Row[]>([]);
  instructors = signal<Row[]>([]);
  audit = signal<Row[]>([]);
  settings: Row = {};
  form: Row = {};
  editId = "";
  busy = signal(false);
  message = signal("");
  error = signal("");
  online = signal(true);
  authMode = signal("");
  credentials: Row = { name: "", email: "", password: "", consent: false };
  slots = signal<Row[]>([]);
  selected = signal<Row | null>(null);
  query: Row = {
    serviceId: "",
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    ownVehicle: true,
    ownPlate: "",
    ownModel: "",
    ownTransmission: "Mecánica",
    policyAccepted: false,
  };
  receipt: Row | null = null;
  operation = "";
  file: File | null = null;
  isAdmin = computed(() => this.user()?.["role"] === "ADMIN");
  pending = computed(() =>
    this.payments().filter((p) => p["status"] === "Pendiente"),
  );
  income = computed(() =>
    this.payments()
      .filter((p) => p["status"] === "Aprobado")
      .reduce((a, p) => a + p["amount"], 0),
  );
  resourceKind: Record<string, string> = {
    clases: "services",
    instructores: "instructors",
    flota: "vehicles",
    horarios: "schedules",
  };
  titles: Record<string, string> = {
    resumen: "Vista general",
    clases: "Clases y tarifas",
    instructores: "Instructores",
    flota: "Nuestra flota",
    horarios: "Horarios de atención",
    pagos: "Validación de pagos",
    configuracion: "Configuración",
    reservas: "Agenda de clases",
    misclases: "Mis clases",
    reservar: "Reserva tu próxima clase",
    auditoria: "Historial de acciones",
  };
  days = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  constructor() {
    void this.init();
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.authMode.set("");
        this.receipt = null;
      }
    });
  }
  async api(url: string, options: RequestInit = {}) {
    const headers: Record<string, string> = { "X-App-Request": "1" };
    if (options.body && typeof options.body === "string")
      headers["Content-Type"] = "application/json";
    const res = await fetch("/api" + url, {
      ...options,
      headers: { ...headers, ...options.headers },
      credentials: "same-origin",
    });
    const data = await res
      .json()
      .catch(() => ({ message: "Respuesta no válida del servidor" }));
    if (!res.ok)
      throw Error(data.message || "No se pudo completar la solicitud");
    return data;
  }
  async act(fn: () => Promise<void>) {
    this.busy.set(true);
    this.error.set("");
    this.message.set("");
    try {
      await fn();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      this.busy.set(false);
    }
  }
  async init() {
    try {
      this.catalog.set(await this.api("/catalog"));
      this.online.set(true);
      try {
        this.user.set(await this.api("/auth/me"));
        await this.go(this.isAdmin() ? "resumen" : "misclases");
      } catch {}
    } catch {
      this.online.set(false);
    }
  }
  async go(page: string) {
    this.page.set(page);
    this.error.set("");
    this.message.set("");
    this.editId = "";
    this.form = {
      active: true,
      state: "Disponible",
      duration: 60,
      day: 1,
      start: "08:00",
      end: "18:00",
    };
    await this.act(async () => {
      if (["resumen", "reservas", "misclases"].includes(page))
        this.bookings.set(await this.api("/bookings"));
      if (["resumen", "pagos", "misclases"].includes(page))
        this.payments.set(await this.api("/payments"));
      const kind = this.resourceKind[page];
      if (kind) {
        this.resources.set(await this.api("/resources/" + kind));
        if (page === "horarios")
          this.instructors.set(await this.api("/resources/instructors"));
      }
      if (page === "configuracion") this.settings = await this.api("/settings");
      if (page === "auditoria") this.audit.set(await this.api("/audit"));
      if (page === "reservar") this.catalog.set(await this.api("/catalog"));
    });
  }
  home() {
    this.page.set("inicio");
    this.error.set("");
  }
  async authenticate() {
    await this.act(async () => {
      const path = this.authMode() === "registro" ? "register" : "login";
      this.user.set(
        await this.api("/auth/" + path, {
          method: "POST",
          body: JSON.stringify(this.credentials),
        }),
      );
      this.authMode.set("");
      this.credentials = { name: "", email: "", password: "", consent: false };
      await this.go(this.isAdmin() ? "resumen" : "misclases");
    });
  }
  async logout() {
    await this.act(async () => {
      await this.api("/auth/logout", { method: "POST" });
      this.user.set(null);
      this.page.set("inicio");
      this.bookings.set([]);
      this.payments.set([]);
    });
  }
  async saveResource() {
    await this.act(async () => {
      const kind = this.resourceKind[this.page()];
      await this.api(
        "/resources/" + kind + (this.editId ? "/" + this.editId : ""),
        {
          method: this.editId ? "PUT" : "POST",
          body: JSON.stringify(this.form),
        },
      );
      await this.go(this.page());
      this.catalog.set(await this.api("/catalog"));
      this.message.set("Cambios guardados correctamente.");
    });
  }
  edit(row: Row) {
    this.editId = row["id"];
    this.form = { ...row };
    document
      .getElementById("resource-form")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  async saveSettings() {
    await this.act(async () => {
      this.settings = await this.api("/settings", {
        method: "PUT",
        body: JSON.stringify(this.settings),
      });
      this.catalog.set(await this.api("/catalog"));
      this.message.set(
        "Configuración actualizada. Las reservas anteriores conservan sus condiciones.",
      );
    });
  }
  async findSlots() {
    this.selected.set(null);
    await this.act(async () => {
      const q = new URLSearchParams({
        date: this.query["date"],
        serviceId: this.query["serviceId"],
        ownVehicle: String(this.query["ownVehicle"]),
      });
      this.slots.set(await this.api("/availability?" + q));
    });
  }
  async reserve() {
    if (!this.user()) {
      this.authMode.set("registro");
      return;
    }
    await this.act(async () => {
      await this.api("/bookings", {
        method: "POST",
        body: JSON.stringify({ ...this.query, ...this.selected() }),
      });
      this.selected.set(null);
      await this.go("misclases");
      this.message.set(
        "Reserva creada. Adjunta tu comprobante antes de que venza el bloqueo.",
      );
    });
  }
  async cancel(row: Row) {
    const reason = window.prompt(
      "Motivo de cancelación. Se aplicarán las condiciones aceptadas en tu reserva.",
    );
    if (!reason) return;
    await this.act(async () => {
      await this.api("/bookings/" + row["id"] + "/cancel", {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await this.go(this.isAdmin() ? "reservas" : "misclases");
      this.message.set(
        "Cita cancelada. Si corresponde un ajuste de pago, el personal lo revisará.",
      );
    });
  }
  chooseFile(e: Event) {
    this.file = (e.target as HTMLInputElement).files?.[0] || null;
  }
  async upload() {
    const file = this.file;
    if (!file || !this.receipt) return;
    const id = this.receipt["id"];
    await this.act(async () => {
      if (file.size > 5 * 1024 * 1024)
        throw Error("El archivo debe pesar como máximo 5 MB");
      const result = await this.api("/bookings/" + id + "/receipt", {
        method: "POST",
        headers: { "Content-Type": file.type, "X-Operation": this.operation },
        body: file,
      });
      this.receipt = null;
      this.file = null;
      this.operation = "";
      await this.go("misclases");
      this.message.set(
        result.late
          ? "Comprobante recibido como incidencia. El personal revisará el pago tardío."
          : "Comprobante recibido. El personal verificará el pago.",
      );
    });
  }
  async validate(row: Row, approved: boolean) {
    const reason = approved ? "" : window.prompt("Motivo del rechazo");
    if (!approved && !reason) return;
    await this.act(async () => {
      await this.api("/payments/" + row["id"] + "/validate", {
        method: "POST",
        body: JSON.stringify({ approved, reason }),
      });
      await this.go("pagos");
      this.message.set(
        approved
          ? "Pago aprobado y cita confirmada."
          : "Pago rechazado con motivo registrado.",
      );
    });
  }
  money(value: number) {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
    }).format(value || 0);
  }
  date(value: string | number) {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(value));
  }
  time(value: string) {
    return new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Lima",
    }).format(new Date(value));
  }
  instructorName(id: string) {
    return (
      this.instructors().find((x) => x["id"] === id)?.["name"] || "Instructor"
    );
  }
  badge(status: string) {
    return status === "Confirmada" || status === "Aprobado"
      ? "success"
      : status === "Cancelada" || status === "Rechazado"
        ? "muted"
        : "warning";
  }
  whatsapp(text = "Hola, quisiera información sobre las clases de manejo.") {
    return (
      "https://wa.me/" +
      this.catalog()["settings"]["schoolPhone"] +
      "?text=" +
      encodeURIComponent(text)
    );
  }
}
