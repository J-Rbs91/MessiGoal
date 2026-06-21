'use strict';

// Tests légers sans dépendance (node:assert + node:test).
const test = require('node:test');
const assert = require('node:assert');
const { validateAndNormalize, buildStats, filterGoals } = require('../server.js');

test('validation : refuse un but sans adversaire ni date', () => {
  const { errors } = validateAndNormalize({}, { partial: false });
  assert.ok(errors.length >= 2);
});

test('validation : accepte un but complet et normalise la minute', () => {
  const { errors, value } = validateAndNormalize({
    date: '2010-11-29',
    opponent: 'Real Madrid',
    minute: '87',
    bodyPart: 'Pied gauche',
    goalType: 'En jeu',
  });
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(value.minute, 87);
  assert.strictEqual(value.opponent, 'Real Madrid');
});

test('validation : rejette une partie du corps inconnue', () => {
  const { errors } = validateAndNormalize({
    date: '2010-01-01', opponent: 'X', bodyPart: 'Genou',
  });
  assert.ok(errors.some((e) => e.includes('Partie du corps')));
});

test('validation : rejette un lien vidéo non http', () => {
  const { errors } = validateAndNormalize({
    date: '2010-01-01', opponent: 'X', videoUrl: 'ftp://nope',
  });
  assert.ok(errors.some((e) => e.includes('lien vidéo')));
});

test('validation partielle : autorise la mise à jour d\'un seul champ', () => {
  const { errors, value } = validateAndNormalize({ stadium: 'Camp Nou' }, { partial: true });
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(value.stadium, 'Camp Nou');
  assert.strictEqual(value.opponent, undefined);
});

test('stats : agrège correctement', () => {
  const goals = [
    { competition: 'Liga', bodyPart: 'Pied gauche', goalType: 'En jeu', opponent: 'A', videoUrl: 'http://x' },
    { competition: 'Liga', bodyPart: 'Tête', goalType: 'Pénalty', opponent: 'A', videoUrl: '' },
  ];
  const s = buildStats(goals);
  assert.strictEqual(s.total, 2);
  assert.strictEqual(s.withVideo, 1);
  assert.strictEqual(s.byCompetition.Liga, 2);
  assert.strictEqual(s.topOpponents[0].name, 'A');
});

test('filtres : recherche texte et tri', () => {
  const goals = [
    { date: '2010-01-01', opponent: 'Getafe', stadium: 'Camp Nou', minute: 28 },
    { date: '2012-01-01', opponent: 'Real Madrid', stadium: 'Bernabéu', minute: 5 },
  ];
  const r = filterGoals(goals, { q: 'getafe' });
  assert.strictEqual(r.length, 1);
  const sorted = filterGoals(goals, { sort: 'date_asc' });
  assert.strictEqual(sorted[0].opponent, 'Getafe');
});

console.log('Tous les tests passés.');
