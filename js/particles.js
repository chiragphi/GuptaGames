// LuckyDev Casino — Canvas Particle System
// Coin SVG shower on wins, confetti on jackpot

const Particles = (() => {
  let canvas = null;
  let ctx = null;
  let particles = [];
  let animFrame = null;
  let active = false;

  // Coin SVG path data for canvas rendering
  function drawCoin(ctx, x, y, r, rotation, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Main circle
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Inner ring
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = r * 0.1;
    ctx.stroke();

    // Shine glint
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.25, r * 0.15, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();

    ctx.restore();
  }

  function drawStar(ctx, x, y, r, rotation, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 4) / 5 - Math.PI / 2;
      const outerX = Math.cos(angle) * r;
      const outerY = Math.sin(angle) * r;
      const innerAngle = angle + Math.PI / 5;
      const innerX = Math.cos(innerAngle) * r * 0.4;
      const innerY = Math.sin(innerAngle) * r * 0.4;
      if (i === 0) ctx.moveTo(outerX, outerY);
      else ctx.lineTo(outerX, outerY);
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawDiamond(ctx, x, y, r, rotation, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.7, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.7, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  class Particle {
    constructor(x, y, type) {
      this.x = x;
      this.y = y;
      this.type = type || ['coin', 'star', 'diamond'][Math.floor(Math.random() * 3)];
      this.vx = (Math.random() - 0.5) * 8;
      this.vy = Math.random() * -12 - 4;
      this.gravity = 0.4;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.3;
      this.r = Math.random() * 10 + 6;
      this.alpha = 1;
      this.alphaDecay = Math.random() * 0.008 + 0.006;
      const colors = ['#FFD700', '#FFA500', '#00FFFF', '#FF9F0A', '#FFD700', '#FFFFFF'];
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
      this.x += this.vx;
      this.vy += this.gravity;
      this.y += this.vy;
      this.rotation += this.rotSpeed;
      this.alpha -= this.alphaDecay;
      if (this.y > window.innerHeight + 50) this.alpha = 0;
    }

    draw(ctx) {
      ctx.globalAlpha = Math.max(0, this.alpha);
      if (this.type === 'coin') drawCoin(ctx, this.x, this.y, this.r, this.rotation, this.color);
      else if (this.type === 'star') drawStar(ctx, this.x, this.y, this.r, this.rotation, this.color);
      else drawDiamond(ctx, this.x, this.y, this.r, this.rotation, this.color);
    }

    isDead() { return this.alpha <= 0; }
  }

  class JackpotParticle extends Particle {
    constructor() {
      const x = Math.random() * window.innerWidth;
      super(x, -20, ['coin', 'star', 'diamond'][Math.floor(Math.random() * 3)]);
      this.vx = (Math.random() - 0.5) * 4;
      this.vy = Math.random() * 4 + 2;
      this.gravity = 0.05;
      this.alphaDecay = 0.003;
      this.r = Math.random() * 14 + 8;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.rotation += this.rotSpeed;
      this.alpha -= this.alphaDecay;
      if (this.y > window.innerHeight + 50) this.alpha = 0;
    }
  }

  function init() {
    canvas = document.getElementById('particle-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'particle-canvas';
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9997;';
      document.body.appendChild(canvas);
    }
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  function loop() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles = particles.filter(p => !p.isDead());
    particles.forEach(p => { p.update(); p.draw(ctx); });

    ctx.globalAlpha = 1;

    if (particles.length > 0 || active) {
      animFrame = requestAnimationFrame(loop);
    } else {
      animFrame = null;
    }
  }

  function startLoop() {
    if (!animFrame) animFrame = requestAnimationFrame(loop);
  }

  // ===== WIN SHOWER =====
  function winShower(x, y, count = 24) {
    if (!canvas) init();
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(x || window.innerWidth / 2, y || window.innerHeight / 2));
    }
    startLoop();
  }

  // ===== JACKPOT RAIN =====
  function jackpotRain() {
    if (!canvas) init();
    active = true;
    let count = 0;
    const maxParticles = 200;
    const interval = setInterval(() => {
      for (let i = 0; i < 8; i++) {
        particles.push(new JackpotParticle());
      }
      count += 8;
      if (count >= maxParticles) {
        clearInterval(interval);
        active = false;
      }
    }, 80);
    startLoop();
  }

  // ===== BURST AT ELEMENT =====
  function burstAt(el, count = 16) {
    if (!el) { winShower(null, null, count); return; }
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    winShower(cx, cy, count);
  }

  return { init, winShower, jackpotRain, burstAt };
})();
