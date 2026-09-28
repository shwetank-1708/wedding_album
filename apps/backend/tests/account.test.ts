import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createAccountRouter } from '../src/routes/account.js';
import type { verifySupabaseUser } from '../src/auth.js';

test('account deletion requires authentication and confirmation and uses only verified identity', async () => {
  let authenticated = false;
  let failDeletion = false;
  const deleted: string[] = [];
  const verified = { user: { id: 'verified-user' }, supabaseAdmin: {} } as NonNullable<Awaited<ReturnType<typeof verifySupabaseUser>>>;
  const app = express();
  app.use(express.json());
  app.use('/account', createAccountRouter(async () => authenticated ? verified : null, async (_client, uid) => {
    if (failDeletion) throw new Error('private provider error');
    deleted.push(uid);
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/account`;
  const request = (body: object) => fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await request({ confirmation: 'DELETE' })).status, 401);
    authenticated = true;
    assert.equal((await request({})).status, 400);
    assert.deepEqual(deleted, []);
    assert.equal((await request({ confirmation: 'DELETE', uid: 'another-user' })).status, 200);
    assert.deepEqual(deleted, ['verified-user']);
    failDeletion = true;
    const failed = await request({ confirmation: 'DELETE' });
    assert.equal(failed.status, 500);
    assert.equal((await failed.text()).includes('private provider error'), false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
