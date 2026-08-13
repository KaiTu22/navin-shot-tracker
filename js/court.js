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
// shot-chart tools use, not the exact HS 3PT line geometry. But the zone *shapes*
// drawn for shading DO follow the true 3PT arc/tangent boundary exactly (see
// arcSegment/angleForX below) - a zone's shaded area never bleeds across the real
// 2PT/3PT line, so a shot's zone membership always matches what's colored under it.
const RIM_RADIUS = 4.5; // "At the Rim"
const CORNER_CUTOFF_Y = 14; // corner 3 vs above-the-break 3

// Capping height keeps "Above Break 3" from stretching all the way up to mid-court
// just because the tappable court now goes that far.
const ZONE_DISPLAY_MAX_Y = Math.min(COURT_HEIGHT, HOOP.y + THREE_POINT_RADIUS + 6);

// The angle (in the arcPathPoints φ convention below) at which the arc passes
// through a given x. Angle-based sampling is used for every arc segment here
// (never sampling evenly in x) because the arc's slope is vertical right at the
// tangent points - evenly-spaced x samples badly under-approximate the curve
// exactly there, while evenly-spaced angles stay accurate everywhere.
function angleForX(x) {
  return Math.asin((x - HOOP.x) / THREE_POINT_RADIUS);
}

const TANGENT_LEFT_X = HOOP.x - THREE_POINT_RADIUS;
const TANGENT_RIGHT_X = HOOP.x + THREE_POINT_RADIUS;
// Where the arc itself crosses y = CORNER_CUTOFF_Y (solving the circle equation) -
// the exact point where the corner-vs-above-break shading boundary meets the arc.
const CORNER_ARC_LEFT_X = HOOP.x - Math.sqrt(THREE_POINT_RADIUS ** 2 - (CORNER_CUTOFF_Y - HOOP.y) ** 2);
const CORNER_ARC_RIGHT_X = HOOP.x + Math.sqrt(THREE_POINT_RADIUS ** 2 - (CORNER_CUTOFF_Y - HOOP.y) ** 2);
const WING_LEFT_X = HOOP.x - 5;
const WING_RIGHT_X = HOOP.x + 5;

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

function zoneBenchmarkCategory(zone) {
  if (zone === 'At The Rim') return 'rim';
  if (zone === 'In The Paint') return 'paint';
  if (zone === 'Midrange 2s') return 'midrange';
  return 'three';
}

// Typical HS shooting percentages by shot difficulty (independent of Navin's own
// data) - lets a chart grade a spot against a realistic external target instead of
// only ever falling back to "not enough data yet" gray in a small/early-season sample.
const BENCHMARKS = {
  rim: 0.525, // at the rim / layups: ~50-55%
  paint: 0.325, // short floaters/hooks: ~30-35%
  midrange: 0.34, // mid-range, 10ft to the 3PT line: ~32-36%
  three: 0.3 // HS three-pointers: ~28-32%
};

// Returns a Map<zone, baseline%>. 'self' (default) uses his own overall 2PT/3PT split;
// 'benchmark' uses the external HS averages above, split more finely across the 4 shot
// -difficulty categories instead of just 2PT/3PT.
export function zoneBaselineMap(mode, summary) {
  if (mode === 'benchmark') {
    return new Map(ZONES.map((zone) => [zone, BENCHMARKS[zoneBenchmarkCategory(zone)]]));
  }
  return new Map(ZONES.map((zone) => [zone, zoneShotType(zone) === '3PT' ? summary.threePct : summary.twoPct]));
}

// Same benchmark lookup as zoneBaselineMap, but for an arbitrary point - used by
// Heat, which isn't confined to the 8 named Zones.
export function benchmarkAt(x, y) {
  return BENCHMARKS[zoneBenchmarkCategory(zoneForPoint(x, y))];
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

function courtLinesMarkup() {
  return `
    <path d="M 0 0 L ${COURT_WIDTH} 0" stroke="#3a3a35" stroke-width="0.3" />
    <path d="M 0 0 L 0 ${COURT_HEIGHT}" stroke="#3a3a35" stroke-width="0.3" />
    <path d="M ${COURT_WIDTH} 0 L ${COURT_WIDTH} ${COURT_HEIGHT}" stroke="#3a3a35" stroke-width="0.3" />
    <path d="M 0 ${COURT_HEIGHT} L ${COURT_WIDTH} ${COURT_HEIGHT}" stroke="#3a3a35" stroke-width="0.3" />
    <path d="${centerCirclePath()}" fill="none" stroke="#3a3a35" stroke-width="0.25" />

    <rect x="${LANE_LEFT}" y="0" width="${LANE_HALF_WIDTH * 2}" height="${FREE_THROW_LINE_Y}" fill="none" stroke="#3a3a35" stroke-width="0.3" />
    <path d="M ${LANE_LEFT} ${FREE_THROW_LINE_Y} L ${LANE_RIGHT} ${FREE_THROW_LINE_Y}" stroke="#3a3a35" stroke-width="0.3" />
    <circle cx="${HOOP.x}" cy="${FREE_THROW_LINE_Y}" r="${FREE_THROW_CIRCLE_RADIUS}" fill="none" stroke="#3a3a35" stroke-width="0.25" stroke-dasharray="1 1" />

    <path d="M ${HOOP.x - 3} 4 L ${HOOP.x + 3} 4" stroke="#3a3a35" stroke-width="0.4" />
    <circle cx="${HOOP.x}" cy="${HOOP.y}" r="0.75" fill="none" stroke="#ff7a1a" stroke-width="0.3" />
    <path d="${rimArcPath()}" fill="none" stroke="#3a3a35" stroke-width="0.25" stroke-dasharray="0.6 0.6" />

    <path d="${threePointPath()}" fill="none" stroke="#3a3a35" stroke-width="0.3" />
  `;
}

export function drawCourt(svg) {
  svg.setAttribute('viewBox', VIEW_BOX);
  svg.innerHTML = `
    <defs>
      <filter id="heat-blur" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="0.65" />
      </filter>
    </defs>

    <rect x="${-PAD_X}" y="${-PAD_Y}" width="${COURT_WIDTH + 2 * PAD_X}" height="${COURT_HEIGHT + 2 * PAD_Y}" fill="#f7f4ec" />

    ${courtLinesMarkup()}
  `;
}

// Redraws the court lines fresh, on top of whatever's already in the SVG. Used after
// the (blurred, sometimes near-opaque) heatmap layer so the lines are never obscured
// by it, regardless of how confident/solid the heat color underneath is.
export function redrawCourtLinesOnTop(svg) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('id', 'court-lines-overlay');
  group.innerHTML = courtLinesMarkup();
  svg.appendChild(group);
}

// pct is 0-1 or null (no attempts). Dark-surface sequential ramp: low value recedes
// toward the surface, high value brightens to stand out (inverse of the light-mode convention).
const HEAT_STEPS = ['#0d366b', '#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5'];
export function heatColorForRate(pct) {
  if (pct === null || pct === undefined) return 'rgba(0,0,0,0.05)';
  const idx = Math.min(HEAT_STEPS.length - 1, Math.floor(pct * HEAT_STEPS.length));
  return HEAT_STEPS[idx];
}

// A spot's raw FG% doesn't account for shot difficulty (35% from three is great,
// 35% at the rim isn't) - color instead compares a zone/hex/ring cell's make% to a
// baseline (his own average, or an HS benchmark - see zoneBaselineMap/benchmarkAt),
// the same "vs. average" technique real shot-chart tools use. Same diverging red
// (below)/green (above) scale as Heat (see normalizedDivergingColor), stretched to
// whatever spread is actually present in the current dataset, so every chart on the
// app reads the same way.
export const MIN_ATTEMPTS_FOR_COLOR = 2; // fewer attempts than this = not enough data to color meaningfully
const NO_DATA_COLOR = 'rgba(0,0,0,0.05)';

// Colors are dark/saturated specifically because they sit on the court at partial
// opacity - measured WCAG contrast against the court color (#f7f4ec): these read at
// 7.38-9.35:1. Picking a notably darker red than green gives a lightness cue on top of
// the hue difference, since red-green is otherwise the classic confusable pair for
// red-green colorblindness.
const DIVERGING_BELOW = [122, 31, 31]; // #7a1f1f - below baseline ("cold" / lower%)
const DIVERGING_NEUTRAL = [138, 132, 120]; // #8a8478 - close to baseline, deliberately low-contrast so it recedes
const DIVERGING_ABOVE = [26, 92, 26]; // #1a5c1a - above baseline ("hot" / higher%)

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function blendColor(c1, c2, t) {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r},${g},${b})`;
}

// Stretches color to the range actually observed in THIS dataset (maxAbove/maxBelow),
// rather than a fixed assumed spread - a small or naturally tight-spread dataset still
// gets a fully-saturated hot and cold spot instead of everything landing close to gray
// just because nothing happens to clear some fixed, arbitrary "very good"/"very bad"
// threshold.
export function normalizedDivergingColor(value, baseline, maxAbove, maxBelow) {
  if (value === null || value === undefined) return NO_DATA_COLOR;
  if (value >= baseline) {
    const t = Math.min(1, (value - baseline) / maxAbove);
    return blendColor(DIVERGING_NEUTRAL, DIVERGING_ABOVE, t);
  }
  const t = Math.min(1, (baseline - value) / maxBelow);
  return blendColor(DIVERGING_NEUTRAL, DIVERGING_BELOW, t);
}

// Shapes trace the true arc/tangent boundary exactly (sampled by angle, never by
// x - see angleForX above). Draw order in ZONES matters here: "In The Paint" and
// "At The Rim" are drawn last so they always render correctly on top regardless of
// what the wider Midrange/Corner/Above-Break shapes beneath them cover.
function arcSegment(xFrom, xTo, steps) {
  return arcPathPoints(HOOP.x, HOOP.y, THREE_POINT_RADIUS, angleForX(xFrom), angleForX(xTo), steps);
}

function zonePath(zone) {
  switch (zone) {
    case 'Midrange 2s': {
      // The full 2PT "stadium" - straight tangent down to the baseline on each
      // side, true arc across the top. Exactly the classifyShot() 2PT region.
      const arc = arcPathPoints(HOOP.x, HOOP.y, THREE_POINT_RADIUS, -Math.PI / 2, Math.PI / 2, 48);
      return pathFromPoints([{ x: TANGENT_LEFT_X, y: 0 }, ...arc, { x: TANGENT_RIGHT_X, y: 0 }]) + ' Z';
    }
    case 'Corner 3 (Left)': {
      const arc = arcSegment(CORNER_ARC_LEFT_X, TANGENT_LEFT_X, 16);
      return (
        pathFromPoints([
          { x: 0, y: 0 },
          { x: 0, y: CORNER_CUTOFF_Y },
          { x: CORNER_ARC_LEFT_X, y: CORNER_CUTOFF_Y },
          ...arc,
          { x: TANGENT_LEFT_X, y: 0 }
        ]) + ' Z'
      );
    }
    case 'Corner 3 (Right)': {
      const arc = arcSegment(CORNER_ARC_RIGHT_X, TANGENT_RIGHT_X, 16);
      return (
        pathFromPoints([
          { x: COURT_WIDTH, y: 0 },
          { x: COURT_WIDTH, y: CORNER_CUTOFF_Y },
          { x: CORNER_ARC_RIGHT_X, y: CORNER_CUTOFF_Y },
          ...arc,
          { x: TANGENT_RIGHT_X, y: 0 }
        ]) + ' Z'
      );
    }
    case 'Above Break 3 (Left Wing)': {
      const arc = arcSegment(WING_LEFT_X, CORNER_ARC_LEFT_X, 24);
      return (
        pathFromPoints([
          { x: 0, y: CORNER_CUTOFF_Y },
          { x: 0, y: ZONE_DISPLAY_MAX_Y },
          { x: WING_LEFT_X, y: ZONE_DISPLAY_MAX_Y },
          ...arc,
          { x: CORNER_ARC_LEFT_X, y: CORNER_CUTOFF_Y }
        ]) + ' Z'
      );
    }
    case 'Above Break 3 (Right Wing)': {
      const arc = arcSegment(CORNER_ARC_RIGHT_X, WING_RIGHT_X, 24);
      return (
        pathFromPoints([
          { x: COURT_WIDTH, y: CORNER_CUTOFF_Y },
          { x: CORNER_ARC_RIGHT_X, y: CORNER_CUTOFF_Y },
          ...arc,
          { x: WING_RIGHT_X, y: ZONE_DISPLAY_MAX_Y },
          { x: COURT_WIDTH, y: ZONE_DISPLAY_MAX_Y }
        ]) + ' Z'
      );
    }
    case 'Above Break 3 (Center)': {
      const arc = arcSegment(WING_RIGHT_X, WING_LEFT_X, 24);
      return pathFromPoints([{ x: WING_LEFT_X, y: ZONE_DISPLAY_MAX_Y }, { x: WING_RIGHT_X, y: ZONE_DISPLAY_MAX_Y }, ...arc]) + ' Z';
    }
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
      return { x: 3, y: CORNER_CUTOFF_Y / 2 };
    case 'Corner 3 (Right)':
      return { x: COURT_WIDTH - 3, y: CORNER_CUTOFF_Y / 2 };
    case 'Above Break 3 (Left Wing)':
      return { x: 9, y: midY };
    case 'Above Break 3 (Right Wing)':
      return { x: COURT_WIDTH - 9, y: midY };
    case 'Above Break 3 (Center)':
      return { x: HOOP.x, y: HOOP.y + THREE_POINT_RADIUS + 3 };
    default:
      return { x: HOOP.x, y: HOOP.y };
  }
}

function baselineLabel(baselineMode) {
  return baselineMode === 'benchmark' ? 'a typical HS player’s average' : 'his own average';
}

function buildZoneTooltip(zone, stat, metric, baselines, baselineMode) {
  const description = ZONE_DESCRIPTIONS[zone] || '';
  if (!stat || !stat.attempts) {
    return `${zone}\n${description}\n\nNo attempts logged yet.`;
  }
  const rate = stat.makes / stat.attempts;
  if (metric === 'attempts') {
    return `${zone}\n${description}\n\n${stat.attempts} attempt${stat.attempts === 1 ? '' : 's'} (${stat.makes} made, ${Math.round(rate * 100)}%).`;
  }
  const baseline = baselines.get(zone) ?? 0;
  const deltaPct = Math.round((rate - baseline) * 100);
  const sign = deltaPct >= 0 ? 'above' : 'below';
  const baselineName = baselineMode === 'benchmark' ? 'Typical HS average here' : 'His baseline here';
  return (
    `${zone}\n${description}\n\n` +
    `His FG% here is ${Math.round(rate * 100)}% (${stat.makes}/${stat.attempts}).\n` +
    `${baselineName} is ${Math.round(baseline * 100)}%.\n` +
    `That's ${Math.abs(deltaPct)}% ${sign} ${baselineLabel(baselineMode)}.`
  );
}

// zoneStats: Map<zoneLabel, {attempts, makes}>
// metric 'fgpct' colors by make% per zone (default); 'attempts' colors by relative
// shot volume instead, so you can see where he shoots from most vs. where he's best.
// baselines: Map<zone, baseline%> from zoneBaselineMap() - either his own overall make%
// by shot type, or the external HS benchmark, depending on baselineMode. Only used in
// 'fgpct' metric mode.
export function drawZoneOverlay(svg, zoneStats, metric = 'fgpct', baselines = new Map(), baselineMode = 'self') {
  const maxAttempts = Math.max(0, ...[...zoneStats.values()].map((s) => s.attempts));

  // Stretch color to the range of above/below-baseline deltas actually present among
  // zones with enough data (see normalizedDivergingColor) instead of a fixed spread.
  let maxAbove = 0.05;
  let maxBelow = 0.05;
  if (metric === 'fgpct') {
    ZONES.forEach((zone) => {
      const stat = zoneStats.get(zone);
      if (!stat || stat.attempts < MIN_ATTEMPTS_FOR_COLOR) return;
      const delta = stat.makes / stat.attempts - (baselines.get(zone) ?? 0);
      if (delta > 0) maxAbove = Math.max(maxAbove, delta);
      else maxBelow = Math.max(maxBelow, -delta);
    });
  }

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
      const baseline = baselines.get(zone) ?? 0;
      const rate = stat.makes / stat.attempts;
      path.setAttribute('fill', normalizedDivergingColor(rate, baseline, maxAbove, maxBelow));
      path.setAttribute('fill-opacity', '0.82');
    }
    path.setAttribute('stroke', 'rgba(0,0,0,0.22)');
    path.setAttribute('stroke-width', '0.15');
    path.dataset.zone = zone;
    path.dataset.tooltip = buildZoneTooltip(zone, stat, metric, baselines, baselineMode);
    group.appendChild(path);

    const pos = zoneLabelPosition(zone);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', pos.x);
    label.setAttribute('y', pos.y);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('font-size', '2.4');
    label.setAttribute('font-weight', '800');
    label.setAttribute('fill', hasColor ? '#ffffff' : 'rgba(0,0,0,0.45)');
    label.setAttribute('paint-order', 'stroke');
    label.setAttribute('stroke', 'rgba(0,0,0,0.55)');
    label.setAttribute('stroke-width', '0.4');
    label.style.pointerEvents = 'none';
    label.textContent = !stat || !stat.attempts ? '—' : metric === 'attempts' ? `${stat.attempts}` : `${Math.round((stat.makes / stat.attempts) * 100)}%`;
    group.appendChild(label);
  });
  svg.appendChild(group);
}

export function removeZoneOverlay(svg) {
  const existing = svg.querySelector('#zone-overlay');
  if (existing) existing.remove();
}

// --- Distance-ring x side-wedge grid: same "vs. his own baseline" coloring as Zones,
// but partitioned purely by distance-from-hoop and angle instead of basketball zone
// names. Insights-only (season aggregates) - a single game's shot count spreads too
// thin across ~30 cells to mean much.
const RING_BOUNDARIES = [RIM_RADIUS, 9, 14, THREE_POINT_RADIUS, 24, 200]; // last = "24ft+", 200 is just a generous catch-all
const RING_LABELS = ['4.5-9ft', '9-14ft', '14-19.75ft', '19.75-24ft', '24ft+'];
const WEDGE_BOUNDARIES = [-Math.PI / 2, -Math.PI / 3, -Math.PI / 6, 0, Math.PI / 6, Math.PI / 3, Math.PI / 2];
const WEDGE_LABELS = ['Far Left', 'Left', 'Center-Left', 'Center-Right', 'Right', 'Far Right'];

function ringIndexForDistance(d) {
  if (d < RING_BOUNDARIES[0]) return -1; // -1 = the unsplit "At the Rim" disc
  for (let i = 1; i < RING_BOUNDARIES.length; i++) {
    if (d < RING_BOUNDARIES[i]) return i - 1;
  }
  return RING_BOUNDARIES.length - 2;
}

function wedgeIndexForAngle(angle) {
  const clamped = Math.max(WEDGE_BOUNDARIES[0], Math.min(WEDGE_BOUNDARIES[WEDGE_BOUNDARIES.length - 1], angle));
  for (let i = 0; i < WEDGE_BOUNDARIES.length - 1; i++) {
    if (clamped <= WEDGE_BOUNDARIES[i + 1]) return i;
  }
  return WEDGE_BOUNDARIES.length - 2;
}

function ringCellPath(ringIdx, wedgeIdx) {
  const r1 = RING_BOUNDARIES[ringIdx];
  const r2 = RING_BOUNDARIES[ringIdx + 1];
  const a1 = WEDGE_BOUNDARIES[wedgeIdx];
  const a2 = WEDGE_BOUNDARIES[wedgeIdx + 1];
  const outer = arcPathPoints(HOOP.x, HOOP.y, r2, a1, a2, 12);
  const inner = arcPathPoints(HOOP.x, HOOP.y, r1, a2, a1, 12);
  return pathFromPoints([...outer, ...inner]) + ' Z';
}

function rimDiscPath() {
  const arc = arcPathPoints(HOOP.x, HOOP.y, RING_BOUNDARIES[0], -Math.PI / 2, Math.PI / 2, 24);
  return pathFromPoints([HOOP, ...arc]) + ' Z';
}

function ringCellLabelPosition(ringIdx, wedgeIdx) {
  const outerBound = ringIdx === RING_BOUNDARIES.length - 2 ? RING_BOUNDARIES[ringIdx] + 4 : RING_BOUNDARIES[ringIdx + 1];
  const midR = (RING_BOUNDARIES[ringIdx] + outerBound) / 2;
  const midA = (WEDGE_BOUNDARIES[wedgeIdx] + WEDGE_BOUNDARIES[wedgeIdx + 1]) / 2;
  return { x: HOOP.x + midR * Math.sin(midA), y: HOOP.y + midR * Math.cos(midA) };
}

function buildRingTooltip(label, stat, metric, zone, baselines, baselineMode) {
  if (!stat || !stat.attempts) return `${label}\nNo attempts logged yet.`;
  const rate = stat.makes / stat.attempts;
  if (metric === 'attempts') {
    return `${label}\n${stat.attempts} attempt${stat.attempts === 1 ? '' : 's'} (${stat.makes} made, ${Math.round(rate * 100)}%).`;
  }
  const baseline = baselines.get(zone) ?? 0;
  const deltaPct = Math.round((rate - baseline) * 100);
  const sign = deltaPct >= 0 ? 'above' : 'below';
  const baselineName = baselineMode === 'benchmark' ? 'Typical HS average here' : 'His baseline here';
  return (
    `${label}\n` +
    `FG% here: ${Math.round(rate * 100)}% (${stat.makes}/${stat.attempts}).\n` +
    `${baselineName}: ${Math.round(baseline * 100)}%.\n` +
    `That's ${Math.abs(deltaPct)}% ${sign} ${baselineLabel(baselineMode)}.`
  );
}

// shots: array of { x, y, shotType, result } for made/missed field goal attempts only.
// baselines: Map<zone, baseline%> from zoneBaselineMap() - a cell's baseline is picked
// by classifying its representative court point via zoneForPoint(), same as Zones.
export function drawRingOverlay(svg, shots, metric = 'fgpct', baselines = new Map(), baselineMode = 'self') {
  const rim = { attempts: 0, makes: 0 };
  const cells = new Map(); // key `${ringIdx}:${wedgeIdx}` -> { attempts, makes }

  shots.forEach((shot) => {
    if (shot.x === undefined || shot.y === undefined) return;
    const dx = shot.x - HOOP.x;
    const dy = shot.y - HOOP.y;
    const distance = Math.hypot(dx, dy);
    const ringIdx = ringIndexForDistance(distance);
    const isMake = shot.result === 'make';
    if (ringIdx === -1) {
      rim.attempts += 1;
      if (isMake) rim.makes += 1;
      return;
    }
    const angle = Math.atan2(dx, dy);
    const wedgeIdx = wedgeIndexForAngle(angle);
    const key = `${ringIdx}:${wedgeIdx}`;
    const cell = cells.get(key) || { attempts: 0, makes: 0 };
    cell.attempts += 1;
    if (isMake) cell.makes += 1;
    cells.set(key, cell);
  });

  const maxAttempts = Math.max(rim.attempts, 0, ...[...cells.values()].map((c) => c.attempts));
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('id', 'ring-overlay');

  // Stretch color to the range of above/below-baseline deltas actually present among
  // cells with enough data (see normalizedDivergingColor) instead of a fixed spread.
  let maxAbove = 0.05;
  let maxBelow = 0.05;
  if (metric === 'fgpct') {
    const trackDelta = (stat, zone) => {
      if (!stat.attempts || stat.attempts < MIN_ATTEMPTS_FOR_COLOR) return;
      const delta = stat.makes / stat.attempts - (baselines.get(zone) ?? 0);
      if (delta > 0) maxAbove = Math.max(maxAbove, delta);
      else maxBelow = Math.max(maxBelow, -delta);
    };
    trackDelta(rim, zoneForPoint(HOOP.x, HOOP.y));
    for (let ringIdx = 0; ringIdx < RING_LABELS.length; ringIdx++) {
      for (let wedgeIdx = 0; wedgeIdx < WEDGE_LABELS.length; wedgeIdx++) {
        const stat = cells.get(`${ringIdx}:${wedgeIdx}`) || { attempts: 0, makes: 0 };
        const pos = ringCellLabelPosition(ringIdx, wedgeIdx);
        const zone = zoneForPoint(Math.min(COURT_WIDTH, Math.max(0, pos.x)), Math.min(COURT_HEIGHT, Math.max(0, pos.y)));
        trackDelta(stat, zone);
      }
    }
  }

  function colorAndTooltip(stat, zone, label) {
    if (metric === 'attempts') {
      const value = stat.attempts && maxAttempts ? stat.attempts / maxAttempts : null;
      return { fill: heatColorForRate(value), tooltip: buildRingTooltip(label, stat, metric, zone, baselines, baselineMode) };
    }
    if (!stat.attempts || stat.attempts < MIN_ATTEMPTS_FOR_COLOR) {
      return { fill: NO_DATA_COLOR, tooltip: buildRingTooltip(label, stat, metric, zone, baselines, baselineMode) };
    }
    const baseline = baselines.get(zone) ?? 0;
    const rate = stat.makes / stat.attempts;
    return { fill: normalizedDivergingColor(rate, baseline, maxAbove, maxBelow), tooltip: buildRingTooltip(label, stat, metric, zone, baselines, baselineMode) };
  }

  // Rim disc (unsplit)
  const rimResult = colorAndTooltip(rim, zoneForPoint(HOOP.x, HOOP.y), 'At the Rim (0-4.5ft)');
  const rimPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  rimPath.setAttribute('d', rimDiscPath());
  rimPath.setAttribute('fill', rimResult.fill);
  rimPath.setAttribute('fill-opacity', metric === 'attempts' && !rim.attempts ? '1' : '0.85');
  rimPath.setAttribute('stroke', 'rgba(0,0,0,0.22)');
  rimPath.setAttribute('stroke-width', '0.15');
  rimPath.dataset.tooltip = rimResult.tooltip;
  group.appendChild(rimPath);
  const rimLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  rimLabel.setAttribute('x', HOOP.x);
  rimLabel.setAttribute('y', HOOP.y + 2);
  rimLabel.setAttribute('text-anchor', 'middle');
  rimLabel.setAttribute('dominant-baseline', 'middle');
  rimLabel.setAttribute('font-size', '2.3');
  rimLabel.setAttribute('font-weight', '800');
  rimLabel.setAttribute('fill', '#ffffff');
  rimLabel.setAttribute('paint-order', 'stroke');
  rimLabel.setAttribute('stroke', 'rgba(0,0,0,0.55)');
  rimLabel.setAttribute('stroke-width', '0.4');
  rimLabel.style.pointerEvents = 'none';
  rimLabel.textContent = !rim.attempts ? '—' : metric === 'attempts' ? `${rim.attempts}` : `${Math.round((rim.makes / rim.attempts) * 100)}%`;
  group.appendChild(rimLabel);

  for (let ringIdx = 0; ringIdx < RING_LABELS.length; ringIdx++) {
    for (let wedgeIdx = 0; wedgeIdx < WEDGE_LABELS.length; wedgeIdx++) {
      const stat = cells.get(`${ringIdx}:${wedgeIdx}`) || { attempts: 0, makes: 0 };
      const label = `${RING_LABELS[ringIdx]} — ${WEDGE_LABELS[wedgeIdx]}`;
      const pos = ringCellLabelPosition(ringIdx, wedgeIdx);
      const zone = zoneForPoint(Math.min(COURT_WIDTH, Math.max(0, pos.x)), Math.min(COURT_HEIGHT, Math.max(0, pos.y)));
      const result = colorAndTooltip(stat, zone, label);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', ringCellPath(ringIdx, wedgeIdx));
      path.setAttribute('fill', result.fill);
      path.setAttribute('fill-opacity', metric === 'attempts' && !stat.attempts ? '1' : '0.85');
      path.setAttribute('stroke', 'rgba(0,0,0,0.22)');
      path.setAttribute('stroke-width', '0.15');
      path.dataset.tooltip = result.tooltip;
      group.appendChild(path);

      const label2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label2.setAttribute('x', pos.x);
      label2.setAttribute('y', pos.y);
      label2.setAttribute('text-anchor', 'middle');
      label2.setAttribute('dominant-baseline', 'middle');
      label2.setAttribute('font-size', '1.5');
      label2.setAttribute('font-weight', '800');
      label2.setAttribute('fill', '#ffffff');
      label2.setAttribute('paint-order', 'stroke');
      label2.setAttribute('stroke', 'rgba(0,0,0,0.55)');
      label2.setAttribute('stroke-width', '0.28');
      label2.style.pointerEvents = 'none';
      label2.textContent = !stat.attempts ? '—' : metric === 'attempts' ? `${stat.attempts}` : `${Math.round((stat.makes / stat.attempts) * 100)}%`;
      group.appendChild(label2);
    }
  }

  svg.appendChild(group);
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
// baselines: Map<zone, baseline%> from zoneBaselineMap() - a bin's baseline is picked
// by classifying its center point via zoneForPoint(), same as Zones.
export function drawHexbin(svg, shots, metric = 'fgpct', baselines = new Map()) {
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

  // Stretch color to the range of above/below-baseline deltas actually present among
  // bins with enough data (see normalizedDivergingColor) instead of a fixed spread.
  let maxAbove = 0.05;
  let maxBelow = 0.05;
  if (metric === 'fgpct') {
    bins.forEach((bin) => {
      if (bin.attempts < MIN_ATTEMPTS_FOR_COLOR) return;
      const center = hexToPixel(bin.q, bin.r, HEX_SIZE);
      const zone = zoneForPoint(Math.min(COURT_WIDTH, Math.max(0, center.x)), Math.min(COURT_HEIGHT, Math.max(0, center.y)));
      const delta = bin.makes / bin.attempts - (baselines.get(zone) ?? 0);
      if (delta > 0) maxAbove = Math.max(maxAbove, delta);
      else maxBelow = Math.max(maxBelow, -delta);
    });
  }

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
      const zone = zoneForPoint(Math.min(COURT_WIDTH, Math.max(0, center.x)), Math.min(COURT_HEIGHT, Math.max(0, center.y)));
      const baseline = baselines.get(zone) ?? 0;
      const rate = bin.makes / bin.attempts;
      polygon.setAttribute('fill', normalizedDivergingColor(rate, baseline, maxAbove, maxBelow));
    }
    polygon.setAttribute('stroke', 'rgba(0,0,0,0.3)');
    polygon.setAttribute('stroke-width', '0.1');
    group.appendChild(polygon);
  });
  svg.appendChild(group);
}

// --- Smooth heatmap: kernel-weighted local make% vs. his baseline, red (below) to green (above) ---
// This is a locally-smoothed efficiency surface, not a volume density map — it answers
// "how well does he shoot from around here", matching the article's heatmap convention.

const HEAT_GRID_STEP = 1.5; // feet
const HEAT_BANDWIDTH = 2.8; // feet, gaussian sigma - tighter than a naive choice so distinct
// clusters (rim vs. paint vs. wing) stay visually separated instead of smearing together
// Opacity is confidence, scaled against this absolute amount of local kernel weight -
// NOT against whatever the single densest spot on this particular chart achieves.
// A tight, high-volume cluster (shots at the rim are almost always packed into a small
// area) will always out-density a real, well-sampled but more spread-out area (e.g. the
// 3PT arc) - normalizing to the chart's own max makes every non-rim zone look faint even
// with plenty of real data behind it. This constant is calibrated so a cluster of roughly
// 11 nearby attempts reaches full opacity, independent of what's happening elsewhere.
const HEAT_CONFIDENCE_WEIGHT = 11;
const HEAT_MAX_OPACITY = 0.92; // cap so a fully-confident area still reads as a wash, not a solid mask
// Square-root curve so moderately-sampled areas (not just the single most-sampled spot)
// ramp up to a visually bold color quickly, rather than needing near-maximum weight to
// look like anything at all.
const HEAT_OPACITY_CURVE = 0.5;
const HEAT_MIDPOINT = 0.45; // roughly a typical HS FG% - the neutral gray point
// Color is the same shared diverging red (below)/green (above) scale defined above
// (normalizedDivergingColor) - see that function for the contrast/CVD rationale.

function gaussianWeight(dx, dy, sigma) {
  return Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
}

// benchmarkAt() is a step function - it jumps sharply right at a zone boundary (52.5%
// at the rim vs. 32.5% a few inches away in the paint). Heat's actual color surface has
// no such edges - it's a smooth gaussian-kernel blend across every nearby shot. Comparing
// a smooth surface to a stepped one creates a fake-looking hard edge in the color right
// at the boundary (e.g. a "cold" ring around the rim that isn't really there). This
// blends benchmarkAt with the same kernel/bandwidth used for the shot density above, so
// the benchmark itself transitions gradually near zone boundaries instead of jumping.
const BENCHMARK_SMOOTH_STEP = 0.75; // feet, sub-sampling resolution for the blur convolution
const BENCHMARK_SMOOTH_RANGE = HEAT_BANDWIDTH * 2; // feet - beyond this the gaussian weight is negligible
export function smoothedBenchmarkAt(x, y) {
  let totalWeight = 0;
  let weightedSum = 0;
  for (let dx = -BENCHMARK_SMOOTH_RANGE; dx <= BENCHMARK_SMOOTH_RANGE; dx += BENCHMARK_SMOOTH_STEP) {
    for (let dy = -BENCHMARK_SMOOTH_RANGE; dy <= BENCHMARK_SMOOTH_RANGE; dy += BENCHMARK_SMOOTH_STEP) {
      const sx = x + dx;
      const sy = y + dy;
      if (sx < 0 || sx > COURT_WIDTH || sy < 0 || sy > COURT_HEIGHT) continue;
      const w = gaussianWeight(dx, dy, HEAT_BANDWIDTH);
      weightedSum += w * benchmarkAt(sx, sy);
      totalWeight += w;
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : benchmarkAt(x, y);
}

// shots: array of { x, y, result } for made/missed field goal attempts only (no free throws).
// baseline: either a flat number (his real overall FG% for the shots being charted -
// the "vs. his own average" mode, one neutral-gray anchor for the whole court) or a
// function (x, y) => pct (the "vs. HS benchmark" mode via smoothedBenchmarkAt(), which
// varies by shot difficulty - a fixed 52% neutral point at the rim would be meaningless
// out past the 3PT line). Falls back to a generic flat assumption if not given at all.
export function drawHeatmap(svg, shots, baseline = HEAT_MIDPOINT) {
  const points = shots.filter((s) => s.x !== undefined && s.y !== undefined);
  if (!points.length) return;

  const baselineAt = typeof baseline === 'function' ? baseline : () => baseline;

  const cells = [];
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
        cells.push({ gx, gy, pct: madeWeight / totalWeight, weight: totalWeight, baseline: baselineAt(gx, gy) });
      }
    }
  }

  // Stretch the color scale to whatever spread is actually present among the
  // reasonably-confident cells, instead of assuming a fixed spread - a small or
  // naturally tight-spread dataset still gets a fully-saturated hot and cold spot
  // rather than every cell landing close to neutral gray because none of them happen
  // to reach some fixed, arbitrary "very good"/"very bad" threshold.
  const meaningfulCells = cells.filter((c) => c.weight >= HEAT_CONFIDENCE_WEIGHT * 0.4);
  const reference = meaningfulCells.length ? meaningfulCells : cells;
  const maxAbove = Math.max(0.05, ...reference.map((c) => c.pct - c.baseline));
  const maxBelow = Math.max(0.05, ...reference.map((c) => c.baseline - c.pct));

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('id', 'heatmap');
  group.setAttribute('filter', 'url(#heat-blur)');
  cells.forEach((cell) => {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', (cell.gx - HEAT_GRID_STEP / 2).toFixed(2));
    rect.setAttribute('y', (cell.gy - HEAT_GRID_STEP / 2).toFixed(2));
    rect.setAttribute('width', HEAT_GRID_STEP);
    rect.setAttribute('height', HEAT_GRID_STEP);
    rect.setAttribute('fill', normalizedDivergingColor(cell.pct, cell.baseline, maxAbove, maxBelow));
    // Capped below 1.0 so even a fully-confident area stays a wash rather than a solid
    // mask - keeps it reading as a heatmap over the court, not a poster on top of it.
    const confidence = Math.pow(cell.weight / HEAT_CONFIDENCE_WEIGHT, HEAT_OPACITY_CURVE);
    rect.setAttribute('opacity', Math.min(HEAT_MAX_OPACITY, confidence).toFixed(2));
    group.appendChild(rect);
  });
  svg.appendChild(group);
  redrawCourtLinesOnTop(svg);
}
