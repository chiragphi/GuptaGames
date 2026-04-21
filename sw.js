// LuckyDev Casino Service Worker — PWA support
const CACHE_NAME = 'luckydev-v1';
const ASSETS = [
  '.',
  'index.html',
  'leaderboard.html',
  'profile.html',
  'howtoplay.html',
  'css/main.css',
  'css/games.css',
  'css/animations.css',
  'js/core.js',
  'js/addiction.js',
  'js/audio.js',
  'js/particles.js',
  'js/firebase.js',
  'js/games/slots.js',
  'js/games/crash.js',
  'js/games/plinko.js',
  'js/games/blackjack.js',
  'js/games/roulette.js',
  'js/games/mines.js',
  'js/games/dice.js',
  'js/games/coinflip.js',
  'js/games/towers.js',
  'js/games/videopoker.js',
  'games/slots.html',
  'games/crash.html',
  'games/plinko.html',
  'games/blackjack.html',
  'games/roulette.html',
  'games/mines.html',
  'games/dice.html',
  'games/coinflip.html',
  'games/towers.html',
  'games/videopoker.html',
  'assets/icons/sprite.svg',
  'manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network first for Firebase, cache first for assets
  if (e.request.url.includes('firebaseio.com') || e.request.url.includes('googleapis.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return resp;
    }))
  );
});
