import { test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { localGuard } from "../../server/auth";
function app() {
  const a = express();
  a.use(localGuard("http://127.0.0.1:4173", "test-token"));
  a.post("/api/save", (_q, r) => r.json({ ok: true }));
  a.get("/api/session", (_q, r) => r.json({ token: "test-token" }));
  return a;
}
test("rejects foreign origin even with token", async () =>
  expect(
    (
      await request(app())
        .post("/api/save")
        .set("Host", "127.0.0.1:4173")
        .set("Origin", "https://evil.test")
        .set("X-Session-Token", "test-token")
    ).status,
  ).toBe(403));
test("requires token for mutation and prevents host rebinding", async () => {
  expect(
    (await request(app()).post("/api/save").set("Host", "127.0.0.1:4173"))
      .status,
  ).toBe(403);
  expect(
    (await request(app()).get("/api/session").set("Host", "evil.test")).status,
  ).toBe(403);
  expect(
    (
      await request(app())
        .post("/api/save")
        .set("Host", "127.0.0.1:4173")
        .set("Origin", "http://127.0.0.1:4173")
        .set("X-Session-Token", "test-token")
    ).status,
  ).toBe(200);
});
