// LuckyDev Casino — Plinko Game
// Path-precomputed animation (no physics engine)

const Plinko = (() => {
  const ROWS = 16;
  const BUCKETS = ROWS + 1;
  let canvas, ctx;
  let activeBalls = [];
  let pegs = [];
  let animFrame = null;
  let risk = 'med';
  let betAmount = 10;
  let lastBallLanding = [];

  const MULTIPLIERS = {
    low:  [0.3,0.4,0.5,0.7,1.0,1.0,1.0,1.5,1.0,1.0,1.0,0.7,0.5,0.4,0.3,1.5,0.2],
    med:  [0.2,0.3,0.4,0.5,0.8,1.0,1.5,3.0,1.5,1.0,0.8,0.5,0.4,0.3,0.2,5.0,1000],
    high: [0.1,0.2,0.2,0.3,0.4,0.5,1.0,5.0,1.0,0.5,0.4,0.3,0.2,0.2,0.1,10.0,1000],
  };

  const BUCKET_COLORS = {
    low:  ['#FF6B35','#FF8C42','#FFA552','#FFD700','#30D158','#30D158','#30D158','#FFD700','#30D158','#30D158','#30D158','#FFD700','#FFA552','#FF8C42','#FF6B35','#FF6B35','#FF3B30'],
    med:  ['#FF3B30','#FF6B35','#FF8C42','#FFA552','#FFD700','#30D158','#00FFFF','#FFD700','#00FFFF','#30D158','#FFD700','#FFA552','#FF8C42','#FF6B35','#FF3B30','#FF3B30','#BF5AF2'],
    high: ['#8B0000','#CC1100','#FF3B30','#FF6B35','#FFA552','#FFD700','#30D158','#00FFFF','#30D158','#FFD700','#FFA552','#FF6B35','#FF3B30','#CC1100','#8B0000','#FF3B30','#BF5AF2'],
  };

  let W, H, pegSpacing, topOffset;
  const PEG_R = 5;
  const BALL_R = 3;

  // Build peg grid
  function buildPegs() {
    pegs = [];
    for (let row = 0; row < ROWS; row++) {
      const count = row + 2;
      const rowW = (count - 1) * pegSpacing;
      const startX = (W - rowW) / 2;
      for (let col = 0; col < count; col++) {
        pegs.push({ x: startX + col * pegSpacing, y: topOffset + row * pegSpacing * 0.85, row, col });
      }
    }
  }

  // Pre-compute waypoints for a ball drop — purely positional, no physics
  function computePath(nearMiss, targetBucket) {
    const waypoints = [];
    // Start above first peg row
    waypoints.push({ x: W / 2, y: topOffset - pegSpacing * 0.8 });

    let col = 0; // column offset within current row (0 = leftmost slot)

    for (let row = 0; row < ROWS; row++) {
      // Choose direction: 0 = left, 1 = right
      let dir;
      if (nearMiss && targetBucket >= 0 && row >= ROWS - 4) {
        // Bias last 4 rows toward target
        const curBucket = col; // col after row bounces = bucket index
        dir = targetBucket > curBucket ? 1 : 0;
      } else {
        dir = Math.random() < 0.5 ? 0 : 1;
      }

      // Peg hit in this row: there are (row+2) pegs, ball is between col and col+1
      const count = row + 2;
      const rowW = (count - 1) * pegSpacing;
      const startX = (W - rowW) / 2;
      const pegX = startX + (col + dir) * pegSpacing; // peg it deflects off
      const pegY = topOffset + row * pegSpacing * 0.85;

      waypoints.push({ x: pegX, y: pegY });

      // After deflection, col advances by dir (ball moves right if dir=1)
      col += dir;
    }

    // Final bucket
    const bucket = Math.max(0, Math.min(BUCKETS - 1, col));
    const bucketW = W / BUCKETS;
    const bucketX = bucket * bucketW + bucketW / 2;
    waypoints.push({ x: bucketX, y: H - 14 });

    return { waypoints, bucket };
  }

  class AnimBall {
    constructor(betAmt) {
      this.betAmt = betAmt;
      const nearMiss = Addiction.shouldNearMiss();
      const target = nearMiss ? Addiction.getPlinkoNearMissBucket(BUCKETS) : -1;
      const { waypoints, bucket } = computePath(nearMiss, target);
      this.waypoints = waypoints;
      this.bucket = bucket;
      this.wpIdx = 0;        // current waypoint index
      this.t = 0;            // interpolation 0→1 between waypoints
      this.done = false;
      this.trail = [];
      // Speed: frames between waypoints (lower = faster)
      this.framesPerStep = 10;
    }

    get x() { return this._x || this.waypoints[0].x; }
    get y() { return this._y || this.waypoints[0].y; }

    update() {
      if (this.done) return;
      const from = this.waypoints[this.wpIdx];
      const to   = this.waypoints[this.wpIdx + 1];
      if (!to) { this.done = true; onBallLand(this); return; }

      this.t += 1 / this.framesPerStep;
      if (this.t >= 1) {
        this.t = 0;
        this.wpIdx++;
        if (this.wpIdx >= this.waypoints.length - 1) {
          this._x = to.x; this._y = to.y;
          this.done = true;
          onBallLand(this);
          return;
        }
        Audio.playPlinkoHit();
      }

      // Ease-in-out for natural feel
      const ease = this.t < 0.5 ? 2 * this.t * this.t : -1 + (4 - 2 * this.t) * this.t;
      this._x = from.x + (to.x - from.x) * ease;
      this._y = from.y + (to.y - from.y) * ease;

      this.trail.push({ x: this._x, y: this._y });
      if (this.trail.length > 6) this.trail.shift();
    }

    draw() {
      // Trail
      this.trail.forEach((pt, i) => {
        const a = (i / this.trail.length) * 0.35;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, BALL_R * (i / this.trail.length), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,215,0,${a})`;
        ctx.fill();
      });
      // Ball
      ctx.beginPath();
      ctx.arc(this._x, this._y, BALL_R, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(this._x - 1, this._y - 1, 0.5, this._x, this._y, BALL_R);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.4, '#FFD700');
      g.addColorStop(1, '#FF8C00');
      ctx.fillStyle = g;
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function onBallLand(ball) {
    const mults = MULTIPLIERS[risk];
    const mult  = mults[ball.bucket] || 0.2;
    const win   = Math.floor(ball.betAmt * mult);

    Core.resolveWin(win, ball.betAmt);
    Core.trackPlinko();
    Core.trackFirstWin();

    if (mult >= 1000) {
      Core.trackPlinkoMax();
      showJackpot(win);
      Particles.jackpotRain();
    } else if (mult >= 5) {
      goldFlash();
      Particles.winShower(ball._x, ball._y, 20);
      Audio.playWin(win);
    } else if (win > ball.betAmt) {
      Audio.playCoin();
    } else {
      Addiction.handleLossDisguised(win, ball.betAmt);
      Audio.playLoss();
      Core.resolveLoss();
    }

    showToast(win > ball.betAmt ? 'win' : 'info',
      `Bucket ${ball.bucket + 1} — ${mult}x`,
      win > ball.betAmt ? `+${(win - ball.betAmt).toLocaleString()} chips profit!` : `Got ${win.toLocaleString()} chips`,
      'gem');

    lastBallLanding.unshift({ bucket: ball.bucket, mult, win });
    if (lastBallLanding.length > 10) lastBallLanding.pop();

    FirebaseDB.submitScore(Core.getState().username, Core.getBalance(), win, 'Plinko');
  }

  function drawPegs() {
    pegs.forEach(peg => {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, PEG_R, 0, Math.PI * 2);
      ctx.fillStyle = '#334466';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(peg.x - 1.5, peg.y - 1.5, PEG_R * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    });
  }

  function drawBuckets() {
    const mults  = MULTIPLIERS[risk];
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
      ctx.font = `bold ${Math.max(7, 10 - BUCKETS * 0.3)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(m + 'x', x + bucketW / 2, y + bucketH - 6);
    });
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawPegs();
    drawBuckets();
    activeBalls.forEach(b => { b.update(); if (!b.done) b.draw(); });
    activeBalls = activeBalls.filter(b => !b.done);
    animFrame = requestAnimationFrame(loop);
  }

  function dropBall(count = 1) {
    for (let i = 0; i < Math.min(count, 5); i++) {
      if (!Core.placeBet(betAmount)) {
        showToast('info', 'Insufficient chips', 'Not enough chips.', 'warning');
        break;
      }
      setTimeout(() => activeBalls.push(new AnimBall(betAmount)), i * 300);
    }
  }

  function resize() {
    W = Math.min(window.innerWidth - 40, 560);
    H = Math.min(window.innerHeight * 0.65, 540);
    canvas.width  = W;
    canvas.height = H;
    pegSpacing = W / (ROWS + 2);
    topOffset  = pegSpacing * 0.6;
    buildPegs();
  }

  function init() {
    canvas = document.getElementById('plinko-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    loop();

    document.getElementById('plinko-drop')?.addEventListener('click', () => {
      const count = parseInt(document.getElementById('ball-count')?.value) || 1;
      dropBall(count);
    });

    document.querySelectorAll('.risk-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        risk = btn.dataset.risk;
        document.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('active','low','med','high'));
        btn.classList.add('active', risk);
      });
    });
    document.querySelector('.risk-btn[data-risk="med"]')?.classList.add('active','med');

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
