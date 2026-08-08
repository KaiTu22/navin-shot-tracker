import { PLAYER_NAME, subscribeToGames, getShotSummary } from './data-store.js';
import { renderShotChart, renderZoneCards, renderTrend, renderStatGrid, renderGameList, formatDate } from './render.js';
import { installPressFeedback } from './ui-feedback.js';

const el = (id) => document.getElementById(id);
const screens = ['missing-link', 'games', 'summary', 'insights'];
const NAV_VISIBLE_SCREENS = ['games', 'insights'];

const state = {
  games: [],
  selectedGameId: null,
  chartMode: 'scatter'
};

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
  renderGameList(el('game-list'), state.games, state.selectedGameId, { canDelete: false });
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

document.querySelectorAll('.chart-tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.chartMode = btn.dataset.chartMode;
    document.querySelectorAll('.chart-tabs .tab').forEach((b) => b.classList.toggle('active', b === btn));
    el('summary-legend').classList.toggle('hidden', state.chartMode === 'zones');
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
  renderShotChart(el('summary-court'), game.events, state.chartMode);
  renderZoneCards(el('summary-zone-grid'), game.events);
}

function renderInsightsScreen() {
  renderZoneCards(el('insights-zone-grid'), state.games.flatMap((g) => g.events));
  renderTrend(el('insights-trend'), state.games, state.selectedGameId);
}
