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
export const COURT_WIDTH = 50;
export const COURT_HEIGHT = 27;
export const VIEW_BOX = `-3 -2 ${COURT_WIDTH + 6} ${COURT_HEIGHT + 2}`;

const LANE_LEFT = HOOP.x - LANE_HALF_WIDTH;
const LANE_RIGHT = HOOP.x + LANE_HALF_WIDTH;

// The straight-vs-arc transition happens exactly level with the rim, where the
// arc's tangent is already vertical - so the corner line and the arc meet smoothly.
const CORNER_LEFT_X = HOOP.x - THREE_POINT_RADIUS;
const CORNER_RIGHT_X = HOOP.x + THREE_POINT_RADIUS;
const CORNER_SPLIT_Y = HOOP.y;

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

export function drawCourt(svg) {
  svg.setAttribute('viewBox', VIEW_BOX);
  svg.innerHTML = `
    <rect x="-3" y="-2" width="${COURT_WIDTH + 6}" height="${COURT_HEIGHT + 2}" fill="#d7c79e" />

    <path d="M 0 0 L ${COURT_WIDTH} 0" stroke="#f5f5f5" stroke-width="0.3" />
    <path d="M 0 0 L 0 ${COURT_HEIGHT}" stroke="#f5f5f5" stroke-width="0.3" />
    <path d="M ${COURT_WIDTH} 0 L ${COURT_WIDTH} ${COURT_HEIGHT}" stroke="#f5f5f5" stroke-width="0.3" />

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
      return `M 0 0 L ${LANE_LEFT} 0 L ${LANE_LEFT} ${COURT_HEIGHT} L 0 ${COURT_HEIGHT} Z`;
    case 'Mid-Range (Right)':
      return `M ${LANE_RIGHT} 0 L ${COURT_WIDTH} 0 L ${COURT_WIDTH} ${COURT_HEIGHT} L ${LANE_RIGHT} ${COURT_HEIGHT} Z`;
    case 'Mid-Range (Center)':
      return `M ${LANE_LEFT} ${FREE_THROW_LINE_Y} L ${LANE_RIGHT} ${FREE_THROW_LINE_Y} L ${LANE_RIGHT} ${COURT_HEIGHT} L ${LANE_LEFT} ${COURT_HEIGHT} Z`;
    case 'Corner 3 (Left)':
      return `M 0 0 L ${CORNER_LEFT_X} 0 L ${CORNER_LEFT_X} ${CORNER_SPLIT_Y} L 0 ${CORNER_SPLIT_Y} Z`;
    case 'Corner 3 (Right)':
      return `M ${CORNER_RIGHT_X} 0 L ${COURT_WIDTH} 0 L ${COURT_WIDTH} ${CORNER_SPLIT_Y} L ${CORNER_RIGHT_X} ${CORNER_SPLIT_Y} Z`;
    case 'Above Break 3 (Left)':
      return `M 0 ${CORNER_SPLIT_Y} L ${CORNER_LEFT_X} ${CORNER_SPLIT_Y} L ${HOOP.x - 5} ${COURT_HEIGHT} L 0 ${COURT_HEIGHT} Z`;
    case 'Above Break 3 (Right)':
      return `M ${CORNER_RIGHT_X} ${CORNER_SPLIT_Y} L ${COURT_WIDTH} ${CORNER_SPLIT_Y} L ${COURT_WIDTH} ${COURT_HEIGHT} L ${HOOP.x + 5} ${COURT_HEIGHT} Z`;
    case 'Above Break 3 (Center)':
      return `M ${HOOP.x - 5} ${COURT_HEIGHT} L ${HOOP.x + 5} ${COURT_HEIGHT} L ${CORNER_RIGHT_X} ${CORNER_SPLIT_Y} L ${CORNER_LEFT_X} ${CORNER_SPLIT_Y} Z`;
    default:
      return '';
  }
}

// zoneStats: Map<zoneLabel, {attempts, makes}>
export function drawZoneOverlay(svg, zoneStats) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('id', 'zone-overlay');
  ZONES.forEach((zone) => {
    const stat = zoneStats.get(zone);
    const rate = stat && stat.attempts ? stat.makes / stat.attempts : null;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', zonePath(zone));
    path.setAttribute('fill', heatColorForRate(rate));
    path.setAttribute('fill-opacity', rate === null ? '1' : '0.82');
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
