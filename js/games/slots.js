// LuckyDev Casino — Slots Game
// 5 reels, 3 rows, cascading wins, near-miss system, hot streak, progressive jackpot

const Slots = (() => {
  const SYMBOLS = [
    { id: 'cherry',    icon: 'cherry',    class: 'sym-cherry',  weight: 18, value: [0,0,2,5,15]     },
    { id: 'lemon',     icon: 'lemon',     class: 'sym-lemon',   weight: 16, value: [0,0,3,6,20]     },
    { id: 'orange',    icon: 'orange',    class: 'sym-orange',  weight: 14, value: [0,0,4,8,25]     },
    { id: 'bell',      icon: 'bell',      class: 'sym-bell',    weight: 12, value: [0,0,5,10,30]    },
    { id: 'bar',       icon: 'bar',       class: 'sym-bar',     weight: 10, value: [0,0,6,15,40]    },
    { id: 'grape',     icon: 'grape',     class: 'sym-grape',   weight: 8,  value: [0,2,8,20,60]    },
    { id: 'star',      icon: 'star',      class: 'sym-star',    weight: 7,  value: [0,3,10,25,80]   },
    { id: 'card',      icon: 'card',      class: 'sym-card',    weight: 6,  value: [0,4,15,40,120]  },
    { id: 'lightning', icon: 'lightning', class: 'sym-lightning',weight:5,  value: [0,5,20,60,200]  },
    { id: 'crown',     icon: 'crown',     class: 'sym-crown',   weight: 4,  value: [0,8,30,100,400] },
    { id: 'diamond',   icon: 'diamond',   class: 'sym-diamond', weight: 3,  value: [0,10,50,200,1000]},
    { id: 'seven',     icon: 'seven',     class: 'sym-seven',   weight: 2,  value: [0,20,100,500,5000]},
  ];

  const REELS = 5;
  const ROWS = 3;
  const PAYLINES = 10;

  // Payline definitions (row indices per reel)
  const PAYLINE_DEFS = [
    [1,1,1,1,1], // center
    [0,0,0,0,0], // top
    [2,2,2,2,2], // bottom
    [0,1,2,1,0], // V-shape
    [2,1,0,1,2], // inverted V
    [0,0,1,2,2], // diagonal down
    [2,2,1,0,0], // diagonal up
    [1,0,0,0,1], // top curve
    [1,2,2,2,1], // bottom curve
    [0,1,1,1,2], // zigzag
  ];

  let reelStrips = []; // 5 arrays of symbols
  let spinning = false;
  let autoSpin = false;
  let autoSpinCount = 0;
  let turboMode = false;
  let stopOnWin = false;
  let grid = []; // [reel][row] = symbolIdx
  let betAmount = 10;
  let jackpotAmount = 50000;

  // Build weighted reel strips
  function buildStrips() {
    const pool = [];
    SYMBOLS.forEach((s, idx) => {
      for (let i = 0; i < s.weight; i++) pool.push(idx);
    });
    reelStrips = Array.from({length: REELS}, () => {
      const strip = [];
      for (let i = 0; i < 40; i++) strip.push(pool[Math.floor(Math.random() * pool.length)]);
      return strip;
    });
  }

  function randomSymbol(bias = null) {
    const pool = [];
    SYMBOLS.forEach((s, idx) => {
      // ADDICTION: Hot streak increases weight of higher-value symbols slightly
      const w = s.weight + (Addiction.isHotStreak() ? Math.floor(s.weight * 0.2) : 0);
      for (let i = 0; i < w; i++) pool.push(idx);
    });
    if (bias !== null) {
      const rng = Addiction.applyHotStreakBias(Math.random());
      return pool[Math.floor(rng * pool.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function generateGrid(nearMiss = false) {
    const newGrid = Array.from({length: REELS}, (_, r) =>
      Array.from({length: ROWS}, (_, row) => randomSymbol(r))
    );

    // ADDICTION: Near-miss — set 4 matching symbols on a payline, miss on last reel
    if (nearMiss && Addiction.shouldNearMiss()) {
      const line = PAYLINE_DEFS[0]; // center line
      const symIdx = Math.floor(Math.random() * 8 + 1); // pick a mid-value symbol
      for (let r = 0; r < 4; r++) newGrid[r][line[r]] = symIdx;
      // Last reel gets adjacent symbol (not matching)
      newGrid[4][line[4]] = (symIdx + 1) % SYMBOLS.length;
    }

    return newGrid;
  }

  function checkPaylines(grid) {
    const wins = [];
    PAYLINE_DEFS.forEach((line, lineIdx) => {
      const syms = line.map((row, reel) => grid[reel][row]);
      const first = syms[0];
      let matchCount = 1;
      for (let i = 1; i < REELS; i++) {
        if (syms[i] === first) matchCount++;
        else break;
      }
      if (matchCount >= 2) {
        const multiplier = SYMBOLS[first].value[matchCount - 1];
        if (multiplier > 0) {
          wins.push({ lineIdx, syms, matchCount, multiplier, symId: SYMBOLS[first].id });
        }
      }
    });
    return wins;
  }

  function isJackpot(grid) {
    return grid.every(reel => reel[1] === SYMBOLS.findIndex(s => s.id === 'seven'));
  }

  // ===== RENDER =====
  function renderSymbol(symIdx) {
    const s = SYMBOLS[symIdx];
    return `<div class="reel-symbol ${s.class}">
      <svg class="icon" aria-hidden="true"><use href="#icon-${s.icon}"/></svg>
    </div>`;
  }

  function renderReels() {
    for (let r = 0; r < REELS; r++) {
      const reelInner = document.getElementById(`reel-inner-${r}`);
      if (!reelInner) continue;
      // Show 5 symbols total (3 visible rows + buffer)
      const startSyms = Array.from({length: 5}, (_, i) => randomSymbol());
      reelInner.innerHTML = startSyms.concat(Array.from({length: 3}, () => grid[r] ? grid[r].map(s=>s) : [0,0,0])).flat()
        .slice(-5).map(s => renderSymbol(typeof s === 'number' ? s : 0)).join('');
    }
  }

  function applyGridToReels() {
    for (let r = 0; r < REELS; r++) {
      const reelInner = document.getElementById(`reel-inner-${r}`);
      if (!reelInner) continue;
      reelInner.innerHTML = grid[r].map(s => renderSymbol(s)).join('');
    }
  }

  // ===== SPIN ANIMATION =====
  function animateReels(callback) {
    const duration = turboMode ? 400 : 1200;
    const reelDelay = turboMode ? 60 : 150;

    // Spin all reels
    for (let r = 0; r < REELS; r++) {
      const reelEl = document.getElementById(`reel-${r}`);
      if (!reelEl) continue;
      reelEl.classList.add('spinning');

      // Stream random symbols during spin
      const streamInterval = setInterval(() => {
        const reelInner = document.getElementById(`reel-inner-${r}`);
        if (reelInner) {
          reelInner.innerHTML = Array.from({length: 3}, () => renderSymbol(randomSymbol())).join('');
        }
      }, 80);

      // Stop each reel with delay
      setTimeout(() => {
        clearInterval(streamInterval);
        reelEl.classList.remove('spinning');
        const reelInner = document.getElementById(`reel-inner-${r}`);
        if (reelInner) {
          reelInner.innerHTML = grid[r].map(s => renderSymbol(s)).join('');
        }
        Audio.playReelStop(r);

        if (r === REELS - 1) {
          setTimeout(callback, 200);
        }
      }, duration + r * reelDelay);
    }
  }

  // ===== HIGHLIGHT PAYLINES =====
  function highlightWins(wins) {
    // Remove previous highlights
    document.querySelectorAll('.reel-win').forEach(el => el.classList.remove('reel-win'));

    wins.forEach(win => {
      const line = PAYLINE_DEFS[win.lineIdx];
      for (let r = 0; r < win.matchCount; r++) {
        const reelEl = document.getElementById(`reel-${r}`);
        if (reelEl) reelEl.classList.add('reel-win');
      }
    });

    setTimeout(() => {
      document.querySelectorAll('.reel-win').forEach(el => el.classList.remove('reel-win'));
    }, 2000);
  }

  // ===== SPIN LOGIC =====
  async function spin() {
    if (spinning) return;
    if (!Core.canBet(betAmount)) {
      showToast('info', 'Insufficient chips', 'Increase your balance to continue playing.', 'warning');
      if (Core.canRebuy()) showModal('rebuy');
      return;
    }

    spinning = true;
    Core.placeBet(betAmount);
    Core.trackSlotSpin();
    Audio.playSlotSpin();

    // Increment jackpot with each spin
    jackpotAmount += Math.floor(betAmount * 0.05);
    updateJackpotDisplay();
    FirebaseDB.incrementJackpot(Math.floor(betAmount * 0.05));

    const spinBtn = document.getElementById('spin-btn');
    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.textContent = 'SPINNING...';
      spinBtn.classList.add('spinning-feedback');
    }

    // Generate outcome (with near-miss chance on losses)
    grid = generateGrid(true);
    const wins = checkPaylines(grid);
    const jackpotHit = isJackpot(grid);

    animateReels(async () => {
      let totalWin = 0;

      if (jackpotHit) {
        // JACKPOT
        totalWin = jackpotAmount;
        grid = grid; // keep grid
        const jpAmt = jackpotAmount;
        jackpotAmount = 10000;
        FirebaseDB.resetJackpot();
        Core.resolveWin(jpAmt, betAmount);
        Core.checkAchievement('jackpot');
        showJackpot(jpAmt);
        Particles.jackpotRain();
        Audio.playJackpot();
        FirebaseDB.submitScore(Core.getState().username, Core.getBalance(), jpAmt, 'Slots');
      } else if (wins.length > 0) {
        // Calculate win
        wins.forEach(w => { totalWin += w.multiplier * betAmount; });
        highlightWins(wins);

        // Check for cascades (remove winning symbols, drop new ones)
        await handleCascade(wins, totalWin);

        Core.resolveWin(totalWin, betAmount);
        Core.trackFirstWin();

        const displayWin = totalWin;
        const winEl = document.getElementById('win-display');
        if (winEl) winEl.textContent = 'WIN +' + displayWin.toLocaleString() + ' chips!';

        if (totalWin >= betAmount * 10) {
          goldFlash();
          Particles.winShower(null, null, 32);
          Audio.playWin(totalWin);
        } else if (totalWin >= betAmount * 2) {
          Particles.winShower(null, null, 16);
          Audio.playWin(totalWin);
        } else if (totalWin > 0 && totalWin < betAmount) {
          // ADDICTION: Loss disguised as win
          Addiction.handleLossDisguised(totalWin, betAmount);
        } else {
          Audio.playCoin(0.8);
        }

        Addiction.onWin();
        FirebaseDB.submitScore(Core.getState().username, Core.getBalance(), totalWin, 'Slots');

        if (stopOnWin) { autoSpin = false; }
      } else {
        // Loss
        Core.resolveLoss();
        Addiction.onLoss();
        Audio.playLoss();
        const winEl = document.getElementById('win-display');
        if (winEl) winEl.textContent = '';
      }

      spinning = false;
      if (spinBtn) {
        spinBtn.disabled = false;
        spinBtn.textContent = 'SPIN';
        spinBtn.classList.remove('spinning-feedback');
      }

      // Auto-spin
      if (autoSpin && autoSpinCount !== 0) {
        if (autoSpinCount > 0) autoSpinCount--;
        updateAutoSpinDisplay();
        if (autoSpinCount !== 0) {
          setTimeout(spin, turboMode ? 300 : 800);
        } else {
          autoSpin = false;
        }
      }
    });
  }

  async function handleCascade(wins, totalWin) {
    return new Promise(resolve => {
      // Mark winning positions
      const toRemove = new Set();
      wins.forEach(win => {
        const line = PAYLINE_DEFS[win.lineIdx];
        for (let r = 0; r < win.matchCount; r++) {
          toRemove.add(`${r}-${line[r]}`);
        }
      });

      if (toRemove.size === 0) { resolve(); return; }

      // Replace winning symbols with new ones
      setTimeout(() => {
        toRemove.forEach(key => {
          const [r, row] = key.split('-').map(Number);
          grid[r][row] = randomSymbol();
        });

        // Check for new wins (cascade)
        const cascadeWins = checkPaylines(grid);
        applyGridToReels();

        if (cascadeWins.length > 0) {
          let cascadeTotal = 0;
          cascadeWins.forEach(w => { cascadeTotal += w.multiplier * betAmount; });
          highlightWins(cascadeWins);
          totalWin += cascadeTotal;
          Audio.playCoin(1.2);
        }
        resolve();
      }, 400);
    });
  }

  function updateJackpotDisplay() {
    const el = document.getElementById('jackpot-display-slots');
    if (el) el.textContent = jackpotAmount.toLocaleString();
  }

  function updateAutoSpinDisplay() {
    const el = document.getElementById('auto-spin-count');
    if (el) el.textContent = autoSpinCount === -1 ? 'inf' : autoSpinCount;
  }

  // ===== INIT =====
  function init() {
    buildStrips();
    grid = generateGrid();
    applyGridToReels();

    // Get jackpot from Firebase
    FirebaseDB.getJackpot().then(amt => {
      jackpotAmount = amt;
      updateJackpotDisplay();
    });

    FirebaseDB.subscribeJackpot(amt => {
      jackpotAmount = amt;
      updateJackpotDisplay();
    });

    // Bet controls
    document.getElementById('bet-input') && (document.getElementById('bet-input').value = betAmount);
    document.querySelectorAll('.btn-bet').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const balance = Core.getBalance();
        if (action === 'min') betAmount = 1;
        else if (action === '10') betAmount = 10;
        else if (action === '50') betAmount = 50;
        else if (action === '100') betAmount = 100;
        else if (action === 'max') betAmount = Math.min(balance, 500);
        else if (action === 'half') betAmount = Math.max(1, Math.floor(betAmount / 2));
        else if (action === 'double') betAmount = Math.min(balance, betAmount * 2);
        const inp = document.getElementById('bet-input');
        if (inp) inp.value = betAmount;
        Audio.playClick();
      });
    });

    const betInp = document.getElementById('bet-input');
    if (betInp) betInp.addEventListener('change', () => {
      betAmount = Math.max(1, Math.min(Core.getBalance(), parseInt(betInp.value) || 1));
      betInp.value = betAmount;
    });

    // Spin button
    document.getElementById('spin-btn')?.addEventListener('click', spin);

    // Turbo toggle
    document.getElementById('turbo-toggle')?.addEventListener('change', e => {
      turboMode = e.target.checked;
    });

    // Stop on win
    document.getElementById('stop-win-toggle')?.addEventListener('change', e => {
      stopOnWin = e.target.checked;
    });

    // Auto spin
    document.getElementById('auto-spin-btn')?.addEventListener('click', () => {
      if (autoSpin) {
        autoSpin = false;
        autoSpinCount = 0;
        document.getElementById('auto-spin-btn').textContent = 'AUTO';
      } else {
        autoSpin = true;
        autoSpinCount = -1; // infinite
        document.getElementById('auto-spin-btn').textContent = 'STOP';
        spin();
      }
    });

    // Spacebar to spin
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !spinning && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        spin();
      }
    });
  }

  return { init };
})();
