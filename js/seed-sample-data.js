// Dev-only helper for generating a large, realistic-looking synthetic season so the
// Hex/Heat/Zones/Rings charts can be evaluated with enough volume per cell to mean
// something. Not wired to any UI button on purpose - run from the browser console
// (window.seedSampleGames() / window.deleteSampleGames()) so it's never one accidental
// tap away from polluting real data. Every seeded game is named "[SAMPLE] ..." so
// cleanup is unambiguous.
import { createGame, updateGameMeta, appendEvent, logShot, deleteGame, GAME_CATEGORIES } from './data-store.js';
import { classifyShot } from './court.js';

const OPPONENTS = ['Central', 'Lincoln', 'Riverside', 'Eastview', 'Franklin', 'Jefferson', 'Madison', 'Wilson', 'Roosevelt', 'Hamilton'];

// A deliberately lopsided shot profile (strong right side and rim, weak left corner)
// so the resulting charts show real, visible spatial patterns instead of noise.
// { cx, cy, r }: a circular source region on the court (feet, hoop at 25,5.25).
// weight: relative share of total shot volume. pct: target make rate from there.
const SHOT_PROFILE = [
  { cx: 25, cy: 6, r: 2, weight: 0.3, pct: 0.62 }, // at the rim
  { cx: 29, cy: 12, r: 3, weight: 0.08, pct: 0.46 }, // right block
  { cx: 21, cy: 12, r: 3, weight: 0.05, pct: 0.4 }, // left block
  { cx: 33, cy: 15, r: 3, weight: 0.06, pct: 0.34 }, // right midrange
  { cx: 17, cy: 15, r: 3, weight: 0.04, pct: 0.28 }, // left midrange
  { cx: 46, cy: 6, r: 2, weight: 0.08, pct: 0.39 }, // right corner 3 (strong side)
  { cx: 4, cy: 6, r: 2, weight: 0.03, pct: 0.22 }, // left corner 3 (weak side, rarely used)
  { cx: 38, cy: 22, r: 3, weight: 0.12, pct: 0.37 }, // right wing 3
  { cx: 12, cy: 22, r: 3, weight: 0.05, pct: 0.29 }, // left wing 3
  { cx: 25, cy: 26, r: 3, weight: 0.09, pct: 0.33 }, // top of the key 3
  { cx: 25, cy: 20, r: 15, weight: 0.1, pct: 0.3 } // scattered/other
];

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function pickWeightedZone() {
  const total = SHOT_PROFILE.reduce((sum, z) => sum + z.weight, 0);
  let roll = Math.random() * total;
  for (const zone of SHOT_PROFILE) {
    if (roll < zone.weight) return zone;
    roll -= zone.weight;
  }
  return SHOT_PROFILE[0];
}

function randomShotPoint() {
  const zone = pickWeightedZone();
  const x = clamp(zone.cx + (Math.random() * 2 - 1) * zone.r, 0, 50);
  const y = clamp(zone.cy + (Math.random() * 2 - 1) * zone.r, 0, 41);
  return { x, y, pct: zone.pct };
}

function randomPeriod() {
  return 1 + Math.floor(Math.random() * 4);
}

function randomPastDate(maxDaysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * maxDaysAgo));
  return d.toISOString().slice(0, 10);
}

function buildStatEvents() {
  const events = [];
  const add = (count, payload) => {
    for (let i = 0; i < count; i++) events.push(payload);
  };
  add(1 + Math.floor(Math.random() * 4), { type: 'assist' });
  add(1 + Math.floor(Math.random() * 3), { type: 'steal' });
  add(Math.floor(Math.random() * 2), { type: 'block' });
  add(1 + Math.floor(Math.random() * 3), { type: 'turnover' });
  add(2 + Math.floor(Math.random() * 3), { type: 'rebound', reboundType: 'defensive' });
  add(Math.floor(Math.random() * 3), { type: 'rebound', reboundType: 'offensive' });
  add(Math.floor(Math.random() * 3), { type: 'foul', foulType: 'defensive' });
  return events;
}

export async function seedSampleGames(scopeId, gameCount = 20) {
  if (!scopeId) {
    console.error('Not signed in yet - sign in on the tracker page first.');
    return;
  }
  console.log(`Seeding ${gameCount} sample games (this writes real data to Firestore)...`);

  for (let i = 0; i < gameCount; i++) {
    const opponent = OPPONENTS[i % OPPONENTS.length];
    const docRef = await createGame(scopeId, {
      name: `[SAMPLE] Game ${i + 1}`,
      opponent,
      venue: i % 2 === 0 ? 'Home Gym' : `${opponent} Gym`,
      league: 'Sample Season',
      category: GAME_CATEGORIES[i % GAME_CATEGORIES.length],
      date: randomPastDate(120),
      time: '',
      periodMode: 'quarters'
    });
    const gameId = docRef.id;

    const shotCount = 14 + Math.floor(Math.random() * 9); // 14-22 per game
    const shotWrites = Array.from({ length: shotCount }, () => {
      const { x, y, pct } = randomShotPoint();
      const shotType = classifyShot(x, y);
      const result = Math.random() < pct ? 'make' : 'miss';
      return logShot(scopeId, gameId, { x, y, shotType, result }, randomPeriod());
    });

    const ftCount = 3 + Math.floor(Math.random() * 5); // 3-7 per game
    const ftWrites = Array.from({ length: ftCount }, () =>
      appendEvent(scopeId, gameId, { type: 'freeThrow', result: Math.random() < 0.72 ? 'make' : 'miss' }, randomPeriod())
    );

    const statWrites = buildStatEvents().map((evt) => appendEvent(scopeId, gameId, evt, randomPeriod()));

    await Promise.all([...shotWrites, ...ftWrites, ...statWrites]);
    await updateGameMeta(scopeId, gameId, { status: 'final' });
    console.log(`  [${i + 1}/${gameCount}] vs ${opponent}: ${shotCount} shots, ${ftCount} FTs logged`);
  }

  console.log('Done — open Insights (All Games) to see it filled in.');
}

export async function deleteSampleGames(scopeId, games) {
  const samples = games.filter((g) => g.name.startsWith('[SAMPLE]'));
  if (!samples.length) {
    console.log('No [SAMPLE] games found.');
    return;
  }
  console.log(`Deleting ${samples.length} sample games...`);
  await Promise.all(samples.map((g) => deleteGame(scopeId, g.id)));
  console.log('Done.');
}
