const PROGRESS_KEY = 'gta6-atlas-progress-v1';
const FILTER_KEY = 'gta6-atlas-filter-v1';
const DATA_PATH = 'app/data/trophies.json';

const state = {
  trophies: [],
  earned: new Set(),
  activeFilter: 'all',
  searchQuery: '',
  spoilerMode: true,
  selectedId: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function safeText(value) {
  return value === undefined || value === null || value === '' ? '\u2014' : String(value);
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function createElement(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attributes).forEach(([key, val]) => {
    if (key === 'class') node.className = val;
    else if (key === 'dataset') Object.entries(val).forEach(([dk, dv]) => node.dataset[dk] = dv);
    else if (key.startsWith('on') && typeof val === 'function') node.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === 'style' && typeof val === 'object') Object.assign(node.style, val);
    else node.setAttribute(key, val);
  });
  children.flat().forEach(child => {
    if (child == null) return;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
}

function gradeChip(grade) {
  const g = safeText(grade).toLowerCase();
  return createElement('span', { class: `grade-chip grade-${g}` }, safeText(grade).toUpperCase());
}

function isSpoilerHidden(trophy) {
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
  const haystack = [
    trophy.name, trophy.description, trophy.roadmap, trophy.guide, trophy.kind, trophy.grade,
    ...(trophy.steps || []), ...(trophy.sources || [])
  ].join(' ').toLowerCase();
  return haystack.includes(q);
}

function buildRow(trophy) {
  const earned = state.earned.has(trophy.id);
  const hidden = isSpoilerHidden(trophy);

  const checkbox = createElement('input', {
    type: 'checkbox', class: 'trophy-check',
    'aria-label': `Mark ${safeText(trophy.name)} as earned`,
    onchange: () => toggleEarned(trophy.id),
  });
  checkbox.checked = earned;

  const nameEl = createElement('span', { class: 'trophy-name' }, hidden ? '???' : safeText(trophy.name));
  const descEl = createElement('span', { class: 'trophy-desc' }, hidden ? 'Hidden (story trophy)' : safeText(trophy.description));
  const badge = trophy.missable ? createElement('span', { class: 'missable-badge' }, 'MISSABLE') : null;

  const header = createElement('div', { class: 'trophy-header' }, nameEl, gradeChip(trophy.grade), badge);
  const info = createElement('div', { class: 'trophy-info' }, header, descEl);

  return createElement('li', {
    class: `trophy-row ${earned ? 'earned' : ''} ${hidden ? 'spoiler-blur' : ''}`,
    dataset: { id: trophy.id }, role: 'option', 'aria-selected': earned,
    onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTrophy(trophy.id); } },
    onclick: () => selectTrophy(trophy.id),
  }, checkbox, info);
}

function renderList() {
  const list = $('#trophyList');
  const countEl = $('#trophyCount');
  if (!list) return;

  const visible = state.trophies.filter(t => matchesFilter(t) && matchesSearch(t));
  const rows = visible.map(buildRow).filter(Boolean);
  list.replaceChildren(...rows);
  if (countEl) countEl.textContent = visible.length;
}

function renderDetail(id) {
  const detail = $('#detailContent');
  const placeholder = $('#detailPlaceholder');
  if (!detail || !placeholder) return;

  const trophy = state.trophies.find(t => t.id === id);
  if (!trophy) {
    detail.replaceChildren();
    detail.classList.add('hidden');
    detail.classList.remove('detail');
    placeholder.hidden = false;
    return;
  }

  const earned = state.earned.has(id);
  const hidden = isSpoilerHidden(trophy);

  placeholder.hidden = true;
  detail.hidden = false;
  detail.classList.add('detail');
  detail.classList.remove('hidden');

  const titleRow = createElement('div', { class: 'detail-title-row' },
    createElement('h3', { class: `detail-name ${hidden ? 'spoiler-blur' : ''}` }, hidden ? '???' : safeText(trophy.name)),
    gradeChip(trophy.grade),
    trophy.missable ? createElement('span', { class: 'missable-badge' }, 'MISSABLE') : null
  );

  const header = createElement('header', { class: 'detail-header' },
    titleRow,
    createElement('p', { class: `detail-desc ${hidden ? 'spoiler-blur' : ''}` },
      hidden ? 'Description hidden (story trophy). Earn the trophy to reveal.' : safeText(trophy.description)
    )
  );

  const guideSection = hasValue(trophy.guide)
    ? createElement('section', { class: 'detail-guide' },
        createElement('h4', {}, 'Guide'),
        createElement('p', {}, safeText(trophy.guide))
      )
    : null;

  const missableWarning = trophy.missable
    ? createElement('div', { class: 'missable-warning' }, '⚠ This trophy is missable — complete it before the indicated roadmap stage or it may become unobtainable.')
    : null;

  const metaItems = [];
  if (hasValue(trophy.rarity)) metaItems.push(createElement('span', { class: 'meta-item' }, `Rarity: ${safeText(trophy.rarity)}`));
  if (hasValue(trophy.time)) metaItems.push(createElement('span', { class: 'meta-item' }, `Est. Time: ${safeText(trophy.time)}`));
  if (hasValue(trophy.roadmap)) metaItems.push(createElement('span', { class: 'meta-item' }, `Roadmap: ${safeText(trophy.roadmap)}`));
  const metaSection = metaItems.length ? createElement('div', { class: 'detail-meta' }, ...metaItems) : null;

  const stepsSection = (trophy.steps || []).length
    ? createElement('section', { class: 'detail-steps' },
        createElement('h4', {}, 'Steps'),
        createElement('ol', { class: 'steps-list' }, ...trophy.steps.map(s => createElement('li', {}, safeText(s))))
      )
    : null;

  const sourcesSection = (trophy.sources || []).length
    ? createElement('section', { class: 'detail-sources' },
        createElement('h4', {}, 'Sources'),
        createElement('ul', { class: 'sources-list' }, ...trophy.sources.map(s => createElement('li', {}, safeText(s))))
      )
    : null;

  const actions = createElement('div', { class: 'detail-actions' },
    createElement('button', { class: 'btn-primary', onclick: () => toggleEarned(id) }, earned ? 'Mark Unearned' : 'Mark Earned')
  );

  const children = [header, guideSection, missableWarning, metaSection, stepsSection, sourcesSection, actions].filter(Boolean);
  detail.replaceChildren(...children);
}

function updateProgress() {
  const total = state.trophies.length;
  const earned = state.earned.size;
  const pct = total ? Math.round((earned / total) * 100) : 0;

  const fill = $('.progress-fill');
  const track = $('.progress-track');
  const text = $('#progressText');

  if (fill) fill.style.width = `${pct}%`;
  if (track) track.setAttribute('aria-valuenow', pct);
  if (text) text.textContent = `${pct}% earned (${earned} of ${total})`;
}

const STAGE_ORDER = { prologue: 0, 'chapter 1': 1, 'chapter 2': 2, 'chapter 3': 3, 'chapter 4': 4, endgame: 5, cleanup: 6 };
function stageRank(name) {
  return STAGE_ORDER[(name || '').toLowerCase()] ?? 99;
}

function renderRoadmap() {
  const container = $('#roadmapContainer');
  if (!container) return;

  const stages = [...new Set(state.trophies.map(t => t.roadmap).filter(hasValue))]
    .sort((a, b) => stageRank(a) - stageRank(b));

  const stageElements = stages.map(stage => {
    const items = state.trophies.filter(t => t.roadmap === stage);
    const got = items.filter(t => state.earned.has(t.id)).length;
    const total = items.length;
    const pct = total ? Math.round((got / total) * 100) : 0;

    const trophyElements = items.map(t => {
      const earned = state.earned.has(t.id);
      const hidden = isSpoilerHidden(t);
      return createElement('li', {
        class: `stage-trophy ${earned ? 'earned' : ''} ${hidden ? 'spoiler-blur' : ''}`,
        onclick: () => selectTrophy(t.id),
      },
        createElement('input', { type: 'checkbox', class: 'trophy-check', onchange: () => toggleEarned(t.id), checked: earned }),
        createElement('span', { class: 'stage-name' }, hidden ? '???' : safeText(t.name)),
        gradeChip(t.grade)
      );
    }).filter(Boolean);

    return createElement('div', { class: 'roadmap-stage' },
      createElement('header', { class: 'stage-header' },
        createElement('h3', {}, safeText(stage)),
        createElement('div', { class: 'stage-progress' },
          createElement('span', {}, `${got} / ${total}`),
          createElement('div', { class: 'mini-bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
            createElement('div', { class: 'mini-fill', style: { width: `${pct}%` } })
          )
        )
      ),
      createElement('ul', { class: 'stage-trophies' }, ...trophyElements)
    );
  }).filter(Boolean);

  container.replaceChildren(...stageElements);
}

function syncFilterUI() {
  $$('.filter-btn').forEach(btn => {
    const active = btn.dataset.filter === state.activeFilter;
    btn.classList.toggle('is-active', active);
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active);
  });
}

function toggleEarned(id) {
  if (state.earned.has(id)) state.earned.delete(id);
  else state.earned.add(id);
  saveProgress();
  renderList();
  if (state.selectedId === id) renderDetail(id);
  updateProgress();
  renderRoadmap();
}

function selectTrophy(id) {
  state.selectedId = id;
  $$('.trophy-row', $('#trophyList')).forEach(r => r.setAttribute('aria-selected', r.dataset.id == id));
  renderDetail(id);
}

function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify([...state.earned])); } catch (_) {}
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) state.earned = new Set(JSON.parse(raw));
  } catch (_) {}
}

function saveFilter() {
  try { localStorage.setItem(FILTER_KEY, state.activeFilter); } catch (_) {}
}

function loadFilter() {
  try {
    const saved = localStorage.getItem(FILTER_KEY);
    if (saved) state.activeFilter = saved;
  } catch (_) {}
}

function exportData() {
  const data = { earned: [...state.earned], exportedAt: new Date().toISOString() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = createElement('a', { href: url, download: 'trophies-progress.json' });
  link.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const ids = Array.isArray(data.earned) ? data.earned : (Array.isArray(data) ? data : []);
      state.earned = new Set(ids.filter(Number.isInteger));
      saveProgress();
      renderList();
      updateProgress();
      renderRoadmap();
      if (state.selectedId) renderDetail(state.selectedId);
    } catch (_) {}
  };
  reader.readAsText(file);
}

function resetAll() {
  if (!confirm('Reset ALL trophy progress? This cannot be undone.')) return;
  state.earned.clear();
  saveProgress();
  renderList();
  updateProgress();
  renderRoadmap();
  if (state.selectedId) renderDetail(state.selectedId);
}

function setFilter(filter) {
  state.activeFilter = filter;
  saveFilter();
  syncFilterUI();
  renderList();
}

function setSearch(query) {
  state.searchQuery = query;
  renderList();
}

function setSpoilerMode(on) {
  state.spoilerMode = on;
  renderList();
  if (state.selectedId) renderDetail(state.selectedId);
  renderRoadmap();
}

function onGlobalKey(event) {
  if (event.key === '/' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
    event.preventDefault();
    $('#searchInput')?.focus();
  }
}

function bindUI() {
  $('#searchInput')?.addEventListener('input', e => setSearch(e.target.value));
  $('#spoilerToggle')?.addEventListener('change', e => setSpoilerMode(e.target.checked));
  $$('.filter-btn').forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));
  $('#exportBtn')?.addEventListener('click', exportData);
  $('#importInput')?.addEventListener('change', e => { if (e.target.files?.[0]) importData(e.target.files[0]); e.target.value = ''; });
  $('#resetBtn')?.addEventListener('click', resetAll);
  document.addEventListener('keydown', onGlobalKey);
}

async function boot() {
  try {
    loadProgress();
    loadFilter();
    syncFilterUI();

    const res = await fetch(DATA_PATH);
    if (!res.ok) throw new Error('Failed to load trophy data');
    const data = await res.json();
    state.trophies = data.trophies ?? [];

    bindUI();
    renderList();
    updateProgress();
    renderRoadmap();
    setSpoilerMode($('#spoilerToggle')?.checked ?? true);
  } catch (err) {
    console.error('Initialization error:', err);
    $('#trophyList')?.replaceChildren(createElement('li', { class: 'error' }, 'Failed to load trophy data.'));
  }
}

document.addEventListener('DOMContentLoaded', boot);