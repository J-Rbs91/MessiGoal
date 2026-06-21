'use strict';

/**
 * Importeur StatsBomb Open Data → buts de Messi en Liga avec le FC Barcelone.
 *
 * Source : https://github.com/statsbomb/open-data (données gratuites StatsBomb).
 * Couverture : compétition « La Liga » (id 11), saisons 2004/05 → 2020/21,
 * soit toute la carrière de Messi en Liga.
 *
 * Pour chaque tir de Messi marqué (Shot / outcome Goal), on extrait : date,
 * adversaire, minute, partie du corps, type de but, position au tir, passeur
 * (key pass) et gardien adverse (freeze frame). Les fichiers déjà présents ne
 * sont jamais écrasés.
 *
 *   node scripts/import-statsbomb.js
 *
 * ⚠️ Attribution requise : « source : StatsBomb » (cf. data user agreement).
 */

const fs = require('fs');
const path = require('path');

const BASE = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data';
const GOALS_DIR = path.join(__dirname, '..', 'data', 'goals');
const MESSI = 'Lionel Andrés Messi Cuccittini';
const SOURCE = 'StatsBomb Open Data (github.com/statsbomb/open-data)';
const CONTRIBUTOR = 'MessiGoal (import StatsBomb)';

// La Liga (compétition 11), saisons 2004/05 → 2020/21 (on exclut 1973/74).
const SEASONS = [37, 38, 39, 40, 41, 21, 22, 23, 24, 25, 26, 27, 2, 1, 4, 42, 90];

const BODY = { 'Left Foot': 'Pied gauche', 'Right Foot': 'Pied droit', 'Head': 'Tête', 'Other': 'Autre' };

function slug(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function fetchJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

function goalType(t) {
  if (t === 'Penalty') return 'Pénalty';
  if (t === 'Free Kick') return 'Coup franc';
  return 'En jeu';
}

// Position au tir à partir des coordonnées StatsBomb (terrain 120 × 80, but en x=120).
function position(loc) {
  if (!Array.isArray(loc)) return '';
  const [x, y] = loc;
  if (x >= 102) return 'Dans la surface';
  const dist = Math.hypot(120 - x, 40 - y); // en yards
  if (dist > 32.8) return 'Loin du but (+30 m)'; // ~30 m
  return 'Hors de la surface';
}

async function main() {
  const matchCount = {};
  let created = 0, skipped = 0, goalsFound = 0, matchesScanned = 0;

  for (const season of SEASONS) {
    const matches = await fetchJson(`${BASE}/matches/11/${season}.json`);
    if (!matches) { console.log(`saison ${season} : aucune donnée`); continue; }
    const barca = matches.filter((m) =>
      m.home_team.home_team_name === 'Barcelona' || m.away_team.away_team_name === 'Barcelona');
    console.log(`saison ${season} : ${barca.length} match(s) du Barça`);

    for (const m of barca) {
      matchesScanned++;
      let events;
      try {
        events = await fetchJson(`${BASE}/events/${m.match_id}.json`);
      } catch (e) {
        console.log(`  ! match ${m.match_id} ignoré (${e.message})`);
        continue;
      }
      if (!events) continue;

      const byId = new Map(events.map((e) => [e.id, e]));
      const opponent = m.home_team.home_team_name === 'Barcelona'
        ? m.away_team.away_team_name : m.home_team.home_team_name;

      const goals = events.filter((e) =>
        e.type && e.type.name === 'Shot' &&
        e.shot && e.shot.outcome && e.shot.outcome.name === 'Goal' &&
        e.player && e.player.name === MESSI &&
        e.period !== 5); // exclut les tirs au but (séances de pénaltys)

      for (const g of goals) {
        goalsFound++;
        const kp = g.shot.key_pass_id ? byId.get(g.shot.key_pass_id) : null;
        const assist = kp && kp.player ? kp.player.name : '';
        let gk = '';
        for (const f of (g.shot.freeze_frame || [])) {
          if (f.position && f.position.name === 'Goalkeeper' && f.teammate === false) {
            gk = f.player.name; break;
          }
        }

        const key = m.match_date + '|' + opponent;
        matchCount[key] = (matchCount[key] || 0) + 1;
        const n = matchCount[key];
        const base = m.match_date + '-' + slug(opponent) + (n > 1 ? '-' + n : '');
        const file = path.join(GOALS_DIR, base + '.json');
        if (fs.existsSync(file)) { skipped++; continue; }

        const goal = {
          date: m.match_date,
          team: 'FC Barcelone',
          opponent,
          competition: 'Liga',
          city: '',
          stadium: (m.stadium && m.stadium.name) || '',
          minute: typeof g.minute === 'number' ? g.minute : null,
          bodyPart: BODY[g.shot.body_part && g.shot.body_part.name] || '',
          goalType: goalType(g.shot.type && g.shot.type.name),
          position: position(g.location),
          placement: '',
          assist,
          goalkeeper: gk,
          videoUrl: '',
          source: SOURCE,
          contributor: CONTRIBUTOR,
        };
        fs.writeFileSync(file, JSON.stringify(goal, null, 2) + '\n', 'utf8');
        created++;
      }
    }
  }
  console.log(`\nTerminé : ${matchesScanned} match(s) scanné(s), ${goalsFound} but(s) Messi trouvé(s), ` +
    `${created} fichier(s) créé(s), ${skipped} déjà présent(s).`);
}

main().catch((e) => { console.error('Échec :', e); process.exit(1); });
