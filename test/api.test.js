// End-to-end API flow: first login is created, records are saved, read back and deleted. Nothing works logged out.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wharf-test-'));
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD;
const { app } = require('../server/index.js');

let base;
let server;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
test.after(() => { server.close(); setTimeout(() => process.exit(0), 100); });

function client() {
  let cookie = '';
  return async (method, p, body) => {
    const res = await fetch(base + p, {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

test('first login, save, read, delete', async () => {
  const office = client();
  const stranger = client();

  const first = await office('GET', '/api/data');
  assert.equal(first.status, 401);
  assert.equal(first.body.setup, true);

  assert.equal((await office('POST', '/api/setup', { email: 'office@test.local', password: 'short' })).status, 400);
  assert.equal((await office('POST', '/api/setup', { email: 'office@test.local', password: 'GoodPass123' })).status, 200);
  assert.equal((await stranger('POST', '/api/setup', { email: 'x@test.local', password: 'Another123' })).status, 409);
  assert.equal((await stranger('GET', '/api/data')).body.setup, false);

  const settings = { business: { name: 'SB Truckin Pty Ltd' }, rates: { fuelLevy: 15, card: [{ suburb: 'Braeside / Dandenong', rate: 18.5 }] } };
  assert.equal((await office('PUT', '/api/docs/config/settings', settings)).status, 200);
  assert.equal((await office('PUT', '/api/docs/companies/sidxpress', { name: 'SIDXPRESS Pty. Ltd.', id: 'ignored' })).status, 200);
  assert.equal((await office('PUT', '/api/docs/invoices/inv1', { number: 'INV-0001', items: [] })).status, 200);
  assert.equal((await office('PUT', '/api/docs/invoices/inv1', { number: 'INV-0001', items: [{ id: 'r1' }] })).status, 200);

  const data = (await office('GET', '/api/data')).body;
  assert.deepEqual(data.settings, settings);
  assert.deepEqual(data.companies, [{ name: 'SIDXPRESS Pty. Ltd.', id: 'sidxpress' }]);
  assert.equal(data.invoices.length, 1);
  assert.equal(data.invoices[0].items.length, 1);

  assert.equal((await office('PUT', '/api/docs/users/1', { a: 1 })).status, 404);
  assert.equal((await office('PUT', '/api/docs/config/other', { a: 1 })).status, 404);
  assert.equal((await office('PUT', '/api/docs/invoices/inv2', [1, 2])).status, 400);
  assert.equal((await stranger('PUT', '/api/docs/invoices/inv9', { a: 1 })).status, 401);
  assert.equal((await stranger('DELETE', '/api/docs/invoices/inv1')).status, 401);

  assert.equal((await office('DELETE', '/api/docs/invoices/inv1')).status, 200);
  assert.equal((await office('GET', '/api/data')).body.invoices.length, 0);

  const login = client();
  assert.equal((await login('POST', '/api/login', { email: 'office@test.local', password: 'wrong' })).status, 401);
  assert.equal((await login('POST', '/api/login', { email: 'OFFICE@test.local', password: 'GoodPass123' })).status, 200);
  assert.equal((await login('POST', '/api/me/password', { current: 'GoodPass123', next: 'NewPass1234' })).status, 200);
  assert.equal((await login('POST', '/api/logout')).status, 200);
  assert.equal((await login('GET', '/api/data')).status, 401);
  assert.equal((await login('POST', '/api/login', { email: 'office@test.local', password: 'NewPass1234' })).status, 200);
});

test('web app is served', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /window\.WHARF_SERVER = true/);
  assert.equal((await fetch(base + '/manifest.webmanifest')).status, 200);
});
