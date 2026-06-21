'use strict';

// Repère de version VISIBLE (affiché en bas de page). Sert à vérifier d'un coup
// d'œil, sur un appareil, si c'est bien la dernière version qui est chargée
// (et pas une ancienne servie par le cache du service worker).
const BUILD = 'v8 — menu déroulant réorganisé · 21 juin';

// ---------------------------------------------------------------------------
// Application 100 % statique (GitHub Pages, sans backend).
// Les buts sont lus depuis goals.json (généré à partir de data/goals/*.json).
// Les ajouts / corrections ouvrent une issue GitHub pré-remplie : la
// communauté valide, puis le but est ajouté au dépôt sous forme de fichier.
// ---------------------------------------------------------------------------

const META = {
  bodyParts: ['Pied gauche', 'Pied droit', 'Tête', 'Autre'],
  goalTypes: ['En jeu', 'Pénalty', 'Coup franc', 'Contre son camp'],
  positions: ['Dans la surface', 'Entrée de la surface', 'Hors de la surface', 'Loin du but (+30 m)'],
  placements: [
    'Petit filet gauche', 'Petit filet droit', 'Lucarne gauche', 'Lucarne droite',
    'Sous la barre', 'Ras de terre', 'Poteau rentrant', 'Plein centre', 'Panenka',
  ],
};

// Dépôt GitHub cible pour les contributions
const GITHUB = { owner: 'J-Rbs91', repo: 'MessiGoal' };

let editingId = null;
const Store = { cache: null };

// Buts sélectionnés pour comparaison (max 4)
const selected = new Set();

// Définition de tous les champs affichables (clé, libellé, formateur)
// Le n° du but est calculé chronologiquement (cf. assignNumbers) : le tout
// premier but de la carrière porte le n°1, le plus récent le n°N.
const FIELDS = [
  ['goalNumber', 'N° du but', (g) => (g._num != null ? formatGoalNumber(g._num) : '')],
  ['date', 'Date', (g) => formatDate(g.date)],
  ['team', 'Équipe de Messi', (g) => g.team],
  ['opponent', 'Adversaire', (g) => g.opponent],
  ['competition', 'Compétition', (g) => g.competition],
  ['city', 'Ville', (g) => g.city],
  ['stadium', 'Stade', (g) => g.stadium],
  ['minute', 'Minute', (g) => (g.minute != null ? g.minute + "'" : '')],
  ['position', 'Position au tir', (g) => g.position],
  ['bodyPart', 'Partie du corps', (g) => g.bodyPart],
  ['goalType', 'Type de but', (g) => g.goalType],
  ['placement', 'Placement', (g) => g.placement],
  ['assist', 'Passe décisive', (g) => g.assist],
  ['goalkeeper', 'Gardien', (g) => g.goalkeeper],
  ['source', 'Source', (g) => g.source],
];

// Données principales affichées directement sur la ligne : n° du but,
// adversaire, compétition. Tout le reste est révélé via « Détails » (un détail
// par ligne). Les blocs reprennent à l'identique les sections du formulaire de
// contribution (index.html) pour que l'organisation soit la même partout.
// Adversaire et compétition ne sont pas répétés ici : ils figurent déjà sur la
// ligne principale.
const DETAIL_GROUPS = [
  ['Informations principales', ['date', 'team', 'minute']],
  ['Détail du but', ['goalType', 'bodyPart', 'position', 'placement']],
  ['Contexte', ['city', 'stadium', 'goalkeeper', 'assist']],
  ['Preuves', ['video', 'source']],
];

const $ = (sel) => document.querySelector(sel);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// N'autorise que les URL http(s) (bloque javascript:, data:, etc.)
function safeUrl(url) {
  const u = String(url ?? '').trim();
  return /^https?:\/\/\S+$/i.test(u) ? u : '';
}

// Libellé court pour une source-URL : le nom de domaine (sans « www. »)
function sourceLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Numéro chronologique formaté comme une donnée de collection : #001, #120, #600
function formatGoalNumber(n) {
  return '#' + String(n).padStart(3, '0');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return escapeHtml(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showToast(message, isError = false) {
  const t = $('#toast');
  t.textContent = message;
  t.className = 'toast' + (isError ? ' error' : '');
  t.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { t.hidden = true; }, 3500);
}

// ---------------------------------------------------------------------------
// Données
// ---------------------------------------------------------------------------
async function getAllGoals() {
  if (!Store.cache) {
    const res = await fetch('./goals.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Données indisponibles (goals.json introuvable)');
    Store.cache = await res.json();
    assignNumbers(Store.cache);
  }
  return Store.cache;
}

// Attribue un n° de but chronologique et stable : tous les buts sont classés
// du plus ancien au plus récent, le plus ancien reçoit le n°1 et le plus
// récent le n°N. Ce numéro (g._num) est calculé une seule fois sur l'ensemble
// des buts : il ne change donc jamais, quels que soient les filtres ou le tri.
function assignNumbers(goals) {
  goals
    .slice()
    .sort((a, b) => {
      const d = String(a.date).localeCompare(String(b.date));
      if (d !== 0) return d;
      return (a.minute ?? 0) - (b.minute ?? 0);
    })
    .forEach((g, i) => { g._num = i + 1; });
}

function applyFilters(goals, q) {
  let r = goals.slice();
  const text = (q.q || '').toLowerCase().trim();
  if (text) {
    r = r.filter((g) =>
      [g.opponent, g.competition, g.stadium, g.city, g.goalkeeper, g.date]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(text))
    );
  }
  if (q.competition) r = r.filter((g) => g.competition === q.competition);
  if (q.bodyPart) r = r.filter((g) => g.bodyPart === q.bodyPart);
  if (q.goalType) r = r.filter((g) => g.goalType === q.goalType);
  if (q.hasVideo) r = r.filter((g) => !!g.videoUrl);

  const sort = q.sort || 'date_desc';
  r.sort((a, b) => {
    if (sort === 'date_asc') return String(a.date).localeCompare(String(b.date));
    if (sort === 'minute') return (a.minute ?? 999) - (b.minute ?? 999);
    if (sort === 'number') return (a._num ?? Infinity) - (b._num ?? Infinity);
    return String(b.date).localeCompare(String(a.date));
  });
  return r;
}

function computeStats(goals) {
  const byCompetition = {};
  const opponents = new Set();
  let withVideo = 0;
  for (const g of goals) {
    if (g.competition) byCompetition[g.competition] = (byCompetition[g.competition] || 0) + 1;
    if (g.opponent) opponents.add(g.opponent);
    if (g.videoUrl) withVideo++;
  }
  return { total: goals.length, withVideo, byCompetition, opponents: opponents.size };
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------
async function init() {
  populateSelect($('#filter-bodyPart'), META.bodyParts, 'Toutes parties du corps');
  populateSelect($('#filter-goalType'), META.goalTypes, 'Tous types de but');
  populateSelect($('#select-bodyPart'), META.bodyParts, '—');
  populateSelect($('#select-goalType'), META.goalTypes, '—');
  populateSelect($('#select-position'), META.positions, '—');
  populateSelect($('#select-placement'), META.placements, '—');

  wireEvents();
  setupInstall();
  updateCompareUI();
  $('#build-stamp').textContent = BUILD;
  try {
    await getAllGoals();
    await loadStats();
    await loadGoals();
  } catch (e) {
    showToast("Une erreur empêche de charger l'archive. Réessayez plus tard.", true);
  } finally {
    // L'archive est chargée (ou en erreur) : on retire le loader.
    $('#loader').hidden = true;
  }
}

function populateSelect(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` +
    values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  select.value = current;
}

// Bouton « Installer l'app » : invite native sur Android/Chrome, instructions
// manuelles sur iPhone/iPad (iOS ne propose pas d'invite automatique).
let deferredInstallPrompt = null;

function setupInstall() {
  const btn = $('#btn-install');
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  if (standalone) return; // déjà installée → pas de bouton

  // Android / Chrome : on capte l'invite native et on affiche le bouton
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btn.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    deferredInstallPrompt = null;
    showToast('Application installée. Merci !');
  });

  // iOS : pas d'invite possible → on montre quand même le bouton (instructions)
  if (isIOS) btn.hidden = false;

  btn.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      btn.hidden = true;
      return;
    }
    $('#install-instructions').innerHTML = isIOS
      ? "Sur iPhone / iPad, dans <strong>Safari</strong> : appuyez sur le bouton " +
        "<strong>Partager</strong> (carré avec une flèche vers le haut), faites défiler, " +
        "puis choisissez <strong>« Sur l'écran d'accueil »</strong>."
      : "Dans le menu de votre navigateur (⋮), choisissez " +
        "<strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong>.";
    $('#install-dialog').showModal();
  });

  $('#install-close').addEventListener('click', () => $('#install-dialog').close());
}

// ---------------------------------------------------------------------------
// Filtres
// ---------------------------------------------------------------------------
function currentQueryObj() {
  return {
    q: $('#filter-q').value.trim(),
    competition: $('#filter-competition').value,
    bodyPart: $('#filter-bodyPart').value,
    goalType: $('#filter-goalType').value,
    hasVideo: $('#filter-hasVideo').checked,
    sort: $('#filter-sort').value,
  };
}

let debounceTimer;
function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadGoals, 250);
}

// ---------------------------------------------------------------------------
// Rendu de la liste
// ---------------------------------------------------------------------------
async function loadGoals() {
  try {
    const goals = applyFilters(await getAllGoals(), currentQueryObj());
    renderGoals(goals);
    $('#result-count').textContent =
      goals.length + (goals.length > 1 ? ' buts trouvés' : ' but trouvé');
  } catch (e) {
    showToast("Une erreur empêche de charger l'archive. Réessayez plus tard.", true);
  }
}

function renderGoals(goals) {
  const body = $('#goals-body');
  $('#empty-state').hidden = goals.length > 0;
  body.innerHTML = goals.map((g) => {
    const isSel = selected.has(g.id);
    const checked = isSel ? 'checked' : '';
    const details = DETAIL_GROUPS.map(([title, keys]) =>
      `<div class="detail-block-title">${title}</div>` + keys.map((k) => detailItem(k, g)).join('')
    ).join('');
    const num = g._num != null
      ? `<span class="goal-no">${escapeHtml(formatGoalNumber(g._num))}</span>`
      : '—';
    return `<tr class="goal-row${isSel ? ' selected' : ''}" data-id="${escapeHtml(g.id)}">
      <td class="col-no" data-label="N°">${num}</td>
      <td class="opponent" data-label="Adversaire">${escapeHtml(g.opponent)}</td>
      <td data-label="Compétition">${escapeHtml(g.competition) || '—'}</td>
      <td class="col-details" data-label=""><button class="btn-icon toggle-details" data-action="toggle" aria-expanded="false">▾ Détails</button></td>
    </tr>
    <tr class="details-row" data-id="${escapeHtml(g.id)}" hidden>
      <td colspan="4">
        <div class="details-grid">${details}</div>
        <div class="details-actions">
          <label class="compare-select"><input type="checkbox" class="compare-check" data-id="${escapeHtml(g.id)}" ${checked} /> Sélectionner ce but pour comparer</label>
          <button class="btn-icon compare-launch" data-action="compare" disabled>⚖ Cochez au moins 2 buts</button>
          <button class="btn-icon" data-action="edit" title="Proposer une correction">✎ Proposer une correction</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  // La sélection persiste entre deux rendus : on resynchronise les boutons
  // « Comparer » des lignes fraîchement rendues.
  updateCompareUI();
}

// Rend une donnée complémentaire (label + valeur) pour le menu déroulant.
// Cas particuliers : vidéo et source → lien cliquable ; type de but → badge.
function detailItem(key, g) {
  // Vidéo : badge bleu avec texte explicite (jamais d'icône seule), pas de
  // rouge si absente — l'absence de vidéo n'est pas une erreur.
  if (key === 'video') {
    const u = safeUrl(g.videoUrl);
    const value = u
      ? `<a class="video-link badge badge-video" href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">▶ Voir la vidéo</a>`
      : '<span class="muted">—</span>';
    return `<div class="detail-item"><span class="detail-label">Vidéo</span><span class="detail-value">${value}</span></div>`;
  }
  const f = FIELDS.find((x) => x[0] === key);
  const raw = f[2](g);
  let value;
  // Source : verte si disponible (lien ou texte), orange « À vérifier » sinon.
  if (key === 'source') {
    if (safeUrl(raw)) {
      value = `<a class="source-link" href="${escapeHtml(safeUrl(raw))}" target="_blank" rel="noopener noreferrer">` +
        `<span class="badge badge-source-ok">Sourcé</span> ${escapeHtml(sourceLabel(raw))}</a>`;
    } else if (raw) {
      value = `<span class="badge badge-source-ok">Sourcé</span> ${escapeHtml(raw)}`;
    } else {
      value = '<span class="badge badge-source-todo">À vérifier</span>';
    }
  } else if (key === 'goalType' && raw) {
    const typeClass = 'type-' + g.goalType.replace(/\s+/g, '.');
    value = `<span class="badge ${typeClass}">${escapeHtml(raw)}</span>`;
  } else {
    value = escapeHtml(raw) || '<span class="muted">Non renseigné</span>';
  }
  const monoKeys = ['date', 'minute'];
  const cls = 'detail-value' + (monoKeys.includes(key) ? ' is-mono' : '');
  return `<div class="detail-item"><span class="detail-label">${f[1]}</span><span class="${cls}">${value}</span></div>`;
}

// ---------------------------------------------------------------------------
// Comparaison de 2 à 4 buts
// ---------------------------------------------------------------------------
// La comparaison se pilote entièrement depuis le menu déplié (« Détails ») :
// plus de barre fixe en bas d'écran. Chaque ligne dépliée propose un bouton
// « Comparer la sélection » qui s'active dès qu'au moins 2 buts sont cochés.
function updateCompareUI() {
  const n = selected.size;
  const label = n >= 2
    ? `⚖ Comparer la sélection (${n})`
    : '⚖ Cochez au moins 2 buts';
  document.querySelectorAll('.compare-launch').forEach((b) => {
    b.disabled = n < 2;
    b.textContent = label;
  });
}

async function openCompare() {
  if (selected.size < 2) return;
  const all = await getAllGoals();
  const goals = [...selected].map((id) => all.find((g) => g.id === id)).filter(Boolean);
  if (goals.length < 2) return;

  const videoCell = (g) => {
    const u = safeUrl(g.videoUrl);
    return u ? `<a class="video-link" href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">▶ Voir la vidéo</a>` : '—';
  };
  // Marqueur accessible : ne pas signaler une différence par la seule couleur.
  const diffTag = '<span class="diff-tag">différent</span>';
  // Une ligne est « différente » dès que les buts comparés n'ont pas tous la
  // même valeur (fonctionne pour 2, 3 ou 4 buts).
  const allEqual = (vals) => vals.every((v) => v === vals[0]);

  const head = '<thead><tr><th>Champ</th>' + goals.map((g) =>
    `<th>But ${escapeHtml(g._num != null ? formatGoalNumber(g._num) : '')}` +
    `<br><small>${escapeHtml(g.opponent)} · ${formatDate(g.date)}</small></th>`
  ).join('') + '</tr></thead>';

  const rows = FIELDS.map(([key, label, fmt]) => {
    const vals = goals.map((g) => String(fmt(g) || ''));
    const isDiff = !allEqual(vals);
    return `<tr${isDiff ? ' class="diff"' : ''}><th>${label}${isDiff ? diffTag : ''}</th>` +
      vals.map((v) => `<td>${escapeHtml(v) || '—'}</td>`).join('') + '</tr>';
  }).join('');

  const vurls = goals.map((g) => safeUrl(g.videoUrl));
  const videoDiff = !allEqual(vurls);
  const videoRow = `<tr${videoDiff ? ' class="diff"' : ''}><th>Vidéo${videoDiff ? diffTag : ''}</th>` +
    goals.map((g) => `<td>${videoCell(g)}</td>`).join('') + '</tr>';

  $('#compare-table').innerHTML = head + '<tbody>' + rows + videoRow + '</tbody>';
  $('#compare-dialog').showModal();
}

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------
async function loadStats() {
  try {
    const s = computeStats(await getAllGoals());
    $('#stat-total').textContent = s.total;
    $('#stat-video').textContent = s.withVideo;
    $('#stat-comp').textContent = Object.keys(s.byCompetition).length;
    $('#stat-opp').textContent = s.opponents;

    const comps = Object.keys(s.byCompetition).sort();
    populateSelect($('#filter-competition'), comps, 'Toutes compétitions');
    $('#competitions-list').innerHTML =
      comps.map((c) => `<option value="${escapeHtml(c)}">`).join('');
  } catch (e) { /* silencieux */ }
}

// ---------------------------------------------------------------------------
// Modale ajout / correction → contribution GitHub
// ---------------------------------------------------------------------------
function openDialog(goal = null) {
  editingId = goal ? goal.id : null;
  $('#dialog-title').textContent = goal ? 'Proposer une correction' : 'Proposer un but';
  $('#btn-save').textContent = 'Envoyer ma contribution';

  const form = $('#goal-form');
  form.reset();
  $('#form-errors').hidden = true;
  if (goal) {
    for (const [k, v] of Object.entries(goal)) {
      if (form.elements[k]) form.elements[k].value = v ?? '';
    }
  }
  $('#goal-dialog').showModal();
}

function openGitHubContribution(payload, id) {
  const isEdit = !!id;
  const title = (isEdit ? 'Correction : ' : 'Nouveau but : ') +
    (payload.opponent || '?') + ' (' + (payload.date || '?') + ')';

  const rows = [
    ['N° du but (carrière)', payload.goalNumber],
    ['Date', payload.date],
    ['Équipe de Messi', payload.team],
    ['Équipe adverse', payload.opponent],
    ['Compétition', payload.competition],
    ['Ville / Lieu', payload.city],
    ['Stade', payload.stadium],
    ['Minute', payload.minute],
    ['Position au tir', payload.position],
    ['Partie du corps', payload.bodyPart],
    ['Type de but', payload.goalType],
    ['Placement dans le but', payload.placement],
    ['Passe décisive', payload.assist],
    ['Gardien adverse', payload.goalkeeper],
    ['Lien vidéo', payload.videoUrl],
    ['Source de la donnée', payload.source],
    ['Contributeur', payload.contributor],
  ];
  const body = [
    isEdit ? '> Correction proposée pour le but `' + id + '`' : '> Proposition d’ajout d’un but',
    '',
    '| Champ | Valeur |',
    '|---|---|',
    ...rows.map(([k, v]) => `| ${k} | ${(v ?? '').toString().replace(/\|/g, '\\|')} |`),
  ].join('\n');

  const url = `https://github.com/${GITHUB.owner}/${GITHUB.repo}/issues/new` +
    `?title=${encodeURIComponent(title)}` +
    `&body=${encodeURIComponent(body)}` +
    `&labels=${encodeURIComponent('contribution')}`;
  window.open(url, '_blank', 'noopener');
}

function submitForm(e) {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData($('#goal-form')).entries());

  const errors = [];
  if (!payload.date) errors.push('La date est obligatoire.');
  if (!payload.opponent) errors.push("L'équipe adverse est obligatoire.");
  // Le lien vidéo, s'il est renseigné, doit être une URL http(s).
  if (payload.videoUrl && !safeUrl(payload.videoUrl)) {
    errors.push('Le lien doit commencer par http:// ou https://.');
  }

  if (errors.length) {
    const box = $('#form-errors');
    box.innerHTML = '<strong>Merci de corriger :</strong><ul>' +
      errors.map((m) => `<li>${m}</li>`).join('') + '</ul>';
    box.hidden = false;
    return;
  }

  openGitHubContribution(payload, editingId);
  $('#goal-dialog').close();
  showToast('Merci ! Finalisez votre contribution participative dans la page qui vient de s’ouvrir.');
}

// ---------------------------------------------------------------------------
// Événements
// ---------------------------------------------------------------------------
function wireEvents() {
  $('#btn-add').addEventListener('click', () => openDialog());
  $('#btn-cancel').addEventListener('click', () => $('#goal-dialog').close());
  $('#goal-form').addEventListener('submit', submitForm);

  ['#filter-competition', '#filter-bodyPart', '#filter-goalType', '#filter-sort', '#filter-hasVideo']
    .forEach((sel) => $(sel).addEventListener('change', loadGoals));
  $('#filter-q').addEventListener('input', debouncedLoad);

  $('#goals-body').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const row = btn.closest('tr');

    if (btn.dataset.action === 'toggle') {
      const details = row.nextElementSibling;
      const open = details.hidden;
      details.hidden = !open;
      row.classList.toggle('expanded', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = (open ? '▴' : '▾') + ' Détails';
      return;
    }
    if (btn.dataset.action === 'compare') {
      openCompare();
      return;
    }
    if (btn.dataset.action === 'edit') {
      const goal = (await getAllGoals()).find((g) => g.id === row.dataset.id);
      openDialog(goal);
    }
  });

  // Sélection pour comparaison (max 4)
  $('#goals-body').addEventListener('change', (e) => {
    const cb = e.target.closest('.compare-check');
    if (!cb) return;
    // La case est dans la ligne « détails » : la ligne principale (mise en
    // surbrillance) est sa sœur précédente.
    const detailsRow = cb.closest('.details-row');
    const row = detailsRow ? detailsRow.previousElementSibling : null;
    if (cb.checked) {
      if (selected.size >= 4) {
        cb.checked = false;
        showToast('Vous pouvez comparer jusqu’à 4 buts à la fois.', true);
        return;
      }
      selected.add(cb.dataset.id);
      if (row) row.classList.add('selected');
    } else {
      selected.delete(cb.dataset.id);
      if (row) row.classList.remove('selected');
    }
    updateCompareUI();
  });

  $('#compare-close').addEventListener('click', () => $('#compare-dialog').close());
}

document.addEventListener('DOMContentLoaded', init);

// Enregistrement du service worker (PWA / hors-ligne) + mise à jour automatique.
// Sans ça, un ancien service worker peut continuer à servir une version périmée
// de l'app même après un rechargement : on force donc la vérification de mise à
// jour, on active immédiatement la nouvelle version, et on recharge une seule
// fois quand elle prend le contrôle.
if ('serviceWorker' in navigator) {
  let swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swReloaded) return;
    swReloaded = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.update();
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          // Nouvelle version installée alors qu'une ancienne contrôle déjà la
          // page → on lui demande de s'activer tout de suite.
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            nw.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    } catch { /* ignoré */ }
  });
}
