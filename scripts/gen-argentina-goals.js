'use strict';

/**
 * Générateur ponctuel : crée un fichier data/goals/*.json par but international
 * de Lionel Messi avec l'Argentine (source : Wikipédia, « List of international
 * goals scored by Lionel Messi », 120 buts).
 *
 * On ne renseigne que les champs vérifiables (date, équipe, adversaire,
 * compétition, ville, stade). Les champs inconnus (minute, gardien, passeur,
 * partie du corps…) restent vides : la communauté les complétera.
 *
 * Les fichiers déjà présents (buts déjà saisis avec plus de détails) ne sont
 * jamais écrasés.
 */

const fs = require('fs');
const path = require('path');

const GOALS_DIR = path.join(__dirname, '..', 'data', 'goals');

// [date, adversaire (fr), compétition (fr), stade, ville]
// stade/ville vides = non documentés.
const GOALS = [
  ['2006-03-01', 'Croatie', 'Match amical', 'St. Jakob-Park', 'Bâle'],
  ['2006-06-16', 'Serbie-et-Monténégro', 'Coupe du monde', 'Arena AufSchalke', 'Gelsenkirchen'],
  ['2007-06-05', 'Algérie', 'Match amical', 'Camp Nou', 'Barcelone'],
  ['2007-06-05', 'Algérie', 'Match amical', 'Camp Nou', 'Barcelone'],
  ['2007-07-08', 'Pérou', 'Copa América', 'Estadio Metropolitano de Lara', 'Barquisimeto'],
  ['2007-07-11', 'Mexique', 'Copa América', 'Polideportivo Cachamay', 'Puerto Ordaz'],
  ['2007-10-16', 'Venezuela', 'Qualifications Coupe du monde', 'Estadio José Pachencho Romero', 'Maracaibo'],
  ['2007-11-20', 'Colombie', 'Qualifications Coupe du monde', 'Estadio El Campín', 'Bogota'],
  ['2008-06-04', 'Mexique', 'Match amical', 'Qualcomm Stadium', 'San Diego'],
  ['2008-10-11', 'Uruguay', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2009-02-11', 'France', 'Match amical', 'Stade Vélodrome', 'Marseille'],
  ['2009-03-28', 'Venezuela', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2009-11-14', 'Espagne', 'Match amical', 'Estadio Vicente Calderón', 'Madrid'],
  ['2010-09-07', 'Espagne', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2010-11-17', 'Brésil', 'Match amical', 'Khalifa International Stadium', 'Doha'],
  ['2011-02-09', 'Portugal', 'Match amical', 'Stade de Genève', 'Genève'],
  ['2011-06-20', 'Albanie', 'Match amical', 'Estadio Monumental', 'Buenos Aires'],
  ['2011-10-07', 'Chili', 'Qualifications Coupe du monde', '', ''],
  ['2011-11-15', 'Colombie', 'Qualifications Coupe du monde', 'Estadio Metropolitano Roberto Meléndez', 'Barranquilla'],
  ['2012-02-29', 'Suisse', 'Match amical', 'Stade de Suisse', 'Berne'],
  ['2012-02-29', 'Suisse', 'Match amical', 'Stade de Suisse', 'Berne'],
  ['2012-02-29', 'Suisse', 'Match amical', 'Stade de Suisse', 'Berne'],
  ['2012-06-02', 'Équateur', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2012-06-09', 'Brésil', 'Match amical', 'MetLife Stadium', 'East Rutherford'],
  ['2012-06-09', 'Brésil', 'Match amical', 'MetLife Stadium', 'East Rutherford'],
  ['2012-06-09', 'Brésil', 'Match amical', 'MetLife Stadium', 'East Rutherford'],
  ['2012-08-15', 'Allemagne', 'Match amical', 'Waldstadion', 'Francfort'],
  ['2012-09-07', 'Paraguay', 'Qualifications Coupe du monde', 'Estadio Mario Alberto Kempes', 'Córdoba'],
  ['2012-10-12', 'Uruguay', 'Qualifications Coupe du monde', 'Estadio Malvinas Argentinas', 'Mendoza'],
  ['2012-10-12', 'Uruguay', 'Qualifications Coupe du monde', 'Estadio Malvinas Argentinas', 'Mendoza'],
  ['2012-10-16', 'Chili', 'Qualifications Coupe du monde', 'Estadio Nacional Julio Martínez Prádanos', 'Santiago'],
  ['2013-03-22', 'Venezuela', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2013-06-14', 'Guatemala', 'Match amical', 'Estadio Nacional Mateo Flores', 'Guatemala'],
  ['2013-06-14', 'Guatemala', 'Match amical', 'Estadio Nacional Mateo Flores', 'Guatemala'],
  ['2013-06-14', 'Guatemala', 'Match amical', 'Estadio Nacional Mateo Flores', 'Guatemala'],
  ['2013-09-10', 'Paraguay', 'Qualifications Coupe du monde', 'Estadio Defensores del Chaco', 'Asunción'],
  ['2013-09-10', 'Paraguay', 'Qualifications Coupe du monde', 'Estadio Defensores del Chaco', 'Asunción'],
  ['2014-06-07', 'Slovénie', 'Match amical', 'Estadio Ciudad de La Plata', 'La Plata'],
  ['2014-06-15', 'Bosnie-Herzégovine', 'Coupe du monde', 'Maracanã', 'Rio de Janeiro'],
  ['2014-06-21', 'Iran', 'Coupe du monde', 'Mineirão', 'Belo Horizonte'],
  ['2014-06-25', 'Nigeria', 'Coupe du monde', 'Beira-Rio', 'Porto Alegre'],
  ['2014-06-25', 'Nigeria', 'Coupe du monde', 'Beira-Rio', 'Porto Alegre'],
  ['2014-10-14', 'Hong Kong', 'Match amical', 'Hong Kong Stadium', 'Hong Kong'],
  ['2014-10-14', 'Hong Kong', 'Match amical', 'Hong Kong Stadium', 'Hong Kong'],
  ['2014-11-12', 'Croatie', 'Match amical', 'Upton Park', 'Londres'],
  ['2015-06-13', 'Paraguay', 'Copa América', 'Estadio La Portada', 'La Serena'],
  ['2015-09-04', 'Bolivie', 'Match amical', 'BBVA Compass Stadium', 'Houston'],
  ['2015-09-04', 'Bolivie', 'Match amical', 'BBVA Compass Stadium', 'Houston'],
  ['2015-09-08', 'Mexique', 'Match amical', 'AT&T Stadium', 'Arlington'],
  ['2016-03-29', 'Bolivie', 'Qualifications Coupe du monde', 'Estadio Mario Alberto Kempes', 'Córdoba'],
  ['2016-06-10', 'Panama', 'Copa América', 'Soldier Field', 'Chicago'],
  ['2016-06-10', 'Panama', 'Copa América', 'Soldier Field', 'Chicago'],
  ['2016-06-10', 'Panama', 'Copa América', 'Soldier Field', 'Chicago'],
  ['2016-06-18', 'Venezuela', 'Copa América', 'Gillette Stadium', 'Foxborough'],
  ['2016-06-21', 'États-Unis', 'Copa América', 'NRG Stadium', 'Houston'],
  ['2016-09-01', 'Uruguay', 'Qualifications Coupe du monde', 'Estadio Malvinas Argentinas', 'Mendoza'],
  ['2016-11-15', 'Colombie', 'Qualifications Coupe du monde', 'Estadio San Juan del Bicentenario', 'San Juan'],
  ['2017-03-23', 'Chili', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2017-10-10', 'Équateur', 'Qualifications Coupe du monde', 'Estadio Olímpico Atahualpa', 'Quito'],
  ['2017-10-10', 'Équateur', 'Qualifications Coupe du monde', 'Estadio Olímpico Atahualpa', 'Quito'],
  ['2017-10-10', 'Équateur', 'Qualifications Coupe du monde', 'Estadio Olímpico Atahualpa', 'Quito'],
  ['2018-05-29', 'Haïti', 'Match amical', 'La Bombonera', 'Buenos Aires'],
  ['2018-05-29', 'Haïti', 'Match amical', 'La Bombonera', 'Buenos Aires'],
  ['2018-05-29', 'Haïti', 'Match amical', 'La Bombonera', 'Buenos Aires'],
  ['2018-06-26', 'Nigeria', 'Coupe du monde', 'Krestovsky Stadium', 'Saint-Pétersbourg'],
  ['2019-06-07', 'Nicaragua', 'Match amical', 'Estadio San Juan del Bicentenario', 'San Juan'],
  ['2019-06-07', 'Nicaragua', 'Match amical', 'Estadio San Juan del Bicentenario', 'San Juan'],
  ['2019-06-19', 'Paraguay', 'Copa América', 'Mineirão', 'Belo Horizonte'],
  ['2019-11-15', 'Brésil', 'Superclásico de las Américas', 'King Saud University Stadium', 'Riyad'],
  ['2019-11-18', 'Uruguay', 'Match amical', 'Bloomfield Stadium', 'Tel Aviv'],
  ['2020-10-08', 'Équateur', 'Qualifications Coupe du monde', 'La Bombonera', 'Buenos Aires'],
  ['2021-06-03', 'Chili', 'Qualifications Coupe du monde', 'Estadio Único Madre de Ciudades', 'Santiago del Estero'],
  ['2021-06-14', 'Brésil', 'Copa América', 'Estádio Olímpico Nilton Santos', 'Rio de Janeiro'],
  ['2021-06-28', 'Bolivie', 'Copa América', 'Arena Pantanal', 'Cuiabá'],
  ['2021-06-28', 'Bolivie', 'Copa América', 'Arena Pantanal', 'Cuiabá'],
  ['2021-07-03', 'Équateur', 'Copa América', 'Estádio Olímpico Pedro Ludovico', 'Goiânia'],
  ['2021-09-09', 'Bolivie', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2021-09-09', 'Bolivie', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2021-09-09', 'Bolivie', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2021-10-10', 'Uruguay', 'Qualifications Coupe du monde', '', ''],
  ['2022-03-25', 'Venezuela', 'Qualifications Coupe du monde', 'La Bombonera', 'Buenos Aires'],
  ['2022-06-05', 'Estonie', 'Match amical', 'Estadio El Sadar', 'Pampelune'],
  ['2022-06-05', 'Estonie', 'Match amical', 'Estadio El Sadar', 'Pampelune'],
  ['2022-06-05', 'Estonie', 'Match amical', 'Estadio El Sadar', 'Pampelune'],
  ['2022-06-05', 'Estonie', 'Match amical', 'Estadio El Sadar', 'Pampelune'],
  ['2022-06-05', 'Estonie', 'Match amical', 'Estadio El Sadar', 'Pampelune'],
  ['2022-09-23', 'Honduras', 'Match amical', 'Hard Rock Stadium', 'Miami Gardens'],
  ['2022-09-23', 'Honduras', 'Match amical', 'Hard Rock Stadium', 'Miami Gardens'],
  ['2022-09-27', 'Jamaïque', 'Match amical', 'Red Bull Arena', 'Harrison'],
  ['2022-09-27', 'Jamaïque', 'Match amical', 'Red Bull Arena', 'Harrison'],
  ['2022-11-16', 'Émirats arabes unis', 'Match amical', 'Mohammed bin Zayed Stadium', 'Abou Dabi'],
  ['2022-11-22', 'Arabie saoudite', 'Coupe du monde', 'Stade de Lusail', 'Lusail'],
  // 2022-11-26 Mexique : déjà présent (fichier détaillé) -> ignoré
  ['2022-12-03', 'Australie', 'Coupe du monde', 'Ahmad bin Ali Stadium', 'Al Rayyan'],
  ['2022-12-09', 'Pays-Bas', 'Coupe du monde', 'Stade de Lusail', 'Lusail'],
  // 2022-12-13 Croatie + 2022-12-18 France (x2) : déjà présents -> ignorés
  ['2023-03-23', 'Panama', 'Match amical', 'Estadio Monumental', 'Buenos Aires'],
  ['2023-03-28', 'Curaçao', 'Match amical', 'Estadio Único Madre de Ciudades', 'Santiago del Estero'],
  ['2023-03-28', 'Curaçao', 'Match amical', 'Estadio Único Madre de Ciudades', 'Santiago del Estero'],
  ['2023-03-28', 'Curaçao', 'Match amical', 'Estadio Único Madre de Ciudades', 'Santiago del Estero'],
  ['2023-06-15', 'Australie', 'Match amical', "Workers' Stadium", 'Pékin'],
  ['2023-09-07', 'Équateur', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2023-10-17', 'Pérou', 'Qualifications Coupe du monde', 'Estadio Nacional de Lima', 'Lima'],
  ['2023-10-17', 'Pérou', 'Qualifications Coupe du monde', 'Estadio Nacional de Lima', 'Lima'],
  ['2024-06-14', 'Guatemala', 'Match amical', 'Commanders Field', 'Landover'],
  ['2024-06-14', 'Guatemala', 'Match amical', 'Commanders Field', 'Landover'],
  ['2024-07-09', 'Canada', 'Copa América', 'MetLife Stadium', 'East Rutherford'],
  ['2024-10-15', 'Bolivie', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2024-10-15', 'Bolivie', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2024-10-15', 'Bolivie', 'Qualifications Coupe du monde', 'Estadio Monumental', 'Buenos Aires'],
  ['2025-09-04', 'Venezuela', 'Qualifications Coupe du monde', '', ''],
  ['2025-09-04', 'Venezuela', 'Qualifications Coupe du monde', '', ''],
  ['2025-11-14', 'Angola', 'Match amical', 'Estádio 11 de Novembro', 'Luanda'],
  ['2026-03-31', 'Zambie', 'Qualifications Coupe du monde', 'La Bombonera', 'Buenos Aires'],
  ['2026-06-09', 'Islande', 'Qualifications Coupe du monde', 'Jordan-Hare Stadium', 'Auburn'],
  ['2026-06-16', 'Algérie', 'Coupe du monde', 'Arrowhead Stadium', 'Kansas City'],
  ['2026-06-16', 'Algérie', 'Coupe du monde', 'Arrowhead Stadium', 'Kansas City'],
  ['2026-06-16', 'Algérie', 'Coupe du monde', 'Arrowhead Stadium', 'Kansas City'],
];

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Compteur d'occurrences par match (date + adversaire) pour suffixer.
const matchCount = {};
let created = 0;
let skipped = 0;

for (const [date, opp, comp, stadium, city] of GOALS) {
  const key = date + '|' + opp;
  matchCount[key] = (matchCount[key] || 0) + 1;
  const n = matchCount[key];
  const base = date + '-' + slug(opp) + (n > 1 ? '-' + n : '');
  const file = path.join(GOALS_DIR, base + '.json');

  if (fs.existsSync(file)) { skipped++; continue; }

  const goal = {
    date,
    team: 'Argentine',
    opponent: opp,
    competition: comp,
    city,
    stadium,
    minute: null,
    bodyPart: '',
    goalType: '',
    position: '',
    placement: '',
    assist: '',
    goalkeeper: '',
    videoUrl: '',
    contributor: 'MessiGoal',
  };
  fs.writeFileSync(file, JSON.stringify(goal, null, 2) + '\n', 'utf8');
  created++;
}

console.log('Buts internationaux : ' + created + ' fichier(s) créé(s), ' + skipped + ' déjà présent(s).');
