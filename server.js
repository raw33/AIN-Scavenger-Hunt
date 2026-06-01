const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'submissions.json');

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

function ensureStore() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ submissions: [] }, null, 2));
}

function readDb() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  ensureStore();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
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

function publicSubmission(submission) {
  const copy = { ...submission };
  delete copy.photoDataUrl;
  return copy;
}

function savePhoto(submission) {
  if (submission.photoUrl) return submission.photoUrl;
  const dataUrl = String(submission.photo || submission.photoDataUrl || '');
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return '';
  const ext = match[1].split('/')[1].replace('jpeg', 'jpg');
  const safeId = String(submission.id || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]+/g, '');
  const filename = `${safeId}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(match[2], 'base64'));
  return `/data/uploads/${filename}`;
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (req.method === 'GET' && url.pathname === '/api/submissions') {
    const db = readDb();
    return sendJson(res, 200, { ok: true, submissions: db.submissions.map(publicSubmission) });
  }

  if (req.method === 'POST' && url.pathname === '/api/submissions') {
    const payload = JSON.parse(await readBody(req) || '{}');
    const incoming = payload.submission || payload;
    if (!incoming.id) incoming.id = crypto.randomUUID();
    if (!incoming.teamId || !incoming.itemId) return sendJson(res, 400, { ok: false, error: 'Missing team or clue number' });

    const db = readDb();
    const photoUrl = savePhoto(incoming);
    const now = new Date().toISOString();
    const submission = {
      id: incoming.id,
      teamId: incoming.teamId,
      teamName: incoming.teamName || '',
      itemId: Number(incoming.itemId),
      photoUrl,
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

    const existing = db.submissions.findIndex(item => item.id === submission.id);
    if (existing >= 0) db.submissions[existing] = { ...db.submissions[existing], ...submission };
    else db.submissions.push(submission);
    writeDb(db);
    return sendJson(res, 200, { ok: true, submission: publicSubmission(submission) });
  }

  if (req.method === 'POST' && url.pathname === '/api/score') {
    const payload = JSON.parse(await readBody(req) || '{}');
    const db = readDb();
    const submission = db.submissions.find(item => item.id === payload.submissionId);
    if (!submission) return sendJson(res, 404, { ok: false, error: 'Submission not found' });

    submission.status = payload.status || 'pending';
    submission.awardedBase = Number(payload.awardedBase || 0);
    submission.awardedBonus = Number(payload.awardedBonus || 0);
    submission.extraPersonBonus = Number(payload.extraPersonBonus || 0);
    submission.adminNote = payload.adminNote || '';
    submission.updatedAt = new Date().toISOString();
    writeDb(db);
    return sendJson(res, 200, { ok: true, submission: publicSubmission(submission) });
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

ensureStore();

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
