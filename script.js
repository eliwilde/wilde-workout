const SUPABASE_URL = 'https://spwoicclxqoxqkfkmcrw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwd29pY2NseHFveHFrZmttY3J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MzIzNDMsImV4cCI6MjA4NzIwODM0M30.QhrV6CqGMVpCu_ySygeATvF_hvGoGmgYzbocp9A-qX0';

function getOrCreateUserId() {
  let uid = localStorage.getItem('wilde_uid');
  if (!uid) {
    uid = crypto.randomUUID ? crypto.randomUUID() : 'uid-' + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem('wilde_uid', uid);
  }
  return uid;
}
const USER_ID = getOrCreateUserId();

const MUSCLE_COLORS = {
  Chest:'#60a5fa', Back:'#3b82f6', Shoulders:'#93c5fd', Traps:'#7dd3fc',
  Biceps:'#a5b4fc', Triceps:'#818cf8', Forearms:'#c4b5fd', Core:'#34d399',
  Quads:'#f472b6', Hamstrings:'#fb7185', Glutes:'#f43f5e', Calves:'#fda4af',
  Hips:'#fb923c', 'Ankles/Feet':'#facc15',
};
const DIFF_ORDER = ['Novice','Beginner','Intermediate','Advanced','Expert','Master','Legendary','Grand Master'];
const MUSCLES_LIST = ['Ankles/Feet','Back','Biceps','Calves','Chest','Core','Forearms','Glutes','Hamstrings','Hips','Quads','Shoulders','Traps','Triceps'];
const DIFFS_LIST = ['Novice','Beginner','Intermediate','Advanced','Expert','Master','Legendary','Grand Master'];

let exercises = [];
let favoriteIds = new Set();
let sessionList = [];
let currentMuscle = 'all';
let currentDiff = 'all';
let currentSearch = '';
let showFavoritesOnly = false;
let displayCount = 40;
let expandedId = null;
let explorerActiveId = null;

// ── FETCH ──────────────────────────────────────────────────────────────────────
async function loadExercises() {
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/exercises?select=*&limit=5000&order=id.asc', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    exercises = await res.json();
    exercises = exercises.sort(() => Math.random() - 0.5);
    await loadFavorites();
    buildFilters();
    render();
  } catch(e) {
    document.getElementById('listContainer').innerHTML = '<div class="empty-state">Could not load exercises.</div>';
  }
}

async function loadFavorites() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/favorites?select=exercise_id&user_id=eq.${encodeURIComponent(USER_ID)}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    const rows = await res.json();
    favoriteIds = new Set((rows || []).map(r => r.exercise_id));
  } catch(e) { favoriteIds = new Set(); }
}

async function toggleFavorite(id, e) {
  e.stopPropagation();
  const isFav = favoriteIds.has(id);
  if (isFav) {
    favoriteIds.delete(id);
    await fetch(`${SUPABASE_URL}/rest/v1/favorites?user_id=eq.${encodeURIComponent(USER_ID)}&exercise_id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
  } else {
    favoriteIds.add(id);
    await fetch(`${SUPABASE_URL}/rest/v1/favorites`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id: USER_ID, exercise_id: id })
    });
  }
  render();
}

// ── FILTERS ────────────────────────────────────────────────────────────────────
function buildFilters() {
  // Muscle pills
  const muscleRow = document.getElementById('muscleRow');
  if (muscleRow) {
    muscleRow.innerHTML = `<div class="pill active" onclick="setMuscle('all',this)">All</div>` +
      MUSCLES_LIST.map(m => `<div class="pill" onclick="setMuscle('${m}',this)">${m}</div>`).join('');
  }
  // Diff pills
  const diffRow = document.getElementById('diffRow');
  if (diffRow) {
    diffRow.innerHTML = `<div class="pill active" onclick="setDiff('all',this)">All</div>` +
      DIFFS_LIST.map(d => `<div class="pill diff-${d.toLowerCase().replace(' ','-')}" onclick="setDiff('${d}',this)">${d}</div>`).join('');
  }
}

function setMuscle(val, el) {
  currentMuscle = val;
  document.querySelectorAll('#muscleRow .pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  displayCount = 40;
  render();
  updateFilterBtn();
}

function setDiff(val, el) {
  currentDiff = val;
  document.querySelectorAll('#diffRow .pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  displayCount = 40;
  render();
  updateFilterBtn();
}

function updateFilterBtn() {
  const btn = document.getElementById('filterToggleBtn');
  if (!btn) return;
  const hasFilters = currentMuscle !== 'all' || currentDiff !== 'all' || showFavoritesOnly;
  btn.classList.toggle('has-filters', hasFilters);
}

function toggleFilterDrawer() {
  document.getElementById('filterDrawer').classList.toggle('open');
  document.getElementById('filterToggleBtn').classList.toggle('active');
}

function toggleFavoritesFilter() {
  showFavoritesOnly = !showFavoritesOnly;
  const btn = document.getElementById('favFilterBtn');
  if (btn) btn.classList.toggle('active', showFavoritesOnly);
  displayCount = 40;
  render();
  updateFilterBtn();
}

// ── SEARCH ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
  if (input) {
    input.addEventListener('input', e => {
      currentSearch = e.target.value.toLowerCase();
      displayCount = 40;
      render();
    });
  }

  // Back to top
  window.addEventListener('scroll', () => {
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    btn.classList.toggle('visible', window.scrollY > 400);
  });
});

// ── FILTER LOGIC ───────────────────────────────────────────────────────────────
function getFiltered() {
  return exercises.filter(ex => {
    if (showFavoritesOnly && !favoriteIds.has(ex.id)) return false;
    if (currentMuscle !== 'all' && ex.m !== currentMuscle) return false;
    if (currentDiff !== 'all' && ex.d !== currentDiff) return false;
    if (currentSearch && !(ex.n||'').toLowerCase().includes(currentSearch)) return false;
    return true;
  });
}

// ── RENDER LIST ────────────────────────────────────────────────────────────────
function render() {
  const filtered = getFiltered();
  const shown = filtered.slice(0, displayCount);

  document.getElementById('countDisplay').textContent = filtered.length;

  document.getElementById('listContainer').innerHTML = shown.map(ex => {
    const color = MUSCLE_COLORS[ex.m] || '#888';
    const isFav = favoriteIds.has(ex.id);
    const isExpanded = expandedId === ex.id;

    let videoHtml = '';
    if (isExpanded) {
      const videoUrl = ex.v
        ? ex.v
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.n + ' exercise')}`;
      videoHtml = `<div class="ex-video-wrap">
        <a class="ex-video-link" href="${videoUrl}" target="_blank" rel="noopener">
          ▶ Watch: ${ex.n}
        </a>
      </div>`;
    }

    return `<div class="ex-card${isExpanded ? ' expanded' : ''}" id="card-${ex.id}">
      <div class="ex-card-main" onclick="toggleExpand(${ex.id})">
        <div class="muscle-bar" style="background:${color}"></div>
        <div class="ex-info">
          <div class="ex-name">${ex.n || 'Unnamed'}</div>
          ${isExpanded ? `<div class="ex-meta">${ex.m || ''}${ex.d ? ' · ' + ex.d : ''}${ex.e ? ' · ' + ex.e : ''}</div>` : ''}
        </div>
        <button class="fav-btn${isFav ? ' active' : ''}" onclick="toggleFavorite(${ex.id}, event)">♥</button>
      </div>
      ${isExpanded ? `
        ${videoHtml}
        <div class="ex-actions">
          <button class="ex-action-btn" onclick="openExplorer(${ex.id})">🗺 Explore</button>
          <button class="ex-action-btn" onclick="addToSession(${ex.id})">＋ Add to Session</button>
        </div>` : ''}
    </div>`;
  }).join('');

  // Load more sentinel
  if (filtered.length > displayCount) {
    document.getElementById('listContainer').innerHTML += `<div id="loadMoreSentinel" style="height:1px"></div>`;
    observeLoadMore();
  }

  renderSessionTray();
}

function toggleExpand(id) {
  expandedId = expandedId === id ? null : id;
  render();
  if (expandedId) {
    setTimeout(() => document.getElementById('card-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }
}

// ── INFINITE SCROLL ────────────────────────────────────────────────────────────
function observeLoadMore() {
  const sentinel = document.getElementById('loadMoreSentinel');
  if (!sentinel) return;
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      displayCount += 40;
      obs.disconnect();
      render();
    }
  });
  obs.observe(sentinel);
}

// ── SESSION TRAY ───────────────────────────────────────────────────────────────
function addToSession(id) {
  const ex = exercises.find(e => e.id === id);
  if (!ex || sessionList.find(s => s.id === id)) return;
  sessionList.push(ex);
  renderSessionTray();
  showToast(`${ex.n} added to session`);
}

function removeFromSession(id) {
  sessionList = sessionList.filter(e => e.id !== id);
  renderSessionTray();
}

function renderSessionTray() {
  const tray = document.getElementById('sessionTray');
  if (!tray) return;
  if (sessionList.length === 0) { tray.innerHTML = ''; tray.classList.remove('open'); return; }

  tray.classList.add('open');
  tray.innerHTML = `
    <div class="tray-header">
      <span class="tray-title">Session (${sessionList.length})</span>
      <button class="tray-copy-btn" onclick="copySession()">Copy</button>
      <button class="tray-clear-btn" onclick="clearSession()">Clear</button>
    </div>
    <div class="tray-list">
      ${sessionList.map(ex => `
        <div class="tray-item">
          <div class="tray-item-bar" style="background:${MUSCLE_COLORS[ex.m]||'#888'}"></div>
          <span class="tray-item-name">${ex.n}</span>
          <button class="tray-remove-btn" onclick="removeFromSession(${ex.id})">✕</button>
        </div>`).join('')}
    </div>`;

  const btt = document.getElementById('backToTop');
  if (btt) btt.classList.add('tray-up');
}

function clearSession() {
  sessionList = [];
  renderSessionTray();
  const btt = document.getElementById('backToTop');
  if (btt) btt.classList.remove('tray-up');
}

function copySession() {
  const text = sessionList.map((ex, i) => `${i+1}. ${ex.n}${ex.m ? ' ('+ex.m+')' : ''}`).join('\n');
  navigator.clipboard.writeText(text).then(() => showToast('Session copied!')).catch(() => showToast('Copy failed'));
}

// ── DICE / ROULETTE ────────────────────────────────────────────────────────────
function rollDice() {
  const filtered = getFiltered();
  if (!filtered.length) return;
  const ex = filtered[Math.floor(Math.random() * filtered.length)];
  expandedId = ex.id;
  render();
  setTimeout(() => document.getElementById('card-' + ex.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  showToast('🎲 ' + ex.n);
}

// ── TOAST ──────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ── VISUAL EXPLORER ────────────────────────────────────────────────────────────
function getExplorerNeighbors(ex) {
  const diffIdx = DIFF_ORDER.indexOf(ex.d);
  const sameMuscle = exercises.filter(e => e.id !== ex.id && e.m === ex.m);

  function nameTokens(name) {
    return (name || '').toLowerCase().replace(/\(.*?\)/g, '').split(/\s+/).filter(t => t.length >= 4);
  }
  const myTokens = nameTokens(ex.n);

  const variations = exercises.filter(e => {
    if (e.id === ex.id || e.n === ex.n) return false;
    return nameTokens(e.n).some(t => myTokens.includes(t));
  }).slice(0, 3);

  const varIds = new Set(variations.map(e => e.id));

  const regressions = sameMuscle
    .filter(e => DIFF_ORDER.indexOf(e.d) < diffIdx && !varIds.has(e.id))
    .sort((a, b) => DIFF_ORDER.indexOf(b.d) - DIFF_ORDER.indexOf(a.d))
    .slice(0, 2);

  const progressions = sameMuscle
    .filter(e => DIFF_ORDER.indexOf(e.d) > diffIdx && !varIds.has(e.id))
    .sort((a, b) => DIFF_ORDER.indexOf(a.d) - DIFF_ORDER.indexOf(b.d))
    .slice(0, 2);

  return { regressions, progressions, variations };
}

function renderExplorer() {
  if (!explorerActiveId || exercises.length === 0) return;
  const ex = exercises.find(e => e.id === explorerActiveId);
  if (!ex) return;

  const { regressions, progressions, variations } = getExplorerNeighbors(ex);
  const canvas = document.getElementById('explorerCanvas');
  const nodesEl = document.getElementById('explorerNodes');
  const linesEl = document.getElementById('explorerLines');
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  const cx = W / 2, cy = H / 2;
  const isMobile = W < 500;

  const allSats = [
    ...regressions.map(e => ({ ex: e, type: 'regression' })),
    ...progressions.map(e => ({ ex: e, type: 'progression' })),
    ...variations.map(e => ({ ex: e, type: 'variation' }))
  ];

  const total = allSats.length;
  const radius = isMobile ? Math.min(W,H)*0.36 : Math.min(W,H)*0.38;

  const positions = allSats.map((item, i) => {
    const angle = (2 * Math.PI * i) / total - Math.PI / 2;
    return { ex: item.ex, type: item.type, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });

  linesEl.innerHTML = positions.map(({ x, y, type }) =>
    `<line class="explorer-line ${type}" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`
  ).join('');

  const muscleColor = MUSCLE_COLORS[ex.m] || '#888';
  let html = `<div class="explorer-node center-node" style="left:${cx}px;top:${cy}px">
    <div class="cn-accent-bar" style="background:${muscleColor}"></div>
    <div class="cn-name">${ex.n || 'Unnamed'}</div>
  </div>`;

  positions.forEach(({ ex: sat, x, y, type }) => {
    html += `<div class="explorer-node satellite-node type-${type}" style="left:${x}px;top:${y}px" onclick="navigateExplorer(${sat.id})">
      <div class="sat-inner sat-${type}">
        <div class="sat-type-label">${type}</div>
        <div class="sat-name">${sat.n || 'Unnamed'}</div>
      </div>
    </div>`;
  });

  nodesEl.innerHTML = html;
}

function navigateExplorer(id) {
  explorerActiveId = id;
  renderExplorer();
}

function openExplorer(id) {
  explorerActiveId = id || (expandedId || (exercises[0] && exercises[0].id));
  document.getElementById('explorerOverlay').classList.add('open');
  renderExplorer();
}

function closeExplorer() {
  document.getElementById('explorerOverlay').classList.remove('open');
}

window.addEventListener('resize', () => {
  if (document.getElementById('explorerOverlay').classList.contains('open')) renderExplorer();
});

// ── MISC ───────────────────────────────────────────────────────────────────────
function dismissBanner() {
  document.getElementById('installBanner').classList.remove('show');
}

loadExercises();
