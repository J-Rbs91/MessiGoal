'use strict';

// ---------------------------------------------------------------------------
// État + helpers
// ---------------------------------------------------------------------------
let META = { bodyParts: [], goalTypes: [] };
let editingId = null;

const $ = (sel) => document.querySelector(sel);

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
  showToast._t = setTimeout(() => { t.hidden = true; }, 3000);
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
// Chargement initial
// ---------------------------------------------------------------------------
async function init() {
  try {
    META = await api('/api/meta');
  } catch (e) { /* valeurs par défaut */ }

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
// Filtres -> query string
// ---------------------------------------------------------------------------
function currentQuery() {
  const params = new URLSearchParams();
  const q = $('#filter-q').value.trim();
  if (q) params.set('q', q);
  if ($('#filter-competition').value) params.set('competition', $('#filter-competition').value);
  if ($('#filter-bodyPart').value) params.set('bodyPart', $('#filter-bodyPart').value);
  if ($('#filter-goalType').value) params.set('goalType', $('#filter-goalType').value);
  if ($('#filter-hasVideo').checked) params.set('hasVideo', 'true');
  params.set('sort', $('#filter-sort').value);
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
    const data = await api('/api/goals?' + currentQuery());
    renderGoals(data.goals);
    $('#result-count').textContent =
      data.count + (data.count > 1 ? ' buts trouvés' : ' but trouvé');
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
        <button class="btn-icon" data-action="edit" title="Modifier / corriger">✏️ Corriger</button>
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
    const s = await api('/api/stats');
    $('#stat-total').textContent = s.total;
    $('#stat-video').textContent = s.withVideo;
    $('#stat-comp').textContent = Object.keys(s.byCompetition).length;
    $('#stat-opp').textContent = s.topOpponents.length
      ? new Set(s.topOpponents.map((o) => o.name)).size + (s.total > 10 ? '+' : '')
      : 0;

    // Liste déroulante des compétitions (filtre)
    const sel = $('#filter-competition');
    const comps = Object.keys(s.byCompetition).sort();
    populateSelect(sel, comps, 'Toutes compétitions');

    // Datalist du formulaire
    $('#competitions-list').innerHTML =
      comps.map((c) => `<option value="${escapeHtml(c)}">`).join('');
  } catch (e) { /* silencieux */ }
}

// ---------------------------------------------------------------------------
// Modale ajout / édition
// ---------------------------------------------------------------------------
function openDialog(goal = null) {
  editingId = goal ? goal.id : null;
  $('#dialog-title').textContent = goal ? 'Modifier / corriger un but' : 'Ajouter un but';
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

async function submitForm(e) {
  e.preventDefault();
  const form = $('#goal-form');
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());

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
      const goal = await api('/api/goals/' + id);
      openDialog(goal);
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
