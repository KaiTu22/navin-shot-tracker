// Shared render helpers used by both the tracker app and the read-only player app,
// so the two views never drift out of sync on how a stat is computed or displayed.
import { getShotSummary, getCountStats, getZoneStats, GAME_CATEGORIES } from './data-store.js';
import {
  drawCourt,
  drawShots,
  drawZoneOverlay,
  removeZoneOverlay,
  drawHexbin,
  drawHeatmap,
  drawRingOverlay,
  zoneBaselineMap,
  smoothedBenchmarkAt,
  ZONES
} from './court.js';

// baselineMode: 'self' (default) compares against his own average; 'benchmark' compares
// against typical HS shooting percentages by shot difficulty instead.
export function chartHintText(mode, metric, baselineMode = 'self') {
  if (mode === 'heat') {
    return baselineMode === 'benchmark'
      ? 'Green = shooting above a typical HS player’s average from there, red = below.'
      : 'Green = shooting above his own average from there, red = below.';
  }
  if (metric === 'attempts') {
    return 'Brighter = shot from there more often, relative to his most-used spot.';
  }
  return baselineMode === 'benchmark'
    ? 'Green = shooting above a typical HS player’s average from there, red = below. Gray = too few shots yet to tell.'
    : 'Green = shooting above his own average from there, red = below. Gray = too few shots yet to tell.';
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

export function formatDate(dateStr) {
  if (!dateStr) return 'No date';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function renderStatGrid(container, events) {
  const summary = getShotSummary(events);
  const counts = getCountStats(events);
  container.innerHTML = `
    <div class="cell"><span class="value">${counts.totalRebounds}</span><span class="label">Reb</span></div>
    <div class="cell"><span class="value">${counts.assists}</span><span class="label">Ast</span></div>
    <div class="cell"><span class="value">${counts.steals}</span><span class="label">Stl</span></div>
    <div class="cell"><span class="value">${counts.blocks}</span><span class="label">Blk</span></div>
    <div class="cell"><span class="value">${summary.overallMakes}/${summary.overallAttempts}</span><span class="label">FG</span></div>
    <div class="cell"><span class="value">${summary.twoMakes}/${summary.twoAttempts}</span><span class="label">2PT</span></div>
    <div class="cell"><span class="value">${summary.threeMakes}/${summary.threeAttempts}</span><span class="label">3PT</span></div>
    <div class="cell"><span class="value">${summary.freeMakes}/${summary.freeAttempts}</span><span class="label">FT</span></div>
    <div class="cell"><span class="value">${formatPercent(summary.overallPct)}</span><span class="label">FG%</span></div>
    <div class="cell"><span class="value">${formatPercent(summary.twoPct)}</span><span class="label">2PT%</span></div>
    <div class="cell"><span class="value">${formatPercent(summary.threePct)}</span><span class="label">3PT%</span></div>
    <div class="cell"><span class="value">${formatPercent(summary.freePct)}</span><span class="label">FT%</span></div>
    <div class="cell"><span class="value">${counts.offensiveRebounds}</span><span class="label">Off Reb</span></div>
    <div class="cell"><span class="value">${counts.defensiveRebounds}</span><span class="label">Def Reb</span></div>
    <div class="cell"><span class="value">${counts.turnovers}</span><span class="label">TOV</span></div>
    <div class="cell"><span class="value">${counts.fouls}</span><span class="label">Fouls</span></div>
  `;
  return { summary, counts };
}

export function renderShotChart(svgEl, events, mode, metric = 'fgpct', baselineMode = 'self') {
  drawCourt(svgEl);
  if (mode === 'zones') {
    const baselines = zoneBaselineMap(baselineMode, getShotSummary(events));
    drawZoneOverlay(svgEl, getZoneStats(events), metric, baselines, baselineMode);
  } else if (mode === 'hex') {
    const baselines = zoneBaselineMap(baselineMode, getShotSummary(events));
    drawHexbin(svgEl, events.filter((e) => e.type === 'shot'), metric, baselines);
  } else if (mode === 'rings') {
    const baselines = zoneBaselineMap(baselineMode, getShotSummary(events));
    drawRingOverlay(svgEl, events.filter((e) => e.type === 'shot'), metric, baselines, baselineMode);
  } else if (mode === 'heat') {
    const { overallPct } = getShotSummary(events);
    const baseline = baselineMode === 'benchmark' ? smoothedBenchmarkAt : overallPct;
    drawHeatmap(svgEl, events.filter((e) => e.type === 'shot'), baseline);
  } else {
    drawShots(svgEl, events.filter((e) => e.type === 'shot'));
  }
}

export function renderZoneCards(container, events) {
  const zoneStats = getZoneStats(events);
  const cards = ZONES
    .map((zone) => {
      const stat = zoneStats.get(zone);
      const attempts = stat ? stat.attempts : 0;
      const makes = stat ? stat.makes : 0;
      return { zone, attempts, makes, rate: attempts ? makes / attempts : 0 };
    })
    .filter((z) => z.attempts > 0)
    .sort((a, b) => b.attempts - a.attempts);

  if (!cards.length) {
    container.innerHTML = '<div class="empty-state">No shots logged yet for this view.</div>';
    return;
  }

  container.innerHTML = cards
    .map(
      (z) => `
      <div class="zone-card">
        <div class="zone-name">${z.zone}</div>
        <div class="zone-value">${formatPercent(z.rate)}</div>
        <div class="zone-meta">${z.makes}/${z.attempts}</div>
      </div>
    `
    )
    .join('');
}

export function renderTrend(container, games, selectedGameId) {
  const sorted = [...games].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  if (!sorted.length) {
    container.innerHTML = '<div class="empty-state">No games yet.</div>';
    return;
  }

  let best = null;
  const rows = sorted.map((game) => {
    const summary = getShotSummary(game.events || []);
    if (summary.overallAttempts > 0 && (!best || summary.overallPct > best.pct)) {
      best = { name: game.name, pct: summary.overallPct };
    }
    const active = game.id === selectedGameId ? 'active' : '';
    return `
      <div class="trend-row ${active}">
        <div class="trend-row-header"><span>${game.name}</span><span>${formatPercent(summary.overallPct)}</span></div>
        <div class="bar-row">
          <span>FG%</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, summary.overallPct * 100)}%"></div></div>
          <span>${formatPercent(summary.overallPct)}</span>
        </div>
        <div class="bar-row">
          <span>3PT%</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, summary.threePct * 100)}%"></div></div>
          <span>${formatPercent(summary.threePct)}</span>
        </div>
      </div>
    `;
  });

  const bestLine = best
    ? `<div class="field-hint">Best shooting game: ${best.name} (${formatPercent(best.pct)})</div>`
    : '';
  container.innerHTML = rows.join('') + bestLine;
}

function gameItemMarkup(game, selectedGameId, canManage) {
  const active = game.id === selectedGameId ? 'active' : '';
  const shotCount = (game.events || []).filter((e) => e.type === 'shot' || e.type === 'freeThrow').length;
  const statusBadge = game.status === 'live' ? '<span class="game-item__badge">Live</span>' : '';
  const resumeBtn =
    canManage && game.status !== 'live'
      ? `<button type="button" class="game-item__resume" data-resume-id="${game.id}">Resume</button>`
      : '';
  const editBtn = canManage
    ? `<button type="button" class="game-item__edit" data-edit-id="${game.id}" aria-label="Edit ${game.name}">Edit</button>`
    : '';
  const deleteBtn = canManage
    ? `<button type="button" class="game-item__delete" data-delete-id="${game.id}" aria-label="Delete ${game.name}">Delete</button>`
    : '';
  return `
    <div class="game-item ${active}">
      <button type="button" class="game-item__main" data-select-id="${game.id}">
        <span class="game-item__title">${game.name}</span>
        <span class="game-item__meta">${game.opponent ? `vs ${game.opponent} • ` : ''}${formatDate(game.date)}</span>
      </button>
      <span class="game-item__side">
        ${statusBadge}
        <span class="game-item__chip">${shotCount}</span>
        ${resumeBtn}
        ${editBtn}
        ${deleteBtn}
      </span>
    </div>
  `;
}

// Groups games into the fixed GAME_CATEGORIES buckets (plus "Uncategorized" for
// older/migrated games with no category), each collapsible independently so a season's
// worth of games doesn't read as one long flat list. collapsedCategories: Set of bucket
// names currently collapsed (persisted in the caller's state, not here).
export function renderGameList(container, games, selectedGameId, { canManage = false } = {}, collapsedCategories = new Set()) {
  if (!games.length) {
    container.innerHTML = '<div class="empty-state">No games yet.</div>';
    return;
  }

  const buckets = new Map(GAME_CATEGORIES.map((category) => [category, []]));
  const uncategorized = [];
  games.forEach((game) => {
    if (game.category && buckets.has(game.category)) buckets.get(game.category).push(game);
    else uncategorized.push(game);
  });

  const sections = [...GAME_CATEGORIES];
  if (uncategorized.length) {
    buckets.set('Uncategorized', uncategorized);
    sections.push('Uncategorized');
  }

  container.innerHTML = sections
    .map((category) => {
      const categoryGames = buckets.get(category) || [];
      const collapsed = collapsedCategories.has(category);
      const body = categoryGames.length
        ? categoryGames.map((game) => gameItemMarkup(game, selectedGameId, canManage)).join('')
        : '<div class="empty-state empty-state--small">No games in this category yet.</div>';
      return `
        <div class="game-category">
          <button type="button" class="game-category__header" data-toggle-category="${category}">
            <span class="game-category__name">${category}</span>
            <span class="game-category__count">${categoryGames.length}</span>
            <span class="game-category__chevron ${collapsed ? 'collapsed' : ''}">&#9662;</span>
          </button>
          <div class="game-category__body ${collapsed ? 'hidden' : ''}">${body}</div>
        </div>
      `;
    })
    .join('');
}

// selectedIds: null/empty Set means "All Games". Otherwise a Set of chosen game ids
// (single or multiple selection both render the same way — chips just toggle membership).
export function renderGameFilterChips(container, games, selectedIds) {
  if (!games.length) {
    container.innerHTML = '<div class="empty-state">No games yet.</div>';
    return;
  }
  const allActive = !selectedIds || selectedIds.size === 0;
  const chips = [`<button type="button" class="filter-chip ${allActive ? 'active' : ''}" data-filter-game="all">All Games</button>`];
  games.forEach((game) => {
    const active = !allActive && selectedIds.has(game.id);
    chips.push(`<button type="button" class="filter-chip ${active ? 'active' : ''}" data-filter-game="${game.id}">${game.name}</button>`);
  });
  container.innerHTML = chips.join('');
}

export function filterGames(games, selectedIds) {
  if (!selectedIds || selectedIds.size === 0) return games;
  return games.filter((g) => selectedIds.has(g.id));
}
