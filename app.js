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

// Buts sélectionnés pour comparaison (max 2)
const selected = new Set();

// Définition de tous les champs affichables (clé, libellé, formateur)
const FIELDS = [
  ['goalNumber', 'N° du but', (g) => (g.goalNumber != null ? '#' + g.goalNumber : '')],
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
];

// Champs masqués dans la ligne principale, révélés via « Détails »
const DETAIL_KEYS = ['city', 'stadium', 'position', 'bodyPart', 'placement', 'assist', 'goalkeeper'];

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
  updateCompareBar();
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
    const vurl = safeUrl(g.videoUrl);
    const video = vurl
      ? `<a class="video-link" href="${escapeHtml(vurl)}" target="_blank" rel="noopener noreferrer">▶ Voir</a>`
      : '<span class="muted">—</span>';
    const checked = selected.has(g.id) ? 'checked' : '';
    const details = DETAIL_KEYS.map((k) => {
      const f = FIELDS.find((x) => x[0] === k);
      return `<div class="detail-item"><span class="detail-label">${f[1]}</span><span class="detail-value">${escapeHtml(f[2](g)) || '—'}</span></div>`;
    }).join('');
    return `<tr class="goal-row" data-id="${escapeHtml(g.id)}">
      <td class="col-compare" data-label="Comparer"><input type="checkbox" class="compare-check" data-id="${escapeHtml(g.id)}" ${checked} aria-label="Sélectionner pour comparer" /></td>
      <td data-label="N°">${g.goalNumber != null ? '#' + escapeHtml(g.goalNumber) : '—'}</td>
      <td data-label="Date">${formatDate(g.date)}</td>
      <td data-label="Équipe">${escapeHtml(g.team) || '—'}</td>
      <td class="opponent" data-label="Adversaire">${escapeHtml(g.opponent)}</td>
      <td data-label="Compétition">${escapeHtml(g.competition) || '—'}</td>
      <td data-label="Min.">${g.minute != null ? escapeHtml(g.minute) + "'" : '—'}</td>
      <td data-label="Type">${g.goalType ? `<span class="badge ${typeClass}">${escapeHtml(g.goalType)}</span>` : '—'}</td>
      <td data-label="Vidéo">${video}</td>
      <td class="col-details" data-label=""><button class="btn-icon toggle-details" data-action="toggle" aria-expanded="false">▾ Détails</button></td>
      <td class="col-action actions" data-label=""><button class="btn-icon" data-action="edit" title="Proposer une correction">✏️ Proposer</button></td>
    </tr>
    <tr class="details-row" hidden>
      <td colspan="11"><div class="details-grid">${details}</div></td>
    </tr>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Comparaison de deux buts
// ---------------------------------------------------------------------------
function updateCompareBar() {
  const n = selected.size;
  $('#compare-bar').hidden = n === 0;
  $('#compare-info').textContent =
    n + (n > 1 ? ' buts sélectionnés' : ' but sélectionné') + (n < 2 ? ' — choisissez-en 2' : '');
  $('#compare-go').disabled = n !== 2;
}

function clearCompare() {
  selected.clear();
  document.querySelectorAll('.compare-check').forEach((c) => { c.checked = false; });
  updateCompareBar();
}

async function openCompare() {
  if (selected.size !== 2) return;
  const all = await getAllGoals();
  const [a, b] = [...selected].map((id) => all.find((g) => g.id === id)).filter(Boolean);
  if (!a || !b) return;

  const videoCell = (g) => {
    const u = safeUrl(g.videoUrl);
    return u ? `<a class="video-link" href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">▶ Voir</a>` : '—';
  };
  const head = `<thead><tr><th>Champ</th>
    <th>${escapeHtml(a.opponent)}<br><small>${formatDate(a.date)}</small></th>
    <th>${escapeHtml(b.opponent)}<br><small>${formatDate(b.date)}</small></th></tr></thead>`;
  const rows = FIELDS.map(([key, label, fmt]) => {
    const va = String(fmt(a) || '');
    const vb = String(fmt(b) || '');
    const diff = va !== vb ? ' class="diff"' : '';
    return `<tr${diff}><th>${label}</th><td>${escapeHtml(va) || '—'}</td><td>${escapeHtml(vb) || '—'}</td></tr>`;
  }).join('');
  const videoRow = `<tr${safeUrl(a.videoUrl) !== safeUrl(b.videoUrl) ? ' class="diff"' : ''}>` +
    `<th>Vidéo</th><td>${videoCell(a)}</td><td>${videoCell(b)}</td></tr>`;

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
    if (btn.dataset.action === 'edit') {
      const goal = (await getAllGoals()).find((g) => g.id === row.dataset.id);
      openDialog(goal);
    }
  });

  // Sélection pour comparaison (max 2)
  $('#goals-body').addEventListener('change', (e) => {
    const cb = e.target.closest('.compare-check');
    if (!cb) return;
    if (cb.checked) {
      if (selected.size >= 2) {
        cb.checked = false;
        showToast('Vous ne pouvez comparer que 2 buts à la fois.', true);
        return;
      }
      selected.add(cb.dataset.id);
    } else {
      selected.delete(cb.dataset.id);
    }
    updateCompareBar();
  });

  $('#compare-clear').addEventListener('click', clearCompare);
  $('#compare-go').addEventListener('click', openCompare);
  $('#compare-close').addEventListener('click', () => $('#compare-dialog').close());
}

document.addEventListener('DOMContentLoaded', init);

// Enregistrement du service worker (PWA / hors-ligne)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* ignoré */ });
  });
}
