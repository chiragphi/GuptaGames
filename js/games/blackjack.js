// LuckyDev Casino — Blackjack (6-deck shoe, Vegas rules)

const Blackjack = (() => {
  const SUITS = ['spade', 'heart', 'diamond', 'club'];
  const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const SUIT_ICONS = { spade: 'card-spade', heart: 'card-heart', diamond: 'card-diamond', club: 'card-club' };
  const SUIT_COLORS = { spade: 'black', heart: 'red', diamond: 'red', club: 'black' };
  const DECKS = 6;

  let shoe = [];
  let playerHand = [];
  let dealerHand = [];
  let splitHand = [];
  let betAmount = 10;
  let phase = 'bet'; // bet / play / end
  let doubled = false;
  let isSplit = false;

  function buildShoe() {
    shoe = [];
    for (let d = 0; d < DECKS; d++) {
      SUITS.forEach(suit => {
        VALUES.forEach(val => shoe.push({ suit, val }));
      });
    }
    // Shuffle
    for (let i = shoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }
  }

  function draw() {
    if (shoe.length < 10) buildShoe();
    return shoe.pop();
  }

  function cardValue(card) {
    if (['J','Q','K'].includes(card.val)) return 10;
    if (card.val === 'A') return 11;
    return parseInt(card.val);
  }

  function handValue(hand) {
    let total = 0, aces = 0;
    hand.forEach(c => {
      if (c.hidden) return;
      total += cardValue(c);
      if (c.val === 'A') aces++;
    });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  function isBlackjack(hand) { return hand.length === 2 && handValue(hand) === 21; }
  function isBust(hand) { return handValue(hand) > 21; }

  function renderCard(card, delay = 0) {
    if (card.hidden) return `
      <div class="playing-card face-down animate-card-deal" style="animation-delay:${delay}ms">
        <div style="display:flex;align-items:center;justify-content:center;height:100%">
          <svg class="icon" style="width:44px;height:44px;color:var(--cyan);opacity:0.4" aria-hidden="true"><use href="#icon-playing-card-back"/></svg>
        </div>
      </div>`;
    const color = SUIT_COLORS[card.suit];
    const icon = SUIT_ICONS[card.suit];
    return `
      <div class="playing-card ${color} animate-card-deal" style="animation-delay:${delay}ms">
        <div style="font-size:1rem;font-weight:900">${card.val}</div>
        <svg class="icon card-suit" style="color:${color==='red'?'#CC0000':'#111'}" aria-hidden="true"><use href="#icon-${icon}"/></svg>
        <div class="card-center">
          <svg class="icon" style="width:32px;height:32px;color:${color==='red'?'#CC0000':'#111'}" aria-hidden="true"><use href="#icon-${icon}"/></svg>
        </div>
        <div style="font-size:1rem;font-weight:900;position:absolute;bottom:5px;right:5px;transform:rotate(180deg)">${card.val}</div>
      </div>`;
  }

  function renderHand(hand, elId, showValue = true) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = `<div class="card-hand">${hand.map((c,i) => renderCard(c, i*120)).join('')}</div>`;
    if (showValue) {
      const val = handValue(hand);
      const valEl = document.getElementById(elId + '-value');
      if (valEl) {
        valEl.textContent = val;
        valEl.className = 'hand-value' + (val > 21 ? ' bust' : val === 21 && hand.length === 2 ? ' blackjack' : '');
      }
    }
  }

  function setActions(phase) {
    const hitBtn = document.getElementById('bj-hit');
    const standBtn = document.getElementById('bj-stand');
    const doubleBtn = document.getElementById('bj-double');
    const splitBtn = document.getElementById('bj-split');
    const betBtn = document.getElementById('bj-bet');
    const active = phase === 'play';

    if (hitBtn) hitBtn.disabled = !active;
    if (standBtn) standBtn.disabled = !active;
    if (betBtn) betBtn.disabled = active;

    const canDouble = active && !doubled && playerHand.length === 2 && Core.getBalance() >= betAmount;
    if (doubleBtn) doubleBtn.disabled = !canDouble;

    const canSplit = active && !isSplit && playerHand.length === 2 &&
      cardValue(playerHand[0]) === cardValue(playerHand[1]) && Core.getBalance() >= betAmount;
    if (splitBtn) splitBtn.disabled = !canSplit;
  }

  function dealInitial() {
    if (phase !== 'bet') return;
    betAmount = parseInt(document.getElementById('bj-bet-input')?.value) || 10;
    if (!Core.placeBet(betAmount)) {
      showToast('info', 'Insufficient chips', 'Not enough chips.', 'warning');
      return;
    }

    playerHand = [draw(), draw()];
    dealerHand = [draw(), { ...draw(), hidden: true }];
    doubled = false;
    isSplit = false;
    phase = 'play';
    setActions('play');

    renderHand(playerHand, 'player-hand');
    renderHand(dealerHand, 'dealer-hand', false);

    Audio.playCardDeal();
    setTimeout(() => Audio.playCardDeal(), 150);
    setTimeout(() => Audio.playCardDeal(), 300);
    setTimeout(() => Audio.playCardDeal(), 450);

    Core.trackBJHand();

    const statusEl = document.getElementById('bj-status');
    if (statusEl) statusEl.textContent = '';

    if (isBlackjack(playerHand)) {
      // Dealer peek
      dealerHand[1].hidden = false;
      renderHand(dealerHand, 'dealer-hand');
      if (isBlackjack(dealerHand)) {
        endRound('push');
      } else {
        endRound('blackjack');
      }
    }
  }

  function hit() {
    if (phase !== 'play') return;
    playerHand.push(draw());
    renderHand(playerHand, 'player-hand');
    Audio.playCardDeal();
    if (isBust(playerHand)) endRound('bust');
  }

  function stand() {
    if (phase !== 'play') return;
    // Dealer plays
    dealerHand[1].hidden = false;
    while (handValue(dealerHand) < 17) dealerHand.push(draw());
    renderHand(dealerHand, 'dealer-hand');
    Audio.playCardDeal();

    const pv = handValue(playerHand);
    const dv = handValue(dealerHand);
    if (isBust(dealerHand)) endRound('dealer_bust');
    else if (pv > dv) endRound('win');
    else if (pv < dv) endRound('lose');
    else endRound('push');
  }

  function doubleDown() {
    if (phase !== 'play' || doubled || playerHand.length !== 2) return;
    if (!Core.placeBet(betAmount)) return;
    doubled = true;
    betAmount *= 2;
    playerHand.push(draw());
    renderHand(playerHand, 'player-hand');
    Audio.playCardDeal();
    setActions('play');
    if (isBust(playerHand)) endRound('bust');
    else stand();
  }

  function split() {
    if (phase !== 'play' || isSplit || playerHand.length !== 2) return;
    if (cardValue(playerHand[0]) !== cardValue(playerHand[1])) return;
    if (!Core.placeBet(betAmount)) return;
    isSplit = true;
    splitHand = [playerHand.pop()];
    playerHand.push(draw());
    splitHand.push(draw());
    renderHand(playerHand, 'player-hand');
    Audio.playCardDeal();
    setActions('play');
  }

  function endRound(result) {
    phase = 'end';
    setActions('end');

    dealerHand[1] && (dealerHand[1].hidden = false);
    renderHand(dealerHand, 'dealer-hand');
    renderHand(playerHand, 'player-hand');

    const statusEl = document.getElementById('bj-status');
    const resultEl = document.getElementById('bj-result');
    let msg = '', winAmount = 0;

    switch(result) {
      case 'blackjack':
        winAmount = Math.floor(betAmount * 2.5);
        msg = 'Blackjack! 3:2 payout!';
        Core.resolveWin(winAmount, betAmount);
        Core.trackBlackjack();
        Core.trackFirstWin();
        Addiction.onWin();
        goldFlash();
        Particles.winShower(null, null, 24);
        Audio.playWin(winAmount);
        if (resultEl) { resultEl.textContent = msg; resultEl.className = 'game-result win'; }
        break;
      case 'win':
        winAmount = betAmount * 2;
        msg = `You win! +${betAmount} chips`;
        Core.resolveWin(winAmount, betAmount);
        Core.trackFirstWin();
        Addiction.onWin();
        Audio.playWin(winAmount);
        Particles.burstAt(document.getElementById('player-hand'), 12);
        if (resultEl) { resultEl.textContent = msg; resultEl.className = 'game-result win'; }
        break;
      case 'dealer_bust':
        winAmount = betAmount * 2;
        msg = 'Dealer busts! You win!';
        Core.resolveWin(winAmount, betAmount);
        Core.trackFirstWin();
        Addiction.onWin();
        Audio.playWin(winAmount);
        Particles.burstAt(document.getElementById('player-hand'), 12);
        if (resultEl) { resultEl.textContent = msg; resultEl.className = 'game-result win'; }
        break;
      case 'bust':
        msg = 'Bust! You lose.';
        Core.resolveLoss();
        Addiction.onLoss();
        Audio.playLoss();
        shakeScreen();
        if (resultEl) { resultEl.textContent = msg; resultEl.className = 'game-result lose'; }
        break;
      case 'lose':
        msg = 'Dealer wins.';
        Core.resolveLoss();
        Addiction.onLoss();
        Audio.playLoss();
        shakeScreen();
        if (resultEl) { resultEl.textContent = msg; resultEl.className = 'game-result lose'; }
        break;
      case 'push':
        winAmount = betAmount;
        msg = 'Push — tie!';
        Core.addBalance(betAmount);
        if (resultEl) { resultEl.textContent = msg; resultEl.className = 'game-result push'; }
        break;
    }

    FirebaseDB.submitScore(Core.getState().username, Core.getBalance(), winAmount, 'Blackjack');

    setTimeout(() => { phase = 'bet'; setActions('bet'); }, 1500);
  }

  function init() {
    buildShoe();
    setActions('bet');

    document.getElementById('bj-bet')?.addEventListener('click', dealInitial);
    document.getElementById('bj-hit')?.addEventListener('click', hit);
    document.getElementById('bj-stand')?.addEventListener('click', stand);
    document.getElementById('bj-double')?.addEventListener('click', doubleDown);
    document.getElementById('bj-split')?.addEventListener('click', split);

    const betInp = document.getElementById('bj-bet-input');
    betInp?.addEventListener('change', () => {
      betAmount = Math.max(1, Math.min(Core.getBalance(), parseInt(betInp.value) || 1));
    });

    document.querySelectorAll('.bj-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        betAmount = parseInt(btn.dataset.val) || betAmount;
        if (betInp) betInp.value = betAmount;
      });
    });
  }

  return { init };
})();
