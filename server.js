const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let Pool = null;
try {
  ({ Pool } = require('pg'));
} catch {
  Pool = null;
}

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const JSON_DB_PATH = path.join(DATA_DIR, 'submissions.json');
const DATABASE_URL = process.env.DATABASE_URL || '';
const USE_POSTGRES = Boolean(DATABASE_URL && Pool);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

const pool = USE_POSTGRES ? new Pool({
  connectionString: DATABASE_URL,
  ssl: shouldUseSsl() ? { rejectUnauthorized: false } : false
}) : null;

function shouldUseSsl() {
  return process.env.PGSSLMODE === 'require' ||
    process.env.DATABASE_SSL === 'true' ||
    /sslmode=require|neon\.tech/i.test(DATABASE_URL);
}

function ensureJsonStore() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(JSON_DB_PATH)) fs.writeFileSync(JSON_DB_PATH, JSON.stringify({ submissions: [] }, null, 2));
}

async function initStore() {
  if (!USE_POSTGRES) {
    ensureJsonStore();
    console.log('Using local JSON database fallback.');
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      team_name TEXT NOT NULL DEFAULT '',
      item_id INTEGER NOT NULL,
      photo_data_url TEXT NOT NULL DEFAULT '',
      extra_people INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      submitted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT NOT NULL DEFAULT '',
      awarded_base INTEGER NOT NULL DEFAULT 0,
      awarded_bonus INTEGER NOT NULL DEFAULT 0,
      extra_person_bonus INTEGER NOT NULL DEFAULT 0
    )
  `);
  console.log('Using PostgreSQL database from DATABASE_URL.');
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), 'application/json; charset=utf-8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error('Request is too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function normalizeIncoming(incoming) {
  const now = new Date().toISOString();
  return {
    id: incoming.id || crypto.randomUUID(),
    teamId: incoming.teamId || '',
    teamName: incoming.teamName || '',
    itemId: Number(incoming.itemId || 0),
    photo: incoming.photo || incoming.photoDataUrl || incoming.photoUrl || '',
    extraPeople: Number(incoming.extraPeople || 0),
    note: incoming.note || '',
    submittedAt: incoming.submittedAt || now,
    updatedAt: now,
    status: incoming.status || 'pending',
    adminNote: incoming.adminNote || '',
    awardedBase: Number(incoming.awardedBase || 0),
    awardedBonus: Number(incoming.awardedBonus || 0),
    extraPersonBonus: Number(incoming.extraPersonBonus || 0)
  };
}

function rowToSubmission(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    itemId: Number(row.item_id),
    photo: row.photo_data_url,
    photoUrl: row.photo_data_url,
    extraPeople: Number(row.extra_people || 0),
    note: row.note || '',
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    status: row.status || 'pending',
    adminNote: row.admin_note || '',
    awardedBase: Number(row.awarded_base || 0),
    awardedBonus: Number(row.awarded_bonus || 0),
    extraPersonBonus: Number(row.extra_person_bonus || 0)
  };
}

function saveJsonPhoto(submission) {
  const dataUrl = String(submission.photo || '');
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return dataUrl;
  const ext = match[1].split('/')[1].replace('jpeg', 'jpg');
  const safeId = String(submission.id).replace(/[^a-zA-Z0-9_-]+/g, '');
  const filename = `${safeId}.${ext}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(match[2], 'base64'));
  return `/data/uploads/${filename}`;
}

async function listSubmissions() {
  if (USE_POSTGRES) {
    const result = await pool.query('SELECT * FROM submissions ORDER BY submitted_at ASC');
    return result.rows.map(rowToSubmission);
  }
  ensureJsonStore();
  return JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8')).submissions;
}

async function saveSubmission(incoming) {
  const submission = normalizeIncoming(incoming);
  if (!submission.teamId || !submission.itemId) throw new Error('Missing team or clue number');

  if (USE_POSTGRES) {
    await pool.query(`
      INSERT INTO submissions (
        id, team_id, team_name, item_id, photo_data_url, extra_people, note,
        submitted_at, updated_at, status, admin_note, awarded_base, awarded_bonus, extra_person_bonus
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (id) DO UPDATE SET
        team_id = EXCLUDED.team_id,
        team_name = EXCLUDED.team_name,
        item_id = EXCLUDED.item_id,
        photo_data_url = EXCLUDED.photo_data_url,
        extra_people = EXCLUDED.extra_people,
        note = EXCLUDED.note,
        submitted_at = EXCLUDED.submitted_at,
        updated_at = EXCLUDED.updated_at,
        status = EXCLUDED.status,
        admin_note = EXCLUDED.admin_note,
        awarded_base = EXCLUDED.awarded_base,
        awarded_bonus = EXCLUDED.awarded_bonus,
        extra_person_bonus = EXCLUDED.extra_person_bonus
    `, [
      submission.id,
      submission.teamId,
      submission.teamName,
      submission.itemId,
      submission.photo,
      submission.extraPeople,
      submission.note,
      submission.submittedAt,
      submission.updatedAt,
      submission.status,
      submission.adminNote,
      submission.awardedBase,
      submission.awardedBonus,
      submission.extraPersonBonus
    ]);
    return submission;
  }

  ensureJsonStore();
  const db = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));
  submission.photoUrl = saveJsonPhoto(submission);
  submission.photo = submission.photoUrl;
  const index = db.submissions.findIndex(item => item.id === submission.id);
  if (index >= 0) db.submissions[index] = { ...db.submissions[index], ...submission };
  else db.submissions.push(submission);
  fs.writeFileSync(JSON_DB_PATH, JSON.stringify(db, null, 2));
  return submission;
}

async function updateScore(payload) {
  const status = payload.status || 'pending';
  const awardedBase = Number(payload.awardedBase || 0);
  const awardedBonus = Number(payload.awardedBonus || 0);
  const extraPersonBonus = Number(payload.extraPersonBonus || 0);
  const adminNote = payload.adminNote || '';
  const updatedAt = new Date().toISOString();

  if (USE_POSTGRES) {
    const result = await pool.query(`
      UPDATE submissions
      SET status=$2, awarded_base=$3, awarded_bonus=$4, extra_person_bonus=$5, admin_note=$6, updated_at=$7
      WHERE id=$1
      RETURNING *
    `, [payload.submissionId, status, awardedBase, awardedBonus, extraPersonBonus, adminNote, updatedAt]);
    if (!result.rows[0]) throw new Error('Submission not found');
    return rowToSubmission(result.rows[0]);
  }

  ensureJsonStore();
  const db = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));
  const submission = db.submissions.find(item => item.id === payload.submissionId);
  if (!submission) throw new Error('Submission not found');
  Object.assign(submission, { status, awardedBase, awardedBonus, extraPersonBonus, adminNote, updatedAt });
  fs.writeFileSync(JSON_DB_PATH, JSON.stringify(db, null, 2));
  return submission;
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, database: USE_POSTGRES ? 'postgres' : 'json' });
  }

  if (req.method === 'GET' && url.pathname === '/api/submissions') {
    return sendJson(res, 200, { ok: true, submissions: await listSubmissions() });
  }

  if (req.method === 'POST' && url.pathname === '/api/submissions') {
    const payload = JSON.parse(await readBody(req) || '{}');
    return sendJson(res, 200, { ok: true, submission: await saveSubmission(payload.submission || payload) });
  }

  if (req.method === 'POST' && url.pathname === '/api/score') {
    const payload = JSON.parse(await readBody(req) || '{}');
    return sendJson(res, 200, { ok: true, submission: await updateScore(payload) });
  }

  return sendJson(res, 404, { ok: false, error: 'API route not found' });
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/data/submissions.json') return sendJson(res, 403, { ok: false, error: 'Database file is private' });
  const filepath = path.normalize(path.join(ROOT, pathname));
  if (!filepath.startsWith(ROOT)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  fs.readFile(filepath, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    send(res, 200, data, MIME[path.extname(filepath).toLowerCase()] || 'application/octet-stream');
  });
}

initStore().then(() => {
  http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      handleApi(req, res, url).catch(err => sendJson(res, 500, { ok: false, error: err.message }));
    } else {
      serveStatic(req, res, url);
    }
  }).listen(PORT, () => {
    console.log(`AIN Scavenger Hunt running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Could not initialize database:', err);
  process.exit(1);
});
