// LuckyDev Casino — Mines Game

const Mines = (() => {
  const GRID_SIZE = 25; // 5x5
  let mineCount = 5;
  let minePositions = new Set();
  let revealed = new Set();
  let active = false;
  let betAmount = 10;
  let baseMultiplier = 1.0;
  let currentMultiplier = 1.0;
  let safeCount = 0;

  const MULTIPLIER_TABLE = {
    1: [1.04,1.08,1.12,1.17,1.22,1.28,1.35,1.42,1.50,1.60,1.71,1.84,1.99,2.17,2.39,2.66,2.99,3.44,4.04,4.90,6.22,8.43,12.6,25.0,100],
    3: [1.12,1.27,1.45,1.67,1.94,2.27,2.67,3.17,3.80,4.60,5.65,7.04,8.91,11.5,15.2,20.7,29.1,43.2,67.8,115,220,500,1500,Infinity,Infinity],
    5: [1.22,1.54,1.97,2.56,3.37,4.49,6.07,8.33,11.6,16.5,24.0,35.8,55.0,88.0,148,262,500,1050,2500,7500,Infinity,Infinity,Infinity,Infinity,Infinity],
    10:[1.62,2.72,4.76,8.69,16.6,33.3,70.4,159,390,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity],
    20:[5.0,25.0,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity,Infinity],
  };

  function getMultiplier(mines, safe) {
    const table = MULTIPLIER_TABLE[mines] || MULTIPLIER_TABLE[5];
    return table[Math.min(safe, table.length - 1)] || table[table.length - 1];
  }

  function startGame() {
    if (active) return;
    betAmount = parseInt(document.getElementById('mines-bet')?.value) || 10;
    mineCount = parseInt(document.getElementById('mines-count')?.value) || 5;
    if (!Core.placeBet(betAmount)) {
      showToast('info', 'Insufficient chips', 'Not enough chips.', 'warning');
      return;
    }

    // Place mines
    minePositions.clear();
    revealed.clear();
    while (minePositions.size < mineCount) {
      minePositions.add(Math.floor(Math.random() * GRID_SIZE));
    }

    active = true;
    safeCount = 0;
    currentMultiplier = 1.0;
    renderGrid();
    updateStats();

    document.getElementById('mines-start')?.setAttribute('disabled', 'true');
    document.getElementById('mines-cashout')?.removeAttribute('disabled');
  }

  function revealTile(idx) {
    if (!active || revealed.has(idx)) return;
    revealed.add(idx);

    const tile = document.getElementById(`mine-tile-${idx}`);
    if (!tile) return;

    if (minePositions.has(idx)) {
      // BOOM
      tile.classList.add('revealed', 'bomb');
      tile.innerHTML = `<svg class="icon animate-mine-reveal" style="width:36px;height:36px" aria-hidden="true"><use href="#icon-skull"/></svg>`;
      revealAllMines();
      endGame(false);
    } else {
      // Safe
      tile.classList.add('revealed', 'safe');
      tile.innerHTML = `<svg class="icon animate-gem-reveal" style="width:36px;height:36px" aria-hidden="true"><use href="#icon-gem"/></svg>`;
      safeCount++;
      currentMultiplier = getMultiplier(mineCount, safeCount);
      Core.trackMineSafe();
      Audio.playCoin(0.8 + safeCount * 0.05);
      updateStats();

      // ADDICTION: check if last safe tile
      if (safeCount === GRID_SIZE - mineCount) {
        endGame(true);
      }
    }
  }

  function revealAllMines() {
    minePositions.forEach(idx => {
      const tile = document.getElementById(`mine-tile-${idx}`);
      if (tile && !revealed.has(idx)) {
        tile.classList.add('revealed', 'bomb');
        tile.innerHTML = `<svg class="icon" style="width:36px;height:36px" aria-hidden="true"><use href="#icon-skull"/></svg>`;
      }
    });
  }

  function cashOut() {
    if (!active || safeCount === 0) return;
    endGame(true);
  }

  function endGame(win) {
    active = false;
    // Make all tiles non-interactive
    document.querySelectorAll('.mine-tile:not(.revealed)').forEach(t => {
      t.classList.add('disabled');
    });

    document.getElementById('mines-start')?.removeAttribute('disabled');
    document.getElementById('mines-cashout')?.setAttribute('disabled', 'true');

    if (win && safeCount > 0) {
      const winAmount = Math.floor(betAmount * currentMultiplier);
      Core.resolveWin(winAmount, betAmount);
      Core.trackFirstWin();
      Addiction.onWin();
      Audio.playWin(winAmount);

      if (currentMultiplier >= 5) {
        goldFlash();
        Particles.winShower(null, null, 20);
      }

      showToast('win', `Cashed out at ${currentMultiplier.toFixed(2)}x!`, `+${winAmount.toLocaleString()} chips!`, 'gem');
      document.getElementById('mines-result').textContent = `+${winAmount.toLocaleString()} chips!`;
      document.getElementById('mines-result').className = 'game-result win';
      FirebaseDB.submitScore(Core.getState().username, Core.getBalance(), winAmount, 'Mines');
    } else if (!win) {
      Core.resolveLoss();
      Addiction.onLoss();
      Audio.playMineExplosion();
      shakeScreen();
      document.getElementById('mines-result').textContent = 'BOOM! You hit a mine!';
      document.getElementById('mines-result').className = 'game-result lose';
    }
  }

  function renderGrid() {
    const grid = document.getElementById('mines-grid');
    if (!grid) return;
    grid.innerHTML = Array.from({length: GRID_SIZE}, (_, i) => `
      <div class="mine-tile" id="mine-tile-${i}" onclick="Mines.click(${i})">
        <svg class="icon" style="width:36px;height:36px;opacity:0" aria-hidden="true"><use href="#icon-gem"/></svg>
      </div>
    `).join('');
  }

  function updateStats() {
    const multEl = document.getElementById('mines-multiplier');
    const potEl = document.getElementById('mines-potential');
    const safeEl = document.getElementById('mines-safe');
    if (multEl) multEl.textContent = currentMultiplier.toFixed(2) + 'x';
    if (potEl) potEl.textContent = Math.floor(betAmount * currentMultiplier).toLocaleString();
    if (safeEl) safeEl.textContent = safeCount;
  }

  function init() {
    renderGrid();

    document.getElementById('mines-start')?.addEventListener('click', startGame);
    document.getElementById('mines-cashout')?.addEventListener('click', cashOut);
    document.getElementById('mines-cashout')?.setAttribute('disabled', 'true');

    const betInp = document.getElementById('mines-bet');
    const countSel = document.getElementById('mines-count');
    betInp?.addEventListener('change', () => {
      betAmount = Math.max(1, Math.min(Core.getBalance(), parseInt(betInp.value) || 1));
    });
    countSel?.addEventListener('change', () => {
      mineCount = parseInt(countSel.value) || 5;
    });
  }

  return { init, click: revealTile };
})();
