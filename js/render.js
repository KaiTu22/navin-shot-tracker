// Shared render helpers used by both the tracker app and the read-only player app,
// so the two views never drift out of sync on how a stat is computed or displayed.
import { getShotSummary, getCountStats, getZoneStats } from './data-store.js';
import { drawCourt, drawShots, drawZoneOverlay, removeZoneOverlay, ZONES } from './court.js';

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

export function renderShotChart(svgEl, events, mode) {
  drawCourt(svgEl);
  removeZoneOverlay(svgEl);
  if (mode === 'zones') {
    drawZoneOverlay(svgEl, getZoneStats(events));
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

export function renderGameList(container, games, selectedGameId, { canDelete = false } = {}) {
  if (!games.length) {
    container.innerHTML = '<div class="empty-state">No games yet.</div>';
    return;
  }
  container.innerHTML = games
    .map((game) => {
      const active = game.id === selectedGameId ? 'active' : '';
      const shotCount = (game.events || []).filter((e) => e.type === 'shot' || e.type === 'freeThrow').length;
      const statusBadge = game.status === 'live' ? '<span class="game-item__badge">Live</span>' : '';
      const deleteBtn = canDelete
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
            ${deleteBtn}
          </span>
        </div>
      `;
    })
    .join('');
}
