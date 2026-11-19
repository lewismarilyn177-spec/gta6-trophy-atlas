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

/* ==================== HELPERS ==================== */

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.entries(value).forEach(([dk, dv]) => (el.dataset[dk] = dv));
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value);
  });
  children.forEach((child) => el.append(child instanceof Node ? child : document.createTextNode(String(child))));
  return el;
}

function safeGet(selector, name) {
  const el = qs(selector);
  if (!el) console.warn(`[gta6-atlas] Element not found: ${name} (${selector})`);
  return el;
}

function gradeClass(grade) {
  return `grade-${grade}`;
}

function kindOrder(kind) {
  const order = { prologue: 0, 'chapter 1': 1, 'chapter 2': 2, 'chapter 3': 3, 'chapter 4': 4, endgame: 5, cleanup: 6, activities: 7, collectibles: 8, story: 9, online: 10 };
  return order[kind.toLowerCase()] ?? 99;
}

function roadmapOrder(roadmap) {
  const order = { prologue: 0, 'chapter 1': 1, 'chapter 2': 2, 'chapter 3': 3, 'chapter 4': 4, endgame: 5, cleanup: 6 };
  return order[roadmap.toLowerCase()] ?? 99;
}

function passesFilter(trophy) {
  if (state.activeFilter === 'all') return true;
  if (state.activeFilter === 'missable') return trophy.missable === true;
  if (state.activeFilter === 'roadmap') return trophy.roadmap != null;
  return trophy.kind?.toLowerCase() === state.activeFilter.toLowerCase();
}

function passesSearch(trophy) {
  const q = state.searchQuery.toLowerCase();
  if (!q) return true;
  return (
    trophy.name?.toLowerCase().includes(q) ||
    trophy.description?.toLowerCase().includes(q) ||
    trophy.roadmap?.toLowerCase().includes(q) ||
    trophy.guide?.toLowerCase().includes(q) ||
    trophy.kind?.toLowerCase().includes(q) ||
    trophy.grade?.toLowerCase().includes(q)
  );
}

function isStorySpoiler(trophy) {
  return state.spoilerMode && trophy.kind === 'story' && !state.earned.has(trophy.id);
}

/* ==================== RENDER ==================== */

function buildTrophyItem(trophy) {
  const earned = state.earned.has(trophy.id);
  const spoiler = isStorySpoiler(trophy);

  const checkbox = createEl('input', {
    type: 'checkbox',
    class: 'trophy-check',
    checked: earned,
    'aria-label': `Mark ${trophy.name} as earned`,
    onchange: () => toggleEarned(trophy.id),
  });

  const nameEl = createEl('span', { class: 'trophy-name' }, [spoiler ? '???' : trophy.name]);
  const descEl = createEl('span', { class: 'trophy-desc' }, [spoiler ? 'Hidden (story trophy)' : trophy.description]);
  const gradeChip = createEl('span', { class: `grade-chip ${gradeClass(trophy.grade)}` }, [trophy.grade.toUpperCase()]);
  const missableBadge = trophy.missable ? createEl('span', { class: 'missable-badge' }, ['MISSABLE']) : null;

  const info = createEl('div', { class: 'trophy-info' }, [
    createEl('div', { class: 'trophy-header' }, [nameEl, gradeChip, missableBadge].filter(Boolean)),
    descEl,
  ]);

  return createEl('li', {
    class: `trophy-row ${earned ? 'earned' : ''} ${spoiler ? 'spoiler-blur' : ''}`,
    dataset: { id: trophy.id },
    role: 'option',
    ariaSelected: earned,
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTrophy(trophy.id); } },
    onclick: () => selectTrophy(trophy.id),
  }, [checkbox, info]);
}

function renderTrophyList() {
  const filtered = state.trophies.filter((t) => passesFilter(t) && passesSearch(t));
  elements.list?.replaceChildren();
  filtered.forEach((t) => elements.list?.append(buildTrophyItem(t)));
  if (elements.count) elements.count.textContent = filtered.length;
}

function renderTrophyDetail(trophyId) {
  const trophy = state.trophies.find((t) => t.id === trophyId);
  if (!trophy) {
    elements.detail?.replaceChildren();
    if (elements.placeholder) elements.placeholder.hidden = false;
    if (elements.detail) elements.detail.hidden = true;
    return;
  }

  const earned = state.earned.has(trophyId);
  const spoiler = isStorySpoiler(trophy);

  if (elements.placeholder) elements.placeholder.hidden = true;
  if (elements.detail) elements.detail.hidden = false;

  const stepsHtml = trophy.steps?.length
    ? createEl('ol', { class: 'steps-list' }, trophy.steps.map((s) => createEl('li', {}, [s])))
    : null;
  const sourcesHtml = trophy.sources?.length
    ? createEl('ul', { class: 'sources-list' }, trophy.sources.map((s) => createEl('li', {}, [s])))
    : null;
  const missableWarning = trophy.missable
    ? createEl('div', { class: 'missable-warning' }, ['⚠ This trophy is missable — complete it before the indicated roadmap stage or it may become unobtainable.'])
    : null;

  elements.detail?.replaceChildren(
    createEl('header', { class: 'detail-header' }, [
      createEl('div', { class: 'detail-title-row' }, [
        createEl('h3', { class: `detail-name ${spoiler ? 'spoiler-blur' : ''}` }, [spoiler ? '???' : trophy.name]),
        createEl('span', { class: `grade-chip ${gradeClass(trophy.grade)}` }, [trophy.grade.toUpperCase()]),
        trophy.missable ? createEl('span', { class: 'missable-badge' }, ['MISSABLE']) : null,
      ].filter(Boolean)),
      createEl('p', { class: `detail-desc ${spoiler ? 'spoiler-blur' : ''}` }, [spoiler ? 'Description hidden (story trophy). Earn the trophy to reveal.' : trophy.description]),
    ]),
    createEl('section', { class: 'detail-guide' }, [
      createEl('h4', {}, ['Guide']),
      createEl('p', {}, [trophy.guide]),
    ]),
    missableWarning,
    trophy.rarity
      ? createEl('div', { class: 'detail-meta' }, [
          createEl('span', { class: 'meta-item' }, [`Rarity: ${trophy.rarity}`]),
          trophy.time ? createEl('span', { class: 'meta-item' }, [`Est. Time: ${trophy.time}`]) : null,
          trophy.roadmap ? createEl('span', { class: 'meta-item' }, [`Roadmap: ${trophy.roadmap}`]) : null,
        ].filter(Boolean))
      : null,
    stepsHtml
      ? createEl('section', { class: 'detail-steps' }, [createEl('h4', {}, ['Steps']), stepsHtml])
      : null,
    sourcesHtml
      ? createEl('section', { class: 'detail-sources' }, [createEl('h4', {}, ['Sources']), sourcesHtml])
      : null,
    createEl('div', { class: 'detail-actions' }, [
      createEl('button', { class: 'btn-primary', onclick: () => toggleEarned(trophyId) }, [earned ? 'Mark Unearned' : 'Mark Earned']),
    ])
  );
}

function updateProgressBar() {
  const total = state.trophies.length;
  const earned = state.earned.size;
  const pct = total ? Math.round((earned / total) * 100) : 0;
  if (elements.progressFill) elements.progressFill.style.width = `${pct}%`;
  if (elements.progressBar) elements.progressBar.setAttribute('aria-valuenow', pct);
  if (elements.progressText) elements.progressText.textContent = `${pct}% earned (${earned} of ${total})`;
}

function renderRoadmap() {
  const stages = [...new Set(state.trophies.map((t) => t.roadmap).filter(Boolean))].sort((a, b) => roadmapOrder(a) - roadmapOrder(b));
  elements.roadmap?.replaceChildren();
  stages.forEach((stage) => {
    const stageTrophies = state.trophies.filter((t) => t.roadmap === stage);
    const earnedCount = stageTrophies.filter((t) => state.earned.has(t.id)).length;
    const total = stageTrophies.length;
    const pct = total ? Math.round((earnedCount / total) * 100) : 0;

    const card = createEl('div', { class: 'roadmap-stage' }, [
      createEl('header', { class: 'stage-header' }, [
        createEl('h3', {}, [stage]),
        createEl('div', { class: 'stage-progress' }, [
          createEl('span', {}, [`${earnedCount} / ${total}`]),
          createEl('div', { class: 'mini-bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, [
            createEl('div', { class: 'mini-fill', style: `width:${pct}%` }),
          ]),
        ]),
      ]),
      createEl('ul', { class: 'stage-trophies' }, stageTrophies.map((t) => {
        const earned = state.earned.has(t.id);
        const spoiler = isStorySpoiler(t);
        return createEl('li', { class: `stage-trophy ${earned ? 'earned' : ''} ${spoiler ? 'spoiler-blur' : ''}`, onclick: () => selectTrophy(t.id) }, [
          createEl('input', { type: 'checkbox', checked: earned, onchange: () => toggleEarned(t.id) }),
          createEl('span', { class: 'stage-name' }, [spoiler ? '???' : t.name]),
          createEl('span', { class: `grade-chip ${gradeClass(t.grade)}` }, [t.grade.toUpperCase()]),
        ]);
      })),
    ]);
    elements.roadmap?.append(card);
  });
}

function renderFilterButtons() {
  qsa('.filter-btn', elements.toolbar).forEach((btn) => {
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
  qsa('.trophy-row', elements.list).forEach((row) => row.setAttribute('aria-selected', row.dataset.id == trophyId));
  renderTrophyDetail(trophyId);
}

function persistProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.earned])); } catch (_) {}
}

function loadProgress() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) state.earned = new Set(JSON.parse(raw)); } catch (_) {}
}

function persistFilter() {
  try { localStorage.setItem(FILTER_KEY, state.activeFilter); } catch (_) {}
}

function loadFilter() {
  try { const saved = localStorage.getItem(FILTER_KEY); if (saved) state.activeFilter = saved; } catch (_) {}
}

function exportProgress() {
  const data = { earned: [...state.earned], exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = createEl('a', { href: url, download: 'trophies-progress.json' });
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
    elements.searchInput?.focus();
  }
}

function cacheElements() {
  elements.list = safeGet('#trophyList', 'trophyList');
  elements.count = safeGet('#sidebarCount', 'sidebarCount');
  elements.detail = safeGet('#detailContent', 'detailContent');
  elements.placeholder = safeGet('#detailPlaceholder', 'detailPlaceholder');
  elements.progressFill = safeGet('.progress-fill', 'progressFill');
  elements.progressBar = safeGet('.progress-bar', 'progressBar');
  elements.progressText = safeGet('.progress-text', 'progressText');
  elements.searchInput = safeGet('#searchInput', 'searchInput');
  elements.spoilerToggle = safeGet('#spoilerToggle', 'spoilerToggle');
  elements.toolbar = safeGet('.toolbar', 'toolbar');
  elements.roadmap = safeGet('#roadmapContainer', 'roadmapContainer');
  elements.exportBtn = safeGet('#exportBtn', 'exportBtn');
  elements.importInput = safeGet('#importInput', 'importInput');
  elements.resetBtn = safeGet('#resetBtn', 'resetBtn');
}

function bindEvents() {
  elements.searchInput?.addEventListener('input', (e) => setSearch(e.target.value));
  elements.spoilerToggle?.addEventListener('change', (e) => toggleSpoilerMode(e.target.checked));
  qsa('.filter-btn', elements.toolbar).forEach((btn) => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));
  elements.exportBtn?.addEventListener('click', exportProgress);
  elements.importInput?.addEventListener('change', (e) => { if (e.target.files?.[0]) importProgress(e.target.files[0]); e.target.value = ''; });
  elements.resetBtn?.addEventListener('click', resetProgress);
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
    toggleSpoilerMode(elements.spoilerToggle?.checked ?? true);
  } catch (error) {
    console.error('Initialization error:', error);
    elements.list?.replaceChildren(createEl('li', { class: 'error' }, ['Failed to load trophy data.']));
  }
}

document.addEventListener('DOMContentLoaded', init);