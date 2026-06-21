'use strict';

/**
 * Agrège tous les fichiers de buts (data/goals/*.json) en un unique
 * goals.json (à la racine) consommé par le frontend statique.
 *
 *   node scripts/build-data.js          -> génère goals.json
 *   node scripts/build-data.js --check  -> valide seulement (CI), code != 0 si erreur
 *
 * Chaque but est stocké dans son propre fichier sur le dépôt : une
 * contribution = un fichier = une Pull Request, avec un diff propre et
 * sans conflit. Ce script ne fait qu'assembler et valider ces fichiers.
 *
 * Les champs texte libres sont traités comme des données NON FIABLES :
 * on rejette caractères de contrôle, chevrons et longueurs excessives
 * (défense anti-XSS et anti-injection de prompt pour tout agent automatisé).
 */

const fs = require('fs');
const path = require('path');

const GOALS_DIR = path.join(__dirname, '..', 'data', 'goals');
const OUT_FILE = path.join(__dirname, '..', 'goals.json');

const BODY_PARTS = ['Pied gauche', 'Pied droit', 'Tête', 'Autre'];
const GOAL_TYPES = ['En jeu', 'Pénalty', 'Coup franc', 'Contre son camp'];
const POSITIONS = ['Dans la surface', 'Entrée de la surface', 'Hors de la surface', 'Loin du but (+30 m)'];
const PLACEMENTS = [
  'Petit filet gauche', 'Petit filet droit', 'Lucarne gauche', 'Lucarne droite',
  'Sous la barre', 'Ras de terre', 'Poteau rentrant', 'Plein centre', 'Panenka',
];

// Champs texte libres saisis par le public, avec leur longueur maximale.
const TEXT_FIELDS = {
  id: 80, team: 60, opponent: 60, competition: 60, city: 60,
  stadium: 80, assist: 80, goalkeeper: 60, contributor: 60,
};
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]'); // controle
const ANGLE_BRACKETS = /[<>]/;

function validateGoal(goal) {
  const errors = [];
  const isEmpty = (v) => v == null || String(v).trim() === '';

  // Assainissement des champs texte libres (données non fiables)
  for (const [field, maxLen] of Object.entries(TEXT_FIELDS)) {
    if (isEmpty(goal[field])) continue;
    const v = String(goal[field]);
    if (v.length > maxLen) errors.push(field + ' trop long (max ' + maxLen + ' caractères)');
    if (CONTROL_CHARS.test(v)) errors.push(field + ' contient des caractères de contrôle interdits');
    if (ANGLE_BRACKETS.test(v)) errors.push(field + ' contient des chevrons « < » ou « > » interdits');
  }

  if (isEmpty(goal.date)) errors.push('date manquante');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(goal.date)) errors.push('date attendue au format AAAA-MM-JJ');

  if (isEmpty(goal.opponent)) errors.push('équipe adverse manquante');

  if (!isEmpty(goal.minute)) {
    const n = Number(goal.minute);
    if (!Number.isInteger(n) || n < 0 || n > 130) errors.push('minute invalide (entier 0-130)');
  }
  if (!isEmpty(goal.goalNumber)) {
    const n = Number(goal.goalNumber);
    if (!Number.isInteger(n) || n < 1 || n > 2000) errors.push('numéro du but invalide (entier 1-2000)');
  }
  if (!isEmpty(goal.bodyPart) && !BODY_PARTS.includes(goal.bodyPart)) {
    errors.push('partie du corps invalide (' + BODY_PARTS.join(', ') + ')');
  }
  if (!isEmpty(goal.goalType) && !GOAL_TYPES.includes(goal.goalType)) {
    errors.push('type de but invalide (' + GOAL_TYPES.join(', ') + ')');
  }
  if (!isEmpty(goal.position) && !POSITIONS.includes(goal.position)) {
    errors.push('position invalide (' + POSITIONS.join(', ') + ')');
  }
  if (!isEmpty(goal.placement) && !PLACEMENTS.includes(goal.placement)) {
    errors.push('placement invalide (' + PLACEMENTS.join(', ') + ')');
  }
  if (!isEmpty(goal.videoUrl)) {
    const u = String(goal.videoUrl);
    if (u.length > 300) errors.push('lien vidéo trop long (max 300 caractères)');
    if (!/^https?:\/\/\S+$/i.test(u)) {
      errors.push('lien vidéo invalide (doit commencer par http:// ou https://)');
    }
  }
  return errors;
}

function normalize(data, id) {
  return {
    id,
    goalNumber: (data.goalNumber === '' || data.goalNumber == null) ? null : Number(data.goalNumber),
    date: data.date || '',
    team: data.team || '',
    opponent: data.opponent || '',
    competition: data.competition || '',
    city: data.city || '',
    stadium: data.stadium || '',
    minute: (data.minute === '' || data.minute == null) ? null : Number(data.minute),
    bodyPart: data.bodyPart || '',
    goalType: data.goalType || '',
    position: data.position || '',
    placement: data.placement || '',
    assist: data.assist || '',
    goalkeeper: data.goalkeeper || '',
    videoUrl: data.videoUrl || '',
    contributor: data.contributor || '',
  };
}

function build() {
  if (!fs.existsSync(GOALS_DIR)) {
    throw new Error('Dossier introuvable : ' + GOALS_DIR);
  }
  const files = fs.readdirSync(GOALS_DIR).filter((f) => f.endsWith('.json')).sort();
  const goals = [];
  const errors = [];
  const seen = new Set();

  for (const file of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(GOALS_DIR, file), 'utf8'));
    } catch (e) {
      errors.push(file + ' : JSON invalide (' + e.message + ')');
      continue;
    }
    const id = data.id || file.replace(/\.json$/, '');
    if (seen.has(id)) errors.push(file + ' : identifiant en double « ' + id + ' »');
    seen.add(id);
    for (const e of validateGoal(data)) errors.push(file + ' : ' + e);
    goals.push(normalize(data, id));
  }

  goals.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { goals, errors };
}

function main() {
  const check = process.argv.includes('--check');
  const { goals, errors } = build();

  if (errors.length) {
    console.error('✗ ' + errors.length + ' erreur(s) de validation :');
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }

  if (check) {
    console.log('✓ ' + goals.length + ' but(s) valide(s).');
    return;
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(goals, null, 2) + '\n', 'utf8');
  console.log('✓ ' + goals.length + ' but(s) agrégé(s) → ' + path.relative(process.cwd(), OUT_FILE));
}

if (require.main === module) main();

module.exports = { validateGoal, normalize, build, BODY_PARTS, GOAL_TYPES, POSITIONS, PLACEMENTS };
