// LuckyDev Casino — Firebase Realtime Database Module

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBkok672ukiiFdpSWdXrVhkJWu4fDNEeVw",
  authDomain: "gamew-6cd14.firebaseapp.com",
  databaseURL: "https://gamew-6cd14-default-rtdb.firebaseio.com",
  projectId: "gamew-6cd14",
  storageBucket: "gamew-6cd14.firebasestorage.app",
  messagingSenderId: "634476044291",
  appId: "1:634476044291:web:83732c9b663693c584ae36",
  measurementId: "G-RM60ZGNTEF"
};

let db = null;
let firebaseReady = false;

// ===== INIT =====
async function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded — leaderboard disabled');
      return false;
    }
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    firebaseReady = true;
    if (window.Auth) Auth.init();
    return true;
  } catch(e) {
    console.warn('Firebase init failed:', e);
    return false;
  }
}

// ===== LEADERBOARD =====
async function submitScore(username, balance, biggestWin, game) {
  if (!firebaseReady || !db) return;
  try {
    const state = Core.getState();
    const ref = db.ref(`leaderboard/${username.replace(/[.#$[\]]/g, '_')}`);
    const snap = await ref.once('value');
    const existing = snap.val() || {};

    // Only update if new high score
    if (!existing.balance || balance > existing.balance) {
      await ref.set({
        username,
        balance,
        biggestWin: Math.max(biggestWin, existing.biggestWin || 0),
        level: state.tier,
        xp: state.xp,
        gamesPlayed: state.gamesPlayed || 0,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
      });
    }

    // Only log wins with a real game name
    if (biggestWin > 0 && game) {
      const winRef = db.ref('biggest_wins').push();
      await winRef.set({
        username,
        amount: biggestWin,
        game,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
      });

      // Activity feed — only real game wins
      await db.ref('activity').push({
        player: username,
        amount: biggestWin,
        game,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
      });
    }

  } catch(e) {
    console.warn('Firebase submit failed:', e);
  }
}

// ===== GET LEADERBOARD =====
async function getLeaderboard(limit = 50) {
  if (!firebaseReady || !db) return getMockLeaderboard();
  try {
    const snap = await db.ref('leaderboard').orderByChild('balance').limitToLast(limit).once('value');
    const rows = [];
    snap.forEach(child => rows.push({ id: child.key, ...child.val() }));
    return rows.reverse(); // highest first
  } catch(e) {
    return getMockLeaderboard();
  }
}

// ===== GET BIGGEST WINS =====
async function getBiggestWins(limit = 10) {
  if (!firebaseReady || !db) return getMockBiggestWins();
  try {
    const snap = await db.ref('biggest_wins').orderByChild('amount').limitToLast(limit).once('value');
    const rows = [];
    snap.forEach(child => rows.push({ id: child.key, ...child.val() }));
    return rows.reverse();
  } catch(e) {
    return getMockBiggestWins();
  }
}

// ===== PROGRESSIVE JACKPOT =====
async function getJackpot() {
  if (!firebaseReady || !db) return 5000 + Math.floor(Math.random() * 50000);
  try {
    const snap = await db.ref('jackpot').once('value');
    return snap.val() || 50000;
  } catch(e) {
    return 50000;
  }
}

async function incrementJackpot(amount) {
  if (!firebaseReady || !db) return;
  try {
    await db.ref('jackpot').transaction(current => (current || 50000) + amount);
  } catch(e) {}
}

async function resetJackpot() {
  if (!firebaseReady || !db) return;
  try {
    await db.ref('jackpot').set(10000);
  } catch(e) {}
}

// ===== SUBSCRIBE TO JACKPOT =====
function subscribeJackpot(callback) {
  if (!firebaseReady || !db) return () => {};
  const ref = db.ref('jackpot');
  ref.on('value', snap => callback(snap.val() || 50000));
  return () => ref.off('value');
}

// ===== ACTIVITY FEED =====
function subscribeActivity(callback, limit = 20) {
  if (!firebaseReady || !db) return () => {};
  const ref = db.ref('activity').orderByChild('timestamp').limitToLast(limit);
  ref.on('value', snap => {
    const items = [];
    snap.forEach(child => items.push({ id: child.key, ...child.val() }));
    callback(items.reverse());
  });
  return () => ref.off('value');
}

// ===== MOCK DATA (shown when Firebase unavailable) =====
function getMockLeaderboard() {
  const names = ['SlotKing','GoldRush22','LuckyAce','DiamondHnd','CrashPro','BetMaster','RoyalFlush','WildCard88','HighRoller','JackpotJoe'];
  return names.map((n, i) => ({
    username: n,
    balance: Math.floor(50000 / (i + 1) * (0.9 + Math.random() * 0.2)),
    biggestWin: Math.floor(10000 / (i + 1) * (0.8 + Math.random() * 0.4)),
    level: Math.max(0, 5 - i),
    xp: Math.floor(30000 / (i + 1)),
    gamesPlayed: Math.floor(500 - i * 40),
  }));
}

function getMockBiggestWins() {
  const names = ['SlotKing','GoldRush22','LuckyAce','DiamondHnd','CrashPro','BetMaster','RoyalFlush','WildCard88','HighRoller','JackpotJoe'];
  const games = ['Slots','Crash','Plinko','Blackjack','Roulette'];
  return names.map((n, i) => ({
    username: n,
    amount: Math.floor(15000 / (i * 0.5 + 1) * (0.8 + Math.random() * 0.4)),
    game: games[i % games.length],
  }));
}

// ===== LEADERBOARD AUTO-REFRESH =====
function autoRefreshLeaderboard(renderFn, interval = 8000) {
  renderFn();
  return setInterval(renderFn, interval);
}

const FirebaseDB = {
  init: initFirebase,
  submitScore,
  getLeaderboard,
  getBiggestWins,
  getJackpot,
  incrementJackpot,
  resetJackpot,
  subscribeJackpot,
  subscribeActivity,
  autoRefreshLeaderboard,
};

window.FirebaseDB = FirebaseDB;
