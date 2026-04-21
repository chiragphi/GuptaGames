// LuckyDev Casino — Core Module
// Manages: balance, XP, levels, achievements, missions, persistence

const Core = (() => {
  // ===== CONSTANTS =====
  const STARTING_CHIPS = 1000;
  const REBUY_AMOUNT = 500;
  const MAX_REBUYS = 3;
  const REBUY_COOLDOWN_MS = 10 * 60 * 1000;

  const LEVELS = [
    { name: 'Bronze',   min: 0,      max: 500,   badge: 'chip-bronze', class: 'bronze'    },
    { name: 'Silver',   min: 500,    max: 1500,  badge: 'chip-silver', class: 'silver'    },
    { name: 'Gold',     min: 1500,   max: 4000,  badge: 'chip-gold',   class: 'gold-badge'},
    { name: 'Platinum', min: 4000,   max: 10000, badge: 'gem',         class: 'platinum'  },
    { name: 'Diamond',  min: 10000,  max: 30000, badge: 'diamond',     class: 'diamond'   },
    { name: 'LEGEND',   min: 30000,  max: Infinity, badge: 'crown',    class: 'legend'    },
  ];

  const XP_PER_CHIP_BET = 0.1;
  const XP_LEVEL_THRESHOLDS = [0, 100, 300, 700, 1500, 3000, 6000, 10000, 20000, 50000];

  const ACHIEVEMENTS = [
    { id: 'first_win',      name: 'First Win',       desc: 'Win your first game',                      icon: 'trophy',   xp: 50  },
    { id: 'high_roller',    name: 'High Roller',      desc: 'Place a bet of 500 or more',               icon: 'coin',     xp: 100 },
    { id: 'comeback_kid',   name: 'Comeback Kid',     desc: 'Win after dropping below 100 chips',        icon: 'star',     xp: 150 },
    { id: 'whale',          name: 'Whale',            desc: 'Place a single bet of 1000+',              icon: 'crown',    xp: 200 },
    { id: 'lucky_7',        name: 'Lucky Seven',      desc: 'Win 7 games in a row',                     icon: 'seven',    xp: 250 },
    { id: 'jackpot',        name: 'Jackpot!',         desc: 'Hit the slots jackpot',                    icon: 'lightning',xp: 500 },
    { id: 'diamond_hands',  name: 'Diamond Hands',    desc: 'Cash out crash at 10x or higher',          icon: 'diamond',  xp: 300 },
    { id: 'minesweeper',    name: 'Defused',          desc: 'Clear 20 safe tiles in mines',             icon: 'shield',   xp: 150 },
    { id: 'twenty_one',     name: 'Natural 21',       desc: 'Hit a natural blackjack',                  icon: 'card',     xp: 200 },
    { id: 'roulette_red',   name: 'Seeing Red',       desc: 'Win 5 red bets in a row',                  icon: 'card-heart',xp: 150},
    { id: 'plinko_max',     name: 'Sky High',         desc: 'Hit a 1000x multiplier in plinko',         icon: 'star',     xp: 500 },
    { id: 'level_up',       name: 'Level Up',         desc: 'Reach Silver level',                       icon: 'chip-silver',xp:100},
    { id: 'gold_level',     name: 'Gold Status',      desc: 'Reach Gold level',                         icon: 'chip-gold',xp: 200},
    { id: 'big_win',        name: 'Big Winner',       desc: 'Win 1000+ chips in a single bet',          icon: 'trophy',   xp: 300 },
    { id: 'loyal',          name: 'Loyal Player',     desc: 'Login 7 days in a row',                    icon: 'fire',     xp: 300 },
    { id: 'tower_10',       name: 'Tower Master',     desc: 'Reach level 10 in Towers',                 icon: 'sword',    xp: 200 },
    { id: 'royal_flush',    name: 'Royal Flush',      desc: 'Hit a Royal Flush in Video Poker',         icon: 'card',     xp: 500 },
    { id: 'coin_streak',    name: 'On a Roll',        desc: 'Win 5 coin flips in a row',                icon: 'coin',     xp: 150 },
    { id: 'loss_disguised', name: 'Technically Won',  desc: 'Win a bet that pays less than the wager',  icon: 'wink',     xp: 50  },
    { id: 'first_rebuy',    name: 'Down But Not Out', desc: 'Use your first rebuy',                     icon: 'lightning-bolt', xp: 50 },
  ];

  // ===== STATE =====
  let state = {
    username: '',
    balance: STARTING_CHIPS,
    xp: 0,
    xpLevel: 1,
    tier: 0,
    achievements: {},
    missions: [],
    missionDate: '',
    streak: 0,
    lastLogin: '',
    rebuys: 0,
    lastRebuy: 0,
    totalWon: 0,
    totalLost: 0,
    totalBet: 0,
    biggestWin: 0,
    gamesPlayed: 0,
    gameStats: {},
    sessionStart: Date.now(),
    sessionBets: 0,
    sessionWins: 0,
    lastSessionResult: null,
    consecutiveWins: 0,
    consecutiveLosses: 0,
    redWinStreak: 0,
    coinFlipStreak: 0,
    safesMines: 0,
    chatMessages: [],
  };

  let balanceEl = null;
  let xpFillEl = null;
  let xpLevelEl = null;
  let onBalanceChange = null;

  // ===== PERSISTENCE =====
  function save() {
    try { localStorage.setItem('luckydev_state', JSON.stringify(state)); } catch(e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem('luckydev_state');
      if (raw) {
        const saved = JSON.parse(raw);
        state = { ...state, ...saved };
      }
    } catch(e) {}

    // Check login streak
    const today = new Date().toDateString();
    if (state.lastLogin !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (state.lastLogin === yesterday) {
        state.streak = (state.streak || 0) + 1;
      } else if (state.lastLogin && state.lastLogin !== today) {
        state.streak = 1; // reset
      } else {
        state.streak = Math.max(state.streak || 1, 1);
      }
      state.lastLogin = today;
      save();
    }

    // Ensure username
    if (!state.username) {
      state.username = 'Player' + Math.floor(Math.random() * 9000 + 1000);
      save();
    }

    // Daily missions
    ensureMissions();
  }

  // ===== MISSIONS =====
  const MISSION_TEMPLATES = [
    { id: 'm_bet5',    name: 'Gambler',      desc: 'Place 5 bets',              target: 5,   reward: 50,  type: 'bets',   icon: 'coin'       },
    { id: 'm_win3',    name: 'Winner',       desc: 'Win 3 times',               target: 3,   reward: 75,  type: 'wins',   icon: 'trophy'     },
    { id: 'm_slots',   name: 'Slot Addict',  desc: 'Spin the slots 10 times',   target: 10,  reward: 100, type: 'slots',  icon: 'seven'      },
    { id: 'm_crash2x', name: 'Safe Landing', desc: 'Cash out crash above 2x',   target: 1,   reward: 80,  type: 'crash2x',icon: 'lightning'  },
    { id: 'm_bj',      name: 'Card Shark',   desc: 'Play 5 blackjack hands',    target: 5,   reward: 90,  type: 'bj',     icon: 'card'       },
    { id: 'm_mines5',  name: 'Defuser',      desc: 'Reveal 5 safe mine tiles',  target: 5,   reward: 70,  type: 'mines',  icon: 'shield'     },
    { id: 'm_streak3', name: 'On Fire',      desc: 'Win 3 games in a row',      target: 3,   reward: 120, type: 'streak', icon: 'fire'       },
    { id: 'm_500',     name: 'High Roller',  desc: 'Bet 500 chips total',       target: 500, reward: 60,  type: 'betamt', icon: 'chip-gold'  },
    { id: 'm_plinko',  name: 'Gravity Test', desc: 'Drop 5 plinko balls',       target: 5,   reward: 80,  type: 'plinko', icon: 'star'       },
    { id: 'm_roul',    name: 'Lucky Spin',   desc: 'Place 3 roulette bets',     target: 3,   reward: 70,  type: 'roul',   icon: 'coin'       },
  ];

  function ensureMissions() {
    const today = new Date().toDateString();
    if (state.missionDate !== today) {
      state.missionDate = today;
      const shuffled = [...MISSION_TEMPLATES].sort(() => Math.random() - 0.5);
      state.missions = shuffled.slice(0, 3).map(t => ({ ...t, progress: 0, done: false }));
      save();
    }
  }

  function progressMission(type, amount = 1) {
    let changed = false;
    state.missions.forEach(m => {
      if (m.done) return;
      if (m.type === type) {
        m.progress = Math.min(m.progress + amount, m.target);
        if (m.progress >= m.target) {
          m.done = true;
          addBalance(m.reward, false);
          changed = true;
          if (window.showToast) {
            showToast('mission', 'Mission Complete!', `${m.name} — +${m.reward} chips`, 'checkmark');
          }
          checkAchievement('missions_done');
        }
      }
    });
    if (changed) save();
  }

  // ===== BALANCE =====
  function getBalance() { return state.balance; }

  function setBalanceEl(el) { balanceEl = el; }
  function setXPEls(fill, label) { xpFillEl = fill; xpLevelEl = label; }
  function setOnBalanceChange(fn) { onBalanceChange = fn; }

  function updateBalanceUI(oldBal, newBal) {
    if (!balanceEl) return;
    const display = balanceEl.querySelector('.balance-amount') || balanceEl;
    let count = oldBal;
    const diff = newBal - oldBal;
    const steps = Math.min(Math.abs(diff), 60);
    const step = diff / steps;
    let i = 0;

    display.classList.toggle('gaining', diff > 0);
    display.classList.toggle('losing', diff < 0);
    display.classList.add('balance-tick');
    setTimeout(() => display.classList.remove('balance-tick'), 300);

    const tick = () => {
      i++;
      count += step;
      display.textContent = Math.round(count).toLocaleString();
      if (i < steps) requestAnimationFrame(tick);
      else {
        display.textContent = newBal.toLocaleString();
        setTimeout(() => {
          display.classList.remove('gaining', 'losing');
        }, 600);
      }
    };
    requestAnimationFrame(tick);

    if (onBalanceChange) onBalanceChange(newBal, diff);
  }

  function addBalance(amount, triggerUi = true) {
    const old = state.balance;
    state.balance = Math.max(0, state.balance + amount);
    if (triggerUi) updateBalanceUI(old, state.balance);
    save();
    return state.balance;
  }

  function canBet(amount) {
    return amount > 0 && amount <= state.balance;
  }

  function placeBet(amount) {
    if (!canBet(amount)) return false;
    state.balance -= amount;
    state.totalBet += amount;
    state.sessionBets++;
    updateBalanceUI(state.balance + amount, state.balance);
    progressMission('bets');
    progressMission('betamt', amount);
    addXP(Math.floor(amount * XP_PER_CHIP_BET));
    checkAchievement('high_roller', () => amount >= 500);
    checkAchievement('whale', () => amount >= 1000);
    save();
    return true;
  }

  function resolveWin(amount, betAmount) {
    const net = amount - betAmount; // net gain
    addBalance(amount);
    state.totalWon += amount;
    state.sessionWins++;
    state.consecutiveWins++;
    state.consecutiveLosses = 0;

    if (amount > state.biggestWin) {
      state.biggestWin = amount;
      checkAchievement('big_win', () => amount >= 1000);
    }

    progressMission('wins');

    // streak achievements
    checkAchievement('lucky_7', () => state.consecutiveWins >= 7);
    checkAchievement('streak3_mission', () => state.consecutiveWins >= 3);
    if (state.consecutiveWins >= 3) progressMission('streak', 0); // will be capped

    // comeback kid
    if (state.balance - amount < 100) checkAchievement('comeback_kid');

    // loss disguised as win
    if (amount > 0 && amount < betAmount) checkAchievement('loss_disguised');

    save();
    return amount;
  }

  function resolveLoss() {
    state.totalLost += 1;
    state.consecutiveLosses++;
    state.consecutiveWins = 0;
    save();
  }

  // ===== XP & LEVELS =====
  function addXP(amount) {
    state.xp += amount;
    const oldLevel = state.xpLevel;

    while (state.xpLevel < XP_LEVEL_THRESHOLDS.length - 1 &&
           state.xp >= XP_LEVEL_THRESHOLDS[state.xpLevel]) {
      state.xpLevel++;
    }

    if (state.xpLevel > oldLevel && window.showToast) {
      showToast('level', 'Level Up!', `You reached level ${state.xpLevel}!`, 'lightning-bolt');
      unlockLevelReward(state.xpLevel);
    }

    updateXPBar();
    updateTier();
    save();
  }

  function updateXPBar() {
    if (!xpFillEl || !xpLevelEl) return;
    const cur = XP_LEVEL_THRESHOLDS[state.xpLevel - 1] || 0;
    const next = XP_LEVEL_THRESHOLDS[state.xpLevel] || XP_LEVEL_THRESHOLDS[XP_LEVEL_THRESHOLDS.length - 1];
    const pct = Math.min(100, ((state.xp - cur) / (next - cur)) * 100);
    xpFillEl.style.width = pct + '%';
    if (xpLevelEl) xpLevelEl.textContent = 'Lv.' + state.xpLevel;
  }

  function updateTier() {
    const oldTier = state.tier;
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (state.xp >= LEVELS[i].min) { state.tier = i; break; }
    }
    if (state.tier > oldTier) {
      const lvl = LEVELS[state.tier];
      if (window.showToast) {
        showToast('level', `Tier Up! ${lvl.name}`, `You unlocked the ${lvl.name} tier!`, lvl.badge);
      }
      const bonuses = [0, 200, 500, 1000, 2000, 5000];
      addBalance(bonuses[state.tier] || 0);
      checkAchievement('level_up');
      checkAchievement('gold_level', () => state.tier >= 2);
    }
  }

  function unlockLevelReward(level) {
    const rewards = { 3: 150, 5: 300, 7: 500, 10: 1000 };
    if (rewards[level]) addBalance(rewards[level]);
  }

  // ===== ACHIEVEMENTS =====
  function checkAchievement(id, condition) {
    if (state.achievements[id]) return false;
    if (condition && !condition()) return false;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return false;
    state.achievements[id] = Date.now();
    addXP(def.xp);
    save();
    if (window.showToast) {
      showToast('achieve', 'Achievement Unlocked!', def.name + ' — ' + def.desc, def.icon);
    }
    return true;
  }

  function hasAchievement(id) { return !!state.achievements[id]; }

  // ===== REBUY =====
  function canRebuy() {
    if (state.balance > 50) return false;
    if (state.rebuys >= MAX_REBUYS) return false;
    if (Date.now() - state.lastRebuy < REBUY_COOLDOWN_MS && state.lastRebuy > 0) return false;
    return true;
  }

  function rebuy() {
    if (!canRebuy()) return false;
    state.rebuys++;
    state.lastRebuy = Date.now();
    addBalance(REBUY_AMOUNT);
    checkAchievement('first_rebuy');
    save();
    return true;
  }

  function rebuyTimeLeft() {
    const remaining = (state.lastRebuy + REBUY_COOLDOWN_MS) - Date.now();
    return Math.max(0, remaining);
  }

  // ===== SESSION SUMMARY =====
  function getSessionSummary() {
    return {
      duration: Math.floor((Date.now() - state.sessionStart) / 1000),
      bets: state.sessionBets,
      wins: state.sessionWins,
      biggestWin: state.biggestWin,
      balance: state.balance,
    };
  }

  // ===== GAME-SPECIFIC TRACKERS =====
  function trackSlotSpin() { progressMission('slots'); }
  function trackCrashCashout(mult) { if (mult >= 2) progressMission('crash2x'); }
  function trackBJHand() { progressMission('bj'); }
  function trackMineSafe() {
    state.safesMines++;
    progressMission('mines');
    checkAchievement('minesweeper', () => state.safesMines >= 20);
  }
  function trackPlinko() { progressMission('plinko'); }
  function trackRoulette() { progressMission('roul'); }
  function trackCoinFlipWin() {
    state.coinFlipStreak = (state.coinFlipStreak || 0) + 1;
    checkAchievement('coin_streak', () => state.coinFlipStreak >= 5);
  }
  function trackCoinFlipLoss() { state.coinFlipStreak = 0; }
  function trackFirstWin() { checkAchievement('first_win'); }
  function trackBlackjack() { checkAchievement('twenty_one'); }
  function trackRedWin() {
    state.redWinStreak = (state.redWinStreak || 0) + 1;
    checkAchievement('roulette_red', () => state.redWinStreak >= 5);
  }
  function trackRedLoss() { state.redWinStreak = 0; }
  function trackDiamondHands(mult) { if (mult >= 10) checkAchievement('diamond_hands'); }
  function trackPlinkoMax() { checkAchievement('plinko_max'); }
  function trackTower10(level) { if (level >= 10) checkAchievement('tower_10'); }
  function trackRoyalFlush() { checkAchievement('royal_flush'); }
  function trackStreak3() { if (state.consecutiveWins >= 3) progressMission('streak'); }

  // ===== GETTERS =====
  function getState() { return state; }
  function getLevel() { return LEVELS[state.tier]; }
  function getAchievements() { return ACHIEVEMENTS; }
  function getMissions() { return state.missions; }
  function getLevels() { return LEVELS; }
  function getXPInfo() {
    const cur = XP_LEVEL_THRESHOLDS[state.xpLevel - 1] || 0;
    const next = XP_LEVEL_THRESHOLDS[state.xpLevel] || 9999;
    return { xp: state.xp, level: state.xpLevel, cur, next };
  }

  // ===== INIT =====
  function init() {
    load();
    // Check if low balance on return
    if (state.balance === 0 && canRebuy()) {
      setTimeout(() => {
        if (window.showModal) showModal('rebuy');
      }, 1000);
    }

    // Lonely chips message
    const lastVisit = state.lastLogin;
    const today = new Date().toDateString();
    if (lastVisit && lastVisit !== today) {
      setTimeout(() => {
        if (window.showToast) {
          showToast('info', 'Welcome back!', 'Your chips missed you! Last session: ' + state.biggestWin + ' chip best win.', 'coin');
        }
      }, 3000);
    }
  }

  return {
    init, save, load, getState, getBalance, addBalance, canBet, placeBet,
    resolveWin, resolveLoss, addXP, checkAchievement, hasAchievement,
    canRebuy, rebuy, rebuyTimeLeft, getSessionSummary,
    setBalanceEl, setXPEls, setOnBalanceChange, updateBalanceUI, updateXPBar,
    getLevel, getAchievements, getMissions, getLevels, getXPInfo,
    trackSlotSpin, trackCrashCashout, trackBJHand, trackMineSafe, trackPlinko,
    trackRoulette, trackCoinFlipWin, trackCoinFlipLoss, trackFirstWin,
    trackBlackjack, trackRedWin, trackRedLoss, trackDiamondHands, trackPlinkoMax,
    trackTower10, trackRoyalFlush, trackStreak3, progressMission,
    LEVELS, ACHIEVEMENTS,
  };
})();

// ===== TOAST SYSTEM =====
function showToast(type, title, msg, icon) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `
    <svg class="toast-icon icon" aria-hidden="true"><use href="#icon-${icon}"/></svg>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg class="icon" aria-hidden="true"><use href="#icon-close"/></svg>
    </button>`;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('hiding');
    setTimeout(() => t.remove(), 300);
  }, 4000);
}
window.showToast = showToast;

// ===== MODAL SYSTEM =====
function showModal(type) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  if (!overlay || !content) return;

  if (type === 'rebuy') {
    const state = Core.getState();
    content.innerHTML = `
      <div class="modal-title">Out of Chips?</div>
      <div style="text-align:center;margin-bottom:20px">
        <svg class="icon" style="width:64px;height:64px;color:var(--gold)" aria-hidden="true"><use href="#icon-coin"/></svg>
      </div>
      <p style="text-align:center;color:var(--text-sec);margin-bottom:20px">
        Get ${500} chips to keep playing!<br>
        Rebuys used: ${state.rebuys}/${3}
      </p>
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="btn btn-gold" onclick="doRebuy()">Get 500 Chips</button>
        <button class="btn btn-ghost" onclick="closeModal()">No Thanks</button>
      </div>`;
  }

  overlay.classList.add('open');
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

function doRebuy() {
  if (Core.rebuy()) {
    showToast('win', 'Rebuy Successful!', 'You received 500 chips!', 'coin');
    closeModal();
  } else {
    showToast('info', 'Cannot Rebuy', 'Cooldown active or limit reached.', 'warning');
  }
}

window.showModal = showModal;
window.closeModal = closeModal;
window.doRebuy = doRebuy;

// ===== JACKPOT OVERLAY =====
function showJackpot(amount) {
  const overlay = document.getElementById('jackpot-overlay');
  if (!overlay) return;
  overlay.classList.add('active');
  const amtEl = overlay.querySelector('.jackpot-amount');
  if (amtEl) amtEl.textContent = '+' + amount.toLocaleString() + ' CHIPS';
  Audio && Audio.playJackpot && Audio.playJackpot();
  setTimeout(() => overlay.classList.remove('active'), 6000);
}
window.showJackpot = showJackpot;

// ===== SCREEN SHAKE =====
function shakeScreen() {
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 600);
}
window.shakeScreen = shakeScreen;

// ===== GOLD FLASH =====
function goldFlash() {
  document.body.classList.add('gold-flash');
  setTimeout(() => document.body.classList.remove('gold-flash'), 800);
}
window.goldFlash = goldFlash;

// ===== SESSION END SUMMARY =====
window.addEventListener('beforeunload', () => {
  const s = Core.getSessionSummary();
  Core.getState().lastSessionResult = s;
  Core.save();
});
