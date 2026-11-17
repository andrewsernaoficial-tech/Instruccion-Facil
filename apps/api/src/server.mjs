import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStore } from "./store.mjs";
import { bookingService } from "./service.mjs";
import { requireValue, validSettings, validateResource } from "./domain.mjs";
export function createApp(store = openStore()) {
  const app = express(),
    { db } = store,
    service = bookingService(store);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use("/api", rateLimit({ windowMs: 60000, limit: 180 }));
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const allowed = process.env.APP_ORIGIN || "http://localhost:4200";
      requireValue(
        !req.headers.origin || req.headers.origin === allowed,
        "Origen no permitido",
        403,
      );
      requireValue(
        req.headers["x-app-request"] === "1",
        "Solicitud inválida",
        403,
      );
    }
    next();
  });
  app.use(express.json({ limit: "128kb" }));
  const digest = (s) => createHash("sha256").update(s).digest("hex");
  const clean = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  });
  const session = (res, user) => {
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      digest(token),
      user.id,
      Date.now() + 8 * 3600000,
    );
    res.cookie("if_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 3600000,
      path: "/",
    });
  };
  app.use("/api", (req, res, next) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("if_session="))
      ?.slice(11);
    if (token) {
      const s = db
        .prepare("SELECT user_id FROM sessions WHERE token=? AND expires>?")
        .get(digest(token), Date.now());
      if (s)
        req.user = db.prepare("SELECT * FROM users WHERE id=?").get(s.user_id);
    }
    next();
  });
  const auth = (req, res, next) => {
      requireValue(req.user, "Inicia sesión para continuar", 401);
      next();
    },
    admin = (req, res, next) => {
      requireValue(
        req.user?.role === "ADMIN",
        "Se requiere administrador",
        403,
      );
      next();
    };
  const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 20 });
  app.get("/api/health", (req, res) =>
    res.json({
      status: "ok",
      database: "development-sqlite",
      awsConnected: false,
      whatsappApi: false,
    }),
  );
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const { name, email, password, consent } = req.body;
    requireValue(
      typeof name === "string" && name.trim().length >= 3,
      "Nombre obligatorio",
    );
    requireValue(
      typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      "Correo inválido",
    );
    requireValue(
      typeof password === "string" &&
        password.length >= 10 &&
        password.length <= 72,
      "Contraseña de 10 a 72 caracteres",
    );
    requireValue(consent === true, "Acepta el tratamiento de datos");
    const normalized = email.trim().toLowerCase();
    requireValue(
      !db.prepare("SELECT id FROM users WHERE email=?").get(normalized),
      "Correo ya registrado",
      409,
    );
    const user = {
      id: randomUUID(),
      name: name.trim(),
      email: normalized,
      role: "CLIENT",
    };
    const hash = await bcrypt.hash(password, 12);
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
      user.id,
      user.email,
      user.name,
      hash,
      user.role,
    );
    store.audit(user.id, "UsuarioRegistrado");
    session(res, user);
    res.status(201).json(clean(user));
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const u =
      typeof req.body.email === "string"
        ? db
            .prepare("SELECT * FROM users WHERE email=?")
            .get(req.body.email.trim().toLowerCase())
        : null;
    requireValue(
      typeof req.body.password === "string" &&
        u &&
        (await bcrypt.compare(req.body.password, u.password)),
      "Credenciales incorrectas",
      401,
    );
    session(res, u);
    res.json(clean(u));
  });
  app.get("/api/auth/me", auth, (req, res) => res.json(clean(req.user)));
  app.post("/api/auth/logout", (req, res) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("if_session="))
      ?.slice(11);
    if (token)
      db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
    res.clearCookie("if_session");
    res.json({ ok: true });
  });
  app.get("/api/catalog", (req, res) =>
    res.json({
      services: store.resources("services").filter((x) => x.active),
      instructors: store
        .resources("instructors")
        .filter((x) => x.active)
        .map(({ id, name }) => ({ id, name })),
      settings: {
        ...store.settings(),
        yapeNumber: undefined,
        yapeHolder: undefined,
      },
    }),
  );
  app.get("/api/availability", (req, res) =>
    res.json(
      service.availability({
        ...req.query,
        ownVehicle: req.query.ownVehicle === "true",
      }),
    ),
  );
  app.get("/api/settings", auth, admin, (req, res) =>
    res.json(store.settings()),
  );
  app.put("/api/settings", auth, admin, (req, res) => {
    const cfg = validSettings(req.body);
    cfg.version = store.settings().version + 1;
    store.tx(() => {
      db.prepare("UPDATE settings SET data=? WHERE id=1").run(
        JSON.stringify(cfg),
      );
      store.audit(req.user.id, "ConfiguracionActualizada", {
        version: cfg.version,
      });
    });
    res.json(cfg);
  });
  const kinds = ["services", "instructors", "vehicles", "schedules"];
  app.get("/api/resources/:kind", auth, admin, (req, res) => {
    requireValue(kinds.includes(req.params.kind), "Recurso inválido");
    res.json(store.resources(req.params.kind));
  });
  app.post("/api/resources/:kind", auth, admin, (req, res) => {
    const kind = req.params.kind;
    requireValue(kinds.includes(kind), "Recurso inválido");
    const data = validateResource(kind, req.body),
      id = randomUUID();
    if (kind === "schedules")
      requireValue(
        store.resource(data.instructorId)?.kind === "instructors",
        "Instructor inválido",
      );
    store.tx(() => {
      db.prepare("INSERT INTO resources VALUES(?,?,?)").run(
        id,
        kind,
        JSON.stringify(data),
      );
      store.audit(req.user.id, "RecursoCreado", { id, kind });
    });
    res.status(201).json({ id, ...data });
  });
  app.put("/api/resources/:kind/:id", auth, admin, (req, res) => {
    const kind = req.params.kind,
      id = req.params.id;
    requireValue(
      kinds.includes(kind) && store.resource(id)?.kind === kind,
      "Recurso no encontrado",
      404,
    );
    const data = validateResource(kind, req.body);
    service.expire();
    if (["instructors", "vehicles", "schedules"].includes(kind)) {
      const target =
        kind === "schedules" ? store.resource(id).instructorId : id;
      const has = db
        .prepare(
          "SELECT id FROM bookings WHERE status IN ('Pendiente de Pago','Confirmada','En curso') AND end>? AND (instructor_id=? OR vehicle_id=?)",
        )
        .get(Date.now(), target, target);
      requireValue(
        !has,
        "Resuelve las citas vigentes antes de modificar este recurso",
        409,
      );
    }
    store.tx(() => {
      db.prepare("UPDATE resources SET data=? WHERE id=?").run(
        JSON.stringify(data),
        id,
      );
      store.audit(req.user.id, "RecursoActualizado", { id, kind });
    });
    res.json({ id, ...data });
  });
  app.get("/api/bookings", auth, (req, res) =>
    res.json(service.list(req.user)),
  );
  app.post("/api/bookings", auth, (req, res) =>
    res.status(201).json(service.reserve(req.user, req.body)),
  );
  app.post("/api/bookings/:id/cancel", auth, (req, res) =>
    res.json(service.cancel(req.params.id, req.user, req.body.reason)),
  );
  const privateDir = path.resolve(
    process.env.PRIVATE_FILES_DIR || "var/private",
  );
  mkdirSync(privateDir, { recursive: true });
  app.post(
    "/api/bookings/:id/receipt",
    auth,
    express.raw({
      type: ["image/png", "image/jpeg", "application/pdf"],
      limit: "5mb",
    }),
    (req, res) => {
      requireValue(
        Buffer.isBuffer(req.body) && req.body.length > 0,
        "Archivo JPG, PNG o PDF requerido",
      );
      const buf = req.body;
      const png = buf
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        jpg = buf[0] === 255 && buf[1] === 216 && buf[2] === 255,
        pdf = buf.subarray(0, 5).toString() === "%PDF-";
      const mime = png
        ? "image/png"
        : jpg
          ? "image/jpeg"
          : pdf
            ? "application/pdf"
            : null;
      requireValue(
        mime && mime === req.headers["content-type"],
        "El contenido no coincide con un archivo permitido",
      );
      const key = randomUUID();
      const file = path.join(privateDir, key);
      writeFileSync(file, buf, { mode: 0o600, flag: "wx" });
      try {
        const result = service.submitReceipt(req.params.id, req.user, {
          operation: req.headers["x-operation"],
          file: key,
          mime,
        });
        res.status(201).json(result);
      } catch (e) {
        unlinkSync(file);
        throw e;
      }
    },
  );
  app.get("/api/payments", auth, (req, res) => {
    const rows =
      req.user.role === "ADMIN"
        ? db.prepare("SELECT p.* FROM payments p ORDER BY rowid DESC").all()
        : db
            .prepare(
              "SELECT p.* FROM payments p JOIN bookings b ON b.id=p.booking_id WHERE b.user_id=? ORDER BY p.rowid DESC",
            )
            .all(req.user.id);
    res.json(
      rows.map((p) => {
        const data = JSON.parse(p.data);
        delete data.file;
        return {
          ...data,
          id: p.id,
          bookingId: p.booking_id,
          status: p.status,
          operation: p.operation,
        };
      }),
    );
  });
  app.get("/api/payments/:id/file", auth, (req, res) => {
    const payment = db
      .prepare("SELECT * FROM payments WHERE id=?")
      .get(req.params.id);
    requireValue(payment, "No encontrado", 404);
    service.get(payment.booking_id, req.user);
    const data = JSON.parse(payment.data);
    res.type(data.mime);
    res.set("Content-Disposition", 'attachment; filename="comprobante"');
    res.sendFile(path.join(privateDir, data.file));
  });
  app.post("/api/payments/:id/validate", auth, admin, (req, res) => {
    requireValue(typeof req.body.approved === "boolean", "Decisión inválida");
    res.json(
      service.validatePayment(
        req.params.id,
        req.user,
        req.body.approved,
        req.body.reason,
      ),
    );
  });
  app.get("/api/audit", auth, admin, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,actor,action,at,data FROM audit ORDER BY at DESC LIMIT 100",
        )
        .all(),
    ),
  );
  const dist = path.resolve("dist/web/browser");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (req, res, next) =>
      req.path.startsWith("/api/")
        ? next()
        : res.sendFile(path.join(dist, "index.html")),
    );
  }
  app.use((req, res) =>
    res.status(404).json({ message: "Ruta no encontrada" }),
  );
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error("Error API:", err.message);
    res
      .status(status)
      .json({
        message:
          status === 500 ? "No se pudo procesar la solicitud" : err.message,
      });
  });
  return { app, service, store };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { app, service } = createApp();
  app.listen(Number(process.env.PORT) || 3000, "127.0.0.1", () =>
    console.log(
      "API InstrucciónFácil en http://127.0.0.1:" + (process.env.PORT || 3000),
    ),
  );
  setInterval(() => service.expire(), 15000).unref();
}
