import {
  PLAYER_NAME,
  onAuthChange,
  signInTracker,
  signOutTracker,
  subscribeToGames,
  createGame,
  updateGameMeta,
  deleteGame,
  appendEvent,
  logShot,
  undoLastEvent,
  endPeriod,
  getShotSummary,
  getCountStats
} from './data-store.js';
import { classifyShot, pointFromEvent, drawPendingMarker, removePendingMarker } from './court.js';
import {
  renderShotChart,
  renderZoneCards,
  renderTrend,
  renderStatGrid,
  renderGameList,
  renderGameFilterChips,
  filterGames,
  formatDate
} from './render.js';
import { installPressFeedback } from './ui-feedback.js';

const SCOPE_KEY = 'shot-tracker-scope-id';

const el = (id) => document.getElementById(id);
const screens = ['signin', 'games', 'new-game', 'live', 'summary', 'insights'];
const NAV_VISIBLE_SCREENS = ['games', 'insights'];

const state = {
  scopeId: null,
  games: [],
  selectedGameId: null,
  pendingShot: null,
  periodMode: 'full',
  chartMode: 'scatter',
  chartMetric: 'fgpct',
  insightsChartMode: 'scatter',
  insightsChartMetric: 'fgpct',
  insightGameIds: new Set(),
  unsubscribeGames: null
};

const METRIC_MODES = ['zones', 'hex'];

installPressFeedback();

function showScreen(name) {
  screens.forEach((s) => el(`screen-${s}`).classList.toggle('hidden', s !== name));
  document.querySelector('.bottom-nav').classList.toggle('hidden', !NAV_VISIBLE_SCREENS.includes(name));
}

function setActiveNav(name) {
  document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.nav === name));
}

function getScopeId() {
  let scopeId = localStorage.getItem(SCOPE_KEY);
  if (!scopeId) {
    scopeId = crypto.randomUUID();
    localStorage.setItem(SCOPE_KEY, scopeId);
  }
  return scopeId;
}

function getSelectedGame() {
  return state.games.find((g) => g.id === state.selectedGameId) || null;
}

// --- Auth ---

onAuthChange((user) => {
  if (state.unsubscribeGames) {
    state.unsubscribeGames();
    state.unsubscribeGames = null;
  }
  if (!user) {
    showScreen('signin');
    return;
  }
  state.scopeId = getScopeId();
  const shareUrl = `${location.origin}${location.pathname.replace(/index\.html$/, '')}player.html?scope=${state.scopeId}`;
  el('share-link-input').value = shareUrl;
  state.unsubscribeGames = subscribeToGames(
    state.scopeId,
    (games) => {
      state.games = games;
      onGamesUpdated();
    },
    (error) => console.error('Failed to load games', error)
  );
  showScreen('games');
  setActiveNav('games');
});

el('signin-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  el('signin-error').textContent = '';
  try {
    await signInTracker(el('signin-email').value.trim(), el('signin-password').value);
  } catch (error) {
    el('signin-error').textContent = 'Could not sign in. Check your email and password.';
  }
});

el('sign-out-btn').addEventListener('click', () => signOutTracker());

// --- Games updates drive whichever screen is visible ---

function onGamesUpdated() {
  renderGameList(el('game-list'), state.games, state.selectedGameId, { canManage: true });
  if (!el('screen-live').classList.contains('hidden')) renderLiveScreen();
  if (!el('screen-summary').classList.contains('hidden')) renderSummaryScreen();
  if (!el('screen-insights').classList.contains('hidden')) renderInsightsScreen();
}

function openGame(game) {
  state.selectedGameId = game.id;
  state.pendingShot = null;
  setActiveNav('games');
  if (game.status === 'live') {
    showScreen('live');
    renderLiveScreen();
  } else {
    showScreen('summary');
    renderSummaryScreen();
  }
}

el('game-list').addEventListener('click', (event) => {
  const deleteBtn = event.target.closest('[data-delete-id]');
  if (deleteBtn) {
    const game = state.games.find((g) => g.id === deleteBtn.dataset.deleteId);
    if (game && confirm(`Delete "${game.name}"? This can't be undone.`)) {
      deleteGame(state.scopeId, game.id);
      if (state.selectedGameId === game.id) state.selectedGameId = null;
    }
    return;
  }
  const resumeBtn = event.target.closest('[data-resume-id]');
  if (resumeBtn) {
    const game = state.games.find((g) => g.id === resumeBtn.dataset.resumeId);
    if (game) {
      updateGameMeta(state.scopeId, game.id, { status: 'live' });
      openGame({ ...game, status: 'live' });
    }
    return;
  }
  const selectBtn = event.target.closest('[data-select-id]');
  if (!selectBtn) return;
  const game = state.games.find((g) => g.id === selectBtn.dataset.selectId);
  if (game) openGame(game);
});

document.querySelectorAll('[data-nav]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.nav;
    if (target === 'games') {
      showScreen('games');
      setActiveNav('games');
    } else if (target === 'live') {
      const game = getSelectedGame();
      if (game) updateGameMeta(state.scopeId, game.id, { status: 'live' });
      state.pendingShot = null;
      showScreen('live');
      setActiveNav('games');
      renderLiveScreen();
    } else if (target === 'insights') {
      showScreen('insights');
      setActiveNav('insights');
      renderInsightsScreen();
    }
  });
});

el('new-game-open-btn').addEventListener('click', () => {
  el('new-game-player-name').textContent = PLAYER_NAME;
  showScreen('new-game');
});

el('copy-link-btn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(el('share-link-input').value);
    const btn = el('copy-link-btn');
    const original = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => (btn.textContent = original), 1500);
  } catch (error) {
    el('share-link-input').select();
  }
});

// --- New game form ---

document.querySelectorAll('#period-mode-group button').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.periodMode = btn.dataset.mode;
    document.querySelectorAll('#period-mode-group button').forEach((b) => b.classList.toggle('active', b === btn));
  });
});

el('start-tracking-btn').addEventListener('click', async () => {
  const meta = {
    name: `Game ${state.games.length + 1}`,
    opponent: el('ng-opponent').value.trim(),
    venue: el('ng-venue').value.trim(),
    league: el('ng-league').value.trim(),
    date: el('ng-date').value,
    time: el('ng-time').value,
    periodMode: state.periodMode
  };
  const docRef = await createGame(state.scopeId, meta);
  state.selectedGameId = docRef.id;
  state.pendingShot = null;
  showScreen('live');
  setActiveNav('games');
});

// --- Live tracking ---

function periodLabel(game) {
  if (!game || game.periodMode === 'full') return '';
  const prefix = game.periodMode === 'quarters' ? 'Q' : 'H';
  return `${prefix}${game.currentPeriod}`;
}

function renderLiveStatStrip(container, events) {
  const summary = getShotSummary(events);
  const counts = getCountStats(events);
  container.innerHTML = `
    <div class="stat-cell"><span class="value">${counts.totalRebounds}</span><span class="label">Reb</span></div>
    <div class="stat-cell"><span class="value">${counts.assists}</span><span class="label">Ast</span></div>
    <div class="stat-cell"><span class="value">${counts.steals}</span><span class="label">Stl</span></div>
    <div class="stat-cell"><span class="value">${counts.blocks}</span><span class="label">Blk</span></div>
    <div class="stat-cell"><span class="value">${counts.turnovers}</span><span class="label">Tov</span></div>
    <div class="stat-cell"><span class="value">${summary.overallMakes}/${summary.overallAttempts}</span><span class="label">FG</span></div>
    <div class="stat-cell"><span class="value">${summary.threeMakes}/${summary.threeAttempts}</span><span class="label">3PT</span></div>
    <div class="stat-cell"><span class="value">${summary.freeMakes}/${summary.freeAttempts}</span><span class="label">FT</span></div>
    <div class="stat-cell"><span class="value">${counts.fouls}</span><span class="label">Fol</span></div>
  `;
}

function renderLiveScreen() {
  const game = getSelectedGame();
  if (!game) return;
  el('live-player-name').textContent = PLAYER_NAME;
  const summary = getShotSummary(game.events);
  el('live-points').textContent = summary.points;
  el('live-period-chip').textContent = periodLabel(game);
  el('end-period-btn').textContent = game.periodMode === 'full' ? 'Done' : `End ${periodLabel(game)}`;
  renderLiveStatStrip(el('live-stat-strip'), game.events);
  renderShotChart(el('live-court'), game.events, 'scatter');

  if (state.pendingShot) {
    drawPendingMarker(el('live-court'), state.pendingShot.x, state.pendingShot.y);
    el('shot-confirm-type').textContent = state.pendingShot.shotType;
    el('shot-confirm-panel').classList.remove('hidden');
    el('live-tap-hint').classList.add('hidden');
    el('live-legend').classList.add('hidden');
  } else {
    el('shot-confirm-panel').classList.add('hidden');
    el('live-tap-hint').classList.remove('hidden');
    el('live-legend').classList.remove('hidden');
  }
}

el('live-court').addEventListener('click', (event) => {
  const game = getSelectedGame();
  if (!game) return;
  const svg = el('live-court');
  const { x, y } = pointFromEvent(svg, event);
  state.pendingShot = { x, y, shotType: classifyShot(x, y) };
  renderLiveScreen();
});

function confirmPendingShot(result) {
  const game = getSelectedGame();
  if (!game || !state.pendingShot) return;
  const { x, y, shotType } = state.pendingShot;
  logShot(state.scopeId, game.id, { x, y, shotType, result }, game.currentPeriod);
  state.pendingShot = null;
  removePendingMarker(el('live-court'));
  renderLiveScreen();
}

el('confirm-make-btn').addEventListener('click', () => confirmPendingShot('make'));
el('confirm-miss-btn').addEventListener('click', () => confirmPendingShot('miss'));
el('confirm-cancel-btn').addEventListener('click', () => {
  state.pendingShot = null;
  removePendingMarker(el('live-court'));
  renderLiveScreen();
});

el('ft-make-btn').addEventListener('click', () => {
  const game = getSelectedGame();
  if (game) appendEvent(state.scopeId, game.id, { type: 'freeThrow', result: 'make' }, game.currentPeriod);
});

el('ft-miss-btn').addEventListener('click', () => {
  const game = getSelectedGame();
  if (game) appendEvent(state.scopeId, game.id, { type: 'freeThrow', result: 'miss' }, game.currentPeriod);
});

document.querySelectorAll('.quick-grid button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const game = getSelectedGame();
    if (!game) return;
    const eventType = btn.dataset.event;
    const sub = btn.dataset.sub;
    const payload = { type: eventType };
    if (eventType === 'rebound') payload.reboundType = sub;
    if (eventType === 'foul') payload.foulType = sub;
    appendEvent(state.scopeId, game.id, payload, game.currentPeriod);
  });
});

el('undo-btn').addEventListener('click', () => {
  const game = getSelectedGame();
  if (game) undoLastEvent(state.scopeId, game.id, game.events);
});

function finishGame(game) {
  updateGameMeta(state.scopeId, game.id, { status: 'final' });
  showScreen('summary');
  setActiveNav('games');
  renderSummaryScreen();
}

el('end-period-btn').addEventListener('click', () => {
  const game = getSelectedGame();
  if (!game) return;
  if (game.periodMode === 'full') {
    finishGame(game);
    return;
  }
  endPeriod(state.scopeId, game.id, game.currentPeriod + 1);
});

el('done-btn').addEventListener('click', () => {
  const game = getSelectedGame();
  if (game) finishGame(game);
});

// --- Summary ---

document.querySelectorAll('#screen-summary .chart-tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.chartMode = btn.dataset.chartMode;
    document.querySelectorAll('#screen-summary .chart-tabs .tab').forEach((b) => b.classList.toggle('active', b === btn));
    el('summary-legend').classList.toggle('hidden', state.chartMode !== 'scatter');
    el('summary-metric-toggle').classList.toggle('hidden', !METRIC_MODES.includes(state.chartMode));
    renderSummaryScreen();
  });
});

document.querySelectorAll('#summary-metric-toggle .metric-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.chartMetric = btn.dataset.metric;
    document.querySelectorAll('#summary-metric-toggle .metric-btn').forEach((b) => b.classList.toggle('active', b === btn));
    renderSummaryScreen();
  });
});

function renderSummaryScreen() {
  const game = getSelectedGame();
  if (!game) return;
  const summary = getShotSummary(game.events);
  el('summary-player-name').textContent = PLAYER_NAME;
  el('summary-opponent').textContent = `${game.opponent ? `vs ${game.opponent} • ` : ''}${formatDate(game.date)}`;
  el('summary-points').textContent = summary.points;
  renderStatGrid(el('summary-stat-grid'), game.events);
  renderShotChart(el('summary-court'), game.events, state.chartMode, state.chartMetric);
  renderZoneCards(el('summary-zone-grid'), game.events);
}

// --- Insights ---

document.querySelectorAll('#screen-insights .chart-tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.insightsChartMode = btn.dataset.chartMode;
    document.querySelectorAll('#screen-insights .chart-tabs .tab').forEach((b) => b.classList.toggle('active', b === btn));
    el('insights-legend').classList.toggle('hidden', state.insightsChartMode !== 'scatter');
    el('insights-metric-toggle').classList.toggle('hidden', !METRIC_MODES.includes(state.insightsChartMode));
    renderInsightsScreen();
  });
});

document.querySelectorAll('#insights-metric-toggle .metric-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.insightsChartMetric = btn.dataset.metric;
    document.querySelectorAll('#insights-metric-toggle .metric-btn').forEach((b) => b.classList.toggle('active', b === btn));
    renderInsightsScreen();
  });
});

el('insights-game-filter').addEventListener('click', (event) => {
  const chip = event.target.closest('[data-filter-game]');
  if (!chip) return;
  const gameId = chip.dataset.filterGame;
  if (gameId === 'all') {
    state.insightGameIds.clear();
  } else if (state.insightGameIds.has(gameId)) {
    state.insightGameIds.delete(gameId);
  } else {
    state.insightGameIds.add(gameId);
  }
  renderInsightsScreen();
});

function renderInsightsScreen() {
  const filteredGames = filterGames(state.games, state.insightGameIds);
  const combinedEvents = filteredGames.flatMap((g) => g.events);
  renderGameFilterChips(el('insights-game-filter'), state.games, state.insightGameIds);
  renderShotChart(el('insights-court'), combinedEvents, state.insightsChartMode, state.insightsChartMetric);
  renderZoneCards(el('insights-zone-grid'), combinedEvents);
  renderTrend(el('insights-trend'), filteredGames, state.selectedGameId);
}
