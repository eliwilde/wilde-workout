const SUPABASE_URL = 'https://spwoicclxqoxqkfkmcrw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwd29pY2NseHFveHFrZmttY3J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MzIzNDMsImV4cCI6MjA4NzIwODM0M30.QhrV6CqGMVpCu_ySygeATvF_hvGoGmgYzbocp9A-qX0';
const PASSWORD = 'Wilde';

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
const MUSCLE_GROUPS = {
  'Hips':        ['Hips','Hip Flexors','Abductors','Adductors'],
  'Ankles/Feet': ['Ankles/Feet','Shins','Ankle'],
  'Traps':       ['Traps','Trapezius'],
};
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
let logoTaps = 0;
let logoTimer = null;
let filterDrawerOpen = false;

function toggleFilterDrawer() {
  filterDrawerOpen = !filterDrawerOpen;
  const drawer = document.getElementById('filterDrawer');
  const btn = document.getElementById('filterToggleBtn');
  drawer.classList.toggle('open', filterDrawerOpen);
  btn.classList.toggle('active', filterDrawerOpen);
}

function updateFilterToggleState() {
  const btn = document.getElementById('filterToggleBtn');
  if (!btn) return;
  const hasActive = currentRegion !== 'all' || currentMuscle !== 'all' || currentDiff !== 'all' || showFavoritesOnly;
  btn.classList.toggle('has-filters', hasActive);
}

async function loadExercises() {
  try {
    let all = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const res = await fetch(SUPABASE_URL + '/rest/v1/exercises?select=*&order=id.asc&limit=' + pageSize + '&offset=' + from, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Prefer': 'count=none' }
      });
      const batch = await res.json();
      if (!batch || batch.length === 0) break;
      all = all.concat(batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    exercises = all.sort(() => Math.random() - 0.5);
    buildMusclePills('all');
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

async function toggleFavorite(exerciseId, event) {
  event.stopPropagation();
  const isFav = favoriteIds.has(exerciseId);
  if (isFav) favoriteIds.delete(exerciseId); else favoriteIds.add(exerciseId);
  const btn = event.currentTarget;
  btn.classList.toggle('favorited', !isFav);
  btn.classList.add('pop');
  btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
  showToast(isFav ? 'Removed from favorites' : '♥ Added to favorites', !isFav);
  if (showFavoritesOnly && isFav) render();
  try {
    if (isFav) await sbFetch(`favorites?user_id=eq.${encodeURIComponent(USER_ID)}&exercise_id=eq.${exerciseId}`, { method: 'DELETE' });
    else await sbFetch('favorites', { method: 'POST', body: JSON.stringify({ user_id: USER_ID, exercise_id: exerciseId }) });
  } catch(e) { render(); }
}

function toggleFavFilter(el) {
  showFavoritesOnly = !showFavoritesOnly;
  el.classList.toggle('active', showFavoritesOnly);
  displayCount = 40;
  updateFilterToggleState();
  render();
}

function dismissBanner() { document.getElementById('installBanner').classList.remove('show'); localStorage.setItem('wilde_banner','1'); }
if (!localStorage.getItem('wilde_banner')) setTimeout(()=>document.getElementById('installBanner').classList.add('show'), 2000);

document.getElementById('logoBtn').addEventListener('click', () => {
  logoTaps++;
  clearTimeout(logoTimer);
  if (logoTaps >= 5) { logoTaps = 0; openPinModal(); return; }
  logoTimer = setTimeout(()=>{ logoTaps = 0; }, 1500);
});

function openPinModal() { document.getElementById('pinModal').classList.add('open'); setTimeout(()=>document.getElementById('pinInput').focus(), 100); }
function closePinModal() { document.getElementById('pinModal').classList.remove('open'); document.getElementById('pinInput').value = ''; }
function checkPin() {
  const val = document.getElementById('pinInput').value;
  if (val === PASSWORD) { closePinModal(); openEdit(); }
  else { const inp = document.getElementById('pinInput'); inp.classList.add('error'); setTimeout(()=>inp.classList.remove('error'), 400); }
}

function buildMusclePills(region) {
  const row = document.getElementById('muscleRow');
  let muscles = MUSCLES_LIST;
  if (region !== 'all') muscles = muscles.filter(m => MUSCLE_REGIONS[region]?.includes(m));
  row.innerHTML = `<div class="pill active" onclick="setMuscle('all',this)">All</div>` + muscles.map(m=>`<div class="pill" onclick="setMuscle('${m}',this)">${m}</div>`).join('');
}

function setRegion(r, el) {
  currentRegion = r; currentMuscle = 'all'; displayCount = 40;
  document.querySelectorAll('#regionRow .pill').forEach(p=>p.classList.remove('active')); el.classList.add('active');
  buildMusclePills(r); updateFilterToggleState(); render();
}
function setMuscle(m, el) {
  currentMuscle = m; displayCount = 40;
  document.querySelectorAll('#muscleRow .pill').forEach(p=>p.classList.remove('active')); el.classList.add('active'); updateFilterToggleState(); render();
}
function setDiff(d, el) {
  currentDiff = d; displayCount = 40;
  document.querySelectorAll('#diffRow .pill').forEach(p=>p.classList.remove('active')); el.classList.add('active'); updateFilterToggleState(); render();
}
document.getElementById('searchInput').addEventListener('input', e => {
  currentSearch = e.target.value.trim().toLowerCase(); displayCount = 40; render();
});

function getFiltered() {
  let list = exercises;
  if (showFavoritesOnly) list = list.filter(e => favoriteIds.has(e.id));
  if (currentRegion !== 'all') list = list.filter(e => MUSCLE_REGIONS[currentRegion]?.includes(e.m));
  if (currentMuscle !== 'all') { const group = MUSCLE_GROUPS[currentMuscle] || [currentMuscle]; list = list.filter(e => group.includes(e.m)); }
  if (currentDiff !== 'all') list = list.filter(e => e.d === currentDiff);
  if (currentSearch) list = list.filter(e => (e.n||'').toLowerCase().includes(currentSearch) || (e.m||'').toLowerCase().includes(currentSearch));
  const sort = document.getElementById('sortSelect').value;
  if (sort==='az') list = [...list].sort((a,b)=>(a.n||'').localeCompare(b.n||''));
  if (sort==='za') list = [...list].sort((a,b)=>(b.n||'').localeCompare(a.n||''));
  return list;
}

function render() {
  const filtered = getFiltered();
  const shown = filtered.slice(0, displayCount);
  document.getElementById('countDisplay').textContent = filtered.length.toLocaleString();
  const container = document.getElementById('listContainer');
  if (filtered.length === 0) { container.innerHTML = '<div class="empty-state">No exercises found.</div>'; return; }
  container.innerHTML = shown.map(ex => renderCard(ex)).join('') + (filtered.length > displayCount ? `<button class="load-more-btn" onclick="loadMore()">Load more</button>` : '');
}

function renderCard(ex) {
  const color = MUSCLE_COLORS[ex.m] || '#888';
  const isExpanded = expandedId === ex.id;
  const isFav = favoriteIds.has(ex.id);
  return `<div class="ex-card${isExpanded?' expanded':''}" onclick="toggleCard(${ex.id})">
    <div class="ex-card-main">
      <div class="muscle-bar" style="background:${color}"></div>
      <div class="ex-info">
        <div class="ex-name">${ex.n||'Unnamed'}</div>
        <div class="ex-sub"><span class="tag">${ex.m}</span><span class="tag">${ex.d}</span></div>
      </div>
      <div class="ex-right">
        <button class="heart-btn${isFav?' favorited':''}" onclick="toggleFavorite(${ex.id}, event)">
          <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
    </div>
  </div>`;
}

function toggleCard(id) { expandedId = expandedId === id ? null : id; render(); }
function loadMore() { displayCount += 40; render(); }

function showToast(msg, isHeart=false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isHeart ? ' heart-toast' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

loadExercises();
