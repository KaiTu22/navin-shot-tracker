import { firebaseConfig, TRACKER_UID } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { zoneForPoint } from './court.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);

export const PLAYER_NAME = 'Navin';

// One tracker account -> one fixed scope, so any browser/device you sign into
// resolves to the same games (previously this was a random id stored in that
// browser's localStorage, which meant a new browser saw an empty Games list).
export const TRACKER_SCOPE_ID = TRACKER_UID;

function gamesCollection(scopeId) {
  return collection(db, 'scopes', scopeId, 'games');
}

function gameDoc(scopeId, gameId) {
  return doc(db, 'scopes', scopeId, 'games', gameId);
}

export function signInTracker(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutTracker() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function subscribeToGames(scopeId, callback, onError) {
  return onSnapshot(
    gamesCollection(scopeId),
    (snapshot) => {
      const games = snapshot.docs.map((docSnap) => normalizeGame(docSnap.id, docSnap.data()));
      callback(games);
    },
    onError
  );
}

function normalizeGame(id, data) {
  return {
    id,
    name: data.name || 'Game',
    opponent: data.opponent || '',
    venue: data.venue || '',
    league: data.league || '',
    date: data.date || '',
    time: data.time || '',
    periodMode: data.periodMode || 'full',
    currentPeriod: data.currentPeriod || 1,
    status: data.status || 'live',
    events: Array.isArray(data.events) ? data.events : []
  };
}

export function createGame(scopeId, meta) {
  return addDoc(gamesCollection(scopeId), {
    name: meta.name || 'Game',
    opponent: meta.opponent || '',
    venue: meta.venue || '',
    league: meta.league || '',
    date: meta.date || '',
    time: meta.time || '',
    periodMode: meta.periodMode || 'full',
    currentPeriod: 1,
    status: 'live',
    events: [],
    createdAt: serverTimestamp()
  });
}

export function updateGameMeta(scopeId, gameId, fields) {
  return updateDoc(gameDoc(scopeId, gameId), fields);
}

export function deleteGame(scopeId, gameId) {
  return deleteDoc(gameDoc(scopeId, gameId));
}

// One-time cleanup for browsers still pointed at a pre-account-scoping random
// scope id: copies its games into the fixed account scope, then removes the
// old copies. Returns the number of games migrated.
export async function migrateGames(oldScopeId, newScopeId) {
  const snapshot = await getDocs(gamesCollection(oldScopeId));
  for (const docSnap of snapshot.docs) {
    await addDoc(gamesCollection(newScopeId), docSnap.data());
    await deleteDoc(docSnap.ref);
  }
  return snapshot.docs.length;
}

export function endPeriod(scopeId, gameId, nextPeriod) {
  return updateDoc(gameDoc(scopeId, gameId), { currentPeriod: nextPeriod });
}

function withEventDefaults(event, period) {
  return { ...event, period, ts: Date.now() + Math.random() };
}

export function appendEvent(scopeId, gameId, event, period) {
  return updateDoc(gameDoc(scopeId, gameId), {
    events: arrayUnion(withEventDefaults(event, period))
  });
}

export function logShot(scopeId, gameId, { x, y, shotType, result }, period) {
  return appendEvent(
    scopeId,
    gameId,
    { type: 'shot', shotType, result, x, y, zone: zoneForPoint(x, y) },
    period
  );
}

export function undoLastEvent(scopeId, gameId, events) {
  if (!events.length) return Promise.resolve();
  const last = events[events.length - 1];
  return updateDoc(gameDoc(scopeId, gameId), { events: arrayRemove(last) });
}

// --- Derived stats (event log is the single source of truth) ---

export function getShotSummary(events) {
  const summary = {
    overallAttempts: 0, overallMakes: 0,
    twoAttempts: 0, twoMakes: 0,
    threeAttempts: 0, threeMakes: 0,
    freeAttempts: 0, freeMakes: 0
  };

  for (const event of events) {
    if (event.type === 'shot') {
      const isMake = event.result === 'make';
      summary.overallAttempts += 1;
      if (isMake) summary.overallMakes += 1;
      if (event.shotType === '2PT') {
        summary.twoAttempts += 1;
        if (isMake) summary.twoMakes += 1;
      } else if (event.shotType === '3PT') {
        summary.threeAttempts += 1;
        if (isMake) summary.threeMakes += 1;
      }
    } else if (event.type === 'freeThrow') {
      summary.freeAttempts += 1;
      if (event.result === 'make') summary.freeMakes += 1;
    }
  }

  summary.overallPct = summary.overallAttempts ? summary.overallMakes / summary.overallAttempts : 0;
  summary.twoPct = summary.twoAttempts ? summary.twoMakes / summary.twoAttempts : 0;
  summary.threePct = summary.threeAttempts ? summary.threeMakes / summary.threeAttempts : 0;
  summary.freePct = summary.freeAttempts ? summary.freeMakes / summary.freeAttempts : 0;
  summary.points = summary.twoMakes * 2 + summary.threeMakes * 3 + summary.freeMakes;
  return summary;
}

export function getCountStats(events) {
  const counts = {
    assists: 0, steals: 0, turnovers: 0, blocks: 0,
    offensiveRebounds: 0, defensiveRebounds: 0, totalRebounds: 0,
    offensiveFouls: 0, defensiveFouls: 0, fouls: 0
  };

  for (const event of events) {
    if (event.type === 'assist') counts.assists += 1;
    else if (event.type === 'steal') counts.steals += 1;
    else if (event.type === 'turnover') counts.turnovers += 1;
    else if (event.type === 'block') counts.blocks += 1;
    else if (event.type === 'rebound') {
      counts.totalRebounds += 1;
      if (event.reboundType === 'offensive') counts.offensiveRebounds += 1;
      else counts.defensiveRebounds += 1;
    } else if (event.type === 'foul') {
      counts.fouls += 1;
      if (event.foulType === 'offensive') counts.offensiveFouls += 1;
      else counts.defensiveFouls += 1;
    }
  }
  return counts;
}

// Only real shot attempts carry a court location — free throws are excluded by construction.
export function getZoneStats(events) {
  const zoneStats = new Map();
  for (const event of events) {
    if (event.type !== 'shot' || !event.zone) continue;
    const entry = zoneStats.get(event.zone) || { attempts: 0, makes: 0 };
    entry.attempts += 1;
    if (event.result === 'make') entry.makes += 1;
    zoneStats.set(event.zone, entry);
  }
  return zoneStats;
}
