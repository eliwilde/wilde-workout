const SUPABASE_URL = 'https://spwoicclxqoxqkfkmcrw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwd29pY2NseHFveHFrZmttY3J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MzIzNDMsImV4cCI6MjA4NzIwODM0M30.QhrV6CqGMVpCu_ySygeATvF_hvGoGmgYzbocp9A-qX0';

let exercises = [];
let explorerActiveId = null;
let expandedId = null;
const DIFF_ORDER = ['Novice','Beginner','Intermediate','Advanced','Expert','Master'];
const MUSCLE_COLORS = { Chest:'#60a5fa', Back:'#3b82f6', Shoulders:'#93c5fd', Traps:'#7dd3fc', Biceps:'#a5b4fc', Triceps:'#818cf8', Forearms:'#c4b5fd', Core:'#34d399', Quads:'#f472b6', Hamstrings:'#fb7185', Glutes:'#f43f5e', Calves:'#fda4af' };

async function loadExercises() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/exercises?select=*`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
  exercises = await res.json();
  render();
}

function getExplorerNeighbors(ex) {
  const sameMuscle = exercises.filter(e => e.m === ex.m && e.id !== ex.id);
  const myDiffIndex = DIFF_ORDER.indexOf(ex.d);

  // Regressions: same muscle, lower difficulty — up to 2
  const regressions = sameMuscle
    .filter(e => DIFF_ORDER.indexOf(e.d) < myDiffIndex)
    .slice(0, 2);

  // Progressions: same muscle, higher difficulty — up to 2
  const progressions = sameMuscle
    .filter(e => DIFF_ORDER.indexOf(e.d) > myDiffIndex)
    .slice(0, 2);

  // Variations: name shares first word, different exercise — up to 3
  const firstWord = ex.n.split(' ')[0];
  const variations = exercises
    .filter(e => e.id !== ex.id && e.n.startsWith(firstWord))
    .slice(0, 3);

  return { regressions, progressions, variations };
}

function renderExplorer() {
  const ex = exercises.find(e => e.id === explorerActiveId);

  if (!ex) {
    const canvas = document.getElementById('explorerCanvas');
    const cx = canvas.offsetWidth / 2;
    const cy = canvas.offsetHeight / 2;
    document.getElementById('explorerLines').innerHTML = '';
    document.getElementById('explorerNodes').innerHTML = `
      <div class="explorer-node center-node" style="left:${cx}px;top:${cy}px">
        <div class="cn-name" style="color:var(--muted2);font-size:12px;">Tap any exercise<br>to explore</div>
      </div>`;
    return;
  }

  const { regressions, progressions, variations } = getExplorerNeighbors(ex);

  // Build satellite list — ONLY include nodes that actually exist
  const allSats = [
    ...regressions.map(e => ({ ex: e, type: 'regression' })),
    ...progressions.map(e => ({ ex: e, type: 'progression' })),
    ...variations.map(e => ({ ex: e, type: 'variation' }))
  ].filter(item => item.ex && item.ex.id);  // skip any missing entries

  const canvas = document.getElementById('explorerCanvas');
  const cx = canvas.offsetWidth / 2;
  const cy = canvas.offsetHeight / 2;

  // TRUE circular layout — evenly spaced around a ring, starting from the top
  const nodeCount = allSats.length;
  const isMobile = canvas.offsetWidth < 500;
  // Radius scales up if there are many nodes to prevent crowding
  const radius = nodeCount > 0
    ? Math.max(isMobile ? 145 : 190, (nodeCount * 95) / (2 * Math.PI))
    : 190;

  const positions = allSats.map((item, i) => {
    const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2; // start at top
    return {
      ex: item.ex,
      type: item.type,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    };
  });

  // Draw SVG lines
  document.getElementById('explorerLines').innerHTML = positions.map(p =>
    `<line class="explorer-line ${p.type}" x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" />`
  ).join('');

  // Draw center node + satellites
  document.getElementById('explorerNodes').innerHTML =
    `<div class="explorer-node center-node" style="left:${cx}px;top:${cy}px">
      <div class="cn-muscle">${ex.m}</div>
      <div class="cn-name">${ex.n}</div>
      <div class="cn-diff diff-badge-${(ex.d||'').toLowerCase()}">${ex.d || ''}</div>
    </div>` +
    positions.map(p => `
      <div class="explorer-node sat-node" style="left:${p.x}px;top:${p.y}px" onclick="navigateExplorer(${p.ex.id})">
        <div class="sat-inner sat-${p.type}">
          <div class="sat-type-label">${p.type}</div>
          <div class="sat-name">${p.ex.n}</div>
        </div>
      </div>`
    ).join('');
}

function navigateExplorer(id) {
  explorerActiveId = id;
  renderExplorer();
}

function openExplorer(id) {
  explorerActiveId = id;
  document.getElementById('explorerOverlay').style.display = 'flex';
  renderExplorer();
}

function closeExplorer() {
  document.getElementById('explorerOverlay').style.display = 'none';
  explorerActiveId = null;
}

function toggleFilterDrawer() {
  document.getElementById('filterDrawer').classList.toggle('open');
}

function render() {
  document.getElementById('countDisplay').textContent = exercises.length;
  document.getElementById('listContainer').innerHTML = exercises.map(ex => `
    <div class="ex-card" onclick="openExplorer(${ex.id})">
      <div class="ex-card-main">
        <div class="muscle-bar" style="background:${MUSCLE_COLORS[ex.m] || '#888'}"></div>
        <div class="ex-info"><div class="ex-name">${ex.n}</div></div>
      </div>
    </div>`).join('');
}

loadExercises();
