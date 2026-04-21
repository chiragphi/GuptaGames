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
  let startTime = 0;
  let graphPoints = [];
  let crashHistory = [];
  let tickInterval = null;
  let cdInt = null; // countdown interval — stored for cleanup

  function getCrashPoint() {
    const r = Math.random();
    const bias = Addiction.isHotStreak() ? 1.15 : 1.0;
    return Math.max(1.01, (1 / (1 - r * 0.97)) * bias);
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

  // BUG FIX: always wrap draw calls in save/restore so shadow & textAlign never leak
  function drawGraph() {
    if (!canvas || !ctx) return;

    ctx.save(); // ← matches ctx.restore() at end

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width, H = canvas.height;
    const PAD = 40;

    // Grid — dark lines on dark canvas
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
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

    if (graphPoints.length < 2) { ctx.restore(); return; }

    // Snapshot the points array to avoid mutation during draw
    const pts = graphPoints.slice();
    const elapsed = pts[pts.length - 1].t;
    const maxMult = Math.max(multiplier * 1.2, 3);
    const lineColor = crashed ? '#B03020' : '#2D6A4F';
    const fillColor = crashed ? 'rgba(176,48,32,0.18)' : 'rgba(45,106,79,0.18)';

    // BUG FIX: set shadow BEFORE beginPath, reset to 0 before fill so shadow doesn't bleed
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 10;

    // Draw curve
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    pts.forEach((pt, i) => {
      const x = PAD + ((W - PAD) * (pt.t / Math.max(elapsed, 0.001)));
      const y = (H - PAD) - ((H - PAD) * Math.min((pt.m - 1) / Math.max(maxMult - 1, 0.001), 1));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // BUG FIX: reset shadow before fill so fill doesn't get shadow blur
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Fill under curve
    const lastPt = pts[pts.length - 1];
    const lx = PAD + ((W - PAD) * (lastPt.t / Math.max(elapsed, 0.001)));
    const ly = (H - PAD) - ((H - PAD) * Math.min((lastPt.m - 1) / Math.max(maxMult - 1, 0.001), 1));

    ctx.beginPath();
    pts.forEach((pt, i) => {
      const x = PAD + ((W - PAD) * (pt.t / Math.max(elapsed, 0.001)));
      const y = (H - PAD) - ((H - PAD) * Math.min((pt.m - 1) / Math.max(maxMult - 1, 0.001), 1));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(lx, H - PAD);
    ctx.lineTo(PAD, H - PAD);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Multiplier label — BUG FIX: textAlign reset by ctx.restore()
    ctx.fillStyle = lineColor;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(formatMult(multiplier), Math.min(lx, W - 60), Math.max(ly - 14, 24));

    ctx.restore(); // ← restores textAlign, shadowColor, shadowBlur, etc.
  }

  function updateMultiplierDisplay() {
    const el = document.getElementById('crash-multiplier');
    if (!el) return;
    el.textContent = formatMult(multiplier);
    el.className = 'crash-multiplier';
    if (crashed) el.classList.add('crashed');
    else if (multiplier > 5) el.classList.add('danger');

    const btn = document.getElementById('cashout-btn');
    if (btn && running && !crashed && !cashedOut) {
      if (multiplier > 3) btn.classList.add('cashout-pulse');
      else btn.classList.remove('cashout-pulse');
    }
  }

  function startRound() {
    if (running) return;

    // BUG FIX: cancel any pending countdown before starting a new round
    if (cdInt) { clearInterval(cdInt); cdInt = null; }

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

    setStatus('FLYING...');

    tickInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      multiplier = Math.pow(Math.E, elapsed * 0.12);

      // BUG FIX: only keep 300 points max; never shift — just cap so x-axis stays stable
      if (graphPoints.length < 300) {
        graphPoints.push({ t: elapsed, m: multiplier });
      }

      updateMultiplierDisplay();
      Audio.playCrashTick(multiplier);
      addFakeChat();

      if (betPlaced && !cashedOut && autoCashout > 1 && multiplier >= autoCashout) {
        cashOut();
      }

      if (multiplier >= crashPoint) {
        boom();
      } else {
        drawGraph();
      }
    }, 50);
  }

  function setStatus(text) {
    const el = document.getElementById('crash-status');
    if (el) el.textContent = text;
  }

  function boom() {
    clearInterval(tickInterval); tickInterval = null;
    crashed = true;
    running = false;

    if (betPlaced && !cashedOut) {
      Core.resolveLoss();
      Addiction.onLoss();
      Audio.playCrashBust();
      shakeScreen();
    }

    setStatus(`CRASHED at ${formatMult(multiplier)}`);

    const cashoutBtn = document.getElementById('cashout-btn');
    if (cashoutBtn) { cashoutBtn.disabled = true; cashoutBtn.classList.remove('cashout-pulse'); }

    updateMultiplierDisplay();
    drawGraph();
    addToHistory(parseFloat(multiplier.toFixed(2)));
    betPlaced = false;

    const lastRound = document.getElementById('last-round');
    if (lastRound) lastRound.textContent = `Last round: ${formatMult(multiplier)}`;

    // BUG FIX: countdown shows 5, 4, 3, 2, 1 then fires (decrement AFTER render)
    const betBtn = document.getElementById('bet-btn');
    let countdown = 5;
    setStatus(`Next round in ${countdown}s...`);
    cdInt = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(cdInt); cdInt = null;
        setStatus('Place your bet!');
        if (betBtn) betBtn.disabled = false;
      } else {
        setStatus(`Next round in ${countdown}s...`);
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
    setStatus(`Cashed out at ${formatMult(mult)} — +${winAmount} chips!`);
  }

  // ===== FAKE CHAT =====
  const CHAT_NAMES = ['SlotKing','GoldRush','LuckyAce','CrashPro','BetMaster','WildCard'];
  const CHAT_MSGS_WIN = ['cashed out!','nice one!','gg!','moon!','ez money'];

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

    // BUG FIX: use ResizeObserver so canvas size is correct even on mobile layout shifts
    function resizeCanvas() {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight || 320;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        drawGraph();
      }
    }
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

    // Seed history with realistic values
    for (let i = 0; i < 20; i++) {
      const r = Math.random();
      crashHistory.push(parseFloat(Math.max(1.01, 1 / (1 - r * 0.97)).toFixed(2)));
    }
    renderHistory();

    document.getElementById('bet-btn')?.addEventListener('click', placeBet);
    document.getElementById('cashout-btn')?.addEventListener('click', cashOut);

    const lastRound = document.getElementById('last-round');
    if (lastRound && crashHistory.length > 0) {
      lastRound.textContent = `Last round: ${formatMult(crashHistory[0])}`;
    }

    setStatus('Place your bet!');
    drawGraph();
  }

  return { init };
})();
