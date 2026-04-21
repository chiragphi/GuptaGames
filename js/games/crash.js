// LuckyDev Casino — Crash Game

const Crash = (() => {
  let canvas, ctx;
  let multiplier = 1.0;
  let crashed = false;
  let running = false;
  let cashedOut = false;
  let betPlaced = false;
  let autoCashout = 0;
  let betAmount = 10;
  let animFrame = null;
  let startTime = 0;
  let graphPoints = [];
  let crashHistory = [];
  let tickInterval = null;

  const CRASH_TARGET_MAX = 100;

  function getCrashPoint() {
    // House edge ~3%
    const r = Math.random();
    // ADDICTION: Hot streak slightly delays crash
    const bias = Addiction.isHotStreak() ? 1.15 : 1.0;
    return Math.max(1.0, (1 / (1 - r * 0.97)) * bias);
  }

  function formatMult(m) { return m.toFixed(2) + 'x'; }

  function addToHistory(point) {
    crashHistory.unshift(point);
    if (crashHistory.length > 20) crashHistory.pop();
    renderHistory();
  }

  function renderHistory() {
    const el = document.getElementById('crash-history');
    if (!el) return;
    el.innerHTML = crashHistory.map(p => {
      const cls = p < 1.5 ? 'low' : p < 5 ? 'med' : 'high';
      return `<span class="crash-pill ${cls}">${formatMult(p)}</span>`;
    }).join('');
  }

  function drawGraph() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width, H = canvas.height;
    const PAD = 40;

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(PAD + (W - PAD) * i / 9, 0);
      ctx.lineTo(PAD + (W - PAD) * i / 9, H - PAD);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PAD, (H - PAD) * i / 9);
      ctx.lineTo(W, (H - PAD) * i / 9);
      ctx.stroke();
    }

    if (graphPoints.length < 2) return;

    const maxMult = Math.max(multiplier * 1.2, 3);
    const elapsed = (Date.now() - startTime) / 1000;

    // Draw curve
    ctx.beginPath();
    ctx.strokeStyle = crashed ? '#FF3B30' : '#30D158';
    ctx.lineWidth = 3;
    ctx.shadowColor = crashed ? '#FF3B30' : '#30D158';
    ctx.shadowBlur = 8;

    graphPoints.forEach((pt, i) => {
      const x = PAD + ((W - PAD) * (pt.t / Math.max(elapsed, 1)));
      const y = (H - PAD) - ((H - PAD) * Math.min((pt.m - 1) / (maxMult - 1), 1));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under curve
    ctx.shadowBlur = 0;
    const lastPt = graphPoints[graphPoints.length - 1];
    const lx = PAD + ((W - PAD) * (lastPt.t / Math.max(elapsed, 1)));
    const ly = (H - PAD) - ((H - PAD) * Math.min((lastPt.m - 1) / (maxMult - 1), 1));

    ctx.lineTo(lx, H - PAD);
    ctx.lineTo(PAD, H - PAD);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, crashed ? 'rgba(255,59,48,0.15)' : 'rgba(48,209,88,0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Current multiplier label on graph
    ctx.fillStyle = crashed ? '#FF3B30' : '#30D158';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(formatMult(multiplier), lx, ly - 12);

    ctx.restore && ctx.restore();
  }

  function updateMultiplierDisplay() {
    const el = document.getElementById('crash-multiplier');
    if (!el) return;
    el.textContent = formatMult(multiplier);
    el.className = 'crash-multiplier';
    if (crashed) el.classList.add('crashed');
    else if (multiplier > 5) el.classList.add('danger');

    // Cashout button urgency
    const btn = document.getElementById('cashout-btn');
    if (btn && running && !crashed && !cashedOut) {
      if (multiplier > 3) btn.classList.add('cashout-pulse');
      else btn.classList.remove('cashout-pulse');
    }
  }

  function startRound() {
    if (running) return;
    running = true;
    crashed = false;
    cashedOut = false;
    multiplier = 1.0;
    graphPoints = [];
    startTime = Date.now();

    const crashPoint = getCrashPoint();

    const cashoutBtn = document.getElementById('cashout-btn');
    const betBtn = document.getElementById('bet-btn');
    if (cashoutBtn) { cashoutBtn.disabled = false; cashoutBtn.classList.add('cashout-pulse'); }
    if (betBtn) betBtn.disabled = true;

    document.getElementById('crash-status') && (document.getElementById('crash-status').textContent = 'FLYING...');

    tickInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      multiplier = Math.pow(Math.E, elapsed * 0.12);

      graphPoints.push({ t: elapsed, m: multiplier });
      if (graphPoints.length > 200) graphPoints.shift();

      updateMultiplierDisplay();
      Audio.playCrashTick(multiplier);
      addFakeChat();

      // Auto-cashout
      if (betPlaced && !cashedOut && autoCashout > 1 && multiplier >= autoCashout) {
        cashOut();
      }

      // Check crash
      if (multiplier >= crashPoint) {
        boom();
      }

      drawGraph();
    }, 50);
  }

  function boom() {
    clearInterval(tickInterval);
    crashed = true;
    running = false;

    if (betPlaced && !cashedOut) {
      Core.resolveLoss();
      Addiction.onLoss();
      Audio.playCrashBust();
      shakeScreen();
    }

    const status = document.getElementById('crash-status');
    if (status) status.textContent = `CRASHED at ${formatMult(multiplier)}`;

    const cashoutBtn = document.getElementById('cashout-btn');
    if (cashoutBtn) { cashoutBtn.disabled = true; cashoutBtn.classList.remove('cashout-pulse'); }

    updateMultiplierDisplay();
    drawGraph();
    addToHistory(parseFloat(multiplier.toFixed(2)));
    betPlaced = false;

    // ADDICTION: Show last round result
    const lastRound = document.getElementById('last-round');
    if (lastRound) lastRound.textContent = `Last round: ${formatMult(multiplier)}`;

    // Next round countdown
    const betBtn = document.getElementById('bet-btn');
    let countdown = 5;
    const cdEl = document.getElementById('crash-status');
    const cdInt = setInterval(() => {
      countdown--;
      if (cdEl) cdEl.textContent = `Next round in ${countdown}s...`;
      if (countdown <= 0) {
        clearInterval(cdInt);
        if (cdEl) cdEl.textContent = 'Place your bet!';
        if (betBtn) betBtn.disabled = false;
      }
    }, 1000);
  }

  function placeBet() {
    if (running || betPlaced) return;
    betAmount = parseInt(document.getElementById('crash-bet')?.value) || 10;
    if (!Core.placeBet(betAmount)) {
      showToast('info', 'Insufficient chips', 'Cannot place bet.', 'warning');
      return;
    }
    betPlaced = true;
    autoCashout = parseFloat(document.getElementById('auto-cashout')?.value) || 0;
    document.getElementById('bet-btn').disabled = true;
    showToast('info', 'Bet placed!', `${betAmount} chips on the line. Cash out in time!`, 'lightning-bolt');
    startRound();
  }

  function cashOut() {
    if (!running || crashed || cashedOut || !betPlaced) return;
    cashedOut = true;
    const winAmount = Math.floor(betAmount * multiplier);
    Core.resolveWin(winAmount, betAmount);
    Core.trackCrashCashout(multiplier);
    Core.trackDiamondHands(multiplier);
    Core.trackFirstWin();
    Addiction.onWin();

    const mult = multiplier;
    Audio.playWin(winAmount);
    showToast('win', `Cashed out at ${formatMult(mult)}!`, `+${winAmount.toLocaleString()} chips!`, 'coin');

    if (winAmount > betAmount * 5) {
      goldFlash();
      Particles.winShower(null, null, 20);
    }

    FirebaseDB.submitScore(Core.getState().username, Core.getBalance(), winAmount, 'Crash');

    const cashoutBtn = document.getElementById('cashout-btn');
    if (cashoutBtn) { cashoutBtn.disabled = true; cashoutBtn.classList.remove('cashout-pulse'); }

    const status = document.getElementById('crash-status');
    if (status) status.textContent = `Cashed out at ${formatMult(mult)} — +${winAmount} chips!`;
  }

  // ===== FAKE CHAT =====
  const CHAT_NAMES = ['SlotKing','GoldRush','LuckyAce','CrashPro','BetMaster','WildCard'];
  const CHAT_MSGS_WIN = ['cashed out!','nice one!','gg!','moon!','ez money'];
  const CHAT_MSGS_LOSE = ['rip','oof','should have cashed earlier','got got','too greedy'];

  function addFakeChat() {
    if (Math.random() > 0.04) return;
    const chatEl = document.getElementById('crash-chat');
    if (!chatEl) return;
    const name = CHAT_NAMES[Math.floor(Math.random() * CHAT_NAMES.length)];
    const isMult = Math.random() > 0.5;
    const msg = isMult
      ? `cashed out at ${(Math.random() * multiplier * 1.2 + 1).toFixed(2)}x`
      : CHAT_MSGS_WIN[Math.floor(Math.random() * CHAT_MSGS_WIN.length)];
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="player">${name}</span>: ${msg}`;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
    while (chatEl.children.length > 30) chatEl.removeChild(chatEl.firstChild);
  }

  function init() {
    canvas = document.getElementById('crash-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Resize
    function resizeCanvas() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight || 320;
      drawGraph();
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Seed history
    for (let i = 0; i < 20; i++) {
      const r = Math.random();
      crashHistory.push(parseFloat((1 / (1 - r * 0.97)).toFixed(2)));
    }
    renderHistory();

    document.getElementById('bet-btn')?.addEventListener('click', placeBet);
    document.getElementById('cashout-btn')?.addEventListener('click', cashOut);

    // ADDICTION: show last round
    const lastRound = document.getElementById('last-round');
    if (lastRound && crashHistory.length > 0) {
      lastRound.textContent = `Last round: ${formatMult(crashHistory[0])}`;
    }
  }

  return { init };
})();
