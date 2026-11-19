const PROGRESS_KEY = 'gta6-atlas-progress-v1';
const FILTER_KEY = 'gta6-atlas-filter-v1';
const DATA_PATH = 'data/trophies.json';

const store = {
  trophies: [],
  earned: new Set(),
  activeFilter: 'all',
  searchQuery: '',
  spoilerMode: true,
  selectedId: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function safe(value) {
  if (value === undefined || value === null || value === '') return '\u2014';
  return String(value);
}

function present(value) {
  return value !== undefined && value !== null && value !== '';
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.entries(v).forEach(([dk, dv]) => node.dataset[dk] = dv);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else node.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if (c == null) return;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  });
  return node;
}

function chip(grade) {
  const g = safe(grade).toLowerCase();
  return el('span', { class: `grade-chip grade-${g}` }, safe(grade).toUpperCase());
}

function isHidden(t) {
  return store.spoilerMode && t.kind === 'story' && !store.earned.has(t.id);
}

function passesFilter(t) {
  const f = store.activeFilter;
  if (f === 'all') return true;
  if (f === 'missable') return t.missable === true;
  if (f === 'roadmap') return !!t.roadmap;
  return (t.kind || '').toLowerCase() === f.toLowerCase();
}

function passesSearch(t) {
  const q = store.searchQuery.toLowerCase();
  if (!q) return true;
  const hay = [
    t.name, t.description, t.roadmap, t.guide, t.kind, t.grade,
    ...(t.steps || []), ...(t.sources || [])
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

function buildRow(t) {
  const earned = store.earned.has(t.id);
  const hidden = isHidden(t);

  const check = el('input', {
    type: 'checkbox', class: 'trophy-check',
    'aria-label': `Mark ${safe(t.name)} as earned`,
    onchange: () => toggle(t.id),
  });
  check.checked = earned;

  const name = el('span', { class: 'trophy-name' }, hidden ? '???' : safe(t.name));
  const desc = el('span', { class: 'trophy-desc' }, hidden ? 'Hidden (story trophy)' : safe(t.description));
  const badge = t.missable ? el('span', { class: 'missable-badge' }, 'MISSABLE') : null;

  const head = el('div', { class: 'trophy-header' }, name, chip(t.grade), badge);
  const info = el('div', { class: 'trophy-info' }, head, desc);

  return el('li', {
    class: `trophy-row ${earned ? 'earned' : ''} ${hidden ? 'spoiler-blur' : ''}`,
    dataset: { id: t.id }, role: 'option', 'aria-selected': earned,
    onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(t.id); } },
    onclick: () => pick(t.id),
  }, check, info);
}

function renderList() {
  const list = $('#trophyList');
  const count = $('#trophyCount');
  if (!list) return;
  const visible = store.trophies.filter(t => passesFilter(t) && passesSearch(t));
  list.replaceChildren(...visible.map(buildRow));
  if (count) count.textContent = visible.length;
}

function renderDetail(id) {
  const detail = $('#detailContent');
  const placeholder = $('#detailPlaceholder');
  if (!detail || !placeholder) return;

  const t = store.trophies.find(x => x.id === id);
  if (!t) {
    detail.replaceChildren();
    detail.classList.add('hidden');
    detail.classList.remove('detail');
    placeholder.hidden = false;
    return;
  }

  const earned = store.earned.has(id);
  const hidden = isHidden(t);

  placeholder.hidden = true;
  detail.hidden = false;
  detail.classList.add('detail');
  detail.classList.remove('hidden');

  const titleRow = el('div', { class: 'detail-title-row' },
    el('h3', { class: `detail-name ${hidden ? 'spoiler-blur' : ''}` }, hidden ? '???' : safe(t.name)),
    chip(t.grade),
    t.missable ? el('span', { class: 'missable-badge' }, 'MISSABLE') : null
  );

  const header = el('header', { class: 'detail-header' },
    titleRow,
    el('p', { class: `detail-desc ${hidden ? 'spoiler-blur' : ''}` },
      hidden ? 'Description hidden (story trophy). Earn the trophy to reveal.' : safe(t.description)
    )
  );

  const guideBlock = present(t.guide)
    ? el('section', { class: 'detail-guide' },
        el('h4', {}, 'Guide'),
        el('p', {}, safe(t.guide))
      )
    : null;

  const missableBlock = t.missable
    ? el('div', { class: 'missable-warning' }, '⚠ This trophy is missable — complete it before the indicated roadmap stage or it may become unobtainable.')
    : null;

  const metaParts = [];
  if (present(t.rarity)) metaParts.push(el('span', { class: 'meta-item' }, `Rarity: ${safe(t.rarity)}`));
  if (present(t.time)) metaParts.push(el('span', { class: 'meta-item' }, `Est. Time: ${safe(t.time)}`));
  if (present(t.roadmap)) metaParts.push(el('span', { class: 'meta-item' }, `Roadmap: ${safe(t.roadmap)}`));
  const metaBlock = metaParts.length ? el('div', { class: 'detail-meta' }, ...metaParts) : null;

  const stepsBlock = (t.steps || []).length
    ? el('section', { class: 'detail-steps' },
        el('h4', {}, 'Steps'),
        el('ol', { class: 'steps-list' }, ...t.steps.map(s => el('li', {}, safe(s))))
      )
    : null;

  const sourcesBlock = (t.sources || []).length
    ? el('section', { class: 'detail-sources' },
        el('h4', {}, 'Sources'),
        el('ul', { class: 'sources-list' }, ...t.sources.map(s => el('li', {}, safe(s))))
      )
    : null;

  const actions = el('div', { class: 'detail-actions' },
    el('button', { class: 'btn-primary', onclick: () => toggle(id) }, earned ? 'Mark Unearned' : 'Mark Earned')
  );

  detail.replaceChildren(header, guideBlock, missableBlock, metaBlock, stepsBlock, sourcesBlock, actions);
}

function updateProgress() {
  const total = store.trophies.length;
  const earned = store.earned.size;
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
  const box = $('#roadmapContainer');
  if (!box) return;

  const stages = [...new Set(store.trophies.map(t => t.roadmap).filter(present))]
    .sort((a, b) => stageRank(a) - stageRank(b));

  box.replaceChildren(...stages.map(stage => {
    const items = store.trophies.filter(t => t.roadmap === stage);
    const got = items.filter(t => store.earned.has(t.id)).length;
    const total = items.length;
    const pct = total ? Math.round((got / total) * 100) : 0;

    return el('div', { class: 'roadmap-stage' },
      el('header', { class: 'stage-header' },
        el('h3', {}, safe(stage)),
        el('div', { class: 'stage-progress' },
          el('span', {}, `${got} / ${total}`),
          el('div', { class: 'mini-bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
            el('div', { class: 'mini-fill', style: { width: `${pct}%` } })
          )
        )
      ),
      el('ul', { class: 'stage-trophies' },
        ...items.map(t => {
          const earned = store.earned.has(t.id);
          const hidden = isHidden(t);
          return el('li', {
            class: `stage-trophy ${earned ? 'earned' : ''} ${hidden ? 'spoiler-blur' : ''}`,
            onclick: () => pick(t.id),
          },
            el('input', { type: 'checkbox', class: 'trophy-check', onchange: () => toggle(t.id), checked: earned }),
            el('span', { class: 'stage-name' }, hidden ? '???' : safe(t.name)),
            chip(t.grade)
          );
        })
      )
    );
  }));
}

function syncFilterUI() {
  $$('.filter-btn').forEach(b => {
    const on = b.dataset.filter === store.activeFilter;
    b.classList.toggle('is-active', on);
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
  });
}

function toggle(id) {
  if (store.earned.has(id)) store.earned.delete(id);
  else store.earned.add(id);
  saveProgress();
  renderList();
  if (store.selectedId === id) renderDetail(id);
  updateProgress();
  renderRoadmap();
}

function pick(id) {
  store.selectedId = id;
  $$('.trophy-row', $('#trophyList')).forEach(r => r.setAttribute('aria-selected', r.dataset.id == id));
  renderDetail(id);
}

function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify([...store.earned])); } catch (_) {}
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) store.earned = new Set(JSON.parse(raw));
  } catch (_) {}
}

function saveFilter() {
  try { localStorage.setItem(FILTER_KEY, store.activeFilter); } catch (_) {}
}

function loadFilter() {
  try {
    const s = localStorage.getItem(FILTER_KEY);
    if (s) store.activeFilter = s;
  } catch (_) {}
}

function exportData() {
  const data = { earned: [...store.earned], exportedAt: new Date().toISOString() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = el('a', { href: url, download: 'trophies-progress.json' });
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const ids = Array.isArray(data.earned) ? data.earned : (Array.isArray(data) ? data : []);
      store.earned = new Set(ids.filter(Number.isInteger));
      saveProgress();
      renderList();
      updateProgress();
      renderRoadmap();
      if (store.selectedId) renderDetail(store.selectedId);
    } catch (_) {}
  };
  reader.readAsText(file);
}

function resetAll() {
  if (!confirm('Reset ALL trophy progress? This cannot be undone.')) return;
  store.earned.clear();
  saveProgress();
  renderList();
  updateProgress();
  renderRoadmap();
  if (store.selectedId) renderDetail(store.selectedId);
}

function setFilter(f) {
  store.activeFilter = f;
  saveFilter();
  syncFilterUI();
  renderList();
}

function setSearch(q) {
  store.searchQuery = q;
  renderList();
}

function setSpoiler(on) {
  store.spoilerMode = on;
  renderList();
  if (store.selectedId) renderDetail(store.selectedId);
  renderRoadmap();
}

function onGlobalKey(e) {
  if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    $('#searchInput')?.focus();
  }
}

function bindUI() {
  $('#searchInput')?.addEventListener('input', e => setSearch(e.target.value));
  $('#spoilerToggle')?.addEventListener('change', e => setSpoiler(e.target.checked));
  $$('.filter-btn').forEach(b => b.addEventListener('click', () => setFilter(b.dataset.filter)));
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
    store.trophies = data.trophies ?? [];

    bindUI();
    renderList();
    updateProgress();
    renderRoadmap();
    setSpoiler($('#spoilerToggle')?.checked ?? true);
  } catch (err) {
    console.error('Initialization error:', err);
    $('#trophyList')?.replaceChildren(el('li', { class: 'error' }, 'Failed to load trophy data.'));
  }
}

document.addEventListener('DOMContentLoaded', boot);