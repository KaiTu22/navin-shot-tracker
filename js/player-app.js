import { PLAYER_NAME, subscribeToGames, getShotSummary, GAME_CATEGORIES } from './data-store.js';
import {
  renderShotChart,
  renderZoneCards,
  renderTrend,
  renderStatGrid,
  renderGameList,
  renderGameFilterChips,
  filterGames,
  chartHintText,
  formatDate
} from './render.js';
import { installPressFeedback } from './ui-feedback.js';
import { installZoneTooltip } from './zone-tooltip.js';

const el = (id) => document.getElementById(id);
const screens = ['missing-link', 'games', 'summary', 'insights'];
const NAV_VISIBLE_SCREENS = ['games', 'insights'];

const state = {
  games: [],
  selectedGameId: null,
  collapsedCategories: new Set([...GAME_CATEGORIES, 'Uncategorized']),
  chartMode: 'scatter',
  chartMetric: 'fgpct',
  chartBaseline: 'self',
  insightsChartMode: 'scatter',
  insightsChartMetric: 'fgpct',
  insightsChartBaseline: 'self',
  insightGameIds: new Set()
};

const METRIC_MODES = ['zones', 'hex', 'rings'];
const BASELINE_MODES = ['zones', 'hex', 'rings', 'heat'];

function updateChartControls(prefix, mode, metric, baselineMode) {
  const hint = el(`${prefix}-metric-hint`);
  const baselineToggle = el(`${prefix}-baseline-toggle`);
  const showHint = METRIC_MODES.includes(mode) || mode === 'heat';
  hint.classList.toggle('hidden', !showHint);
  hint.textContent = showHint ? chartHintText(mode, metric, baselineMode) : '';
  const showBaselineToggle = BASELINE_MODES.includes(mode) && (mode === 'heat' || metric === 'fgpct');
  baselineToggle.classList.toggle('hidden', !showBaselineToggle);
}

installPressFeedback();
installZoneTooltip(el('summary-court').closest('.panel'), el('summary-court'));
installZoneTooltip(el('insights-court').closest('.panel'), el('insights-court'));

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
  renderGameList(el('game-list'), state.games, state.selectedGameId, { canManage: false }, state.collapsedCategories);
  if (!el('screen-summary').classList.contains('hidden')) renderSummaryScreen();
  if (!el('screen-insights').classList.contains('hidden')) renderInsightsScreen();
}

el('game-list').addEventListener('click', (event) => {
  const categoryHeader = event.target.closest('[data-toggle-category]');
  if (categoryHeader) {
    const category = categoryHeader.dataset.toggleCategory;
    if (state.collapsedCategories.has(category)) state.collapsedCategories.delete(category);
    else state.collapsedCategories.add(category);
    renderGameList(el('game-list'), state.games, state.selectedGameId, { canManage: false }, state.collapsedCategories);
    return;
  }
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
    updateChartControls('summary', state.chartMode, state.chartMetric, state.chartBaseline);
    renderSummaryScreen();
  });
});

document.querySelectorAll('#summary-metric-toggle .metric-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.chartMetric = btn.dataset.metric;
    document.querySelectorAll('#summary-metric-toggle .metric-btn').forEach((b) => b.classList.toggle('active', b === btn));
    updateChartControls('summary', state.chartMode, state.chartMetric, state.chartBaseline);
    renderSummaryScreen();
  });
});

document.querySelectorAll('#summary-baseline-toggle .metric-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.chartBaseline = btn.dataset.baseline;
    document.querySelectorAll('#summary-baseline-toggle .metric-btn').forEach((b) => b.classList.toggle('active', b === btn));
    updateChartControls('summary', state.chartMode, state.chartMetric, state.chartBaseline);
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
  renderShotChart(el('summary-court'), game.events, state.chartMode, state.chartMetric, state.chartBaseline);
  renderZoneCards(el('summary-zone-grid'), game.events);
}

// --- Insights ---

document.querySelectorAll('#screen-insights .chart-tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.insightsChartMode = btn.dataset.chartMode;
    document.querySelectorAll('#screen-insights .chart-tabs .tab').forEach((b) => b.classList.toggle('active', b === btn));
    el('insights-legend').classList.toggle('hidden', state.insightsChartMode !== 'scatter');
    el('insights-metric-toggle').classList.toggle('hidden', !METRIC_MODES.includes(state.insightsChartMode));
    updateChartControls('insights', state.insightsChartMode, state.insightsChartMetric, state.insightsChartBaseline);
    renderInsightsScreen();
  });
});

document.querySelectorAll('#insights-metric-toggle .metric-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.insightsChartMetric = btn.dataset.metric;
    document.querySelectorAll('#insights-metric-toggle .metric-btn').forEach((b) => b.classList.toggle('active', b === btn));
    updateChartControls('insights', state.insightsChartMode, state.insightsChartMetric, state.insightsChartBaseline);
    renderInsightsScreen();
  });
});

document.querySelectorAll('#insights-baseline-toggle .metric-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.insightsChartBaseline = btn.dataset.baseline;
    document.querySelectorAll('#insights-baseline-toggle .metric-btn').forEach((b) => b.classList.toggle('active', b === btn));
    updateChartControls('insights', state.insightsChartMode, state.insightsChartMetric, state.insightsChartBaseline);
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
  renderShotChart(el('insights-court'), combinedEvents, state.insightsChartMode, state.insightsChartMetric, state.insightsChartBaseline);
  renderZoneCards(el('insights-zone-grid'), combinedEvents);
  renderTrend(el('insights-trend'), filteredGames, state.selectedGameId);
}
