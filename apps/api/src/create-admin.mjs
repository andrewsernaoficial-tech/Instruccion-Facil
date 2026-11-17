import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { openStore } from "./store.mjs";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(),
  password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12 || password.length > 72)
  throw Error(
    "Define ADMIN_EMAIL y ADMIN_PASSWORD (12 a 72 caracteres) en tu .env local.",
  );
const { db } = openStore();
if (db.prepare("SELECT id FROM users WHERE role=?").get("ADMIN"))
  throw Error("Ya existe un administrador; no se modifica automáticamente.");
db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
  randomUUID(),
  email,
  "Administrador",
  await bcrypt.hash(password, 12),
  "ADMIN",
);
db.close();
console.log(
  "Administrador creado. Elimina ADMIN_PASSWORD de .env tras completar el alta.",
);
