const STORAGE_PROGRESS = 'gta6-atlas-progress-v1';
const STORAGE_FILTER = 'gta6-atlas-filter-v1';
const DATA_URL = 'data/trophies.json';

const state = {
  trophies: [],
  earned: new Set(),
  activeFilter: 'all',
  searchQuery: '',
  spoilerMode: true,
  selectedId: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function esc(value) {
  if (value === undefined || value === null || value === '') return '\u2014';
  return String(value);
}

function create(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.entries(value).forEach(([k, v]) => (el.dataset[k] = v));
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else el.setAttribute(key, value);
  });
  children.flat().forEach((child) => {
    if (child == null) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return el;
}

function gradeChip(grade) {
  return create('span', { class: `grade-chip grade-${esc(grade).toLowerCase()}` }, esc(grade).toUpperCase());
}

function isSpoiler(trophy) {
  return state.spoilerMode && trophy.kind === 'story' && !state.earned.has(trophy.id);
}

function matchesFilter(trophy) {
  const f = state.activeFilter;
  if (f === 'all') return true;
  if (f === 'missable') return trophy.missable === true;
  if (f === 'roadmap') return !!trophy.roadmap;
  return (trophy.kind || '').toLowerCase() === f.toLowerCase();
}

function matchesSearch(trophy) {
  const q = state.searchQuery.toLowerCase();
  if (!q) return true;
  const hay = [
    trophy.name,
    trophy.description,
    trophy.roadmap,
    trophy.guide,
    trophy.kind,
    trophy.grade,
    ...(trophy.steps || []),
    ...(trophy.sources || []),
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

function buildListItem(trophy) {
  const earned = state.earned.has(trophy.id);
  const spoiler = isSpoiler(trophy);

  const checkbox = create('input', {
    type: 'checkbox',
    class: 'trophy-check',
    'aria-label': `Mark ${esc(trophy.name)} as earned`,
    onchange: () => toggleEarned(trophy.id),
  });
  checkbox.checked = earned;

  const nameEl = create('span', { class: 'trophy-name' }, spoiler ? '???' : esc(trophy.name));
  const descEl = create('span', { class: 'trophy-desc' }, spoiler ? 'Hidden (story trophy)' : esc(trophy.description));
  const missableBadge = trophy.missable ? create('span', { class: 'missable-badge' }, 'MISSABLE') : null;

  const header = create('div', { class: 'trophy-header' }, nameEl, gradeChip(trophy.grade), missableBadge);
  const info = create('div', { class: 'trophy-info' }, header, descEl);

  return create('li', {
    class: `trophy-row ${earned ? 'earned' : ''} ${spoiler ? 'spoiler-blur' : ''}`,
    dataset: { id: trophy.id },
    role: 'option',
    'aria-selected': earned,
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTrophy(trophy.id); } },
    onclick: () => selectTrophy(trophy.id),
  }, checkbox, info);
}

function renderList() {
  const list = $('#trophyList');
  const countEl = $('#trophyCount');
  if (!list) return;

  const filtered = state.trophies.filter((t) => matchesFilter(t) && matchesSearch(t));
  list.replaceChildren(...filtered.map(buildListItem));
  if (countEl) countEl.textContent = filtered.length;
}

function renderDetail(trophyId) {
  const detail = $('#detailContent');
  const placeholder = $('#detailPlaceholder');
  if (!detail || !placeholder) return;

  const trophy = state.trophies.find((t) => t.id === trophyId);
  if (!trophy) {
    detail.replaceChildren();
    detail.classList.add('hidden');
    detail.classList.remove('detail');
    placeholder.hidden = false;
    return;
  }

  const earned = state.earned.has(trophyId);
  const spoiler = isSpoiler(trophy);

  placeholder.hidden = true;
  detail.hidden = false;
  detail.classList.add('detail');
  detail.classList.remove('hidden');

  const titleRow = create('div', { class: 'detail-title-row' },
    create('h3', { class: `detail-name ${spoiler ? 'spoiler-blur' : ''}` }, spoiler ? '???' : esc(trophy.name)),
    gradeChip(trophy.grade),
    trophy.missable ? create('span', { class: 'missable-badge' }, 'MISSABLE') : null
  );

  const header = create('header', { class: 'detail-header' },
    titleRow,
    create('p', { class: `detail-desc ${spoiler ? 'spoiler-blur' : ''}` }, spoiler ? 'Description hidden (story trophy). Earn the trophy to reveal.' : esc(trophy.description))
  );

  const guide = create('section', { class: 'detail-guide' },
    create('h4', {}, 'Guide'),
    create('p', {}, esc(trophy.guide))
  );

  const missableWarning = trophy.missable
    ? create('div', { class: 'missable-warning' }, '⚠ This trophy is missable — complete it before the indicated roadmap stage or it may become unobtainable.')
    : null;

  const metaItems = [];
  if (trophy.rarity) metaItems.push(create('span', { class: 'meta-item' }, `Rarity: ${esc(trophy.rarity)}`));
  if (trophy.time) metaItems.push(create('span', { class: 'meta-item' }, `Est. Time: ${esc(trophy.time)}`));
  if (trophy.roadmap) metaItems.push(create('span', { class: 'meta-item' }, `Roadmap: ${esc(trophy.roadmap)}`));
  const meta = metaItems.length ? create('div', { class: 'detail-meta' }, ...metaItems) : null;

  const steps = (trophy.steps || []).length
    ? create('section', { class: 'detail-steps' },
        create('h4', {}, 'Steps'),
        create('ol', { class: 'steps-list' }, ...trophy.steps.map((s) => create('li', {}, esc(s))))
      )
    : null;

  const sources = (trophy.sources || []).length
    ? create('section', { class: 'detail-sources' },
        create('h4', {}, 'Sources'),
        create('ul', { class: 'sources-list' }, ...trophy.sources.map((s) => create('li', {}, esc(s))))
      )
    : null;

  const actions = create('div', { class: 'detail-actions' },
    create('button', {
      class: 'btn-primary',
      onclick: () => toggleEarned(trophyId),
    }, earned ? 'Mark Unearned' : 'Mark Earned')
  );

  detail.replaceChildren(header, guide, missableWarning, meta, steps, sources, actions);
}

function updateProgress() {
  const total = state.trophies.length;
  const earned = state.earned.size;
  const pct = total ? Math.round((earned / total) * 100) : 0;

  const fill = $('.progress-fill');
  const bar = $('.progress-track');
  const text = $('#progressText');

  if (fill) fill.style.width = `${pct}%`;
  if (bar) bar.setAttribute('aria-valuenow', pct);
  if (text) text.textContent = `${pct}% earned (${earned} of ${total})`;
}

function roadmapOrder(roadmap) {
  const order = { prologue: 0, 'chapter 1': 1, 'chapter 2': 2, 'chapter 3': 3, 'chapter 4': 4, endgame: 5, cleanup: 6 };
  return order[(roadmap || '').toLowerCase()] ?? 99;
}

function renderRoadmap() {
  const container = $('#roadmapContainer');
  if (!container) return;

  const stages = [...new Set(state.trophies.map((t) => t.roadmap).filter(Boolean))]
    .sort((a, b) => roadmapOrder(a) - roadmapOrder(b));

  container.replaceChildren(...stages.map((stage) => {
    const stageTrophies = state.trophies.filter((t) => t.roadmap === stage);
    const earnedCount = stageTrophies.filter((t) => state.earned.has(t.id)).length;
    const total = stageTrophies.length;
    const pct = total ? Math.round((earnedCount / total) * 100) : 0;

    return create('div', { class: 'roadmap-stage' },
      create('header', { class: 'stage-header' },
        create('h3', {}, esc(stage)),
        create('div', { class: 'stage-progress' },
          create('span', {}, `${earnedCount} / ${total}`),
          create('div', { class: 'mini-bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
            create('div', { class: 'mini-fill', style: { width: `${pct}%` } })
          )
        )
      ),
      create('ul', { class: 'stage-trophies' },
        ...stageTrophies.map((t) => {
          const earned = state.earned.has(t.id);
          const spoiler = isSpoiler(t);
          return create('li', {
            class: `stage-trophy ${earned ? 'earned' : ''} ${spoiler ? 'spoiler-blur' : ''}`,
            onclick: () => selectTrophy(t.id),
          },
            create('input', { type: 'checkbox', class: 'trophy-check', onchange: () => toggleEarned(t.id), checked: earned }),
            create('span', { class: 'stage-name' }, spoiler ? '???' : esc(t.name)),
            gradeChip(t.grade)
          );
        })
      )
    );
  }));
}

function updateFilterButtons() {
  $$('.filter-btn').forEach((btn) => {
    const active = btn.dataset.filter === state.activeFilter;
    btn.classList.toggle('is-active', active);
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active);
  });
}

function toggleEarned(trophyId) {
  if (state.earned.has(trophyId)) state.earned.delete(trophyId);
  else state.earned.add(trophyId);
  persistProgress();
  renderList();
  if (state.selectedId === trophyId) renderDetail(trophyId);
  updateProgress();
  renderRoadmap();
}

function selectTrophy(trophyId) {
  state.selectedId = trophyId;
  $$('.trophy-row', $('#trophyList')).forEach((row) => row.setAttribute('aria-selected', row.dataset.id == trophyId));
  renderDetail(trophyId);
}

function persistProgress() {
  try { localStorage.setItem(STORAGE_PROGRESS, JSON.stringify([...state.earned])); } catch (_) {}
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_PROGRESS);
    if (raw) state.earned = new Set(JSON.parse(raw));
  } catch (_) {}
}

function persistFilter() {
  try { localStorage.setItem(STORAGE_FILTER, state.activeFilter); } catch (_) {}
}

function loadFilter() {
  try {
    const saved = localStorage.getItem(STORAGE_FILTER);
    if (saved) state.activeFilter = saved;
  } catch (_) {}
}

function exportProgress() {
  const data = { earned: [...state.earned], exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = create('a', { href: url, download: 'trophies-progress.json' });
  a.click();
  URL.revokeObjectURL(url);
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const ids = Array.isArray(data.earned) ? data.earned : (Array.isArray(data) ? data : []);
      state.earned = new Set(ids.filter(Number.isInteger));
      persistProgress();
      renderList();
      updateProgress();
      renderRoadmap();
      if (state.selectedId) renderDetail(state.selectedId);
    } catch (_) {}
  };
  reader.readAsText(file);
}

function resetProgress() {
  if (!confirm('Reset ALL trophy progress? This cannot be undone.')) return;
  state.earned.clear();
  persistProgress();
  renderList();
  updateProgress();
  renderRoadmap();
  if (state.selectedId) renderDetail(state.selectedId);
}

function setFilter(filter) {
  state.activeFilter = filter;
  persistFilter();
  updateFilterButtons();
  renderList();
}

function setSearch(query) {
  state.searchQuery = query;
  renderList();
}

function toggleSpoilerMode(enabled) {
  state.spoilerMode = enabled;
  renderList();
  if (state.selectedId) renderDetail(state.selectedId);
  renderRoadmap();
}

function handleGlobalKeydown(event) {
  if (event.key === '/' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
    event.preventDefault();
    $('#searchInput')?.focus();
  }
}

function bindEvents() {
  $('#searchInput')?.addEventListener('input', (e) => setSearch(e.target.value));
  $('#spoilerToggle')?.addEventListener('change', (e) => toggleSpoilerMode(e.target.checked));
  $$('.filter-btn').forEach((btn) => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));
  $('#exportBtn')?.addEventListener('click', exportProgress);
  $('#importInput')?.addEventListener('change', (e) => { if (e.target.files?.[0]) importProgress(e.target.files[0]); e.target.value = ''; });
  $('#resetBtn')?.addEventListener('click', resetProgress);
  document.addEventListener('keydown', handleGlobalKeydown);
}

async function init() {
  try {
    loadProgress();
    loadFilter();
    updateFilterButtons();

    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error('Failed to load trophy data');
    const data = await response.json();
    state.trophies = data.trophies ?? [];

    bindEvents();
    renderList();
    updateProgress();
    renderRoadmap();
    toggleSpoilerMode($('#spoilerToggle')?.checked ?? true);
  } catch (error) {
    console.error('Initialization error:', error);
    $('#trophyList')?.replaceChildren(create('li', { class: 'error' }, 'Failed to load trophy data.'));
  }
}

document.addEventListener('DOMContentLoaded', init);