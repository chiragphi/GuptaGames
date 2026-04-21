// LuckyDev Casino — Dice (over/under with win chance slider)

const Dice = (() => {
  let betAmount = 10;
  let winChance = 50; // percent
  let overUnder = 'over'; // over = roll above threshold
  let rolling = false;
  let lastResult = null;

  function getMultiplier(chance) {
    // House edge 2%
    return parseFloat(((100 / chance) * 0.98).toFixed(4));
  }

  function getThreshold(chance, mode) {
    if (mode === 'over') return 100 - chance;
    return chance;
  }

  function roll() {
    if (rolling) return;
    if (!Core.canBet(betAmount)) {
      showToast('info', 'Insufficient chips', 'Not enough chips.', 'warning');
      return;
    }

    rolling = true;
    Core.placeBet(betAmount);
    Audio.playDiceRoll();

    // Animate dice faces
    let count = 0;
    const animInterval = setInterval(() => {
      count++;
      showRandomDiceFace();
      if (count > 10) {
        clearInterval(animInterval);
        finishRoll();
        rolling = false;
      }
    }, 60);
  }

  function showRandomDiceFace() {
    const face1 = Math.ceil(Math.random() * 6);
    const face2 = Math.ceil(Math.random() * 6);
    const el1 = document.getElementById('dice-face-1');
    const el2 = document.getElementById('dice-face-2');
    if (el1) el1.innerHTML = `<svg class="icon" style="width:100%;height:100%;color:white" aria-hidden="true"><use href="#icon-dice-${face1}"/></svg>`;
    if (el2) el2.innerHTML = `<svg class="icon" style="width:100%;height:100%;color:white" aria-hidden="true"><use href="#icon-dice-${face2}"/></svg>`;
  }

  function finishRoll() {
    // ADDICTION: hot streak bias
    let rng = Math.random() * 100;
    if (Addiction.isHotStreak()) rng = Addiction.applyHotStreakBias(rng / 100) * 100;

    const threshold = getThreshold(winChance, overUnder);
    const win = overUnder === 'over' ? rng > threshold : rng < threshold;

    lastResult = parseFloat(rng.toFixed(2));
    const mult = getMultiplier(winChance);

    // Show result
    const resultEl = document.getElementById('dice-roll-result');
    if (resultEl) {
      resultEl.textContent = lastResult.toFixed(2);
      resultEl.style.color = win ? 'var(--green)' : 'var(--red)';
    }

    // Show die faces based on result
    const face1 = Math.ceil(lastResult / 100 * 6) || 1;
    const face2 = Math.ceil((100 - lastResult) / 100 * 6) || 1;
    const el1 = document.getElementById('dice-face-1');
    const el2 = document.getElementById('dice-face-2');
    if (el1) el1.innerHTML = `<svg class="icon" style="width:100%;height:100%;color:white" aria-hidden="true"><use href="#icon-dice-${face1}"/></svg>`;
    if (el2) el2.innerHTML = `<svg class="icon" style="width:100%;height:100%;color:white" aria-hidden="true"><use href="#icon-dice-${face2}"/></svg>`;

    const gameResult = document.getElementById('dice-result');

    if (win) {
      const winAmount = Math.floor(betAmount * mult);
      Core.resolveWin(winAmount, betAmount);
      Core.trackFirstWin();
      Addiction.onWin();
      Audio.playWin(winAmount);
      if (gameResult) { gameResult.textContent = `WIN! +${(winAmount - betAmount).toLocaleString()} chips`; gameResult.className = 'game-result win'; }
      if (winAmount > betAmount * 5) { goldFlash(); Particles.winShower(null, null, 16); }
      FirebaseDB.submitScore(Core.getState().username, Core.getBalance(), winAmount, 'Dice');
    } else {
      Core.resolveLoss();
      Addiction.onLoss();
      Audio.playLoss();
      if (gameResult) { gameResult.textContent = 'LOSE'; gameResult.className = 'game-result lose'; }
    }

    updateStats();
  }

  function updateStats() {
    const mult = getMultiplier(winChance);
    const multEl = document.getElementById('dice-multiplier');
    const winChanceEl = document.getElementById('dice-win-chance');
    const profitEl = document.getElementById('dice-profit');
    if (multEl) multEl.textContent = mult.toFixed(4) + 'x';
    if (winChanceEl) winChanceEl.textContent = winChance.toFixed(2) + '%';
    if (profitEl) profitEl.textContent = (Math.floor(betAmount * mult) - betAmount).toLocaleString();

    const slider = document.getElementById('win-chance-slider');
    if (slider) slider.value = winChance;
    const sliderVal = document.getElementById('win-chance-val');
    if (sliderVal) sliderVal.textContent = winChance.toFixed(2) + '%';

    const threshold = getThreshold(winChance, overUnder);
    const threshEl = document.getElementById('dice-threshold');
    if (threshEl) threshEl.textContent = threshold.toFixed(2);
  }

  function init() {
    updateStats();

    document.getElementById('dice-roll-btn')?.addEventListener('click', roll);

    // Spacebar hotkey
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !rolling && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        roll();
      }
    });

    // Slider
    document.getElementById('win-chance-slider')?.addEventListener('input', e => {
      winChance = Math.max(1, Math.min(95, parseFloat(e.target.value)));
      updateStats();
    });

    // Over/under toggle
    document.querySelectorAll('.over-under-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overUnder = btn.dataset.mode;
        document.querySelectorAll('.over-under-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateStats();
      });
    });

    // Bet
    const betInp = document.getElementById('dice-bet');
    betInp?.addEventListener('change', () => {
      betAmount = Math.max(1, Math.min(Core.getBalance(), parseInt(betInp.value) || 1));
      updateStats();
    });

    document.querySelectorAll('.dice-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        betAmount = parseInt(btn.dataset.val) || betAmount;
        if (betInp) betInp.value = betAmount;
        updateStats();
      });
    });
  }

  return { init };
})();
