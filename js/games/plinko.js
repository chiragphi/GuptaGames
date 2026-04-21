// LuckyDev Casino — Plinko Game
// Physics simulation with near-miss system and multi-ball

const Plinko = (() => {
  const ROWS = 16;
  const BUCKETS = ROWS + 1; // 17 buckets
  let canvas, ctx;
  let balls = [];
  let pegs = [];
  let animFrame = null;
  let risk = 'med'; // low / med / high
  let betAmount = 10;
  let ballTrails = []; // ghost trails for last 10 balls
  let lastBallLanding = [];

  // Multiplier tables per risk
  const MULTIPLIERS = {
    low:  [0.3, 0.4, 0.5, 0.7, 1.0, 1.0, 1.0, 1.5, 1.0, 1.0, 1.0, 0.7, 0.5, 0.4, 0.3, 1.5, 0.2],
    med:  [0.2, 0.3, 0.4, 0.5, 0.8, 1.0, 1.5, 3.0, 1.5, 1.0, 0.8, 0.5, 0.4, 0.3, 0.2, 5.0, 1000],
    high: [0.1, 0.2, 0.2, 0.3, 0.4, 0.5, 1.0, 5.0, 1.0, 0.5, 0.4, 0.3, 0.2, 0.2, 0.1, 10.0, 1000],
  };

  const BUCKET_COLORS = {
    low:  ['#FF6B35','#FF8C42','#FFA552','#FFD700','#30D158','#30D158','#30D158','#FFD700','#30D158','#30D158','#30D158','#FFD700','#FFA552','#FF8C42','#FF6B35','#FF6B35','#FF3B30'],
    med:  ['#FF3B30','#FF6B35','#FF8C42','#FFA552','#FFD700','#30D158','#00FFFF','#FFD700','#00FFFF','#30D158','#FFD700','#FFA552','#FF8C42','#FF6B35','#FF3B30','#FF3B30','#BF5AF2'],
    high: ['#8B0000','#CC1100','#FF3B30','#FF6B35','#FFA552','#FFD700','#30D158','#00FFFF','#30D158','#FFD700','#FFA552','#FF6B35','#FF3B30','#CC1100','#8B0000','#FF3B30','#BF5AF2'],
  };

  const W_SCALE = 1;
  let W, H;
  let pegRadius = 5;
  let ballRadius = 1;
  let pegSpacing;
  let topOffset;

  class Ball {
    constructor(startX, isNearMiss = false) {
      this.x = startX;
      this.y = topOffset - 30;
      this.vx = (Math.random() - 0.5) * 1.2;
      this.vy = 0;
      this.radius = ballRadius;
      this.trail = [];
      this.landed = false;
      this.bucket = -1;
      this.bounces = 0;
      this.color = '#FFD700';
      this.isNearMiss = isNearMiss;
      this.targetBucket = isNearMiss ? Addiction.getPlinkoNearMissBucket(BUCKETS) : -1;
    }

    update() {
      if (this.landed) return;

      this.vy += 0.35; // gravity
      this.x += this.vx;
      this.y += this.vy;

      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 8) this.trail.shift();

      // Plinko-style deflection: each peg sends ball left or right, never traps
      let hitPeg = false;
      for (const peg of pegs) {
        if (hitPeg) break;
        const dx = this.x - peg.x;
        const dy = this.y - peg.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.radius + pegRadius + 1) {
          hitPeg = true;

          // Decide direction — bias toward near-miss target if applicable
          let goRight = Math.random() < 0.5;
          if (this.isNearMiss && this.targetBucket >= 0) {
            const centerX = pegSpacing * (0.5 + this.targetBucket);
            if (Math.abs(centerX - this.x) > pegSpacing * 0.3)
              goRight = centerX > this.x;
          }

          const side = goRight ? 1 : -1;
          const sep = this.radius + pegRadius + 2;

          // Place ball beside and below the peg so it can't re-collide
          this.x = peg.x + side * sep;
          this.y = peg.y + sep * 0.5;

          // Horizontal impulse in chosen direction, preserve downward momentum
          this.vx = side * (Math.abs(this.vx) * 0.5 + pegSpacing * 0.12 + Math.random() * pegSpacing * 0.08);
          this.vy = Math.abs(this.vy) * 0.6 + 1.5;

          this.bounces++;
          Audio.playPlinkoHit();
        }
      }

      // Boundaries
      if (this.x < this.radius) { this.x = this.radius; this.vx = Math.abs(this.vx); }
      if (this.x > W - this.radius) { this.x = W - this.radius; this.vx = -Math.abs(this.vx); }

      // Landed in bucket
      if (this.y > H - 20) {
        this.landed = true;
        this.y = H - 20;
        this.bucket = Math.floor(this.x / pegSpacing);
        this.bucket = Math.max(0, Math.min(BUCKETS - 1, this.bucket));
        onBallLand(this);
      }
    }

    draw(ctx) {
      // Trail
      this.trail.forEach((pt, i) => {
        const alpha = (i / this.trail.length) * 0.4;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, this.radius * (i / this.trail.length), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,215,0,${alpha})`;
        ctx.fill();
      });

      // Ball
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(this.x - 2, this.y - 2, 1, this.x, this.y, this.radius);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.4, '#FFD700');
      grad.addColorStop(1, '#FF8C00');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function onBallLand(ball) {
    const mults = MULTIPLIERS[risk];
    const mult = mults[ball.bucket] || 0.2;
    const win = Math.floor(betAmount * mult);

    Core.resolveWin(win, betAmount);
    Core.trackPlinko();
    Core.trackFirstWin();

    if (mult >= 1000) {
      Core.trackPlinkoMax();
      showJackpot(win);
      Particles.jackpotRain();
    } else if (mult >= 5) {
      goldFlash();
      Particles.winShower(ball.x, ball.y, 20);
      Audio.playWin(win);
    } else if (win > betAmount) {
      Audio.playCoin();
      Particles.burstAt(canvas, 8);
    } else if (win < betAmount) {
      Addiction.handleLossDisguised(win, betAmount);
    } else {
      Audio.playLoss();
      Core.resolveLoss();
    }

    Addiction.onWin();
    showToast(win > betAmount ? 'win' : 'info',
      `Bucket ${ball.bucket + 1} — ${mult}x`,
      win > betAmount ? `+${(win - betAmount).toLocaleString()} chips profit!` : `Got ${win.toLocaleString()} chips`,
      'gem');

    lastBallLanding.unshift({ bucket: ball.bucket, mult, win });
    if (lastBallLanding.length > 10) lastBallLanding.pop();

    FirebaseDB.submitScore(Core.getState().username, Core.getBalance(), win, 'Plinko');
  }

  function buildPegs() {
    pegs = [];
    for (let row = 0; row < ROWS; row++) {
      const count = row + 2;
      const rowWidth = (count - 1) * pegSpacing;
      const startX = (W - rowWidth) / 2;
      for (let col = 0; col < count; col++) {
        pegs.push({
          x: startX + col * pegSpacing,
          y: topOffset + row * pegSpacing * 0.85,
        });
      }
    }
  }

  function drawPegs() {
    pegs.forEach(peg => {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, pegRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#334466';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(peg.x - 1.5, peg.y - 1.5, pegRadius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    });
  }

  function drawBuckets() {
    const mults = MULTIPLIERS[risk];
    const colors = BUCKET_COLORS[risk];
    const bucketW = W / BUCKETS;
    const bucketH = 26;
    const y = H - bucketH;

    mults.forEach((m, i) => {
      const x = i * bucketW;
      ctx.fillStyle = colors[i] || '#333';
      ctx.fillRect(x + 1, y, bucketW - 2, bucketH);

      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 1, y, bucketW - 2, 4);

      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.max(8, 10 - BUCKETS * 0.3)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(m >= 100 ? m + 'x' : m + 'x', x + bucketW / 2, y + bucketH - 6);
    });
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawPegs();
    drawBuckets();

    balls.forEach(b => { b.update(); b.draw(ctx); });
    balls = balls.filter(b => !b.landed || (Date.now() - (b.landedAt || Date.now())) < 1000);
    balls.forEach(b => { if (b.landed && !b.landedAt) b.landedAt = Date.now(); });

    animFrame = requestAnimationFrame(loop);
  }

  function dropBall(count = 1) {
    for (let i = 0; i < Math.min(count, 5); i++) {
      if (!Core.placeBet(betAmount)) {
        showToast('info', 'Insufficient chips', 'Not enough chips.', 'warning');
        break;
      }
      const cx = W / 2 + (Math.random() - 0.5) * 20;
      const nearMiss = Addiction.shouldNearMiss() && i === 0;
      setTimeout(() => balls.push(new Ball(cx, nearMiss)), i * 200);
    }
  }

  function init() {
    canvas = document.getElementById('plinko-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    function resize() {
      W = Math.min(window.innerWidth - 40, 560);
      H = Math.min(window.innerHeight * 0.65, 540);
      canvas.width = W;
      canvas.height = H;
      pegSpacing = W / (ROWS + 2);
      topOffset = pegSpacing * 0.6;
      ballRadius = 3;
      buildPegs();
    }
    resize();
    window.addEventListener('resize', () => { resize(); });

    loop();

    // Controls
    document.getElementById('plinko-drop')?.addEventListener('click', () => {
      const count = parseInt(document.getElementById('ball-count')?.value) || 1;
      dropBall(count);
    });

    // Risk buttons
    document.querySelectorAll('.risk-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        risk = btn.dataset.risk;
        document.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('active','low','med','high'));
        btn.classList.add('active', risk);
      });
    });

    document.querySelector('.risk-btn[data-risk="med"]')?.classList.add('active', 'med');

    const betInp = document.getElementById('plinko-bet');
    if (betInp) {
      betInp.value = betAmount;
      betInp.addEventListener('change', () => {
        betAmount = Math.max(1, Math.min(Core.getBalance(), parseInt(betInp.value) || 1));
        betInp.value = betAmount;
      });
    }
    document.querySelectorAll('.plinko-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        betAmount = parseInt(btn.dataset.val) || betAmount;
        if (betInp) betInp.value = betAmount;
      });
    });
  }

  return { init };
})();
