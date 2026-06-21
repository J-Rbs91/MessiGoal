'use strict';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DEFAULT_META = {
  bodyParts: ['Pied gauche', 'Pied droit', 'Tête', 'Autre'],
  goalTypes: ['En jeu', 'Pénalty', 'Coup franc', 'Contre son camp'],
};

// Dépôt GitHub : utilisé en mode statique (GitHub Pages) pour proposer
// les ajouts / corrections sous forme d'issues à valider par la communauté.
const GITHUB = { owner: 'J-Rbs91', repo: 'MessiGoal' };

let META = { ...DEFAULT_META };
let editingId = null;

// Store : en mode statique, aucune API — on lit goals.json et on calcule
// tout côté client. En mode dynamique, on interroge le backend.
const Store = { static: false, cache: null };

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

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.errors ? data.errors.join(' ') : data.error || 'Erreur';
    throw new Error(msg);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Accès aux données (mode statique vs dynamique)
// ---------------------------------------------------------------------------
async function getAllGoals() {
  if (!Store.cache) {
    const res = await fetch('./goals.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Données indisponibles');
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
    return String(b.date).localeCompare(String(a.date));
  });
  return r;
}

function computeStats(goals) {
  const byCompetition = {};
  const byOpponent = {};
  let withVideo = 0;
  for (const g of goals) {
    if (g.competition) byCompetition[g.competition] = (byCompetition[g.competition] || 0) + 1;
    if (g.opponent) byOpponent[g.opponent] = (byOpponent[g.opponent] || 0) + 1;
    if (g.videoUrl) withVideo++;
  }
  return {
    total: goals.length,
    withVideo,
    byCompetition,
    opponents: Object.keys(byOpponent).length,
  };
}

// ---------------------------------------------------------------------------
// Chargement initial : détection du mode
// ---------------------------------------------------------------------------
async function init() {
  try {
    META = await api('/api/meta'); // backend joignable -> mode dynamique
    Store.static = false;
  } catch (e) {
    Store.static = true; // pas de backend (GitHub Pages) -> mode statique
    META = { ...DEFAULT_META };
  }

  if (Store.static) {
    document.body.classList.add('static-mode');
    $('#contrib-note').innerHTML =
      'Site participatif : proposez vos <strong>ajouts</strong> et <strong>corrections</strong> via GitHub (validés par la communauté).';
  }

  populateSelect($('#filter-bodyPart'), META.bodyParts, 'Toutes parties du corps');
  populateSelect($('#filter-goalType'), META.goalTypes, 'Tous types de but');
  populateSelect($('#select-bodyPart'), META.bodyParts, '—');
  populateSelect($('#select-goalType'), META.goalTypes, '—');

  wireEvents();
  await Promise.all([loadGoals(), loadStats()]);
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

function currentQuery() {
  const o = currentQueryObj();
  const params = new URLSearchParams();
  if (o.q) params.set('q', o.q);
  if (o.competition) params.set('competition', o.competition);
  if (o.bodyPart) params.set('bodyPart', o.bodyPart);
  if (o.goalType) params.set('goalType', o.goalType);
  if (o.hasVideo) params.set('hasVideo', 'true');
  params.set('sort', o.sort);
  return params.toString();
}

let debounceTimer;
function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadGoals, 250);
}

// ---------------------------------------------------------------------------
// Liste des buts
// ---------------------------------------------------------------------------
async function loadGoals() {
  try {
    let goals, count;
    if (Store.static) {
      goals = applyFilters(await getAllGoals(), currentQueryObj());
      count = goals.length;
    } else {
      const data = await api('/api/goals?' + currentQuery());
      goals = data.goals;
      count = data.count;
    }
    renderGoals(goals);
    $('#result-count').textContent =
      count + (count > 1 ? ' buts trouvés' : ' but trouvé');
  } catch (e) {
    showToast(e.message, true);
  }
}

function renderGoals(goals) {
  const body = $('#goals-body');
  $('#empty-state').hidden = goals.length > 0;
  const editLabel = Store.static ? '✏️ Proposer' : '✏️ Corriger';
  body.innerHTML = goals.map((g) => {
    const typeClass = g.goalType ? 'type-' + g.goalType.replace(/\s+/g, '.') : '';
    const place = [g.stadium, g.city].filter(Boolean).join(' · ');
    const video = g.videoUrl
      ? `<a class="video-link" href="${escapeHtml(g.videoUrl)}" target="_blank" rel="noopener">▶ Voir</a>`
      : '<span class="muted">—</span>';
    return `<tr data-id="${g.id}">
      <td data-label="Date">${formatDate(g.date)}</td>
      <td class="opponent" data-label="Adversaire">${escapeHtml(g.opponent)}</td>
      <td data-label="Compétition">${escapeHtml(g.competition) || '—'}</td>
      <td data-label="Lieu / Stade">${escapeHtml(place) || '—'}</td>
      <td data-label="Minute">${g.minute != null ? escapeHtml(g.minute) + "'" : '—'}</td>
      <td data-label="Partie du corps">${escapeHtml(g.bodyPart) || '—'}</td>
      <td data-label="Type">${g.goalType ? `<span class="badge ${typeClass}">${escapeHtml(g.goalType)}</span>` : '—'}</td>
      <td data-label="Gardien">${escapeHtml(g.goalkeeper) || '—'}</td>
      <td data-label="Vidéo">${video}</td>
      <td class="actions" data-label="">
        <button class="btn-icon" data-action="edit" title="Proposer une correction">${editLabel}</button>
        <button class="btn-icon" data-action="delete" title="Supprimer">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------
async function loadStats() {
  try {
    let s;
    if (Store.static) {
      const raw = computeStats(await getAllGoals());
      s = { ...raw };
    } else {
      const api_s = await api('/api/stats');
      s = {
        total: api_s.total,
        withVideo: api_s.withVideo,
        byCompetition: api_s.byCompetition,
        opponents: new Set(api_s.topOpponents.map((o) => o.name)).size + (api_s.total > 10 ? '+' : ''),
      };
    }
    $('#stat-total').textContent = s.total;
    $('#stat-video').textContent = s.withVideo;
    $('#stat-comp').textContent = Object.keys(s.byCompetition).length;
    $('#stat-opp').textContent = s.opponents;

    const sel = $('#filter-competition');
    const comps = Object.keys(s.byCompetition).sort();
    populateSelect(sel, comps, 'Toutes compétitions');
    $('#competitions-list').innerHTML =
      comps.map((c) => `<option value="${escapeHtml(c)}">`).join('');
  } catch (e) { /* silencieux */ }
}

// ---------------------------------------------------------------------------
// Modale ajout / édition
// ---------------------------------------------------------------------------
function openDialog(goal = null) {
  editingId = goal ? goal.id : null;
  const isEdit = !!goal;
  $('#dialog-title').textContent = Store.static
    ? (isEdit ? 'Proposer une correction' : 'Proposer un but')
    : (isEdit ? 'Modifier / corriger un but' : 'Ajouter un but');
  $('#btn-save').textContent = Store.static ? 'Proposer sur GitHub' : 'Enregistrer';

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

// Construit une issue GitHub pré-remplie (mode statique)
function openGitHubContribution(payload, id) {
  const isEdit = !!id;
  const title = (isEdit ? 'Correction : ' : 'Nouveau but : ') +
    (payload.opponent || '?') + ' (' + (payload.date || '?') + ')';

  const rows = [
    ['Date', payload.date],
    ['Équipe adverse', payload.opponent],
    ['Compétition', payload.competition],
    ['Ville / Lieu', payload.city],
    ['Stade', payload.stadium],
    ['Minute', payload.minute],
    ['Partie du corps', payload.bodyPart],
    ['Type de but', payload.goalType],
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

async function submitForm(e) {
  e.preventDefault();
  const form = $('#goal-form');
  const payload = Object.fromEntries(new FormData(form).entries());

  // Validation minimale partagée
  if (!payload.date || !payload.opponent) {
    const box = $('#form-errors');
    box.innerHTML = '<strong>Champs requis manquants :</strong><ul>' +
      (!payload.date ? '<li>La date est obligatoire.</li>' : '') +
      (!payload.opponent ? "<li>L'équipe adverse est obligatoire.</li>" : '') +
      '</ul>';
    box.hidden = false;
    return;
  }

  if (Store.static) {
    openGitHubContribution(payload, editingId);
    $('#goal-dialog').close();
    showToast('Merci ! Finalisez votre contribution sur GitHub.');
    return;
  }

  try {
    if (editingId) {
      await api('/api/goals/' + editingId, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('But mis à jour. Merci pour votre contribution !');
    } else {
      await api('/api/goals', { method: 'POST', body: JSON.stringify(payload) });
      showToast('But ajouté. Merci pour votre contribution !');
    }
    $('#goal-dialog').close();
    await Promise.all([loadGoals(), loadStats()]);
  } catch (err) {
    const box = $('#form-errors');
    box.innerHTML = '<strong>Impossible d\'enregistrer :</strong><ul>' +
      err.message.split('. ').filter(Boolean).map((m) => `<li>${escapeHtml(m)}</li>`).join('') +
      '</ul>';
    box.hidden = false;
  }
}

async function deleteGoal(id) {
  if (Store.static) {
    // Pas de suppression directe en statique : on propose un signalement
    const goal = (await getAllGoals()).find((g) => g.id === id) || {};
    const title = 'Suppression proposée : ' + (goal.opponent || '?') + ' (' + (goal.date || '?') + ')';
    const body = '> Demande de suppression du but `' + id + '` (doublon ou erreur).';
    window.open(
      `https://github.com/${GITHUB.owner}/${GITHUB.repo}/issues/new` +
      `?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent('contribution')}`,
      '_blank', 'noopener'
    );
    return;
  }
  if (!confirm('Supprimer ce but ? Cette action est définitive.')) return;
  try {
    await api('/api/goals/' + id, { method: 'DELETE' });
    showToast('But supprimé.');
    await Promise.all([loadGoals(), loadStats()]);
  } catch (e) {
    showToast(e.message, true);
  }
}

// ---------------------------------------------------------------------------
// Câblage des événements
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
    if (btn.dataset.action === 'delete') return deleteGoal(id);
    if (btn.dataset.action === 'edit') {
      const goal = Store.static
        ? (await getAllGoals()).find((g) => g.id === id)
        : await api('/api/goals/' + id);
      openDialog(goal);
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
