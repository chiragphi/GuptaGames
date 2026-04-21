// LuckyDev Casino — Addiction Psychology Module
// ADDICTION: Variable reward engine, near-miss, FOMO, streak systems

const Addiction = (() => {
  // ===== HOT STREAK ENGINE =====
  // ADDICTION: Invisible random bonus period — player never knows it's active
  let hotStreakActive = false;
  let hotStreakTimeout = null;

  function startHotStreakCycle() {
    const scheduleNext = () => {
      // ADDICTION: Hot streak fires every 3-10 minutes randomly
      const delay = (Math.random() * 7 + 3) * 60 * 1000;
      setTimeout(() => {
        activateHotStreak();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  function activateHotStreak() {
    hotStreakActive = true;
    // ADDICTION: Lasts 30-60 seconds, completely invisible to player
    const duration = (Math.random() * 30 + 30) * 1000;
    if (hotStreakTimeout) clearTimeout(hotStreakTimeout);
    hotStreakTimeout = setTimeout(() => { hotStreakActive = false; }, duration);
  }

  function isHotStreak() { return hotStreakActive; }

  // When hot streak is active, win probability gets a subtle boost
  // ADDICTION: Reinforces "I'm on a lucky streak" cognitive bias
  function applyHotStreakBias(rng) {
    if (!hotStreakActive) return rng;
    // Shift the RNG outcome slightly toward winning without making it obvious
    return rng * 0.82;
  }

  // ===== NEAR-MISS ENGINE =====
  // ADDICTION: Near-misses trigger almost identical dopamine response to real wins
  let nearMissChance = 0.28; // 28% of losses are near-misses

  function shouldNearMiss() {
    return Math.random() < nearMissChance;
  }

  // For slots: returns a symbol that's "close" to the winning symbol
  function getNearMissSymbol(winSymbol, allSymbols) {
    // ADDICTION: Show the winning symbol in adjacent reels, just miss the payline
    const idx = allSymbols.indexOf(winSymbol);
    const nearIdx = (idx + (Math.random() < 0.5 ? 1 : -1) + allSymbols.length) % allSymbols.length;
    return allSymbols[nearIdx];
  }

  // For plinko: bias ball toward adjacent high-value bucket
  function getPlinkoNearMissBucket(pegs) {
    // ADDICTION: Ball "almost" hits jackpot center, lands one spot away
    const center = Math.floor(pegs / 2);
    return center + (Math.random() < 0.5 ? 1 : -1);
  }

  // ===== RANDOM BONUS POPUP =====
  // ADDICTION: Unpredictable rewards create maximum engagement (variable ratio schedule)
  let bonusPopupScheduled = false;
  let bonusPopupShownAt = 0;

  function scheduleBonusPopup() {
    if (bonusPopupScheduled) return;
    bonusPopupScheduled = true;
    // ADDICTION: Fires randomly every 5-15 minutes of playtime
    const delay = (Math.random() * 10 + 5) * 60 * 1000;
    setTimeout(() => {
      bonusPopupScheduled = false;
      showBonusPopup();
      scheduleBonusPopup(); // reschedule
    }, delay);
  }

  function showBonusPopup() {
    // Don't show if less than 3 minutes since last
    if (Date.now() - bonusPopupShownAt < 3 * 60 * 1000) return;
    bonusPopupShownAt = Date.now();

    const popup = document.getElementById('bonus-popup');
    if (!popup) return;

    const amounts = [25, 50, 75, 100, 150];
    const amount = amounts[Math.floor(Math.random() * amounts.length)];

    popup.querySelector('.bonus-popup-amount').textContent = '+' + amount + ' CHIPS';
    popup.classList.add('visible');

    // ADDICTION: Store reward for claiming
    popup.dataset.amount = amount;

    Audio && Audio.playChime && Audio.playChime();
  }

  function claimBonusPopup() {
    const popup = document.getElementById('bonus-popup');
    if (!popup) return;
    const amount = parseInt(popup.dataset.amount || '0');
    if (amount > 0) {
      Core.addBalance(amount);
      showToast('win', 'Bonus Claimed!', `+${amount} chips added to your balance!`, 'coin');
    }
    popup.classList.remove('visible');
  }

  function dismissBonusPopup() {
    const popup = document.getElementById('bonus-popup');
    if (popup) popup.classList.remove('visible');
  }

  window.claimBonusPopup = claimBonusPopup;
  window.dismissBonusPopup = dismissBonusPopup;

  // ===== LOSS-DISGUISED-AS-WIN =====
  // ADDICTION: Celebrate any return, even below bet size, to create positive association
  function isLossDisguisedAsWin(payout, bet) {
    return payout > 0 && payout < bet;
  }

  function handleLossDisguised(payout, bet) {
    if (!isLossDisguisedAsWin(payout, bet)) return false;
    // Still trigger win animation even though net is negative
    if (window.goldFlash) goldFlash();
    Audio && Audio.playCoin && Audio.playCoin(0.3);
    Core.checkAchievement('loss_disguised');
    return true;
  }

  // ===== CONSECUTIVE LOSS POPUP =====
  // ADDICTION: "Your luck is about to turn" — Gambler's fallacy exploitation
  let lastLossCount = 0;

  function onLoss() {
    lastLossCount++;
    if (lastLossCount === 3) {
      setTimeout(showLuckyTurnPopup, 800);
    }
  }

  function onWin() {
    lastLossCount = 0;
  }

  function showLuckyTurnPopup() {
    // ADDICTION: Exploits gambler's fallacy — "due" for a win
    if (window.showToast) {
      showToast('info', 'Your luck is turning...', 'Statistically speaking, you\'re due for a win.', 'wink');
    }
  }

  // ===== ONLINE COUNTER (FOMO) =====
  // ADDICTION: Social proof via fake-but-realistic online count
  let onlineCount = 0;
  let onlineInterval = null;

  function startOnlineCounter(el) {
    if (!el) return;
    // ADDICTION: Start at realistic number, fluctuate naturally
    onlineCount = Math.floor(Math.random() * 400 + 600);
    updateOnlineDisplay(el);

    onlineInterval = setInterval(() => {
      // ADDICTION: Fluctuates ±5-15 to appear live
      const delta = Math.floor(Math.random() * 21) - 8;
      onlineCount = Math.max(400, Math.min(1200, onlineCount + delta));
      updateOnlineDisplay(el);
    }, 8000 + Math.random() * 4000);
  }

  function updateOnlineDisplay(el) {
    el.textContent = onlineCount.toLocaleString();
  }

  // ===== LIVE ACTIVITY FEED =====
  // ADDICTION: Real wins from Firebase + seeded fake entries to show constant activity
  const FAKE_PLAYERS = [
    'LuckyAce', 'GoldRush22', 'DiamondHnd', 'SlotKing', 'CrashPro',
    'BetMaster', 'WildCard88', 'RoyalFlush', 'CoinFlip7', 'JackpotJoe',
    'HighRoller', 'QuickDraw', 'LuckyLou', 'CasinoKing', 'WinnerWins',
    'BigBetBob', 'AllIn99', 'RiskItAll', 'PlayBig22', 'SpinMaster',
  ];

  const FAKE_GAMES = ['Slots', 'Crash', 'Plinko', 'Blackjack', 'Roulette', 'Mines', 'Dice'];

  const FAKE_AMOUNTS = [150, 280, 420, 680, 840, 1200, 1750, 2300, 3100, 4500, 6200, 8800, 12000];

  let feedMessages = [];

  function generateFakeActivity() {
    const player = FAKE_PLAYERS[Math.floor(Math.random() * FAKE_PLAYERS.length)];
    const game = FAKE_GAMES[Math.floor(Math.random() * FAKE_GAMES.length)];
    const amount = FAKE_AMOUNTS[Math.floor(Math.random() * FAKE_AMOUNTS.length)];
    return { player, game, amount };
  }

  function addRealActivity(player, game, amount) {
    feedMessages.push({ player, game, amount, real: true, time: Date.now() });
  }

  function buildTickerHTML(messages) {
    return messages.map(m =>
      `<span class="ticker-item">
        <span class="name">${m.player}</span>
        <span class="game"> won </span>
        <span class="amount">${m.amount.toLocaleString()} chips</span>
        <span class="game"> on ${m.game}</span>
      </span>`
    ).join('');
  }

  function startLiveFeed(tickerEl) {
    if (!tickerEl) return;

    // Seed initial fake messages
    const initial = Array.from({length: 20}, generateFakeActivity);
    const doubled = [...initial, ...initial]; // double for seamless loop
    tickerEl.innerHTML = buildTickerHTML(doubled);

    // ADDICTION: Inject real wins from Firebase occasionally
    setInterval(() => {
      const fake = generateFakeActivity();
      // Add to beginning, remove from end
      const spans = tickerEl.querySelectorAll('.ticker-item');
      const newSpan = document.createElement('span');
      newSpan.className = 'ticker-item';
      newSpan.innerHTML = `<span class="name">${fake.player}</span><span class="game"> won </span><span class="amount">${fake.amount.toLocaleString()} chips</span><span class="game"> on ${fake.game}</span>`;
      tickerEl.prepend(newSpan);
    }, 12000);
  }

  // ===== LEADERBOARD FOMO =====
  // ADDICTION: "You are X chips away from rank Y" — proximity trigger
  function showLeaderboardFOMO(userBalance, nearbyRankChips, nearbyRank) {
    const gap = nearbyRankChips - userBalance;
    if (gap > 0 && gap < 5000 && window.showToast) {
      showToast('info', 'So close!', `Only ${gap.toLocaleString()} chips away from rank ${nearbyRank}!`, 'trophy');
    }
  }

  // ===== STREAK WIDGET UPDATE =====
  function updateStreakDisplay() {
    const state = Core.getState();
    const streak = state.streak || 0;
    const el = document.getElementById('streak-count');
    if (el) el.textContent = streak;

    const bonus = document.getElementById('streak-bonus');
    if (bonus) {
      if (streak >= 7) bonus.textContent = 'CLAIM 7-DAY BONUS: +1000 chips!';
      else if (streak >= 3) bonus.textContent = `${7 - streak} more days for mega bonus!`;
      else bonus.textContent = 'Keep logging in daily!';
    }
  }

  // ===== DAILY STREAK BONUS =====
  function checkStreakBonus() {
    const state = Core.getState();
    if (state.streak === 7 && !state.achievements['loyal']) {
      Core.addBalance(1000);
      Core.checkAchievement('loyal');
      showToast('win', '7-Day Streak!', 'You earned 1000 bonus chips!', 'fire');
    }
  }

  // ===== COUNTDOWN TIMER =====
  function startMissionCountdown(el) {
    if (!el) return;
    const update = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = Math.floor((midnight - now) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      if (diff < 3600) el.classList.add('urgent');
    };
    update();
    setInterval(update, 1000);
  }

  // ===== LAST SESSION STATS =====
  function showLastSessionStats() {
    const state = Core.getState();
    const last = state.lastSessionResult;
    if (!last) return;
    // ADDICTION: "Last time you won X chips" — anchoring to past wins
    if (last.biggestWin > 0 && window.showToast) {
      setTimeout(() => {
        showToast('info', 'Welcome Back!', `Last session: best win was ${last.biggestWin.toLocaleString()} chips. Beat it today!`, 'trophy');
      }, 5000);
    }
  }

  // ===== INIT =====
  function init() {
    startHotStreakCycle();
    scheduleBonusPopup();
    updateStreakDisplay();
    checkStreakBonus();
    showLastSessionStats();

    const onlineEl = document.getElementById('online-count');
    startOnlineCounter(onlineEl);

    const tickerEl = document.getElementById('ticker-inner');
    startLiveFeed(tickerEl);

    const countdownEl = document.getElementById('mission-countdown');
    startMissionCountdown(countdownEl);
  }

  return {
    init,
    isHotStreak,
    applyHotStreakBias,
    shouldNearMiss,
    getNearMissSymbol,
    getPlinkoNearMissBucket,
    handleLossDisguised,
    isLossDisguisedAsWin,
    onLoss,
    onWin,
    showLeaderboardFOMO,
    addRealActivity,
    updateStreakDisplay,
  };
})();
