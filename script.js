const SUPABASE_URL = 'https://spwoicclxqoxqkfkmcrw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwd29pY2NseHFveHFrZmttY3J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MzIzNDMsImV4cCI6MjA4NzIwODM0M30.QhrV6CqGMVpCu_ySygeATvF_hvGoGmgYzbocp9A-qX0';
const PASSWORD = 'Wilde';

// ── Anonymous user identity ──────────────────────────────────────────────────
function getOrCreateUserId() {
  let uid = localStorage.getItem('wilde_uid');
  if (!uid) {
    uid = crypto.randomUUID ? crypto.randomUUID() : 'uid-' + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem('wilde_uid', uid);
  }
  return uid;
}
const USER_ID = getOrCreateUserId();

const MUSCLE_REGIONS = {
  upper: ['Chest','Back','Shoulders','Trapezius','Biceps','Triceps','Forearms'],
  core:  ['Core'],
  lower: ['Quads','Hamstrings','Glutes','Calves','Hip Flexors','Abductors','Adductors','Shins'],
};
const MUSCLE_COLORS = {
  Chest:'#60a5fa', Back:'#3b82f6', Shoulders:'#93c5fd', Traps:'#7dd3fc',
  Biceps:'#a5b4fc', Triceps:'#818cf8', Forearms:'#c4b5fd', Core:'#34d399',
  Quads:'#f472b6', Hamstrings:'#fb7185', Glutes:'#f43f5e', Calves:'#fda4af',
  Hips:'#fb923c', 'Ankles/Feet':'#facc15',
};
const DIFF_ORDER = ['Novice','Beginner','Intermediate','Advanced','Expert','Master','Legendary','Grand Master'];
const MUSCLES_LIST = ['Ankles/Feet','Back','Biceps','Calves','Chest','Core','Forearms','Glutes','Hamstrings','Hips','Quads','Shoulders','Traps','Triceps'];
const DIFFS_LIST = ['Novice','Beginner','Intermediate','Advanced','Expert','Master','Legendary','Grand Master'];

async function sbFetch(path, opts={}) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...opts,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=minimal',
      ...(opts.headers||{})
    }
  });
  if (opts.returnData) return res.json();
  return res;
}

let exercises = [];
let favoriteIds = new Set();
let sessionList = [];
let currentRegion = 'all';
let currentMuscle = 'all';
let currentDiff = 'all';
let currentSearch = '';
let showFavoritesOnly = false;
let displayCount = 40;
let expandedId = null;

// ── Load all exercises ──────────────────────────────────────────────────────────
async function loadExercises() {
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/exercises?select=*&order=id.asc', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    exercises = await res.json();
    exercises = exercises.sort(() => Math.random() - 0.5);
    await loadFavorites();
    render();
  } catch(e) {
    document.getElementById('listContainer').innerHTML = '<div class="empty-state">Could not load exercises.</div>';
  }
}

async function loadFavorites() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/favorites?select=exercise_id&user_id=eq.${encodeURIComponent(USER_ID)}`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } });
    const rows = await res.json();
    favoriteIds = new Set((rows || []).map(r => r.exercise_id));
  } catch(e) { favoriteIds = new Set(); }
}

// ── VISUAL EXPLORER NEIGHBORS ──────────────────────────────────────────────────
function getExplorerNeighbors(ex) {
  const diffIdx = DIFF_ORDER.indexOf(ex.d);
  const sameMuscle = exercises.filter(e => e.id !== ex.id && e.m === ex.m);

  function nameTokens(name) {
    return (name || '').toLowerCase().replace(/\(.*?\)/g, '').split(/\s+/).filter(t => t.length >= 4);
  }
  const myTokens = nameTokens(ex.n);

  // FIX: Added filter(e => e.n !== ex.n) to stop showing the same exercise twice
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

// ── VISUAL EXPLORER RENDER (ORBITAL LAYOUT) ────────────────────────────────────
function renderExplorer() {
  if (!explorerActiveId || exercises.length === 0) return;
  const ex = exercises.find(e => e.id === explorerActiveId);
  if (!ex) return;

  const { regressions, progressions, variations } = getExplorerNeighbors(ex);
  const canvas = document.getElementById('explorerCanvas');
  const nodesEl = document.getElementById('explorerNodes');
  const linesEl = document.getElementById('explorerLines');

  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  const cx = W / 2;
  const cy = H / 2;
  const isMobile = W < 500;

  // FIX: Collect all items into one circular ring
  const allSats = [
    ...regressions.map(e => ({ ex: e, type: 'regression' })),
    ...progressions.map(e => ({ ex: e, type: 'progression' })),
    ...variations.map(e => ({ ex: e, type: 'variation' }))
  ];

  const total = allSats.length;
  const radius = isMobile ? Math.min(W, H) * 0.36 : Math.min(W, H) * 0.38;

  const positions = allSats.map((item, i) => {
    const angle = (2 * Math.PI * i) / total - Math.PI / 2;
    return {
      ex: item.ex,
      type: item.type,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    };
  });

  // SVG lines
  linesEl.innerHTML = positions.map(({ x, y, type }) => 
    `<line class="explorer-line ${type}" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`
  ).join('');

  let html = '';
  // Center Node
  const muscleColor = MUSCLE_COLORS[ex.m] || '#888';
  html += `<div class="explorer-node center-node" style="left:${cx}px;top:${cy}px" onclick="explorerOpenCenter(${ex.id})">
    <div class="cn-accent-bar" style="background:${muscleColor}"></div>
    <div class="cn-name">${ex.n || 'Unnamed'}</div>
  </div>`;

  // Satellites
  positions.forEach(({ ex: sat, x, y, type }) => {
    html += `<div class="explorer-node satellite-node type-${type}" style="left:${x}px;top:${y}px" onclick="navigateExplorer(${sat.id})">
      <div class="sat-inner">
        <div class="sat-type-label">${type}</div>
        <div class="sat-name">${sat.n || 'Unnamed'}</div>
      </div>
    </div>`;
  });

  nodesEl.innerHTML = html;
}

function explorerOpenCenter(id) {
  closeExplorer();
  expandedId = id;
  render();
  setTimeout(() => { document.getElementById('card-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
}

function navigateExplorer(id) {
  explorerActiveId = id;
  renderExplorer();
}

function openExplorer(id) {
  explorerActiveId = id || (expandedId || exercises[0].id);
  document.getElementById('explorerOverlay').classList.add('open');
  renderExplorer();
}

function closeExplorer() { document.getElementById('explorerOverlay').classList.remove('open'); }

window.addEventListener('resize', () => { if (document.getElementById('explorerOverlay').classList.contains('open')) renderExplorer(); });

loadExercises();
