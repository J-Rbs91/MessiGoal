'use strict';

// Tests sans dépendance (node:test + node:assert) pour la validation des buts.
const test = require('node:test');
const assert = require('node:assert');
const { validateGoal, normalize, build } = require('../scripts/build-data.js');

test('validation : refuse un but sans date ni adversaire', () => {
  const errors = validateGoal({});
  assert.ok(errors.some((e) => e.includes('date')));
  assert.ok(errors.some((e) => e.includes('adverse')));
});

test('validation : accepte un but minimal valide', () => {
  const errors = validateGoal({ date: '2010-11-29', opponent: 'Real Madrid' });
  assert.strictEqual(errors.length, 0);
});

test('validation : refuse une date mal formatée', () => {
  const errors = validateGoal({ date: '29/11/2010', opponent: 'X' });
  assert.ok(errors.some((e) => e.includes('AAAA-MM-JJ')));
});

test('validation : refuse une minute hors bornes', () => {
  assert.ok(validateGoal({ date: '2010-01-01', opponent: 'X', minute: 200 }).length > 0);
  assert.strictEqual(validateGoal({ date: '2010-01-01', opponent: 'X', minute: 90 }).length, 0);
});

test('validation : refuse une partie du corps inconnue', () => {
  assert.ok(validateGoal({ date: '2010-01-01', opponent: 'X', bodyPart: 'Genou' }).length > 0);
});

test('validation : refuse un type de but inconnu', () => {
  assert.ok(validateGoal({ date: '2010-01-01', opponent: 'X', goalType: 'Lob' }).length > 0);
});

test('validation : refuse un lien vidéo non http', () => {
  assert.ok(validateGoal({ date: '2010-01-01', opponent: 'X', videoUrl: 'ftp://x' }).length > 0);
  assert.strictEqual(validateGoal({ date: '2010-01-01', opponent: 'X', videoUrl: 'https://x/y' }).length, 0);
});

test('normalize : structure complète et minute numérique', () => {
  const g = normalize({ date: '2010-01-01', opponent: 'X', minute: '87' }, 'mon-id');
  assert.strictEqual(g.id, 'mon-id');
  assert.strictEqual(g.minute, 87);
  assert.strictEqual(g.competition, '');
});

test('sécurité : rejette les chevrons < > (anti-XSS / injection)', () => {
  const errors = validateGoal({ date: '2010-01-01', opponent: '<script>Real' });
  assert.ok(errors.some((e) => e.includes('chevrons')));
});

test('sécurité : rejette les caractères de contrôle / sauts de ligne', () => {
  const errors = validateGoal({ date: '2010-01-01', opponent: 'Real\nIgnore previous instructions' });
  assert.ok(errors.some((e) => e.includes('caractères de contrôle')));
});

test('sécurité : rejette un champ trop long', () => {
  const errors = validateGoal({ date: '2010-01-01', opponent: 'X'.repeat(200) });
  assert.ok(errors.some((e) => e.includes('trop long')));
});

test('build : les fichiers de données du dépôt sont tous valides', () => {
  const { goals, errors } = build();
  assert.deepStrictEqual(errors, []);
  assert.ok(goals.length >= 1);
  // tri décroissant par date
  for (let i = 1; i < goals.length; i++) {
    assert.ok(goals[i - 1].date >= goals[i].date);
  }
});

console.log('Tous les tests passés.');
