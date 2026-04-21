// LuckyDev Casino — Web Audio API Synthesis Engine
// All sounds are synthesized — no audio files

const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let muted = false;
  let volume = 0.6;
  let ambientNode = null;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
  }

  function setMuted(m) {
    muted = m;
    if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
  }

  // ===== ENVELOPE HELPER =====
  function envelope(gainNode, t, attack, hold, release, peak = 1) {
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(peak, t + attack);
    gainNode.gain.setValueAtTime(peak, t + attack + hold);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + attack + hold + release);
  }

  // ===== COIN CLINK =====
  function playCoin(pitchMult = 1.0) {
    try {
      const c = getCtx();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      const osc2 = c.createOscillator();
      const g2 = c.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200 * pitchMult, t);
      osc.frequency.exponentialRampToValueAtTime(800 * pitchMult, t + 0.15);
      envelope(g, t, 0.001, 0.02, 0.18, 0.5);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2400 * pitchMult, t);
      osc2.frequency.exponentialRampToValueAtTime(1800 * pitchMult, t + 0.1);
      envelope(g2, t, 0.001, 0.01, 0.12, 0.3);

      osc.connect(g); g.connect(masterGain);
      osc2.connect(g2); g2.connect(masterGain);
      osc.start(t); osc.stop(t + 0.22);
      osc2.start(t); osc2.stop(t + 0.16);
    } catch(e) {}
  }

  // ===== BIG WIN COINS =====
  function playWin(amount = 1) {
    try {
      const c = getCtx();
      const count = Math.min(10, Math.floor(amount / 50) + 1);
      for (let i = 0; i < count; i++) {
        setTimeout(() => playCoin(1 + i * 0.08), i * 60);
      }
    } catch(e) {}
  }

  // ===== LOSS THUD =====
  function playLoss() {
    try {
      const c = getCtx();
      const t = c.currentTime;
      const buf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.05));
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      envelope(g, t, 0.001, 0.05, 0.25, 0.8);
      src.connect(filter); filter.connect(g); g.connect(masterGain);
      src.start(t);

      // Low tone
      const osc = c.createOscillator();
      const g2 = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
      envelope(g2, t, 0.001, 0.05, 0.3, 0.6);
      osc.connect(g2); g2.connect(masterGain);
      osc.start(t); osc.stop(t + 0.4);
    } catch(e) {}
  }

  // ===== SLOT SPIN WHIRR =====
  function playSlotSpin() {
    try {
      const c = getCtx();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.linearRampToValueAtTime(200, t + 0.3);
      osc.frequency.linearRampToValueAtTime(90, t + 1.2);
      envelope(g, t, 0.05, 0.8, 0.4, 0.2);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 1.4);
    } catch(e) {}
  }

  // ===== REEL CLICK STOP =====
  function playReelStop(reelIdx = 0) {
    try {
      const c = getCtx();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'square';
      osc.frequency.value = 300 + reelIdx * 40;
      envelope(g, t, 0.001, 0.01, 0.06, 0.4);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.08);
    } catch(e) {}
  }

  // ===== LEVEL UP FANFARE =====
  function playLevelUp() {
    try {
      const c = getCtx();
      const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
      notes.forEach((freq, i) => {
        const t = c.currentTime + i * 0.12;
        const osc = c.createOscillator();
        const osc2 = c.createOscillator();
        const g = c.createGain();
        osc.type = 'triangle';
        osc2.type = 'sine';
        osc.frequency.value = freq;
        osc2.frequency.value = freq * 2;
        envelope(g, t, 0.01, 0.08, 0.15, 0.4);
        osc.connect(g); osc2.connect(g); g.connect(masterGain);
        osc.start(t); osc.stop(t + 0.25);
        osc2.start(t); osc2.stop(t + 0.25);
      });
    } catch(e) {}
  }

  // ===== ACHIEVEMENT CHIME =====
  function playAchievement() {
    try {
      const c = getCtx();
      const t = c.currentTime;
      [880, 1108, 1320].forEach((freq, i) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        envelope(g, t + i * 0.1, 0.01, 0.1, 0.3, 0.35);
        osc.connect(g); g.connect(masterGain);
        osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.45);
      });
    } catch(e) {}
  }

  // ===== JACKPOT SIREN =====
  function playJackpot() {
    try {
      const c = getCtx();
      const t = c.currentTime;
      // Siren sweep
      for (let i = 0; i < 8; i++) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, t + i * 0.5);
        osc.frequency.linearRampToValueAtTime(800, t + i * 0.5 + 0.25);
        osc.frequency.linearRampToValueAtTime(400, t + i * 0.5 + 0.5);
        envelope(g, t + i * 0.5, 0.02, 0.2, 0.28, 0.3);
        osc.connect(g); g.connect(masterGain);
        osc.start(t + i * 0.5); osc.stop(t + i * 0.5 + 0.52);
      }
      // Coin shower sound
      for (let i = 0; i < 20; i++) {
        setTimeout(() => playCoin(0.8 + Math.random() * 0.6), i * 180);
      }
    } catch(e) {}
  }

  // ===== BUTTON CLICK =====
  function playClick() {
    try {
      const c = getCtx();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = 600;
      envelope(g, t, 0.001, 0.005, 0.04, 0.25);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.06);
    } catch(e) {}
  }

  // ===== CRASH MULTIPLIER TICK =====
  function playCrashTick(mult) {
    try {
      const c = getCtx();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = Math.min(200 + mult * 30, 800);
      envelope(g, t, 0.001, 0.005, 0.03, 0.1);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.04);
    } catch(e) {}
  }

  // ===== CRASH EXPLOSION =====
  function playCrashBust() {
    try {
      const c = getCtx();
      const t = c.currentTime;
      const buf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.15));
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 400;
      envelope(g, t, 0.001, 0.1, 0.5, 1.0);
      src.connect(filter); filter.connect(g); g.connect(masterGain);
      src.start(t);
      playLoss();
    } catch(e) {}
  }

  // ===== CARD DEAL =====
  function playCardDeal() {
    try {
      const c = getCtx();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.06);
      envelope(g, t, 0.001, 0.01, 0.06, 0.3);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.08);
    } catch(e) {}
  }

  // ===== ROULETTE SPIN =====
  function playRouletteSpin() {
    try {
      const c = getCtx();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 3.0);
      envelope(g, t, 0.1, 2.0, 1.0, 0.15);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 3.5);
    } catch(e) {}
  }

  // ===== MINE EXPLOSION =====
  function playMineExplosion() {
    try {
      const c = getCtx();
      playLoss();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, t + 0.1);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
      envelope(g, t + 0.1, 0.001, 0.05, 0.35, 0.7);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + 0.1); osc.stop(t + 0.5);
    } catch(e) {}
  }

  // ===== AMBIENT CASINO HUM =====
  function playAmbient() {
    try {
      const c = getCtx();
      if (ambientNode) { ambientNode.stop(); ambientNode = null; }

      const buf = c.createBuffer(2, c.sampleRate * 4, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.08;
        }
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const filter = c.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 300; filter.Q.value = 0.3;

      const g = c.createGain();
      g.gain.value = 0.08;

      src.connect(filter); filter.connect(g); g.connect(masterGain);
      src.start();
      ambientNode = src;
    } catch(e) {}
  }

  function stopAmbient() {
    if (ambientNode) { try { ambientNode.stop(); } catch(e) {} ambientNode = null; }
  }

  // ===== CHIME (bonus popup) =====
  function playChime() {
    try {
      const c = getCtx();
      const t = c.currentTime;
      [523, 659, 784, 1047, 1319].forEach((freq, i) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        envelope(g, t + i * 0.08, 0.01, 0.06, 0.2, 0.4);
        osc.connect(g); g.connect(masterGain);
        osc.start(t + i * 0.08); osc.stop(t + i * 0.08 + 0.32);
      });
    } catch(e) {}
  }

  // ===== PLINKO PEG HIT =====
  function playPlinkoHit() {
    try {
      const c = getCtx();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = 800 + Math.random() * 400;
      envelope(g, t, 0.001, 0.005, 0.04, 0.2);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.05);
    } catch(e) {}
  }

  // ===== DICE ROLL =====
  function playDiceRoll() {
    try {
      const c = getCtx();
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          const t = c.currentTime;
          const osc = c.createOscillator();
          const g = c.createGain();
          osc.type = 'square';
          osc.frequency.value = 200 + Math.random() * 300;
          envelope(g, t, 0.001, 0.01, 0.04, 0.2);
          osc.connect(g); g.connect(masterGain);
          osc.start(t); osc.stop(t + 0.06);
        }, i * 40);
      }
    } catch(e) {}
  }

  // ===== COIN FLIP =====
  function playCoinFlip() {
    try {
      const c = getCtx();
      for (let i = 0; i < 12; i++) {
        const t = c.currentTime + i * 0.07;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 400 + Math.sin(i * 0.8) * 200;
        envelope(g, t, 0.001, 0.01, 0.05, 0.15);
        osc.connect(g); g.connect(masterGain);
        osc.start(t); osc.stop(t + 0.07);
      }
    } catch(e) {}
  }

  // ===== VOLUME SLIDER =====
  function initVolumeControl(slider, muteBtn) {
    if (slider) {
      slider.value = volume;
      slider.addEventListener('input', () => setVolume(parseFloat(slider.value)));
    }
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        setMuted(!muted);
        const icon = muteBtn.querySelector('use');
        if (icon) icon.setAttribute('href', muted ? '#icon-mute' : '#icon-volume');
      });
    }
  }

  // Wire up all buttons to play click sound
  function wireButtonSounds() {
    document.addEventListener('click', e => {
      if (e.target.closest('button, .btn, .mine-tile, .tower-tile, .roul-cell')) {
        playClick();
      }
    }, { passive: true });
  }

  return {
    playCoin, playWin, playLoss, playSlotSpin, playReelStop, playLevelUp,
    playAchievement, playJackpot, playClick, playCrashTick, playCrashBust,
    playCardDeal, playRouletteSpin, playMineExplosion, playAmbient, stopAmbient,
    playChime, playPlinkoHit, playDiceRoll, playCoinFlip,
    setVolume, setMuted, initVolumeControl, wireButtonSounds,
  };
})();
