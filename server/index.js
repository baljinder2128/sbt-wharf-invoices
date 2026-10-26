// SB Truckin wharf invoices: API + web app server.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { db, DATA_DIR, STORAGE_SAFE, getSetting, setSetting } = require('./db');

const PORT = Number(process.env.PORT || 3000);

// ---------- bootstrap ----------
let secret = process.env.JWT_SECRET || getSetting('jwt_secret');
if (!secret) { secret = crypto.randomBytes(32).toString('hex'); setSetting('jwt_secret', secret); }

// With ADMIN_EMAIL and ADMIN_PASSWORD set, the first login is made on start.
// Without them, whoever opens the app first is asked to create it.
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && !db.prepare('SELECT 1 FROM users').get()) {
  db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('Office', process.env.ADMIN_EMAIL.trim(), bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10));
  console.log(`Created login ${process.env.ADMIN_EMAIL}`);
}
const needsSetup = () => !db.prepare('SELECT 1 FROM users').get();

const app = express();
app.set('trust proxy', true); // Railway sits in front, so cookies are marked secure
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- helpers ----------
const bad = (msg, code = 400) => Object.assign(new Error(msg), { status: code });

function auth(req, res, next) {
  try {
    const tok = req.cookies.wharf || (req.headers.authorization || '').replace(/^Bearer /, '');
    const { uid } = jwt.verify(tok, secret);
    const u = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(uid);
    if (!u) throw new Error();
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: 'Please log in', setup: needsSetup() });
  }
}

function signIn(res, req, u) {
  const token = jwt.sign({ uid: u.id }, secret, { expiresIn: '90d' });
  res.cookie('wharf', token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 90 * 864e5 });
}

// ---------- auth ----------
app.post('/api/setup', (req, res) => {
  if (!needsSetup()) throw bad('A login already exists. Log in instead.', 409);
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw bad('Enter a valid email address');
  if (password.length < 8) throw bad('The password needs at least 8 characters');
  const r = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('Office', email, bcrypt.hashSync(password, 10));
  signIn(res, req, { id: Number(r.lastInsertRowid) });
  res.json({ ok: true });
});
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim());
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) return res.status(401).json({ error: 'Wrong email or password' });
  signIn(res, req, u);
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => { res.clearCookie('wharf'); res.json({ ok: true }); });
app.get('/api/me', auth, (req, res) => res.json(req.user));
app.post('/api/me/password', auth, (req, res) => {
  const { current, next } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(current || ''), u.password_hash)) throw bad('Current password is wrong');
  if (String(next || '').length < 8) throw bad('New password needs at least 8 characters');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), u.id);
  res.json({ ok: true });
});

// ---------- invoice data ----------
// podimg holds the full POD photos; they are fetched one at a time, not with /api/data.
const COLS = new Set(['companies', 'invoices', 'config', 'pods', 'podimg']);
const ID = /^[A-Za-z0-9_\-.~:@+]{1,100}$/;
function checkPath(col, id) {
  if (!COLS.has(col) || !ID.test(id) || (col === 'config' && id !== 'settings')) throw bad('Unknown record', 404);
}

app.get('/api/data', auth, (req, res) => {
  const out = { settings: null, companies: [], invoices: [], pods: [] };
  for (const r of db.prepare("SELECT col, id, data FROM docs WHERE col != 'podimg'").all()) {
    const d = JSON.parse(r.data);
    if (r.col === 'config') out.settings = d;
    else out[r.col].push({ ...d, id: r.id });
  }
  res.json(out);
});
app.get('/api/docs/:col/:id', auth, (req, res) => {
  const { col, id } = req.params;
  checkPath(col, id);
  const r = db.prepare('SELECT data FROM docs WHERE col = ? AND id = ?').get(col, id);
  if (!r) throw bad('Not found', 404);
  res.json({ ...JSON.parse(r.data), id });
});
app.put('/api/docs/:col/:id', auth, (req, res) => {
  const { col, id } = req.params;
  checkPath(col, id);
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('Send the record as an object');
  const data = { ...body };
  delete data.id;
  db.prepare("INSERT INTO docs (col, id, data, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
    .run(col, id, JSON.stringify(data));
  res.json({ ok: true });
});
app.delete('/api/docs/:col/:id', auth, (req, res) => {
  const { col, id } = req.params;
  checkPath(col, id);
  db.prepare('DELETE FROM docs WHERE col = ? AND id = ?').run(col, id);
  res.json({ ok: true });
});

// ---------- static web app ----------
// Pages, scripts and styles are revalidated on every open so phones pick up app updates straight away.
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h', setHeaders: (res, p) => { if (/\.(html|js|css|webmanifest)$/.test(p)) res.setHeader('Cache-Control', 'no-cache'); } }));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'That data could not be read' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

if (require.main === module) {
  // Hosts route traffic to the PORT they set, but a domain can be pointed at another port by hand,
  // so also answer on the common ones (3000 and 8080).
  for (const port of new Set([PORT, 3000, 8080])) {
    app.listen(port, '0.0.0.0', () => console.log(`SB Truckin wharf invoices listening on port ${port}`)).on('error', (e) => console.error(`port ${port}: ${e.message}`));
  }
  if (!STORAGE_SAFE) console.warn('WARNING: no Railway volume attached. Invoices and companies will be wiped on the next deploy.');
  console.log(`Data in ${DATA_DIR}${needsSetup() ? ', waiting for the first login to be created' : ''}`);
}
module.exports = { app };
