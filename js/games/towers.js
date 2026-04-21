// LuckyDev Casino — Towers Game

const Towers = (() => {
  const MAX_LEVELS = 12;
  const TILES_PER_ROW = 3;
  let currentLevel = 0;
  let active = false;
  let betAmount = 10;
  let traps = []; // trap position per level
  let currentMultiplier = 1.0;
  let revealed = []; // revealed[level][tile] = true

  const MULTIPLIERS = [1.46,2.13,3.10,4.52,6.59,9.62,14.0,20.5,29.9,43.6,63.7,93.0];

  function buildTower() {
    traps = Array.from({length: MAX_LEVELS}, () => Math.floor(Math.random() * TILES_PER_ROW));
    revealed = Array.from({length: MAX_LEVELS}, () => [false,false,false]);
  }

  function startGame() {
    if (active) return;
    betAmount = parseInt(document.getElementById('towers-bet')?.value) || 10;
    if (!Core.placeBet(betAmount)) { showToast('info', 'Insufficient chips', '', 'warning'); return; }
    buildTower();
    active = true;
    currentLevel = 0;
    currentMultiplier = 1.0;
    renderTower();
    updateStats();
    document.getElementById('towers-start')?.setAttribute('disabled','true');
    document.getElementById('towers-cashout')?.removeAttribute('disabled');
  }

  function clickTile(level, tile) {
    if (!active || level !== currentLevel) return;
    if (revealed[level][tile]) return;

    revealed[level][tile] = true;
    const tileEl = document.getElementById(`tower-tile-${level}-${tile}`);
    if (!tileEl) return;

    if (tile === traps[level]) {
      // Trap hit
      tileEl.classList.add('revealed','trap');
      tileEl.innerHTML = `<svg class="icon animate-mine-reveal" style="width:28px;height:28px" aria-hidden="true"><use href="#icon-skull"/></svg>`;
      revealAllTraps();
      endGame(false);
    } else {
      // Safe
      tileEl.classList.add('revealed','safe');
      tileEl.innerHTML = `<svg class="icon animate-gem-reveal" style="width:28px;height:28px" aria-hidden="true"><use href="#icon-shield"/></svg>`;
      Audio.playCoin(0.9 + currentLevel * 0.05);
      currentLevel++;
      currentMultiplier = MULTIPLIERS[Math.min(currentLevel - 1, MULTIPLIERS.length - 1)];
      Core.trackTower10(currentLevel);
      updateStats();
      renderTower();
      if (currentLevel >= MAX_LEVELS) endGame(true); // topped out
    }
  }

  function revealAllTraps() {
    for (let l = 0; l < MAX_LEVELS; l++) {
      const trapTile = document.getElementById(`tower-tile-${l}-${traps[l]}`);
      if (trapTile && !trapTile.classList.contains('revealed')) {
        trapTile.classList.add('revealed','trap');
        trapTile.innerHTML = `<svg class="icon" style="width:28px;height:28px" aria-hidden="true"><use href="#icon-skull"/></svg>`;
      }
    }
  }

  function cashOut() {
    if (!active || currentLevel === 0) return;
    endGame(true);
  }

  function endGame(win) {
    active = false;
    document.querySelectorAll('.tower-tile').forEach(t => t.classList.add('disabled'));
    document.getElementById('towers-start')?.removeAttribute('disabled');
    document.getElementById('towers-cashout')?.setAttribute('disabled','true');

    const resultEl = document.getElementById('towers-result');
    if (win && currentLevel > 0) {
      const winAmount = Math.floor(betAmount * currentMultiplier);
      Core.resolveWin(winAmount, betAmount);
      Core.trackFirstWin();
      Addiction.onWin();
      Audio.playWin(winAmount);
      if (currentMultiplier >= 5) { goldFlash(); Particles.winShower(null, null, 20); }
      if (resultEl) { resultEl.textContent = `Level ${currentLevel} — +${winAmount.toLocaleString()} chips!`; resultEl.className = 'game-result win'; }
      showToast('win', `Tower Level ${currentLevel}!`, `${currentMultiplier.toFixed(2)}x — +${winAmount.toLocaleString()} chips!`, 'sword');
      FirebaseDB.submitScore(Core.getState().username, Core.getBalance(), winAmount, 'Towers');
    } else if (!win) {
      Core.resolveLoss();
      Addiction.onLoss();
      Audio.playMineExplosion();
      shakeScreen();
      if (resultEl) { resultEl.textContent = 'Trap! You fell!'; resultEl.className = 'game-result lose'; }
      // Show prominent game-over overlay
      setTimeout(() => {
        const ov = document.createElement('div');
        ov.className = 'towers-gameover-overlay';
        ov.innerHTML = `
          <div class="towers-gameover-box">
            <svg class="icon" style="width:64px;height:64px;color:var(--red);margin-bottom:12px" aria-hidden="true"><use href="#icon-skull"/></svg>
            <div class="towers-gameover-title">You Fell!</div>
            <div class="towers-gameover-sub">Reached floor ${currentLevel} — you hit a trap.</div>
            <button class="btn btn-gold" onclick="this.closest('.towers-gameover-overlay').remove();Audio.playClick()">Try Again</button>
          </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
      }, 400);
    }
  }

  function renderTower() {
    const grid = document.getElementById('towers-grid');
    if (!grid) return;

    // Render levels bottom-to-top (visual)
    const rows = [];
    for (let l = MAX_LEVELS - 1; l >= 0; l--) {
      const isActive = l === currentLevel && active;
      const isPassed = l < currentLevel;
      const rowClass = `tower-row${isActive ? ' active-row' : ''}${isPassed ? ' passed' : ''}`;
      const tilesHtml = Array.from({length: TILES_PER_ROW}, (_, t) => {
        const revId = `tower-tile-${l}-${t}`;
        const isRevealed = revealed[l] && revealed[l][t];
        let content = '';
        if (isRevealed) {
          const isTrap = t === traps[l];
          content = `<svg class="icon" style="width:28px;height:28px" aria-hidden="true">
            <use href="#icon-${isTrap ? 'skull' : 'shield'}"/></svg>`;
        }
        const classes = `tower-tile${isRevealed ? ' revealed ' + (t === traps[l] ? 'trap' : 'safe') : ''}${!active || !isActive ? ' disabled' : ''}`;
        return `<div class="${classes}" id="${revId}" onclick="Towers.click(${l},${t})">${content}</div>`;
      }).join('');
      rows.push(`<div class="${rowClass}" style="position:relative">
        <div style="position:absolute;left:-36px;top:50%;transform:translateY(-50%);font-size:0.72rem;color:var(--text-dim)">${MULTIPLIERS[l]}x</div>
        ${tilesHtml}
      </div>`);
    }
    grid.innerHTML = rows.join('');
  }

  function updateStats() {
    const lvlEl = document.getElementById('towers-level');
    const multEl = document.getElementById('towers-multiplier');
    const potEl = document.getElementById('towers-potential');
    if (lvlEl) lvlEl.textContent = currentLevel;
    if (multEl) multEl.textContent = currentMultiplier.toFixed(2) + 'x';
    if (potEl) potEl.textContent = Math.floor(betAmount * currentMultiplier).toLocaleString();
  }

  function init() {
    renderTower();
    document.getElementById('towers-start')?.addEventListener('click', startGame);
    document.getElementById('towers-cashout')?.addEventListener('click', cashOut);
    document.getElementById('towers-cashout')?.setAttribute('disabled','true');
    const betInp = document.getElementById('towers-bet');
    betInp?.addEventListener('change', () => {
      betAmount = Math.max(1, Math.min(Core.getBalance(), parseInt(betInp.value) || 1));
    });
  }

  return { init, click: clickTile };
})();
