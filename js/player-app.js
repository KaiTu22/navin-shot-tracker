import { PLAYER_NAME, subscribeToGames, getShotSummary } from './data-store.js';
import {
  renderShotChart,
  renderZoneCards,
  renderTrend,
  renderStatGrid,
  renderGameList,
  renderGameFilterChips,
  filterGames,
  metricHintText,
  formatDate
} from './render.js';
import { installPressFeedback } from './ui-feedback.js';

const el = (id) => document.getElementById(id);
const screens = ['missing-link', 'games', 'summary', 'insights'];
const NAV_VISIBLE_SCREENS = ['games', 'insights'];

const state = {
  games: [],
  selectedGameId: null,
  chartMode: 'scatter',
  chartMetric: 'fgpct',
  insightsChartMode: 'scatter',
  insightsChartMetric: 'fgpct',
  insightGameIds: new Set()
};

const METRIC_MODES = ['zones', 'hex'];

function updateMetricHint(hintId, mode, metric) {
  const hint = el(hintId);
  const show = METRIC_MODES.includes(mode);
  hint.classList.toggle('hidden', !show);
  hint.textContent = show ? metricHintText(metric) : '';
}

installPressFeedback();

function showScreen(name) {
  screens.forEach((s) => el(`screen-${s}`)?.classList.toggle('hidden', s !== name));
  document.querySelector('.bottom-nav')?.classList.toggle('hidden', !NAV_VISIBLE_SCREENS.includes(name));
}

function setActiveNav(name) {
  document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.nav === name));
}

function getSelectedGame() {
  return state.games.find((g) => g.id === state.selectedGameId) || null;
}

const scopeId = new URLSearchParams(location.search).get('scope');

if (!scopeId) {
  showScreen('missing-link');
} else {
  subscribeToGames(
    scopeId,
    (games) => {
      state.games = games;
      onGamesUpdated();
    },
    (error) => console.error('Failed to load games', error)
  );
  showScreen('games');
}

function onGamesUpdated() {
  renderGameList(el('game-list'), state.games, state.selectedGameId, { canManage: false });
  if (!el('screen-summary').classList.contains('hidden')) renderSummaryScreen();
  if (!el('screen-insights').classList.contains('hidden')) renderInsightsScreen();
}

el('game-list').addEventListener('click', (event) => {
  const selectBtn = event.target.closest('[data-select-id]');
  if (!selectBtn) return;
  state.selectedGameId = selectBtn.dataset.selectId;
  showScreen('summary');
  setActiveNav('games');
  renderSummaryScreen();
});

document.querySelectorAll('[data-nav]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.nav;
    if (target === 'games') {
      showScreen('games');
      setActiveNav('games');
    } else if (target === 'insights') {
      showScreen('insights');
      setActiveNav('insights');
      renderInsightsScreen();
    }
  });
});

document.querySelectorAll('#screen-summary .chart-tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.chartMode = btn.dataset.chartMode;
    document.querySelectorAll('#screen-summary .chart-tabs .tab').forEach((b) => b.classList.toggle('active', b === btn));
    el('summary-legend').classList.toggle('hidden', state.chartMode !== 'scatter');
    el('summary-metric-toggle').classList.toggle('hidden', !METRIC_MODES.includes(state.chartMode));
    updateMetricHint('summary-metric-hint', state.chartMode, state.chartMetric);
    renderSummaryScreen();
  });
});

document.querySelectorAll('#summary-metric-toggle .metric-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.chartMetric = btn.dataset.metric;
    document.querySelectorAll('#summary-metric-toggle .metric-btn').forEach((b) => b.classList.toggle('active', b === btn));
    updateMetricHint('summary-metric-hint', state.chartMode, state.chartMetric);
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
    updateMetricHint('insights-metric-hint', state.insightsChartMode, state.insightsChartMetric);
    renderInsightsScreen();
  });
});

document.querySelectorAll('#insights-metric-toggle .metric-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.insightsChartMetric = btn.dataset.metric;
    document.querySelectorAll('#insights-metric-toggle .metric-btn').forEach((b) => b.classList.toggle('active', b === btn));
    updateMetricHint('insights-metric-hint', state.insightsChartMode, state.insightsChartMetric);
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
