// LuckyDev Casino — Coin Flip

const CoinFlip = (() => {
  let choice = null; // 'heads' | 'tails'
  let betAmount = 10;
  let flipping = false;
  let winStreak = 0;
  let mode = 'single'; // single | best3 | sudden
  let roundsWon = 0, roundsLost = 0, roundsPlayed = 0;

  function setChoice(c) {
    choice = c;
    document.querySelectorAll('.coin-choice-btn').forEach(btn => {
      btn.className = 'coin-choice-btn' + (btn.dataset.choice === c ? (c === 'heads' ? ' selected-heads' : ' selected-tails') : '');
    });
  }

  function flip() {
    if (!choice) { showToast('info', 'Pick a side', 'Choose heads or tails first!', 'coin'); return; }
    if (flipping) return;
    if (!Core.placeBet(betAmount)) { showToast('info', 'Insufficient chips', '', 'warning'); return; }

    flipping = true;
    Audio.playCoinFlip();

    const coin = document.getElementById('coin-flip-coin');
    const FLIPS = 8 + Math.floor(Math.random() * 6);
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      if (coin) coin.style.transform = `rotateY(${frame * 30}deg)`;
      if (frame >= FLIPS) {
        clearInterval(interval);
        finishFlip(frame % 2 === 0 ? 'heads' : 'tails');
      }
    }, 60);
  }

  function finishFlip(result) {
    const coin = document.getElementById('coin-flip-coin');
    if (coin) coin.style.transform = result === 'heads' ? 'rotateY(0deg)' : 'rotateY(180deg)';

    const resultEl = document.getElementById('cf-result');
    const win = result === choice;
    roundsPlayed++;

    if (win) {
      roundsWon++;
      winStreak++;
      Core.resolveWin(betAmount * 2, betAmount);
      Core.trackFirstWin();
      Core.trackCoinFlipWin();
      Addiction.onWin();
      Audio.playCoin();
      if (resultEl) { resultEl.textContent = `${result.toUpperCase()} — You Win! +${betAmount} chips`; resultEl.className = 'game-result win'; }
      if (winStreak >= 3) {
        Particles.winShower(null, null, 16);
        goldFlash();
      }
    } else {
      roundsLost++;
      winStreak = 0;
      Core.resolveLoss();
      Core.trackCoinFlipLoss();
      Addiction.onLoss();
      Audio.playLoss();
      if (resultEl) { resultEl.textContent = `${result.toUpperCase()} — You Lose`; resultEl.className = 'game-result lose'; }
    }

    updateStats();
    FirebaseDB.submitScore(Core.getState().username, Core.getBalance(), betAmount * 2, 'Coin Flip');
    flipping = false;
  }

  function updateStats() {
    document.getElementById('cf-streak') && (document.getElementById('cf-streak').textContent = winStreak);
    document.getElementById('cf-won') && (document.getElementById('cf-won').textContent = roundsWon);
    document.getElementById('cf-lost') && (document.getElementById('cf-lost').textContent = roundsLost);
  }

  function init() {
    document.getElementById('cf-flip-btn')?.addEventListener('click', flip);
    document.querySelectorAll('.coin-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => setChoice(btn.dataset.choice));
    });
    const betInp = document.getElementById('cf-bet');
    betInp?.addEventListener('change', () => {
      betAmount = Math.max(1, Math.min(Core.getBalance(), parseInt(betInp.value) || 1));
    });
    document.querySelectorAll('.cf-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        betAmount = parseInt(btn.dataset.val) || betAmount;
        if (betInp) betInp.value = betAmount;
      });
    });
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !flipping && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault(); flip();
      }
    });
  }

  return { init };
})();
