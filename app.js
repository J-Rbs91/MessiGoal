'use strict';

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
  }
  return Store.cache;
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
    if (sort === 'number') return (a.goalNumber ?? Infinity) - (b.goalNumber ?? Infinity);
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
  try {
    await getAllGoals();
    await loadStats();
    await loadGoals();
  } catch (e) {
    showToast(e.message, true);
  }
}

function populateSelect(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` +
    values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  select.value = current;
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
    showToast(e.message, true);
  }
}

function renderGoals(goals) {
  const body = $('#goals-body');
  $('#empty-state').hidden = goals.length > 0;
  body.innerHTML = goals.map((g) => {
    const typeClass = g.goalType ? 'type-' + g.goalType.replace(/\s+/g, '.') : '';
    const place = [g.stadium, g.city].filter(Boolean).join(' · ');
    const vurl = safeUrl(g.videoUrl);
    const video = vurl
      ? `<a class="video-link" href="${escapeHtml(vurl)}" target="_blank" rel="noopener noreferrer">▶ Voir</a>`
      : '<span class="muted">—</span>';
    return `<tr data-id="${escapeHtml(g.id)}">
      <td data-label="N° du but">${g.goalNumber != null ? '#' + escapeHtml(g.goalNumber) : '—'}</td>
      <td data-label="Date">${formatDate(g.date)}</td>
      <td data-label="Équipe">${escapeHtml(g.team) || '—'}</td>
      <td class="opponent" data-label="Adversaire">${escapeHtml(g.opponent)}</td>
      <td data-label="Compétition">${escapeHtml(g.competition) || '—'}</td>
      <td data-label="Lieu / Stade">${escapeHtml(place) || '—'}</td>
      <td data-label="Minute">${g.minute != null ? escapeHtml(g.minute) + "'" : '—'}</td>
      <td data-label="Position">${escapeHtml(g.position) || '—'}</td>
      <td data-label="Partie du corps">${escapeHtml(g.bodyPart) || '—'}</td>
      <td data-label="Type">${g.goalType ? `<span class="badge ${typeClass}">${escapeHtml(g.goalType)}</span>` : '—'}</td>
      <td data-label="Placement">${escapeHtml(g.placement) || '—'}</td>
      <td data-label="Passe décisive">${escapeHtml(g.assist) || '—'}</td>
      <td data-label="Gardien">${escapeHtml(g.goalkeeper) || '—'}</td>
      <td data-label="Vidéo">${video}</td>
      <td class="actions" data-label="">
        <button class="btn-icon" data-action="edit" title="Proposer une correction">✏️ Proposer</button>
      </td>
    </tr>`;
  }).join('');
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
  $('#btn-save').textContent = 'Proposer sur GitHub';

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

  if (!payload.date || !payload.opponent) {
    const box = $('#form-errors');
    box.innerHTML = '<strong>Champs requis manquants :</strong><ul>' +
      (!payload.date ? '<li>La date est obligatoire.</li>' : '') +
      (!payload.opponent ? "<li>L'équipe adverse est obligatoire.</li>" : '') +
      '</ul>';
    box.hidden = false;
    return;
  }

  openGitHubContribution(payload, editingId);
  $('#goal-dialog').close();
  showToast('Merci ! Finalisez votre contribution sur GitHub.');
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
    const id = btn.closest('tr').dataset.id;
    if (btn.dataset.action === 'edit') {
      const goal = (await getAllGoals()).find((g) => g.id === id);
      openDialog(goal);
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

// Enregistrement du service worker (PWA / hors-ligne)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* ignoré */ });
  });
}
