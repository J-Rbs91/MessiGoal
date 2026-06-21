'use strict';

/**
 * MessiGoal — serveur participatif de recensement des buts de Lionel Messi.
 *
 * Aucune dépendance externe : uniquement les modules natifs de Node.js.
 * Les données sont persistées dans data/goals.json (écriture atomique).
 *
 * API REST :
 *   GET    /api/goals        -> liste (filtres via query string)
 *   GET    /api/goals/:id    -> un but
 *   POST   /api/goals        -> créer un but
 *   PUT    /api/goals/:id    -> modifier / compléter / corriger un but
 *   DELETE /api/goals/:id    -> supprimer un but
 *   GET    /api/stats        -> statistiques agrégées
 *   GET    /api/meta         -> valeurs autorisées (types, parties du corps...)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'goals.json');

// ---------------------------------------------------------------------------
// Référentiel des valeurs autorisées
// ---------------------------------------------------------------------------
const BODY_PARTS = ['Pied gauche', 'Pied droit', 'Tête', 'Autre'];
const GOAL_TYPES = ['En jeu', 'Pénalty', 'Coup franc', 'Contre son camp'];

// ---------------------------------------------------------------------------
// Couche de stockage (fichier JSON, écriture atomique)
// ---------------------------------------------------------------------------
function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readGoals() {
  ensureStore();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8').trim();
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Lecture du stockage impossible :', err.message);
    return [];
  }
}

function writeGoals(goals) {
  ensureStore();
  const tmp = DATA_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(goals, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE); // remplacement atomique
}

// ---------------------------------------------------------------------------
// Validation / normalisation d'un but
// ---------------------------------------------------------------------------
function cleanString(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function validateAndNormalize(input, { partial = false } = {}) {
  const errors = [];
  const out = {};

  // Champs texte libres
  const textFields = {
    date: 'date',
    city: 'lieu',
    stadium: 'stade',
    opponent: 'équipe adverse',
    competition: 'compétition',
    goalkeeper: 'gardien adverse',
    videoUrl: 'lien vidéo',
  };

  for (const [key, label] of Object.entries(textFields)) {
    if (input[key] !== undefined) {
      out[key] = cleanString(input[key]);
    } else if (!partial) {
      out[key] = '';
    }
  }

  // Champs obligatoires (uniquement en création)
  if (!partial) {
    if (!out.opponent) errors.push("L'équipe adverse est obligatoire.");
    if (!out.date) errors.push('La date est obligatoire.');
  } else {
    if (input.opponent !== undefined && !cleanString(input.opponent)) {
      errors.push("L'équipe adverse ne peut pas être vide.");
    }
    if (input.date !== undefined && !cleanString(input.date)) {
      errors.push('La date ne peut pas être vide.');
    }
  }

  // Lien vidéo : doit être une URL http(s) si fourni
  if (out.videoUrl) {
    if (!/^https?:\/\/\S+$/i.test(out.videoUrl)) {
      errors.push('Le lien vidéo doit être une URL valide (http/https).');
    }
  }

  // Minute (nombre 1..130 ou vide)
  if (input.minute !== undefined) {
    const m = cleanString(String(input.minute));
    if (m === '') {
      out.minute = null;
    } else {
      const n = parseInt(m, 10);
      if (Number.isNaN(n) || n < 0 || n > 130) {
        errors.push('La minute doit être un nombre entre 0 et 130.');
      } else {
        out.minute = n;
      }
    }
  } else if (!partial) {
    out.minute = null;
  }

  // Partie du corps
  if (input.bodyPart !== undefined) {
    const bp = cleanString(input.bodyPart);
    if (bp && !BODY_PARTS.includes(bp)) {
      errors.push('Partie du corps invalide. Valeurs : ' + BODY_PARTS.join(', '));
    } else {
      out.bodyPart = bp;
    }
  } else if (!partial) {
    out.bodyPart = '';
  }

  // Type de but
  if (input.goalType !== undefined) {
    const gt = cleanString(input.goalType);
    if (gt && !GOAL_TYPES.includes(gt)) {
      errors.push('Type de but invalide. Valeurs : ' + GOAL_TYPES.join(', '));
    } else {
      out.goalType = gt;
    }
  } else if (!partial) {
    out.goalType = '';
  }

  // Contributeur (optionnel)
  if (input.contributor !== undefined) {
    out.contributor = cleanString(input.contributor).slice(0, 80);
  } else if (!partial) {
    out.contributor = '';
  }

  return { errors, value: out };
}

// ---------------------------------------------------------------------------
// Statistiques agrégées
// ---------------------------------------------------------------------------
function buildStats(goals) {
  const byCompetition = {};
  const byBodyPart = {};
  const byType = {};
  const byOpponent = {};
  let withVideo = 0;

  for (const g of goals) {
    if (g.competition) byCompetition[g.competition] = (byCompetition[g.competition] || 0) + 1;
    if (g.bodyPart) byBodyPart[g.bodyPart] = (byBodyPart[g.bodyPart] || 0) + 1;
    if (g.goalType) byType[g.goalType] = (byType[g.goalType] || 0) + 1;
    if (g.opponent) byOpponent[g.opponent] = (byOpponent[g.opponent] || 0) + 1;
    if (g.videoUrl) withVideo++;
  }

  const topOpponents = Object.entries(byOpponent)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    total: goals.length,
    withVideo,
    byCompetition,
    byBodyPart,
    byType,
    topOpponents,
  };
}

// ---------------------------------------------------------------------------
// Helpers HTTP
// ---------------------------------------------------------------------------
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        tooLarge = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooLarge) return reject(new Error('Corps de requête trop volumineux'));
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('JSON invalide'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------------------------------------------------------------------------
// Routeur API
// ---------------------------------------------------------------------------
function filterGoals(goals, query) {
  let result = goals.slice();
  const q = (query.q || '').toLowerCase().trim();
  if (q) {
    result = result.filter((g) =>
      [g.opponent, g.competition, g.stadium, g.city, g.goalkeeper, g.date]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }
  if (query.competition) {
    result = result.filter((g) => g.competition === query.competition);
  }
  if (query.bodyPart) {
    result = result.filter((g) => g.bodyPart === query.bodyPart);
  }
  if (query.goalType) {
    result = result.filter((g) => g.goalType === query.goalType);
  }
  if (query.hasVideo === 'true') {
    result = result.filter((g) => !!g.videoUrl);
  }

  // Tri par date décroissante par défaut
  const sort = query.sort || 'date_desc';
  result.sort((a, b) => {
    if (sort === 'date_asc') return String(a.date).localeCompare(String(b.date));
    if (sort === 'minute') return (a.minute ?? 999) - (b.minute ?? 999);
    return String(b.date).localeCompare(String(a.date));
  });
  return result;
}

async function handleApi(req, res, parsedUrl) {
  const { pathname, query } = parsedUrl;
  const parts = pathname.split('/').filter(Boolean); // ['api', 'goals', ':id']

  // /api/meta
  if (pathname === '/api/meta' && req.method === 'GET') {
    return sendJson(res, 200, { bodyParts: BODY_PARTS, goalTypes: GOAL_TYPES });
  }

  // /api/stats
  if (pathname === '/api/stats' && req.method === 'GET') {
    return sendJson(res, 200, buildStats(readGoals()));
  }

  // /api/goals
  if (parts[1] === 'goals') {
    const id = parts[2];

    if (!id) {
      if (req.method === 'GET') {
        const goals = filterGoals(readGoals(), query);
        return sendJson(res, 200, { count: goals.length, goals });
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const { errors, value } = validateAndNormalize(body, { partial: false });
        if (errors.length) return sendJson(res, 400, { errors });
        const goals = readGoals();
        const now = new Date().toISOString();
        const goal = {
          id: crypto.randomUUID(),
          ...value,
          createdAt: now,
          updatedAt: now,
        };
        goals.push(goal);
        writeGoals(goals);
        return sendJson(res, 201, goal);
      }
      return sendJson(res, 405, { error: 'Méthode non autorisée' });
    }

    // /api/goals/:id
    const goals = readGoals();
    const idx = goals.findIndex((g) => g.id === id);

    if (req.method === 'GET') {
      if (idx === -1) return sendJson(res, 404, { error: 'But introuvable' });
      return sendJson(res, 200, goals[idx]);
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (idx === -1) return sendJson(res, 404, { error: 'But introuvable' });
      const body = await readBody(req);
      const { errors, value } = validateAndNormalize(body, { partial: true });
      if (errors.length) return sendJson(res, 400, { errors });
      goals[idx] = { ...goals[idx], ...value, updatedAt: new Date().toISOString() };
      writeGoals(goals);
      return sendJson(res, 200, goals[idx]);
    }

    if (req.method === 'DELETE') {
      if (idx === -1) return sendJson(res, 404, { error: 'But introuvable' });
      const [removed] = goals.splice(idx, 1);
      writeGoals(goals);
      return sendJson(res, 200, { deleted: removed.id });
    }

    return sendJson(res, 405, { error: 'Méthode non autorisée' });
  }

  return sendJson(res, 404, { error: 'Route inconnue' });
}

// ---------------------------------------------------------------------------
// Serveur
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const queryObj = Object.fromEntries(parsedUrl.searchParams.entries());

    if (parsedUrl.pathname.startsWith('/api/')) {
      return await handleApi(req, res, { pathname: parsedUrl.pathname, query: queryObj });
    }
    return serveStatic(req, res, req.url);
  } catch (err) {
    console.error('Erreur serveur :', err);
    if (!res.headersSent) sendJson(res, 500, { error: err.message || 'Erreur interne' });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`MessiGoal en écoute sur http://${HOST}:${PORT}`);
  });
}

module.exports = { server, validateAndNormalize, buildStats, filterGoals };
