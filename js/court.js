// To-scale high-school half-court geometry (NFHS dimensions, units = feet) and
// zone/shot-type classification. Single source of truth for hoop position so
// shot classification always matches the drawn art.
//
// NFHS (high school) differs from NBA/NCAA: 12ft lane (not 16ft) and a 19'9"
// 3PT radius (not 22-23'9"). The 3PT line is a "stadium" shape, not a pure
// circle: it follows the 19'9" arc down to the height of the rim center, then
// continues straight (tangent to the arc, no kink) to the baseline from there
// — so below rim height the boundary is a constant-x vertical line, and above
// it, it's the true arc.

export const HOOP = { x: 25, y: 5.25 };
export const LANE_HALF_WIDTH = 6; // NFHS lane is 12ft wide
export const FREE_THROW_LINE_Y = 19;
export const FREE_THROW_CIRCLE_RADIUS = 6;
export const THREE_POINT_RADIUS = 19.75; // 19'9"
export const COURT_WIDTH = 50; // NFHS half-court baseline width
export const COURT_HEIGHT = 42; // NFHS half-court sideline length, baseline to mid-court line
const PAD_X = 3;
const PAD_Y = 2;
export const VIEW_BOX = `${-PAD_X} ${-PAD_Y} ${COURT_WIDTH + 2 * PAD_X} ${COURT_HEIGHT + 2 * PAD_Y}`;

const LANE_LEFT = HOOP.x - LANE_HALF_WIDTH;
const LANE_RIGHT = HOOP.x + LANE_HALF_WIDTH;

// Zone *grouping* (below) is independent of shot-type classification (above) - these
// insight buckets use the same feet-from-baseline/feet-from-rim conventions common
// shot-chart tools use, not the exact HS 3PT line geometry.
const RIM_RADIUS = 4.5; // "At the Rim"
const CORNER_CUTOFF_Y = 14; // corner 3 vs above-the-break 3

// The Zones tab shades rectangular regions for readability, not the literal 2PT/3PT
// boundary — capping their height keeps "Above Break 3" from stretching all the way
// up to mid-court just because the tappable court now goes that far.
const ZONE_DISPLAY_MAX_Y = Math.min(COURT_HEIGHT, HOOP.y + THREE_POINT_RADIUS + 6);

export const ZONES = [
  'Midrange 2s',
  'Corner 3 (Left)',
  'Corner 3 (Right)',
  'Above Break 3 (Left Wing)',
  'Above Break 3 (Center)',
  'Above Break 3 (Right Wing)',
  'In The Paint',
  'At The Rim'
];

export const ZONE_DESCRIPTIONS = {
  'At The Rim': `Within ${RIM_RADIUS} feet of the rim`,
  'In The Paint': 'Shots taken in the paint (non-rim)',
  'Midrange 2s': 'All 2s outside the paint',
  'Corner 3 (Left)': `Within ${CORNER_CUTOFF_Y} feet of the baseline`,
  'Corner 3 (Right)': `Within ${CORNER_CUTOFF_Y} feet of the baseline`,
  'Above Break 3 (Left Wing)': `Greater than ${CORNER_CUTOFF_Y} feet from the baseline`,
  'Above Break 3 (Center)': `Greater than ${CORNER_CUTOFF_Y} feet from the baseline`,
  'Above Break 3 (Right Wing)': `Greater than ${CORNER_CUTOFF_Y} feet from the baseline`
};

const THREE_PT_ZONES = new Set([
  'Corner 3 (Left)',
  'Corner 3 (Right)',
  'Above Break 3 (Left Wing)',
  'Above Break 3 (Center)',
  'Above Break 3 (Right Wing)'
]);
export function zoneShotType(zone) {
  return THREE_PT_ZONES.has(zone) ? '3PT' : '2PT';
}

function distanceFromHoop(x, y) {
  return Math.hypot(x - HOOP.x, y - HOOP.y);
}

export function classifyShot(x, y) {
  if (y <= HOOP.y) {
    return Math.abs(x - HOOP.x) >= THREE_POINT_RADIUS ? '3PT' : '2PT';
  }
  return distanceFromHoop(x, y) >= THREE_POINT_RADIUS ? '3PT' : '2PT';
}

export function zoneForPoint(x, y) {
  const type = classifyShot(x, y);
  if (type === '3PT') {
    if (y <= CORNER_CUTOFF_Y) return x < HOOP.x ? 'Corner 3 (Left)' : 'Corner 3 (Right)';
    if (x < HOOP.x - 5) return 'Above Break 3 (Left Wing)';
    if (x > HOOP.x + 5) return 'Above Break 3 (Right Wing)';
    return 'Above Break 3 (Center)';
  }
  if (distanceFromHoop(x, y) <= RIM_RADIUS) return 'At The Rim';
  if (x >= LANE_LEFT && x <= LANE_RIGHT && y <= FREE_THROW_LINE_Y) return 'In The Paint';
  return 'Midrange 2s';
}

// Maps a client (mouse/touch) event on the court SVG to court-space (feet) coordinates,
// correctly accounting for viewBox letterboxing via the SVG's own screen transform.
export function pointFromEvent(svg, evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: HOOP.x, y: HOOP.y };
  const transformed = pt.matrixTransform(ctm.inverse());
  return {
    x: Math.min(COURT_WIDTH, Math.max(0, transformed.x)),
    y: Math.min(COURT_HEIGHT, Math.max(0, transformed.y))
  };
}

// Samples points around a circle centered at (cx,cy). Angle 0 points straight
// into the court (away from the baseline); positive angles sweep toward +x.
// Building the arc this way (rather than an SVG arc-to command) sidesteps
// large-arc/sweep-flag guesswork entirely.
function arcPathPoints(cx, cy, radius, fromAngle, toAngle, steps) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const angle = fromAngle + ((toAngle - fromAngle) * i) / steps;
    points.push({ x: cx + radius * Math.sin(angle), y: cy + radius * Math.cos(angle) });
  }
  return points;
}

function pathFromPoints(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
}

function threePointPath() {
  // Straight segment down to the baseline, then the true arc (tangent at the
  // seam, level with the rim), then straight back down on the other side.
  // (This is the real court line's tangent point - always HOOP.y, independent of
  // the zone-grouping CORNER_CUTOFF_Y used only for shading buckets below.)
  const arcPoints = arcPathPoints(HOOP.x, HOOP.y, THREE_POINT_RADIUS, -Math.PI / 2, Math.PI / 2, 48);
  const points = [{ x: HOOP.x - THREE_POINT_RADIUS, y: 0 }, ...arcPoints, { x: HOOP.x + THREE_POINT_RADIUS, y: 0 }];
  return pathFromPoints(points);
}

function rimArcPath() {
  const points = arcPathPoints(HOOP.x, HOOP.y, RIM_RADIUS, -Math.PI / 2, Math.PI / 2, 24);
  return pathFromPoints(points);
}

// Half of the center-court restraining circle, bulging back toward the baseline
// from the mid-court line - the standard way a half-court diagram closes off its far edge.
function centerCirclePath() {
  const points = arcPathPoints(HOOP.x, COURT_HEIGHT, FREE_THROW_CIRCLE_RADIUS, Math.PI / 2, (3 * Math.PI) / 2, 32);
  return pathFromPoints(points);
}

export function drawCourt(svg) {
  svg.setAttribute('viewBox', VIEW_BOX);
  svg.innerHTML = `
    <defs>
      <filter id="heat-blur" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1" />
      </filter>
    </defs>

    <rect x="${-PAD_X}" y="${-PAD_Y}" width="${COURT_WIDTH + 2 * PAD_X}" height="${COURT_HEIGHT + 2 * PAD_Y}" fill="#d7c79e" />

    <path d="M 0 0 L ${COURT_WIDTH} 0" stroke="#f5f5f5" stroke-width="0.3" />
    <path d="M 0 0 L 0 ${COURT_HEIGHT}" stroke="#f5f5f5" stroke-width="0.3" />
    <path d="M ${COURT_WIDTH} 0 L ${COURT_WIDTH} ${COURT_HEIGHT}" stroke="#f5f5f5" stroke-width="0.3" />
    <path d="M 0 ${COURT_HEIGHT} L ${COURT_WIDTH} ${COURT_HEIGHT}" stroke="#f5f5f5" stroke-width="0.3" />
    <path d="${centerCirclePath()}" fill="none" stroke="#f5f5f5" stroke-width="0.25" />

    <rect x="${LANE_LEFT}" y="0" width="${LANE_HALF_WIDTH * 2}" height="${FREE_THROW_LINE_Y}" fill="none" stroke="#f5f5f5" stroke-width="0.3" />
    <path d="M ${LANE_LEFT} ${FREE_THROW_LINE_Y} L ${LANE_RIGHT} ${FREE_THROW_LINE_Y}" stroke="#f5f5f5" stroke-width="0.3" />
    <circle cx="${HOOP.x}" cy="${FREE_THROW_LINE_Y}" r="${FREE_THROW_CIRCLE_RADIUS}" fill="none" stroke="#f5f5f5" stroke-width="0.25" stroke-dasharray="1 1" />

    <path d="M ${HOOP.x - 3} 4 L ${HOOP.x + 3} 4" stroke="#f5f5f5" stroke-width="0.4" />
    <circle cx="${HOOP.x}" cy="${HOOP.y}" r="0.75" fill="none" stroke="#ff7a1a" stroke-width="0.3" />
    <path d="${rimArcPath()}" fill="none" stroke="#f5f5f5" stroke-width="0.25" stroke-dasharray="0.6 0.6" />

    <path d="${threePointPath()}" fill="none" stroke="#f5f5f5" stroke-width="0.3" />
  `;
}

// pct is 0-1 or null (no attempts). Dark-surface sequential ramp: low value recedes
// toward the surface, high value brightens to stand out (inverse of the light-mode convention).
const HEAT_STEPS = ['#0d366b', '#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5'];
export function heatColorForRate(pct) {
  if (pct === null || pct === undefined) return 'rgba(255,255,255,0.04)';
  const idx = Math.min(HEAT_STEPS.length - 1, Math.floor(pct * HEAT_STEPS.length));
  return HEAT_STEPS[idx];
}

// A spot's raw FG% doesn't account for shot difficulty (35% from three is great,
// 35% at the rim isn't) - relativeColor instead compares a zone/hex's make% to the
// player's OWN baseline for that shot type (his overall 2PT% or 3PT%, from the same
// dataset being viewed), the same "vs. average" technique real shot-chart tools use.
// Red = shooting above his own average from there ("hot"), blue = below ("cold") -
// two shades per side by lightness (not a red<->green hue crossing) for CVD safety.
export const MIN_ATTEMPTS_FOR_COLOR = 2; // fewer attempts than this = not enough data to color meaningfully
const NO_DATA_COLOR = 'rgba(255,255,255,0.04)';
const NEUTRAL_COLOR = '#383835';
const RED_MILD = '#e66767';
const RED_STRONG = '#d03b3b';
const BLUE_MILD = '#5598e7';
const BLUE_STRONG = '#184f95';

export function relativeColorForDelta(delta) {
  if (delta === null || delta === undefined) return NO_DATA_COLOR;
  const magnitude = Math.abs(delta);
  if (magnitude < 0.08) return NEUTRAL_COLOR;
  if (delta > 0) return magnitude >= 0.18 ? RED_STRONG : RED_MILD;
  return magnitude >= 0.18 ? BLUE_STRONG : BLUE_MILD;
}

// Shapes are approximate rectangles for shading, not the true arc boundary (as
// elsewhere in this file). Draw order in ZONES matters here: "In The Paint" and
// "At The Rim" are drawn last so they always render correctly on top regardless of
// what the wider Midrange/Corner/Above-Break rectangles beneath them cover.
function zonePath(zone) {
  switch (zone) {
    case 'Midrange 2s':
      return `M 0 0 L ${COURT_WIDTH} 0 L ${COURT_WIDTH} ${ZONE_DISPLAY_MAX_Y} L 0 ${ZONE_DISPLAY_MAX_Y} Z`;
    case 'Corner 3 (Left)':
      return `M 0 0 L ${HOOP.x} 0 L ${HOOP.x} ${CORNER_CUTOFF_Y} L 0 ${CORNER_CUTOFF_Y} Z`;
    case 'Corner 3 (Right)':
      return `M ${HOOP.x} 0 L ${COURT_WIDTH} 0 L ${COURT_WIDTH} ${CORNER_CUTOFF_Y} L ${HOOP.x} ${CORNER_CUTOFF_Y} Z`;
    case 'Above Break 3 (Left Wing)':
      return `M 0 ${CORNER_CUTOFF_Y} L ${HOOP.x - 5} ${CORNER_CUTOFF_Y} L ${HOOP.x - 5} ${ZONE_DISPLAY_MAX_Y} L 0 ${ZONE_DISPLAY_MAX_Y} Z`;
    case 'Above Break 3 (Right Wing)':
      return `M ${HOOP.x + 5} ${CORNER_CUTOFF_Y} L ${COURT_WIDTH} ${CORNER_CUTOFF_Y} L ${COURT_WIDTH} ${ZONE_DISPLAY_MAX_Y} L ${HOOP.x + 5} ${ZONE_DISPLAY_MAX_Y} Z`;
    case 'Above Break 3 (Center)':
      return `M ${HOOP.x - 5} ${CORNER_CUTOFF_Y} L ${HOOP.x + 5} ${CORNER_CUTOFF_Y} L ${HOOP.x + 5} ${ZONE_DISPLAY_MAX_Y} L ${HOOP.x - 5} ${ZONE_DISPLAY_MAX_Y} Z`;
    case 'In The Paint':
      return `M ${LANE_LEFT} 0 L ${LANE_RIGHT} 0 L ${LANE_RIGHT} ${FREE_THROW_LINE_Y} L ${LANE_LEFT} ${FREE_THROW_LINE_Y} Z`;
    case 'At The Rim':
      return `M ${HOOP.x - RIM_RADIUS} ${HOOP.y} A ${RIM_RADIUS} ${RIM_RADIUS} 0 0 0 ${HOOP.x + RIM_RADIUS} ${HOOP.y} L ${HOOP.x + RIM_RADIUS} 0 L ${HOOP.x - RIM_RADIUS} 0 Z`;
    default:
      return '';
  }
}

function zoneLabelPosition(zone) {
  const midY = (CORNER_CUTOFF_Y + ZONE_DISPLAY_MAX_Y) / 2;
  switch (zone) {
    case 'At The Rim':
      return { x: HOOP.x, y: HOOP.y + 1.6 };
    case 'In The Paint':
      return { x: HOOP.x, y: (HOOP.y + RIM_RADIUS + FREE_THROW_LINE_Y) / 2 + 1 };
    case 'Midrange 2s':
      return { x: HOOP.x - LANE_HALF_WIDTH - 6, y: 9 };
    case 'Corner 3 (Left)':
      return { x: HOOP.x / 2, y: CORNER_CUTOFF_Y / 2 };
    case 'Corner 3 (Right)':
      return { x: (HOOP.x + COURT_WIDTH) / 2, y: CORNER_CUTOFF_Y / 2 };
    case 'Above Break 3 (Left Wing)':
      return { x: (HOOP.x - 5) / 2, y: midY };
    case 'Above Break 3 (Right Wing)':
      return { x: (HOOP.x + 5 + COURT_WIDTH) / 2, y: midY };
    case 'Above Break 3 (Center)':
      return { x: HOOP.x, y: midY };
    default:
      return { x: HOOP.x, y: HOOP.y };
  }
}

function buildZoneTooltip(zone, stat, metric, baselines) {
  const description = ZONE_DESCRIPTIONS[zone] || '';
  if (!stat || !stat.attempts) {
    return `${zone}\n${description}\n\nNo attempts logged yet.`;
  }
  const rate = stat.makes / stat.attempts;
  if (metric === 'attempts') {
    return `${zone}\n${description}\n\n${stat.attempts} attempt${stat.attempts === 1 ? '' : 's'} (${stat.makes} made, ${Math.round(rate * 100)}%).`;
  }
  const shotType = zoneShotType(zone);
  const baseline = (shotType === '3PT' ? baselines.threePct : baselines.twoPct) ?? 0;
  const deltaPct = Math.round((rate - baseline) * 100);
  const sign = deltaPct >= 0 ? 'above' : 'below';
  return (
    `${zone}\n${description}\n\n` +
    `His FG% here is ${Math.round(rate * 100)}% (${stat.makes}/${stat.attempts}).\n` +
    `His ${shotType} baseline is ${Math.round(baseline * 100)}%.\n` +
    `That's ${Math.abs(deltaPct)}% ${sign} his average.`
  );
}

// zoneStats: Map<zoneLabel, {attempts, makes}>
// metric 'fgpct' colors by make% per zone (default); 'attempts' colors by relative
// shot volume instead, so you can see where he shoots from most vs. where he's best.
// baselines: { twoPct, threePct } - his own overall make% by shot type, from the
// same dataset being charted. Only used in 'fgpct' metric mode.
export function drawZoneOverlay(svg, zoneStats, metric = 'fgpct', baselines = {}) {
  const maxAttempts = Math.max(0, ...[...zoneStats.values()].map((s) => s.attempts));
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('id', 'zone-overlay');
  ZONES.forEach((zone) => {
    const stat = zoneStats.get(zone);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', zonePath(zone));

    let hasColor = true;
    if (metric === 'attempts') {
      const value = stat && maxAttempts ? stat.attempts / maxAttempts : null;
      path.setAttribute('fill', heatColorForRate(value));
      path.setAttribute('fill-opacity', value === null ? '1' : '0.82');
      hasColor = value !== null;
    } else if (!stat || stat.attempts < MIN_ATTEMPTS_FOR_COLOR) {
      path.setAttribute('fill', NO_DATA_COLOR);
      path.setAttribute('fill-opacity', '1');
      hasColor = false;
    } else {
      const baseline = zoneShotType(zone) === '3PT' ? baselines.threePct : baselines.twoPct;
      const delta = stat.makes / stat.attempts - (baseline ?? 0);
      path.setAttribute('fill', relativeColorForDelta(delta));
      path.setAttribute('fill-opacity', '0.82');
    }
    path.setAttribute('stroke', 'rgba(255,255,255,0.35)');
    path.setAttribute('stroke-width', '0.15');
    path.dataset.zone = zone;
    path.dataset.tooltip = buildZoneTooltip(zone, stat, metric, baselines);
    group.appendChild(path);

    const pos = zoneLabelPosition(zone);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', pos.x);
    label.setAttribute('y', pos.y);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('font-size', '2.4');
    label.setAttribute('font-weight', '800');
    label.setAttribute('fill', hasColor ? '#ffffff' : 'rgba(255,255,255,0.55)');
    label.setAttribute('paint-order', 'stroke');
    label.setAttribute('stroke', 'rgba(0,0,0,0.55)');
    label.setAttribute('stroke-width', '0.4');
    label.style.pointerEvents = 'none';
    label.textContent = stat && stat.attempts ? `${Math.round((stat.makes / stat.attempts) * 100)}%` : '—';
    group.appendChild(label);
  });
  svg.appendChild(group);
}

export function removeZoneOverlay(svg) {
  const existing = svg.querySelector('#zone-overlay');
  if (existing) existing.remove();
}

// Shots are colorblind-safe by shape, not just color: makes are filled dots, misses are rings.
export function drawShots(svg, shots) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('id', 'shot-marks');
  shots.forEach((shot) => {
    if (shot.type === 'freeThrow' || shot.x === undefined || shot.y === undefined) return;
    const isMake = shot.result === 'make';
    const mark = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    mark.setAttribute('cx', shot.x);
    mark.setAttribute('cy', shot.y);
    mark.setAttribute('r', '0.85');
    mark.setAttribute('fill', isMake ? '#0ca30c' : 'none');
    mark.setAttribute('stroke', isMake ? '#ffffff' : '#d03b3b');
    mark.setAttribute('stroke-width', isMake ? '0.12' : '0.3');
    group.appendChild(mark);
  });
  svg.appendChild(group);
}

// The not-yet-confirmed tap location in the two-step (tap, then Make/Miss) shot flow.
export function drawPendingMarker(svg, x, y) {
  removePendingMarker(svg);
  const mark = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  mark.setAttribute('id', 'pending-shot-marker');
  mark.setAttribute('cx', x);
  mark.setAttribute('cy', y);
  mark.setAttribute('r', '1.3');
  mark.setAttribute('fill', 'rgba(47,140,255,0.35)');
  mark.setAttribute('stroke', '#2f8cff');
  mark.setAttribute('stroke-width', '0.25');
  mark.setAttribute('class', 'pending-shot-pulse');
  svg.appendChild(mark);
}

export function removePendingMarker(svg) {
  const existing = svg.querySelector('#pending-shot-marker');
  if (existing) existing.remove();
}

// --- Hexbin chart: hexagon size = attempt volume, color = make% (same sequential ramp as Zones) ---

const HEX_SIZE = 2.2; // feet, center-to-corner
const SVG_NS = 'http://www.w3.org/2000/svg';

// Flat-top axial hex grid (center-to-corner = HEX_SIZE). Standard pixel<->axial
// conversion with cube-coordinate rounding so every shot lands in exactly one cell.
function pixelToHex(x, y, size) {
  const q = ((2 / 3) * x) / size;
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / size;
  return roundToHex(q, r);
}

function roundToHex(q, r) {
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);
  if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
  else if (yDiff > zDiff) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

function hexToPixel(q, r, size) {
  return { x: size * 1.5 * q, y: size * Math.sqrt(3) * (r + q / 2) };
}

function hexCorners(cx, cy, size) {
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    corners.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return corners;
}

// shots: array of { x, y, result } for made/missed field goal attempts only (no free throws).
// metric 'fgpct' colors each hex by its own make% (default); 'attempts' colors by
// relative volume instead — hex size always tracks volume either way.
// baselines: { twoPct, threePct } - see drawZoneOverlay. A bin's baseline is picked
// by whichever shot type is more common in that bin (bins rarely straddle the 3PT
// line given how small they are relative to the arc).
export function drawHexbin(svg, shots, metric = 'fgpct', baselines = {}) {
  const bins = new Map();
  shots.forEach((shot) => {
    if (shot.x === undefined || shot.y === undefined) return;
    const { q, r } = pixelToHex(shot.x, shot.y, HEX_SIZE);
    const key = `${q},${r}`;
    const bin = bins.get(key) || { q, r, attempts: 0, makes: 0, attempts2: 0, attempts3: 0 };
    bin.attempts += 1;
    if (shot.result === 'make') bin.makes += 1;
    if (shot.shotType === '3PT') bin.attempts3 += 1;
    else bin.attempts2 += 1;
    bins.set(key, bin);
  });

  if (!bins.size) return;
  const maxAttempts = Math.max(...[...bins.values()].map((b) => b.attempts));

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('id', 'hexbin');
  bins.forEach((bin) => {
    const center = hexToPixel(bin.q, bin.r, HEX_SIZE);
    if (center.x < -HEX_SIZE || center.x > COURT_WIDTH + HEX_SIZE || center.y < -HEX_SIZE || center.y > COURT_HEIGHT + HEX_SIZE) return;
    const sizeScale = Math.max(0.35, Math.sqrt(bin.attempts / maxAttempts));
    const corners = hexCorners(center.x, center.y, HEX_SIZE * 0.92 * sizeScale);
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', corners.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' '));

    if (metric === 'attempts') {
      polygon.setAttribute('fill', heatColorForRate(bin.attempts / maxAttempts));
    } else if (bin.attempts < MIN_ATTEMPTS_FOR_COLOR) {
      polygon.setAttribute('fill', NO_DATA_COLOR);
    } else {
      const baseline = bin.attempts3 > bin.attempts2 ? baselines.threePct : baselines.twoPct;
      const delta = bin.makes / bin.attempts - (baseline ?? 0);
      polygon.setAttribute('fill', relativeColorForDelta(delta));
    }
    polygon.setAttribute('stroke', 'rgba(255,255,255,0.4)');
    polygon.setAttribute('stroke-width', '0.1');
    group.appendChild(polygon);
  });
  svg.appendChild(group);
}

// --- Smooth heatmap: kernel-weighted local make%, red (cold/low%) to green (hot/high%) ---
// This is a locally-smoothed efficiency surface, not a volume density map — it answers
// "how well does he shoot from around here", matching the article's heatmap convention.

const HEAT_GRID_STEP = 1.5; // feet
const HEAT_BANDWIDTH = 4.5; // feet, gaussian sigma
const HEAT_MIDPOINT = 0.45; // roughly a typical HS FG% - the neutral gray point
const HEAT_COLD = [208, 59, 59]; // --critical
const HEAT_NEUTRAL = [56, 56, 53];
const HEAT_HOT = [12, 163, 12]; // --good

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function diverging(pct) {
  const [c1, c2, t] =
    pct <= HEAT_MIDPOINT
      ? [HEAT_COLD, HEAT_NEUTRAL, pct / HEAT_MIDPOINT]
      : [HEAT_NEUTRAL, HEAT_HOT, (pct - HEAT_MIDPOINT) / (1 - HEAT_MIDPOINT)];
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r},${g},${b})`;
}

function gaussianWeight(dx, dy, sigma) {
  return Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
}

// shots: array of { x, y, result } for made/missed field goal attempts only (no free throws).
export function drawHeatmap(svg, shots) {
  const points = shots.filter((s) => s.x !== undefined && s.y !== undefined);
  if (!points.length) return;

  const cells = [];
  let maxWeight = 0;
  for (let gx = 0; gx <= COURT_WIDTH; gx += HEAT_GRID_STEP) {
    for (let gy = 0; gy <= COURT_HEIGHT; gy += HEAT_GRID_STEP) {
      let totalWeight = 0;
      let madeWeight = 0;
      for (const shot of points) {
        const w = gaussianWeight(gx - shot.x, gy - shot.y, HEAT_BANDWIDTH);
        totalWeight += w;
        if (shot.result === 'make') madeWeight += w;
      }
      if (totalWeight > 0.05) {
        cells.push({ gx, gy, pct: madeWeight / totalWeight, weight: totalWeight });
        if (totalWeight > maxWeight) maxWeight = totalWeight;
      }
    }
  }

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('id', 'heatmap');
  group.setAttribute('filter', 'url(#heat-blur)');
  cells.forEach((cell) => {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', (cell.gx - HEAT_GRID_STEP / 2).toFixed(2));
    rect.setAttribute('y', (cell.gy - HEAT_GRID_STEP / 2).toFixed(2));
    rect.setAttribute('width', HEAT_GRID_STEP);
    rect.setAttribute('height', HEAT_GRID_STEP);
    rect.setAttribute('fill', diverging(cell.pct));
    rect.setAttribute('opacity', Math.min(1, cell.weight / maxWeight).toFixed(2));
    group.appendChild(rect);
  });
  svg.appendChild(group);
}
