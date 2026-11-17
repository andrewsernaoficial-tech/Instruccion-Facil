import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openStore } from "../src/store.mjs";
import { createApp } from "../src/server.mjs";
test("HTTP: registro, sesión, control de roles y protección de origen", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "if-test-"));
  process.env.PRIVATE_FILES_DIR = directory;
  const store = openStore(":memory:");
  const { app } = createApp(store);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const req = (url, options = {}) => fetch(base + "/api" + url, options);
  try {
    assert.equal((await req("/health")).status, 200);
    assert.equal((await req("/settings")).status, 401);
    const invalid = await req("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(invalid.status, 403);
    const response = await req("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-App-Request": "1" },
      body: JSON.stringify({
        name: "Alumno de prueba",
        email: "alumno@example.test",
        password: "Prueba-segura-123",
        consent: true,
        role: "ADMIN",
      }),
    });
    assert.equal(response.status, 201);
    const user = await response.json();
    assert.equal(user.role, "CLIENT");
    assert.equal(user.password, undefined);
    const cookie = response.headers.get("set-cookie").split(";")[0];
    assert.match(response.headers.get("set-cookie"), /HttpOnly/);
    assert.equal(
      (await req("/auth/me", { headers: { Cookie: cookie } })).status,
      200,
    );
    assert.equal(
      (await req("/settings", { headers: { Cookie: cookie } })).status,
      403,
    );
    const forbidden = await req("/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Request": "1",
        Origin: "https://otro.example",
        Cookie: cookie,
      },
      body: "{}",
    });
    assert.equal(forbidden.status, 403);
    await req("/auth/logout", {
      method: "POST",
      headers: { "X-App-Request": "1", Cookie: cookie },
    });
    assert.equal(
      (await req("/auth/me", { headers: { Cookie: cookie } })).status,
      401,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
