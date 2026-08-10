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
export const RESTRICTED_RADIUS = 3; // not an official NFHS line; used only to bucket rim-level shots for insights
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

// The straight-vs-arc transition happens exactly level with the rim, where the
// arc's tangent is already vertical - so the corner line and the arc meet smoothly.
const CORNER_LEFT_X = HOOP.x - THREE_POINT_RADIUS;
const CORNER_RIGHT_X = HOOP.x + THREE_POINT_RADIUS;
const CORNER_SPLIT_Y = HOOP.y;

// The Zones tab shades rectangular regions for readability, not the literal 2PT/3PT
// boundary — capping their height keeps "Mid-Range"/"Above Break 3" from stretching
// all the way up to mid-court just because the tappable court now goes that far.
const ZONE_DISPLAY_MAX_Y = Math.min(COURT_HEIGHT, HOOP.y + THREE_POINT_RADIUS + 6);

export const ZONES = [
  'Restricted Area',
  'Paint (Non-RA)',
  'Mid-Range (Left)',
  'Mid-Range (Center)',
  'Mid-Range (Right)',
  'Corner 3 (Left)',
  'Corner 3 (Right)',
  'Above Break 3 (Left)',
  'Above Break 3 (Center)',
  'Above Break 3 (Right)'
];

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
    if (x <= CORNER_LEFT_X) return 'Corner 3 (Left)';
    if (x >= CORNER_RIGHT_X) return 'Corner 3 (Right)';
    if (x < HOOP.x - 5) return 'Above Break 3 (Left)';
    if (x > HOOP.x + 5) return 'Above Break 3 (Right)';
    return 'Above Break 3 (Center)';
  }
  if (distanceFromHoop(x, y) <= RESTRICTED_RADIUS) return 'Restricted Area';
  if (x >= LANE_LEFT && x <= LANE_RIGHT && y <= FREE_THROW_LINE_Y) return 'Paint (Non-RA)';
  if (x < LANE_LEFT) return 'Mid-Range (Left)';
  if (x > LANE_RIGHT) return 'Mid-Range (Right)';
  return 'Mid-Range (Center)';
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
  const arcPoints = arcPathPoints(HOOP.x, HOOP.y, THREE_POINT_RADIUS, -Math.PI / 2, Math.PI / 2, 48);
  const points = [{ x: CORNER_LEFT_X, y: 0 }, ...arcPoints, { x: CORNER_RIGHT_X, y: 0 }];
  return pathFromPoints(points);
}

function restrictedAreaPath() {
  const points = arcPathPoints(HOOP.x, HOOP.y, RESTRICTED_RADIUS, -Math.PI / 2, Math.PI / 2, 24);
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
    <path d="${restrictedAreaPath()}" fill="none" stroke="#f5f5f5" stroke-width="0.25" stroke-dasharray="0.6 0.6" />

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

function zonePath(zone) {
  switch (zone) {
    case 'Restricted Area':
      return `M ${HOOP.x - RESTRICTED_RADIUS} ${HOOP.y} A ${RESTRICTED_RADIUS} ${RESTRICTED_RADIUS} 0 0 0 ${HOOP.x + RESTRICTED_RADIUS} ${HOOP.y} L ${HOOP.x + RESTRICTED_RADIUS} 0 L ${HOOP.x - RESTRICTED_RADIUS} 0 Z`;
    case 'Paint (Non-RA)':
      return `M ${LANE_LEFT} 0 L ${LANE_RIGHT} 0 L ${LANE_RIGHT} ${FREE_THROW_LINE_Y} L ${LANE_LEFT} ${FREE_THROW_LINE_Y} Z`;
    case 'Mid-Range (Left)':
      return `M 0 0 L ${LANE_LEFT} 0 L ${LANE_LEFT} ${ZONE_DISPLAY_MAX_Y} L 0 ${ZONE_DISPLAY_MAX_Y} Z`;
    case 'Mid-Range (Right)':
      return `M ${LANE_RIGHT} 0 L ${COURT_WIDTH} 0 L ${COURT_WIDTH} ${ZONE_DISPLAY_MAX_Y} L ${LANE_RIGHT} ${ZONE_DISPLAY_MAX_Y} Z`;
    case 'Mid-Range (Center)':
      return `M ${LANE_LEFT} ${FREE_THROW_LINE_Y} L ${LANE_RIGHT} ${FREE_THROW_LINE_Y} L ${LANE_RIGHT} ${ZONE_DISPLAY_MAX_Y} L ${LANE_LEFT} ${ZONE_DISPLAY_MAX_Y} Z`;
    case 'Corner 3 (Left)':
      return `M 0 0 L ${CORNER_LEFT_X} 0 L ${CORNER_LEFT_X} ${CORNER_SPLIT_Y} L 0 ${CORNER_SPLIT_Y} Z`;
    case 'Corner 3 (Right)':
      return `M ${CORNER_RIGHT_X} 0 L ${COURT_WIDTH} 0 L ${COURT_WIDTH} ${CORNER_SPLIT_Y} L ${CORNER_RIGHT_X} ${CORNER_SPLIT_Y} Z`;
    case 'Above Break 3 (Left)':
      return `M 0 ${CORNER_SPLIT_Y} L ${CORNER_LEFT_X} ${CORNER_SPLIT_Y} L ${HOOP.x - 5} ${ZONE_DISPLAY_MAX_Y} L 0 ${ZONE_DISPLAY_MAX_Y} Z`;
    case 'Above Break 3 (Right)':
      return `M ${CORNER_RIGHT_X} ${CORNER_SPLIT_Y} L ${COURT_WIDTH} ${CORNER_SPLIT_Y} L ${COURT_WIDTH} ${ZONE_DISPLAY_MAX_Y} L ${HOOP.x + 5} ${ZONE_DISPLAY_MAX_Y} Z`;
    case 'Above Break 3 (Center)':
      return `M ${HOOP.x - 5} ${ZONE_DISPLAY_MAX_Y} L ${HOOP.x + 5} ${ZONE_DISPLAY_MAX_Y} L ${CORNER_RIGHT_X} ${CORNER_SPLIT_Y} L ${CORNER_LEFT_X} ${CORNER_SPLIT_Y} Z`;
    default:
      return '';
  }
}

// zoneStats: Map<zoneLabel, {attempts, makes}>
// metric 'fgpct' colors by make% per zone (default); 'attempts' colors by relative
// shot volume instead, so you can see where he shoots from most vs. where he's best.
export function drawZoneOverlay(svg, zoneStats, metric = 'fgpct') {
  const maxAttempts = Math.max(0, ...[...zoneStats.values()].map((s) => s.attempts));
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('id', 'zone-overlay');
  ZONES.forEach((zone) => {
    const stat = zoneStats.get(zone);
    const value =
      metric === 'attempts'
        ? stat && maxAttempts ? stat.attempts / maxAttempts : null
        : stat && stat.attempts ? stat.makes / stat.attempts : null;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', zonePath(zone));
    path.setAttribute('fill', heatColorForRate(value));
    path.setAttribute('fill-opacity', value === null ? '1' : '0.82');
    path.setAttribute('stroke', 'rgba(255,255,255,0.35)');
    path.setAttribute('stroke-width', '0.15');
    path.dataset.zone = zone;
    group.appendChild(path);
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
export function drawHexbin(svg, shots, metric = 'fgpct') {
  const bins = new Map();
  shots.forEach((shot) => {
    if (shot.x === undefined || shot.y === undefined) return;
    const { q, r } = pixelToHex(shot.x, shot.y, HEX_SIZE);
    const key = `${q},${r}`;
    const bin = bins.get(key) || { q, r, attempts: 0, makes: 0 };
    bin.attempts += 1;
    if (shot.result === 'make') bin.makes += 1;
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
    const value = metric === 'attempts' ? bin.attempts / maxAttempts : bin.makes / bin.attempts;
    polygon.setAttribute('fill', heatColorForRate(value));
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
