import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { authEmailExists, createSignupRouter } from "../src/routes/signup.js";

test("Auth lookup finds email and Google identities without a profile, including later pages", async () => {
  for (const provider of ["email", "google"]) {
    const pages: number[] = [];
    const directory = { async listUsers({ page }: { page: number }) {
      pages.push(page);
      return { error: null, data: { users: page === 1
        ? Array.from({ length: 1000 }, (_, i) => ({ email: `other${i}@example.com` }))
        : [{ email: "Existing@Example.com", app_metadata: { provider } }] } };
    } };
    assert.equal(await authEmailExists(directory as any, " existing@example.com "), true);
    assert.deepEqual(pages, [1, 2]);
  }
  assert.equal(await authEmailExists({ listUsers: async () => ({ data: { users: [] }, error: null }) } as any, "new@example.com"), false);
});

test("signup API validates, exposes only existence, fails closed, and rate limits", async (t) => {
  let calls = 0;
  let fail = false;
  const app = express();
  app.use(express.json());
  app.use("/signup", createSignupRouter(() => ({ async listUsers() {
    calls++;
    if (fail) throw new Error("private upstream failure");
    return { data: { users: [{ email: "existing@example.com", id: "private-id" }] }, error: null };
  } } as any)));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/signup/check-email`;
  const send = (email: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
  assert.equal((await send("bad")).status, 400);
  assert.equal(calls, 0);
  const existing = await send(" Existing@example.com ");
  assert.equal(existing.headers.get("cache-control"), "no-store");
  assert.deepEqual(await existing.json(), { exists: true });
  assert.deepEqual(await (await send("new@example.com")).json(), { exists: false });
  fail = true;
  const failed = await send("new@example.com");
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes("private upstream"), false);
  for (let i = 0; i < 56; i++) await send("bad");
  assert.equal((await send("new@example.com")).status, 429);
  assert.equal(calls, 3);
});
