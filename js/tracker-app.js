import {
  PLAYER_NAME,
  onAuthChange,
  signInTracker,
  signOutTracker,
  subscribeToGames,
  createGame,
  appendEvent,
  logShot,
  undoLastEvent,
  endPeriod,
  getShotSummary,
  getCountStats
} from './data-store.js';
import { classifyShot, pointFromEvent } from './court.js';
import { renderShotChart, renderZoneCards, renderTrend, renderStatGrid, renderGameList, formatDate } from './render.js';

const SCOPE_KEY = 'shot-tracker-scope-id';

const el = (id) => document.getElementById(id);
const screens = ['signin', 'games', 'new-game', 'live', 'summary'];

const state = {
  scopeId: null,
  games: [],
  selectedGameId: null,
  shotResult: 'make',
  periodMode: 'full',
  chartMode: 'scatter',
  insightView: 'all',
  unsubscribeGames: null
};

function showScreen(name) {
  screens.forEach((s) => el(`screen-${s}`).classList.toggle('hidden', s !== name));
  document.querySelector('.bottom-nav').classList.toggle('hidden', name === 'signin');
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
  renderGameList(el('game-list'), state.games, state.selectedGameId);
  if (!el('screen-live').classList.contains('hidden')) renderLiveScreen();
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
    } else if (target === 'live') {
      showScreen('live');
      setActiveNav('games');
      renderLiveScreen();
    } else if (target === 'insights') {
      if (state.games.length) {
        state.selectedGameId = state.selectedGameId || state.games[0].id;
        showScreen('summary');
        setActiveNav('insights');
        renderSummaryScreen();
      }
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
  state.shotResult = 'make';
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
}

document.querySelectorAll('#shot-result-group .segment').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.shotResult = btn.dataset.result;
    document.querySelectorAll('#shot-result-group .segment').forEach((b) => b.classList.toggle('active', b === btn));
  });
});

el('live-court').addEventListener('click', (event) => {
  const game = getSelectedGame();
  if (!game) return;
  const svg = el('live-court');
  const { x, y } = pointFromEvent(svg, event);
  const shotType = classifyShot(x, y);
  logShot(state.scopeId, game.id, { x, y, shotType, result: state.shotResult }, game.currentPeriod);
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

el('end-period-btn').addEventListener('click', () => {
  const game = getSelectedGame();
  if (!game) return;
  if (game.periodMode === 'full') {
    showScreen('summary');
    setActiveNav('games');
    renderSummaryScreen();
    return;
  }
  endPeriod(state.scopeId, game.id, game.currentPeriod + 1);
});

el('done-btn').addEventListener('click', () => {
  showScreen('summary');
  setActiveNav('games');
  renderSummaryScreen();
});

// --- Summary ---

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
