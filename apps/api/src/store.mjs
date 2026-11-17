import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { defaults } from "./domain.mjs";
export function openStore(
  path = process.env.DATABASE_PATH || "var/development.db",
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS resources(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),instructor_id TEXT NOT NULL,vehicle_id TEXT,start INTEGER NOT NULL,end INTEGER NOT NULL,status TEXT NOT NULL,expires INTEGER NOT NULL,data TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS booking_resources ON bookings(instructor_id,vehicle_id,start,end,status);
 CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL REFERENCES bookings(id),status TEXT NOT NULL,operation TEXT NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,at INTEGER NOT NULL,data TEXT NOT NULL);`);
  db.prepare("INSERT OR IGNORE INTO settings VALUES(1,?)").run(
    JSON.stringify(defaults),
  );
  return {
    db,
    settings: () =>
      JSON.parse(db.prepare("SELECT data FROM settings WHERE id=1").get().data),
    resources: (kind) =>
      db
        .prepare("SELECT * FROM resources WHERE kind=?")
        .all(kind)
        .map((r) => ({ id: r.id, ...JSON.parse(r.data) })),
    resource: (id) => {
      const r = db.prepare("SELECT * FROM resources WHERE id=?").get(id);
      return r ? { id: r.id, kind: r.kind, ...JSON.parse(r.data) } : null;
    },
    audit: (actor, action, data = {}) =>
      db
        .prepare("INSERT INTO audit VALUES(?,?,?,?,?)")
        .run(randomUUID(), actor, action, Date.now(), JSON.stringify(data)),
    tx: (fn) => {
      db.exec("BEGIN IMMEDIATE");
      try {
        const r = fn();
        db.exec("COMMIT");
        return r;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
