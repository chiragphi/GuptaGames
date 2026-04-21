// LuckyDev Casino — Roulette (American + European)

const Roulette = (() => {
  let canvas, ctx;
  let spinning = false;
  let angle = 0;
  let ballAngle = 0;
  let animFrame = null;
  let selectedBets = {}; // { betType: amount }
  let betAmount = 10;
  let mode = 'european'; // american | european
  let lastResults = [];
  let hotNumbers = {};
  let coldNumbers = {};

  const EU_NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

  function getColor(n) {
    if (n === 0 || n === 37) return '#006600'; // green (37=00)
    return RED_NUMS.has(n) ? '#880000' : '#111';
  }

  function getDisplayNum(n) { return n === 37 ? '00' : n; }

  function drawWheel() {
    if (!canvas || !ctx) return;
    const W = canvas.width, H = canvas.height;
    const cx = W/2, cy = H/2;
    const radius = Math.min(W,H)/2 - 10;
    const nums = mode === 'american' ? [...EU_NUMBERS, 37] : EU_NUMBERS;
    const sliceAngle = (Math.PI * 2) / nums.length;

    ctx.clearRect(0, 0, W, H);

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI*2);
    ctx.fillStyle = '#8B6914';
    ctx.fill();

    // Slots
    nums.forEach((n, i) => {
      const start = angle + i * sliceAngle - Math.PI/2;
      const end = start + sliceAngle;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius - 8, start, end);
      ctx.closePath();
      ctx.fillStyle = getColor(n);
      ctx.fill();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Number text
      const textRadius = radius - 24;
      const mid = start + sliceAngle/2;
      ctx.save();
      ctx.translate(cx + Math.cos(mid)*textRadius, cy + Math.sin(mid)*textRadius);
      ctx.rotate(mid + Math.PI/2);
      ctx.fillStyle = 'white';
      ctx.font = `bold ${Math.max(8, 10)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(getDisplayNum(n), 0, 4);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI*2);
    ctx.fillStyle = '#1a0a00';
    ctx.fill();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ball
    const br = radius - 15;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ballAngle)*br, cy + Math.sin(ballAngle)*br, 6, 0, Math.PI*2);
    const ballGrad = ctx.createRadialGradient(
      cx + Math.cos(ballAngle)*br - 2, cy + Math.sin(ballAngle)*br - 2, 1,
      cx + Math.cos(ballAngle)*br, cy + Math.sin(ballAngle)*br, 6
    );
    ballGrad.addColorStop(0, '#FFFFFF');
    ballGrad.addColorStop(1, '#CCCCCC');
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.shadowColor = 'white';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function spinWheel() {
    if (spinning) return;
    if (Object.keys(selectedBets).length === 0) {
      showToast('info', 'No bets placed', 'Click on the betting table to place bets!', 'warning');
      return;
    }

    spinning = true;
    let totalBet = 0;
    Object.values(selectedBets).forEach(v => totalBet += v);
    if (!Core.placeBet(totalBet)) {
      showToast('info', 'Insufficient chips', '', 'warning');
      spinning = false;
      return;
    }

    Audio.playRouletteSpin();
    Core.trackRoulette();

    // Animate wheel
    const spinSpeed = 0.15 + Math.random() * 0.05;
    const totalRotation = Math.PI * (8 + Math.random() * 4);
    let rotated = 0;
    let deceleration = 0.005;

    const nums = mode === 'american' ? [...EU_NUMBERS, 37] : EU_NUMBERS;
    const targetIdx = Math.floor(Math.random() * nums.length);
    const targetNum = nums[targetIdx];

    let speed = spinSpeed;
    const spin = () => {
      speed = Math.max(0.002, speed - deceleration * 0.01);
      angle += speed;
      ballAngle -= speed * 3;
      rotated += speed;
      drawWheel();

      if (rotated < totalRotation) {
        animFrame = requestAnimationFrame(spin);
      } else {
        finishSpin(targetNum, targetIdx, totalBet);
      }
    };
    animFrame = requestAnimationFrame(spin);
  }

  function finishSpin(result, idx, totalBet) {
    spinning = false;
    const nums = mode === 'american' ? [...EU_NUMBERS, 37] : EU_NUMBERS;
    const sliceAngle = (Math.PI*2) / nums.length;
    angle = -idx * sliceAngle - sliceAngle/2;
    ballAngle = angle - sliceAngle/2;
    drawWheel();

    lastResults.unshift(result);
    if (lastResults.length > 20) lastResults.pop();
    hotNumbers[result] = (hotNumbers[result] || 0) + 1;
    renderResults();

    let totalWin = 0;
    Object.entries(selectedBets).forEach(([betType, amount]) => {
      const payout = calculatePayout(betType, result, amount);
      totalWin += payout;
    });

    const resultEl = document.getElementById('roulette-result');
    const color = result === 37 ? 'var(--green)' : RED_NUMS.has(result) ? 'var(--red)' : 'var(--text-pri)';
    if (resultEl) {
      resultEl.textContent = getDisplayNum(result);
      resultEl.style.color = color;
    }

    if (totalWin > 0) {
      Core.resolveWin(totalWin, totalBet);
      Core.trackFirstWin();
      Addiction.onWin();
      Audio.playWin(totalWin);
      showToast('win', `${getDisplayNum(result)}! You Win!`, `+${totalWin.toLocaleString()} chips!`, 'coin');
      if (totalWin > totalBet * 5) { goldFlash(); Particles.winShower(null,null,20); }
      // Track red wins for achievement
      if (RED_NUMS.has(result) && selectedBets['red']) Core.trackRedWin();
      else Core.trackRedLoss();
    } else {
      Core.resolveLoss();
      Addiction.onLoss();
      Audio.playLoss();
      showToast('info', `${getDisplayNum(result)} — No Win`, 'Better luck next time!', 'warning');
    }

    selectedBets = {};
    renderBettingTable();
    FirebaseDB.submitScore(Core.getState().username, Core.getBalance(), totalWin, 'Roulette');
  }

  function calculatePayout(betType, result, amount) {
    const n = result === 37 ? -1 : result;
    switch(betType) {
      case 'red': return RED_NUMS.has(n) ? amount * 2 : 0;
      case 'black': return !RED_NUMS.has(n) && n !== 0 && n !== -1 ? amount * 2 : 0;
      case 'green': return n === 0 || n === -1 ? amount * 35 : 0;
      case 'even': return n > 0 && n % 2 === 0 ? amount * 2 : 0;
      case 'odd': return n > 0 && n % 2 !== 0 ? amount * 2 : 0;
      case 'low': return n >= 1 && n <= 18 ? amount * 2 : 0;
      case 'high': return n >= 19 && n <= 36 ? amount * 2 : 0;
      case '1st12': return n >= 1 && n <= 12 ? amount * 3 : 0;
      case '2nd12': return n >= 13 && n <= 24 ? amount * 3 : 0;
      case '3rd12': return n >= 25 && n <= 36 ? amount * 3 : 0;
      default: {
        const num = parseInt(betType);
        if (!isNaN(num)) return num === n ? amount * 36 : 0;
        return 0;
      }
    }
  }

  function placeBet(type) {
    const cur = selectedBets[type] || 0;
    selectedBets[type] = cur + betAmount;
    renderBettingTable();
    Audio.playClick();
  }

  function renderBettingTable() {
    document.querySelectorAll('.roul-cell').forEach(cell => {
      const type = cell.dataset.bet;
      const amount = selectedBets[type];
      if (amount) {
        cell.classList.add('selected');
        let badge = cell.querySelector('.bet-badge');
        if (!badge) { badge = document.createElement('div'); badge.className = 'bet-badge'; badge.style.cssText='position:absolute;top:2px;right:2px;background:#FFD700;color:#000;font-size:0.6rem;font-weight:900;padding:1px 3px;border-radius:3px'; cell.appendChild(badge); }
        badge.textContent = amount;
      } else {
        cell.classList.remove('selected');
        const badge = cell.querySelector('.bet-badge');
        if (badge) badge.remove();
      }
    });
  }

  function renderResults() {
    const el = document.getElementById('roul-history');
    if (!el) return;
    el.innerHTML = lastResults.slice(0,10).map(n => {
      const color = n===37 || n===0 ? 'var(--green)' : RED_NUMS.has(n) ? 'var(--red)' : '#fff';
      return `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${color==='var(--green)'?'#006600':color==='var(--red)'?'#880000':'#111'};color:white;font-size:0.7rem;font-weight:900">${getDisplayNum(n)}</span>`;
    }).join('');
  }

  function init() {
    canvas = document.getElementById('roulette-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    function resize() {
      const size = Math.min(360, window.innerWidth - 40);
      canvas.width = size; canvas.height = size;
      drawWheel();
    }
    resize();
    window.addEventListener('resize', resize);

    document.getElementById('roul-spin')?.addEventListener('click', spinWheel);

    // Betting table clicks
    document.querySelectorAll('.roul-cell').forEach(cell => {
      cell.addEventListener('click', () => placeBet(cell.dataset.bet));
    });

    // Mode toggle
    document.getElementById('roul-mode')?.addEventListener('change', e => {
      mode = e.target.value;
      drawWheel();
    });

    // Bet amount
    document.querySelectorAll('.roul-quick').forEach(btn => {
      btn.addEventListener('click', () => betAmount = parseInt(btn.dataset.val) || betAmount);
    });

    // Clear bets
    document.getElementById('roul-clear')?.addEventListener('click', () => { selectedBets = {}; renderBettingTable(); });
  }

  return { init };
})();
