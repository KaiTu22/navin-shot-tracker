const STORAGE_KEY = 'shot-tracker-state-v1';
const ZONE_LABELS = ['Left Corner', 'Left Wing', 'Paint Left', 'Top Arc', 'Paint Right', 'Right Wing', 'Right Corner', 'Center'];
const DEFAULT_STATS = {
  assists: 0,
  totalRebounds: 0,
  offensiveRebounds: 0,
  defensiveRebounds: 0,
  steals: 0,
  fouls: 0
};

const state = loadState();

const elements = {
  playerNameReadout: document.querySelector('#player-name-readout'),
  opponentLine: document.querySelector('.opponent-line'),
  pointsTotal: document.querySelector('#points-total'),
  rebTotal: document.querySelector('#reb-total'),
  astTotal: document.querySelector('#ast-total'),
  stlTotal: document.querySelector('#stl-total'),
  blkTotal: document.querySelector('#blk-total'),
  fgTotal: document.querySelector('#fg-total'),
  fg2Total: document.querySelector('#fg2-total'),
  fg3Total: document.querySelector('#fg3-total'),
  ftTotal: document.querySelector('#ft-total'),
  fgPct: document.querySelector('#fg-pct'),
  fg2Pct: document.querySelector('#fg2-pct'),
  fg3Pct: document.querySelector('#fg3-pct'),
  ftPct: document.querySelector('#ft-pct'),
  tovTotal: document.querySelector('#tov-total'),
  foulsTotal: document.querySelector('#fouls-total'),
  manualStats: document.querySelector('#manual-stats'),
  insightGrid: document.querySelector('#insight-grid'),
  trendPanel: document.querySelector('#trend-panel'),
  court: document.querySelector('#court'),
  shotTypeIndicator: document.querySelector('#shot-type-indicator'),
  gameSheetToggle: document.querySelector('#game-sheet-toggle'),
  gameSheet: document.querySelector('#game-sheet'),
  gameList: document.querySelector('#game-list'),
  gameSheetClose: document.querySelector('#game-sheet-close'),
  gameForm: document.querySelector('#game-form'),
  gameNameInput: document.querySelector('#game-name-input'),
  opponentInput: document.querySelector('#opponent-input'),
  gameDateInput: document.querySelector('#game-date-input'),
  playerNameInput: document.querySelector('#player-name-input'),
  newGameBtn: document.querySelector('#new-game-btn')
};

let currentType = '2PT';
let currentResult = 'make';

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createGame(name = 'Game 1', opponent = 'Opponent', date = new Date().toISOString().slice(0, 10)) {
  return {
    id: uid(),
    name,
    opponent,
    date,
    stats: { ...DEFAULT_STATS },
    shots: []
  };
}

function normalizeGame(game, index = 0) {
  const normalized = game || {};
  return {
    id: normalized.id || uid(),
    name: normalized.name || `Game ${index + 1}`,
    opponent: normalized.opponent || 'Opponent',
    date: normalized.date || new Date().toISOString().slice(0, 10),
    stats: { ...DEFAULT_STATS, ...(normalized.stats || {}) },
    shots: Array.isArray(normalized.shots) ? normalized.shots : []
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.games) && parsed.games.length) {
        const games = parsed.games.map((game, index) => normalizeGame(game, index));
        return {
          playerName: parsed.playerName || 'Navin',
          selectedGameId: parsed.selectedGameId || games[0].id,
          insightView: parsed.insightView || 'all',
          games
        };
      }
    } catch (error) {
      console.error('Unable to load saved tracker state', error);
    }
  }

  const game = createGame('Game 1', 'South Brunswick');
  return {
    playerName: 'Navin',
    selectedGameId: game.id,
    insightView: 'all',
    games: [game]
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getSelectedGame() {
  return state.games.find(game => game.id === state.selectedGameId) || state.games[0];
}

function getGameScope() {
  return state.insightView === 'selected' ? [getSelectedGame()] : state.games;
}

function formatPercent(value) {
  if (!Number.isFinite(value) || value === null || value === undefined) return '0.0%';
  return `${(value * 100).toFixed(1)}%`;
}

function getShotSummary(game) {
  const summary = {
    overallAttempts: 0,
    overallMakes: 0,
    twoAttempts: 0,
    twoMakes: 0,
    threeAttempts: 0,
    threeMakes: 0,
    freeAttempts: 0,
    freeMakes: 0,
    overallPct: 0,
    twoPct: 0,
    threePct: 0,
    freePct: 0
  };

  for (const shot of game.shots || []) {
    const isMake = shot.result === 'make';
    summary.overallAttempts += 1;
    if (isMake) summary.overallMakes += 1;

    if (shot.type === '2PT') {
      summary.twoAttempts += 1;
      if (isMake) summary.twoMakes += 1;
    }

    if (shot.type === '3PT') {
      summary.threeAttempts += 1;
      if (isMake) summary.threeMakes += 1;
    }

    if (shot.type === 'FT') {
      summary.freeAttempts += 1;
      if (isMake) summary.freeMakes += 1;
    }
  }

  summary.overallPct = summary.overallAttempts ? summary.overallMakes / summary.overallAttempts : 0;
  summary.twoPct = summary.twoAttempts ? summary.twoMakes / summary.twoAttempts : 0;
  summary.threePct = summary.threeAttempts ? summary.threeMakes / summary.threeAttempts : 0;
  summary.freePct = summary.freeAttempts ? summary.freeMakes / summary.freeAttempts : 0;
  return summary;
}

function renderSummary() {
  const selected = getSelectedGame();
  const summary = getShotSummary(selected);
  const points = summary.twoMakes * 2 + summary.threeMakes * 3 + summary.freeMakes;
  const dateLabel = selected.date ? new Date(`${selected.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Today';

  elements.playerNameReadout.textContent = state.playerName || 'Player';
  elements.opponentLine.textContent = `vs ${selected.opponent || 'Opponent'} • ${dateLabel}`;
  elements.pointsTotal.textContent = points;
  elements.rebTotal.textContent = selected.stats.totalRebounds || 0;
  elements.astTotal.textContent = selected.stats.assists || 0;
  elements.stlTotal.textContent = selected.stats.steals || 0;
  elements.blkTotal.textContent = '0';
  elements.fgTotal.textContent = `${summary.overallMakes}/${summary.overallAttempts}`;
  elements.fg2Total.textContent = `${summary.twoMakes}/${summary.twoAttempts}`;
  elements.fg3Total.textContent = `${summary.threeMakes}/${summary.threeAttempts}`;
  elements.ftTotal.textContent = `${summary.freeMakes}/${summary.freeAttempts}`;
  elements.fgPct.textContent = `${(summary.overallPct * 100).toFixed(0)}%`;
  elements.fg2Pct.textContent = `${(summary.twoPct * 100).toFixed(0)}%`;
  elements.fg3Pct.textContent = `${(summary.threePct * 100).toFixed(0)}%`;
  elements.ftPct.textContent = `${(summary.freePct * 100).toFixed(0)}%`;
  elements.foulsTotal.textContent = selected.stats.fouls || 0;
  elements.tovTotal.textContent = '0';
}

function renderManualStats() {
  const selected = getSelectedGame();
  const statEntries = [
    { key: 'assists', label: 'Assists' },
    { key: 'totalRebounds', label: 'Total Rebounds' },
    { key: 'offensiveRebounds', label: 'Offensive Rebounds' },
    { key: 'defensiveRebounds', label: 'Defensive Rebounds' },
    { key: 'steals', label: 'Steals' },
    { key: 'fouls', label: 'Fouls' }
  ];

  elements.manualStats.innerHTML = statEntries.map(entry => `
    <div class="stat-row" data-stat-row="${entry.key}">
      <div class="stat-label">${entry.label}</div>
      <div class="stat-controls">
        <button class="count-button" data-stat="${entry.key}" data-step="-1" aria-label="Decrease ${entry.label}">-</button>
        <span class="count-value">${selected.stats[entry.key] || 0}</span>
        <button class="count-button" data-stat="${entry.key}" data-step="1" aria-label="Increase ${entry.label}">+</button>
      </div>
    </div>
  `).join('');
}

function getZoneForPoint(x, y) {
  if (x <= 22 && y >= 74) return 'Left Corner';
  if (x <= 30 && y >= 35 && y <= 72) return 'Paint Left';
  if (x <= 50 && y <= 32) return 'Top Arc';
  if (x >= 78 && y >= 74) return 'Right Corner';
  if (x >= 70 && y >= 35 && y <= 72) return 'Paint Right';
  if (x > 30 && x < 70 && y > 26 && y < 74) return 'Center';
  if (x < 50 && y > 32 && y < 74) return 'Left Wing';
  if (x > 50 && y > 32 && y < 74) return 'Right Wing';
  if (x > 20 && x < 80 && y < 32) return 'Top Arc';
  return 'Center';
}

function getShotTypeFromPoint(x, y) {
  const basketX = 72;
  const basketY = 50;
  const distance = Math.hypot(x - basketX, y - basketY);
  return distance > 28 ? '3PT' : '2PT';
}

function drawCourt() {
  const svg = elements.court;
  svg.innerHTML = `
    <rect x="0" y="0" width="100" height="100" fill="#d7c79e" />
    <rect x="8" y="8" width="84" height="84" fill="none" stroke="#f5f5f5" stroke-width="1.5" />

    <path d="M 8 50 L 92 50" fill="none" stroke="#f5f5f5" stroke-width="1.5" />
    <path d="M 50 8 L 50 92" fill="none" stroke="#f5f5f5" stroke-width="1.5" />

    <path d="M 8 16 Q 50 2 92 16" fill="none" stroke="#f5f5f5" stroke-width="1.5" />
    <path d="M 8 84 Q 50 98 92 84" fill="none" stroke="#f5f5f5" stroke-width="1.5" />

    <path d="M 8 28 Q 50 18 92 28" fill="none" stroke="#f5f5f5" stroke-width="1.5" />
    <path d="M 8 72 Q 50 82 92 72" fill="none" stroke="#f5f5f5" stroke-width="1.5" />

    <path d="M 18 50 Q 50 30 82 50" fill="none" stroke="#f5f5f5" stroke-width="1.5" />
    <path d="M 18 50 Q 50 70 82 50" fill="none" stroke="#f5f5f5" stroke-width="1.5" />

    <rect x="35" y="35" width="30" height="30" fill="none" stroke="#f5f5f5" stroke-width="1.5" />
    <rect x="25" y="25" width="50" height="50" fill="none" stroke="#f5f5f5" stroke-width="1.5" />

    <circle cx="50" cy="50" r="12" fill="none" stroke="#f5f5f5" stroke-width="1.5" />
    <circle cx="50" cy="50" r="20" fill="none" stroke="#f5f5f5" stroke-width="1.5" />
    <circle cx="50" cy="50" r="30" fill="none" stroke="#f5f5f5" stroke-width="1.5" />
    <circle cx="50" cy="50" r="40" fill="none" stroke="#f5f5f5" stroke-width="1.5" />

    <circle cx="50" cy="50" r="3" fill="#f5f5f5" />

    <path d="M 8 32 L 26 32 L 26 68 L 8 68" fill="none" stroke="#f5f5f5" stroke-width="1.5" />
    <path d="M 92 32 L 74 32 L 74 68 L 92 68" fill="none" stroke="#f5f5f5" stroke-width="1.5" />
  `;
}

function renderCourt() {
  drawCourt();
  const selected = getSelectedGame();
  const latestShots = [...selected.shots].slice(-10);

  latestShots.forEach((shot) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', shot.x);
    circle.setAttribute('cy', shot.y);
    circle.setAttribute('r', '2.8');
    circle.setAttribute('fill', shot.result === 'make' ? '#39d98a' : '#ff5d5d');
    circle.setAttribute('opacity', '0.96');
    elements.court.appendChild(circle);
  });
}

function renderInsights() {
  const games = getGameScope();
  const zoneStats = ZONE_LABELS.map(label => {
    let total = 0;
    let makes = 0;
    for (const game of games) {
      for (const shot of game.shots) {
        if (shot.zone !== label) continue;
        total += 1;
        if (shot.result === 'make') makes += 1;
      }
    }
    return { label, attempts: total, makes, rate: total ? makes / total : 0 };
  }).filter(zone => zone.attempts > 0).sort((a, b) => b.attempts - a.attempts).slice(0, 6);

  if (!zoneStats.length) {
    elements.insightGrid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">No shot data yet for this view.</div>';
  } else {
    elements.insightGrid.innerHTML = zoneStats.map(zone => `
      <div class="zone-card">
        <div class="zone-name">${zone.label}</div>
        <div class="zone-value">${formatPercent(zone.rate)}</div>
        <div class="zone-meta">${zone.makes}/${zone.attempts}</div>
      </div>
    `).join('');
  }

  const trendGames = [...state.games].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!trendGames.length) {
    elements.trendPanel.innerHTML = '<div class="empty-state">No games yet.</div>';
    return;
  }

  const strongestGame = trendGames.reduce((max, game) => {
    const summary = getShotSummary(game);
    const percentage = summary.overallAttempts ? summary.overallMakes / summary.overallAttempts : 0;
    return percentage > max.value ? { value: percentage, game } : max;
  }, { value: -1, game: null });

  const trendMarkup = trendGames.map(game => {
    const summary = getShotSummary(game);
    const fgPct = summary.overallAttempts ? summary.overallMakes / summary.overallAttempts : 0;
    const active = game.id === getSelectedGame().id ? 'active' : '';
    return `
      <div class="game-trend ${active}">
        <div class="game-trend-header">
          <span>${game.name}</span>
          <span>${formatPercent(fgPct)}</span>
        </div>
        <div class="bar-chart">
          <div class="bar-row">
            <span>FG%</span>
            <div class="bar-track"><div class="bar-fill" style="width: ${Math.min(100, fgPct * 100)}%"></div></div>
            <span>${formatPercent(fgPct)}</span>
          </div>
          <div class="bar-row">
            <span>3PT%</span>
            <div class="bar-track"><div class="bar-fill" style="width: ${Math.min(100, summary.threePct * 100)}%"></div></div>
            <span>${formatPercent(summary.threePct)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const bestLine = strongestGame.game ? `<div class="summary-meta">Best shooting game: ${strongestGame.game.name} (${formatPercent(strongestGame.value)})</div>` : '';
  elements.trendPanel.innerHTML = `${trendMarkup}${bestLine}`;
}

function renderGameList() {
  elements.gameList.innerHTML = state.games.map((game) => {
    const activeClass = game.id === state.selectedGameId ? 'active' : '';
    const dateLabel = game.date ? new Date(`${game.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Today';
    const shotTotal = game.shots ? game.shots.length : 0;
    return `
      <button type="button" class="game-item ${activeClass}" data-game-id="${game.id}">
        <span>
          <span class="game-item__title">${game.name}</span>
          <span class="game-item__meta">vs ${game.opponent || 'Opponent'} • ${dateLabel}</span>
        </span>
        <span class="game-item__chip">${shotTotal}</span>
      </button>
    `;
  }).join('');
}

function openGameSheet() {
  elements.gameSheet.classList.add('is-open');
  elements.gameSheet.setAttribute('aria-hidden', 'false');
  const selected = getSelectedGame();
  elements.gameNameInput.value = selected.name || '';
  elements.opponentInput.value = selected.opponent || '';
  elements.gameDateInput.value = selected.date || '';
  elements.playerNameInput.value = state.playerName || '';
  renderGameList();
}

function closeGameSheet() {
  elements.gameSheet.classList.remove('is-open');
  elements.gameSheet.setAttribute('aria-hidden', 'true');
}

function refreshAll() {
  document.querySelectorAll('.filter-button').forEach(item => {
    item.classList.toggle('active', item.dataset.view === state.insightView);
  });

  renderSummary();
  renderManualStats();
  renderInsights();
  renderCourt();
  renderGameList();
}

function handleStatChange(statKey, delta) {
  const selected = getSelectedGame();
  selected.stats[statKey] = Math.max(0, (selected.stats[statKey] || 0) + delta);
  saveState();
  renderSummary();
  renderManualStats();
}

function addGame() {
  const count = state.games.length + 1;
  const game = createGame(`Game ${count}`, 'Opponent');
  state.games.push(game);
  state.selectedGameId = game.id;
  saveState();
  refreshAll();
  openGameSheet();
}

function updateSelectedGameMetadata() {
  const selected = getSelectedGame();
  if (!selected) return;
  state.playerName = elements.playerNameInput.value.trim() || state.playerName || 'Player';
  selected.name = elements.gameNameInput.value.trim() || selected.name || 'Game';
  selected.opponent = elements.opponentInput.value.trim() || 'Opponent';
  selected.date = elements.gameDateInput.value || selected.date || new Date().toISOString().slice(0, 10);
  saveState();
  refreshAll();
}

function resetGame() {
  const selected = getSelectedGame();
  selected.stats = { ...DEFAULT_STATS };
  selected.shots = [];
  saveState();
  refreshAll();
}

function handleResultSelection(result) {
  currentResult = result;
  document.querySelectorAll('#shot-result-group .segment').forEach(button => {
    button.classList.toggle('active', button.dataset.result === result);
  });
}

function updateShotTypeByPoint(x, y) {
  const nextType = getShotTypeFromPoint(x, y);
  currentType = nextType;
  elements.shotTypeIndicator.textContent = nextType;
}

function logShot(event) {
  const rect = elements.court.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  const selected = getSelectedGame();

  updateShotTypeByPoint(x, y);

  selected.shots.push({
    id: uid(),
    type: currentType,
    result: currentResult,
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
    zone: getZoneForPoint(x, y),
    timestamp: new Date().toISOString()
  });

  saveState();
  refreshAll();
}

function handleQuickShot(result) {
  currentResult = result;
  currentType = '2PT';
  elements.shotTypeIndicator.textContent = '2PT';
  handleResultSelection(result);
  const selected = getSelectedGame();
  selected.shots.push({
    id: uid(),
    type: '2PT',
    result,
    x: 82,
    y: 50,
    zone: 'Paint Right',
    timestamp: new Date().toISOString()
  });
  saveState();
  refreshAll();
}

function attachEvents() {
  elements.gameSheetToggle.addEventListener('click', openGameSheet);
  elements.gameSheetClose.addEventListener('click', closeGameSheet);
  elements.gameSheet.addEventListener('click', (event) => {
    if (event.target.dataset.closeSheet === 'true') closeGameSheet();
  });

  elements.newGameBtn.addEventListener('click', () => {
    addGame();
    openGameSheet();
  });

  elements.gameList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-game-id]');
    if (!button) return;
    state.selectedGameId = button.dataset.gameId;
    saveState();
    refreshAll();
    closeGameSheet();
  });

  elements.gameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const nameValue = elements.gameNameInput.value.trim();
    const opponentValue = elements.opponentInput.value.trim();
    const dateValue = elements.gameDateInput.value;
    const playerValue = elements.playerNameInput.value.trim();

    if (playerValue) {
      state.playerName = playerValue;
    }

    const selected = getSelectedGame();
    if (selected) {
      selected.name = nameValue || selected.name || 'Game';
      selected.opponent = opponentValue || selected.opponent || 'Opponent';
      selected.date = dateValue || selected.date || new Date().toISOString().slice(0, 10);
    }

    saveState();
    refreshAll();
    closeGameSheet();
  });

  elements.court.addEventListener('click', logShot);

  document.querySelectorAll('#shot-result-group .segment').forEach(button => {
    button.addEventListener('click', () => handleResultSelection(button.dataset.result));
  });

  elements.manualStats.addEventListener('click', event => {
    const button = event.target.closest('.count-button');
    if (!button) return;
    handleStatChange(button.dataset.stat, Number(button.dataset.step));
  });

  document.querySelectorAll('.filter-button').forEach(button => {
    button.addEventListener('click', () => {
      state.insightView = button.dataset.view;
      document.querySelectorAll('.filter-button').forEach(item => {
        item.classList.toggle('active', item.dataset.view === state.insightView);
      });
      saveState();
      renderInsights();
    });
  });

  document.querySelector('.done-button')?.addEventListener('click', resetGame);
  document.querySelector('.quick-action.success')?.addEventListener('click', () => handleQuickShot('make'));
  document.querySelector('.quick-action.danger')?.addEventListener('click', () => handleQuickShot('miss'));
}

const initialPoint = { x: 78, y: 50 };
updateShotTypeByPoint(initialPoint.x, initialPoint.y);
attachEvents();
refreshAll();
