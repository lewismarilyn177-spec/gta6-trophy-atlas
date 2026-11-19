const STORAGE_KEY = 'gta6-atlas-progress-v1';
const FILTER_KEY = 'gta6-atlas-filter-v1';
const DATA_URL = 'data/trophies.json';

/* ==================== STATE ==================== */

const state = {
  trophies: [],
  earned: new Set(),
  activeFilter: 'all',
  searchQuery: '',
  spoilerMode: true,
  selectedId: null,
};

const elements = {};

/* ==================== RENDER ==================== */

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function createElement(tag, attributes = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.entries(value).forEach(([dk, dv]) => el.dataset[dk] = dv);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value);
  });
  children.forEach(child => el.append(child instanceof Node ? child : document.createTextNode(String(child))));
  return el;
}

function gradeClassName(grade) {
  return `grade-${grade}`;
}

function kindSortOrder(kind) {
  const order = { prologue: 0, 'chapter 1': 1, 'chapter 2': 2, 'chapter 3': 3, 'chapter 4': 4, endgame: 5, cleanup: 6, activities: 7, collectibles: 8, story: 9, online: 10 };
  return order[kind.toLowerCase()] ?? 99;
}

function roadmapSortOrder(roadmap) {
  const order = { prologue: 0, 'chapter 1': 1, 'chapter 2': 2, 'chapter 3': 3, 'chapter 4': 4, endgame: 5, cleanup: 6 };
  return order[roadmap.toLowerCase()] ?? 99;
}

function passesFilter(trophy) {
  if (state.activeFilter === 'all') return true;
  if (state.activeFilter === 'missable') return trophy.missable === true;
  return trophy.kind?.toLowerCase() === state.activeFilter.toLowerCase();
}

function passesSearch(trophy) {
  const query = state.searchQuery.toLowerCase();
  if (!query) return true;
  return (
    trophy.name?.toLowerCase().includes(query) ||
    trophy.description?.toLowerCase().includes(query) ||
    trophy.roadmap?.toLowerCase().includes(query) ||
    trophy.guide?.toLowerCase().includes(query) ||
    trophy.kind?.toLowerCase().includes(query) ||
    trophy.grade?.toLowerCase().includes(query)
  );
}

function isStorySpoiler(trophy) {
  return state.spoilerMode && trophy.kind === 'story' && !state.earned.has(trophy.id);
}

function buildTrophyListItem(trophy) {
  const earned = state.earned.has(trophy.id);
  const spoiler = isStorySpoiler(trophy);

  const checkbox = createElement('input', { type: 'checkbox', class: 'trophy-check', checked: earned, 'aria-label': `Mark ${trophy.name} as earned`, onchange: () => toggleEarned(trophy.id) });

  const nameEl = createElement('span', { class: 'trophy-name' }, [spoiler ? '???' : trophy.name]);
  const descEl = createElement('span', { class: 'trophy-desc' }, [spoiler ? 'Hidden (story trophy)' : trophy.description]);
  const gradeChip = createElement('span', { class: `grade-chip ${gradeClassName(trophy.grade)}` }, [trophy.grade.toUpperCase()]);
  const missableBadge = trophy.missable ? createElement('span', { class: 'missable-badge' }, ['MISSABLE']) : null;

  const info = createElement('div', { class: 'trophy-info' }, [
    createElement('div', { class: 'trophy-header' }, [nameEl, gradeChip, missableBadge].filter(Boolean)),
    descEl,
  ]);

  const row = createElement('li', { class: `trophy-row ${earned ? 'earned' : ''} ${spoiler ? 'spoiler-blur' : ''}`, dataset: { id: trophy.id }, role: 'option', ariaSelected: earned, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTrophy(trophy.id); } }, onclick: () => selectTrophy(trophy.id) }, [
    checkbox,
    info,
  ]);

  return row;
}

function renderTrophyList() {
  const filtered = state.trophies.filter(t => passesFilter(t) && passesSearch(t));
  elements.list.replaceChildren();
  filtered.forEach(t => elements.list.append(buildTrophyListItem(t)));
  elements.count.textContent = filtered.length;
}

function renderTrophyDetail(trophyId) {
  const trophy = state.trophies.find(t => t.id === trophyId);
  if (!trophy) { elements.detail.innerHTML = ''; elements.placeholder.hidden = false; elements.detail.hidden = true; return; }

  const earned = state.earned.has(trophyId);
  const spoiler = isStorySpoiler(trophy);

  elements.placeholder.hidden = true;
  elements.detail.hidden = false;

  const stepsHtml = trophy.steps?.length ? createElement('ol', { class: 'steps-list' }, trophy.steps.map(s => createElement('li', {}, [s]))) : null;
  const sourcesHtml = trophy.sources?.length ? createElement('ul', { class: 'sources-list' }, trophy.sources.map(s => createElement('li', {}, [s]))) : null;
  const missableWarning = trophy.missable ? createElement('div', { class: 'missable-warning' }, ['⚠ This trophy is missable — complete it before the indicated roadmap stage or it may become unobtainable.']) : null;

  elements.detail.replaceChildren(
    createElement('header', { class: 'detail-header' }, [
      createElement('div', { class: 'detail-title-row' }, [
        createElement('h3', { class: `detail-name ${spoiler ? 'spoiler-blur' : ''}` }, [spoiler ? '???' : trophy.name]),
        createElement('span', { class: `grade-chip ${gradeClassName(trophy.grade)}` }, [trophy.grade.toUpperCase()]),
        trophy.missable ? createElement('span', { class: 'missable-badge' }, ['MISSABLE']) : null,
      ].filter(Boolean)),
      createElement('p', { class: `detail-desc ${spoiler ? 'spoiler-blur' : ''}` }, [spoiler ? 'Description hidden (story trophy). Earn the trophy to reveal.' : trophy.description]),
    ]),
    createElement('section', { class: 'detail-guide' }, [
      createElement('h4', {}, ['Guide']),
      createElement('p', {}, [trophy.guide]),
    ]),
    missableWarning,
    trophy.rarity ? createElement('div', { class: 'detail-meta' }, [
      createElement('span', { class: 'meta-item' }, [`Rarity: ${trophy.rarity}`]),
      trophy.time ? createElement('span', { class: 'meta-item' }, [`Est. Time: ${trophy.time}`]) : null,
      trophy.roadmap ? createElement('span', { class: 'meta-item' }, [`Roadmap: ${trophy.roadmap}`]) : null,
    ].filter(Boolean)) : null,
    stepsHtml ? createElement('section', { class: 'detail-steps' }, [
      createElement('h4', {}, ['Steps']),
      stepsHtml,
    ]) : null,
    sourcesHtml ? createElement('section', { class: 'detail-sources' }, [
      createElement('h4', {}, ['Sources']),
      sourcesHtml,
    ]) : null,
    createElement('div', { class: 'detail-actions' }, [
      createElement('button', { class: 'btn-primary', onclick: () => toggleEarned(trophyId) }, [earned ? 'Mark Unearned' : 'Mark Earned']),
    ])
  );
}

function updateProgressBar() {
  const total = state.trophies.length;
  const earned = state.earned.size;
  const percentage = total ? Math.round((earned / total) * 100) : 0;
  elements.progressFill.style.width = `${percentage}%`;
  elements.progressBar.setAttribute('aria-valuenow', percentage);
  elements.progressText.textContent = `${percentage}% earned (${earned} of ${total})`;
}

function renderRoadmap() {
  const stages = [...new Set(state.trophies.map(t => t.roadmap).filter(Boolean))].sort((a, b) => roadmapSortOrder(a) - roadmapSortOrder(b));
  elements.roadmap.replaceChildren();
  stages.forEach(stage => {
    const stageTrophies = state.trophies.filter(t => t.roadmap === stage);
    const earnedCount = stageTrophies.filter(t => state.earned.has(t.id)).length;
    const total = stageTrophies.length;
    const percentage = total ? Math.round((earnedCount / total) * 100) : 0;

    const card = createElement('div', { class: 'roadmap-stage' }, [
      createElement('header', { class: 'stage-header' }, [
        createElement('h3', {}, [stage]),
        createElement('div', { class: 'stage-progress' }, [
          createElement('span', {}, [`${earnedCount} / ${total}`]),
          createElement('div', { class: 'mini-bar', role: 'progressbar', 'aria-valuenow': percentage, 'aria-valuemin': 0, 'aria-valuemax': 100 }, [
            createElement('div', { class: 'mini-fill', style: `width:${percentage}%` }),
          ]),
        ]),
      ]),
      createElement('ul', { class: 'stage-trophies' }, stageTrophies.map(t => {
        const earned = state.earned.has(t.id);
        const spoiler = isStorySpoiler(t);
        return createElement('li', { class: `stage-trophy ${earned ? 'earned' : ''} ${spoiler ? 'spoiler-blur' : ''}`, onclick: () => selectTrophy(t.id) }, [
          createElement('input', { type: 'checkbox', checked: earned, onchange: () => toggleEarned(t.id) }),
          createElement('span', { class: 'stage-name' }, [spoiler ? '???' : t.name]),
          createElement('span', { class: `grade-chip ${gradeClassName(t.grade)}` }, [t.grade.toUpperCase()]),
        ]);
      })),
    ]);
    elements.roadmap.append(card);
  });
}

function renderFilterButtons() {
  qsa('.filter-btn', elements.toolbar).forEach(btn => {
    const active = btn.dataset.filter === state.activeFilter;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active);
  });
}

/* ==================== EVENTS ==================== */

function toggleEarned(trophyId) {
  if (state.earned.has(trophyId)) state.earned.delete(trophyId);
  else state.earned.add(trophyId);
  persistProgress();
  renderTrophyList();
  if (state.selectedId === trophyId) renderTrophyDetail(trophyId);
  updateProgressBar();
  renderRoadmap();
}

function selectTrophy(trophyId) {
  state.selectedId = trophyId;
  qsa('.trophy-row', elements.list).forEach(row => row.setAttribute('aria-selected', row.dataset.id == trophyId));
  renderTrophyDetail(trophyId);
}

function persistProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.earned]));
  } catch (_) {}
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state.earned = new Set(JSON.parse(raw));
  } catch (_) {}
}

function persistFilter() {
  try {
    localStorage.setItem(FILTER_KEY, state.activeFilter);
  } catch (_) {}
}

function loadFilter() {
  try {
    const saved = localStorage.getItem(FILTER_KEY);
    if (saved) state.activeFilter = saved;
  } catch (_) {}
}

function exportProgress() {
  const data = { earned: [...state.earned], exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = createElement('a', { href: url, download: 'trophies-progress.json' });
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
      renderTrophyList();
      updateProgressBar();
      renderRoadmap();
      if (state.selectedId) renderTrophyDetail(state.selectedId);
    } catch (_) {}
  };
  reader.readAsText(file);
}

function resetProgress() {
  if (!confirm('Reset ALL trophy progress? This cannot be undone.')) return;
  state.earned.clear();
  persistProgress();
  renderTrophyList();
  updateProgressBar();
  renderRoadmap();
  if (state.selectedId) renderTrophyDetail(state.selectedId);
}

function setFilter(filter) {
  state.activeFilter = filter;
  persistFilter();
  renderFilterButtons();
  renderTrophyList();
}

function setSearch(query) {
  state.searchQuery = query;
  renderTrophyList();
}

function toggleSpoilerMode(enabled) {
  state.spoilerMode = enabled;
  renderTrophyList();
  if (state.selectedId) renderTrophyDetail(state.selectedId);
  renderRoadmap();
}

function handleGlobalKeydown(event) {
  if (event.key === '/' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
    event.preventDefault();
    elements.searchInput.focus();
  }
}

function cacheElements() {
  elements.list = qs('#trophyList');
  elements.count = qs('#sidebarCount');
  elements.detail = qs('#detailContent');
  elements.placeholder = qs('#detailPlaceholder');
  elements.progressFill = qs('.progress-fill');
  elements.progressBar = qs('.progress-bar');
  elements.progressText = qs('.progress-text');
  elements.searchInput = qs('#searchInput');
  elements.spoilerToggle = qs('#spoilerToggle');
  elements.toolbar = qs('.toolbar');
  elements.roadmap = qs('#roadmapContainer');
  elements.exportBtn = qs('#exportBtn');
  elements.importInput = qs('#importInput');
  elements.resetBtn = qs('#resetBtn');
}

function bindEvents() {
  elements.searchInput.addEventListener('input', e => setSearch(e.target.value));
  elements.spoilerToggle.addEventListener('change', e => toggleSpoilerMode(e.target.checked));
  qsa('.filter-btn', elements.toolbar).forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));
  elements.exportBtn.addEventListener('click', exportProgress);
  elements.importInput.addEventListener('change', e => { if (e.target.files?.[0]) importProgress(e.target.files[0]); e.target.value = ''; });
  elements.resetBtn.addEventListener('click', resetProgress);
  document.addEventListener('keydown', handleGlobalKeydown);
}

async function init() {
  try {
    cacheElements();
    loadProgress();
    loadFilter();
    renderFilterButtons();
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error('Failed to load trophy data');
    const data = await response.json();
    state.trophies = data.trophies ?? [];
    bindEvents();
    renderTrophyList();
    updateProgressBar();
    renderRoadmap();
    toggleSpoilerMode(elements.spoilerToggle.checked);
  } catch (error) {
    console.error('Initialization error:', error);
    elements.list?.replaceChildren(createElement('li', { class: 'error' }, ['Failed to load trophy data.']));
  }
}

document.addEventListener('DOMContentLoaded', init);