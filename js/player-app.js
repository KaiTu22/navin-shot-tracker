import { PLAYER_NAME, subscribeToGames, getShotSummary } from './data-store.js';
import { renderShotChart, renderZoneCards, renderTrend, renderStatGrid, renderGameList, formatDate } from './render.js';
import { installPressFeedback } from './ui-feedback.js';

const el = (id) => document.getElementById(id);
const screens = ['missing-link', 'games', 'summary'];

const state = {
  games: [],
  selectedGameId: null,
  chartMode: 'scatter',
  insightView: 'all'
};

installPressFeedback();

function showScreen(name) {
  screens.forEach((s) => el(`screen-${s}`)?.classList.toggle('hidden', s !== name));
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
  renderGameList(el('game-list'), state.games, state.selectedGameId);
  if (!el('screen-summary').classList.contains('hidden')) renderSummaryScreen();
}

el('game-list').addEventListener('click', (event) => {
  const item = event.target.closest('[data-game-id]');
  if (!item) return;
  state.selectedGameId = item.dataset.gameId;
  state.insightView = 'all';
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
    } else if (target === 'insights' && state.games.length) {
      state.selectedGameId = state.selectedGameId || state.games[0].id;
      showScreen('summary');
      setActiveNav('insights');
      renderSummaryScreen();
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

document.querySelectorAll('#screen-summary .insight-toggle .filter-button').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.insightView = btn.dataset.view;
    document.querySelectorAll('#screen-summary .insight-toggle .filter-button').forEach((b) => b.classList.toggle('active', b === btn));
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

  const insightEvents = state.insightView === 'all' ? state.games.flatMap((g) => g.events) : game.events;
  renderZoneCards(el('summary-zone-grid'), insightEvents);

  const trendContainer = el('summary-trend');
  if (state.insightView === 'all') {
    trendContainer.classList.remove('hidden');
    renderTrend(trendContainer, state.games, state.selectedGameId);
  } else {
    trendContainer.classList.add('hidden');
  }
}
