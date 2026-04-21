// LuckyDev Casino — Video Poker (Jacks or Better)

const VideoPoker = (() => {
  const SUITS = ['spade','heart','diamond','club'];
  const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const SUIT_COLORS = { spade:'black', heart:'red', diamond:'red', club:'black' };
  const SUIT_ICONS = { spade:'card-spade', heart:'card-heart', diamond:'card-diamond', club:'card-club' };

  let deck = [];
  let hand = [];
  let held = [false,false,false,false,false];
  let betAmount = 10;
  let phase = 'bet'; // bet / hold / end

  const PAY_TABLE = {
    'Royal Flush': 800,
    'Straight Flush': 50,
    'Four of a Kind': 25,
    'Full House': 9,
    'Flush': 6,
    'Straight': 4,
    'Three of a Kind': 3,
    'Two Pair': 2,
    'Jacks or Better': 1,
    'No Win': 0,
  };

  function buildDeck() {
    deck = [];
    SUITS.forEach(suit => VALUES.forEach(val => deck.push({ suit, val })));
    for (let i = deck.length-1; i>0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [deck[i],deck[j]] = [deck[j],deck[i]];
    }
  }

  function draw() { return deck.pop(); }

  function cardVal(card) {
    if (['J','Q','K'].includes(card.val)) return 11;
    if (card.val === 'A') return 14;
    return parseInt(card.val);
  }

  function evaluateHand(hand) {
    const vals = hand.map(c => cardVal(c)).sort((a,b)=>a-b);
    const suits = hand.map(c => c.suit);
    const counts = {};
    vals.forEach(v => counts[v] = (counts[v]||0)+1);
    const cnt = Object.values(counts).sort((a,b)=>b-a);
    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = vals[4]-vals[0]===4 && cnt[0]===1;
    const isRoyalStraight = JSON.stringify(vals)===JSON.stringify([10,11,12,13,14]);

    if (isFlush && isRoyalStraight) return 'Royal Flush';
    if (isFlush && isStraight) return 'Straight Flush';
    if (cnt[0]===4) return 'Four of a Kind';
    if (cnt[0]===3 && cnt[1]===2) return 'Full House';
    if (isFlush) return 'Flush';
    if (isStraight) return 'Straight';
    if (cnt[0]===3) return 'Three of a Kind';
    if (cnt[0]===2 && cnt[1]===2) return 'Two Pair';
    // Jacks or Better: pair of J/Q/K/A
    if (cnt[0]===2) {
      const pairVal = parseInt(Object.entries(counts).find(([v,c]) => c===2)[0]);
      if (pairVal >= 11) return 'Jacks or Better';
    }
    return 'No Win';
  }

  function deal() {
    if (phase !== 'bet') return;
    betAmount = parseInt(document.getElementById('poker-bet')?.value) || 10;
    if (!Core.placeBet(betAmount)) { showToast('info', 'Insufficient chips','','warning'); return; }
    buildDeck();
    hand = Array.from({length:5}, () => draw());
    held = [false,false,false,false,false];
    phase = 'hold';
    renderHand();
    Audio.playCardDeal();
    document.getElementById('poker-deal')?.setAttribute('disabled','true');
    document.getElementById('poker-draw')?.removeAttribute('disabled');
    document.getElementById('poker-result').textContent = '';
    updatePayTable('');
  }

  function drawCards() {
    if (phase !== 'hold') return;
    hand.forEach((c,i) => { if (!held[i]) hand[i] = draw(); });
    phase = 'end';
    renderHand();
    Audio.playCardDeal();

    const result = evaluateHand(hand);
    const mult = PAY_TABLE[result];
    const winAmount = betAmount * mult;

    updatePayTable(result);

    const resultEl = document.getElementById('poker-result');
    if (mult > 0) {
      Core.resolveWin(winAmount, betAmount);
      Core.trackFirstWin();
      Addiction.onWin();
      Audio.playWin(winAmount);
      if (resultEl) { resultEl.textContent = `${result}! +${winAmount.toLocaleString()} chips!`; resultEl.className = 'game-result win'; }
      if (mult >= 25) { goldFlash(); Particles.winShower(null,null,24); }
      if (result === 'Royal Flush') {
        Core.trackRoyalFlush();
        showJackpot(winAmount);
        Particles.jackpotRain();
      }
      FirebaseDB.submitScore(Core.getState().username, Core.getBalance(), winAmount, 'Video Poker');
    } else {
      Core.resolveLoss();
      Addiction.onLoss();
      Audio.playLoss();
      if (resultEl) { resultEl.textContent = 'No win this time.'; resultEl.className = 'game-result lose'; }
    }

    document.getElementById('poker-draw')?.setAttribute('disabled','true');
    setTimeout(() => {
      phase = 'bet';
      document.getElementById('poker-deal')?.removeAttribute('disabled');
    }, 1500);
  }

  function toggleHold(idx) {
    if (phase !== 'hold') return;
    held[idx] = !held[idx];
    renderHand();
  }

  function renderHand() {
    const container = document.getElementById('poker-cards');
    if (!container) return;
    container.innerHTML = hand.map((card, i) => {
      const color = SUIT_COLORS[card.suit];
      const icon = SUIT_ICONS[card.suit];
      const isHeld = held[i];
      return `
        <div class="poker-card ${color}${isHeld?' held':''} animate-card-deal" style="animation-delay:${i*100}ms" onclick="VideoPoker.toggleHold(${i})">
          ${isHeld ? '<div class="held-label">HELD</div>' : ''}
          <div style="font-size:1.1rem;font-weight:900">${card.val}</div>
          <svg class="icon card-suit" style="color:${color==='red'?'#CC0000':'#111'};width:18px;height:18px" aria-hidden="true"><use href="#icon-${icon}"/></svg>
          <div class="card-center">
            <svg class="icon" style="width:36px;height:36px;color:${color==='red'?'#CC0000':'#111'}" aria-hidden="true"><use href="#icon-${icon}"/></svg>
          </div>
          <div style="font-size:1.1rem;font-weight:900;position:absolute;bottom:7px;right:7px;transform:rotate(180deg)">${card.val}</div>
        </div>`;
    }).join('');
  }

  function updatePayTable(current) {
    document.querySelectorAll('.poker-pay-row').forEach(row => {
      row.classList.toggle('active', row.dataset.hand === current);
    });
  }

  function init() {
    document.getElementById('poker-deal')?.addEventListener('click', deal);
    document.getElementById('poker-draw')?.addEventListener('click', drawCards);
    document.getElementById('poker-draw')?.setAttribute('disabled','true');
    const betInp = document.getElementById('poker-bet');
    betInp?.addEventListener('change', () => {
      betAmount = Math.max(1, Math.min(Core.getBalance(), parseInt(betInp.value)||1));
    });
    document.querySelectorAll('.poker-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        betAmount = parseInt(btn.dataset.val)||betAmount;
        if (betInp) betInp.value = betAmount;
      });
    });
  }

  return { init, toggleHold };
})();
