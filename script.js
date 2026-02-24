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
  // Filter out any exercise with the exact same name OR same id as center
  const sameMuscle = exercises.filter(e => e.m === ex.m && e.id !== ex.id && e.n !== ex.n);
  const regressions = sameMuscle.filter(e => DIFF_ORDER.indexOf(e.d) < DIFF_ORDER.indexOf(ex.d)).slice(0, 2);
  const progressions = sameMuscle.filter(e => DIFF_ORDER.indexOf(e.d) > DIFF_ORDER.indexOf(ex.d)).slice(0, 2);
  // Also exclude same name in variations
  const variations = exercises.filter(e => e.id !== ex.id && e.n !== ex.n && e.n.includes(ex.n.split(' ')[0])).slice(0, 3);
  return { regressions, progressions, variations };
}

function renderExplorer() {
  const ex = exercises.find(e => e.id === explorerActiveId);
  const { regressions, progressions, variations } = getExplorerNeighbors(ex);
  const allSats = [
    ...regressions.map(e => ({ ex: e, type: 'regression' })),
    ...progressions.map(e => ({ ex: e, type: 'progression' })),
    ...variations.map(e => ({ ex: e, type: 'variation' }))
  ];
  
  const canvas = document.getElementById('explorerCanvas');
  const cx = canvas.offsetWidth / 2;
  const cy = canvas.offsetHeight / 2;

  // Radius scales so nodes never overlap: each node is ~120px wide, 
  // so circumference needs to be at least nodeCount * 130px
  const minRadius = canvas.offsetWidth < 500 ? 150 : 200;
  const nodeCount = allSats.length;
  // Make sure there's enough arc between nodes (each needs ~130px of arc space)
  const radiusFromNodeCount = nodeCount > 0 ? (nodeCount * 130) / (2 * Math.PI) : minRadius;
  const radius = Math.max(minRadius, radiusFromNodeCount);

  // Even ring: divide full circle equally among satellites
  const positions = allSats.map((item, i) => {
    const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2;
    return { ex: item.ex, type: item.type, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });

  document.getElementById('explorerLines').innerHTML = positions.map(p => 
    `<line class="explorer-line ${p.type}" x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" />`).join('');

  document.getElementById('explorerNodes').innerHTML = `
    <div class="explorer-node center-node" style="left:${cx}px;top:${cy}px">
      <div class="cn-name">${ex.n}</div>
    </div>` + positions.map(p => `
    <div class="explorer-node" style="left:${p.x}px;top:${p.y}px" onclick="navigateExplorer(${p.ex.id})">
      <div class="sat-inner">
        <div class="sat-type-label">${p.type}</div>
        <div class="sat-name">${p.ex.n}</div>
      </div>
    </div>`).join('');
}

function navigateExplorer(id) { explorerActiveId = id; renderExplorer(); }
function openExplorer(id) { explorerActiveId = id; document.getElementById('explorerOverlay').style.display = 'flex'; renderExplorer(); }
function toggleFilterDrawer() { document.getElementById('filterDrawer').classList.toggle('open'); }
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
