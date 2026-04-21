// LuckyDev Casino — Firebase Auth Module

const Auth = (() => {
  let currentUser = null;
  let authReady = false;
  let readyCbs = [];
  let activeTab = 'login';

  function onReady(cb) {
    if (authReady) { cb(currentUser); return; }
    readyCbs.push(cb);
  }

  function getUser() { return currentUser; }

  // Called by firebase.js after initializeApp
  function init() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      _fireReady(null);
      return;
    }
    try {
      firebase.auth().onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
          const name = user.displayName || user.email.split('@')[0];
          Core.setUID(user.uid);
          Core.getState().username = name;
          Core.save();
          _injectUserUI(name);
          _hideWall();
        } else {
          _showWall();
        }
        _fireReady(user);
      });
    } catch(e) {
      console.warn('Auth init error:', e);
      _fireReady(null);
    }
  }

  function _fireReady(user) {
    if (authReady) return;
    authReady = true;
    readyCbs.forEach(cb => cb(user));
    readyCbs = [];
  }

  // ── Auth wall ──────────────────────────────────────────────────────────────

  function _showWall() {
    let wall = document.getElementById('auth-wall');
    if (!wall) {
      wall = document.createElement('div');
      wall.id = 'auth-wall';
      document.body.appendChild(wall);
    }
    wall.style.cssText = [
      'position:fixed;inset:0;z-index:99999',
      'background:var(--bg-deep,#0a0a0f)',
      'display:flex;align-items:center;justify-content:center',
      'padding:20px;overflow-y:auto',
    ].join(';');
    wall.innerHTML = _wallHTML();
    document.getElementById('auth-tab-login').addEventListener('click', () => _switchTab('login'));
    document.getElementById('auth-tab-signup').addEventListener('click', () => _switchTab('signup'));
    document.getElementById('auth-form').addEventListener('submit', _handleSubmit);
  }

  function _hideWall() {
    const wall = document.getElementById('auth-wall');
    if (wall) wall.remove();
  }

  function _wallHTML() {
    return `
<div style="width:100%;max-width:420px;padding:8px 0 32px">
  <!-- Logo -->
  <div style="text-align:center;margin-bottom:32px">
    <svg class="icon" style="width:64px;height:64px;color:var(--gold,#FFD700);
      filter:drop-shadow(0 0 20px rgba(255,215,0,0.4));animation:neon-pulse-gold 3s ease-in-out infinite"
      aria-hidden="true"><use href="#icon-crown"/></svg>
    <div style="font-size:1.8rem;font-weight:900;color:var(--gold,#FFD700);margin-top:10px;letter-spacing:-0.5px">LuckyDev Casino</div>
    <div style="color:var(--text-sec,#888);font-size:0.85rem;margin-top:4px">Free-to-play · No real money</div>
  </div>

  <!-- Tabs -->
  <div class="tabs" style="margin-bottom:20px">
    <button class="tab active" id="auth-tab-login">Sign In</button>
    <button class="tab" id="auth-tab-signup">Create Account</button>
  </div>

  <!-- Card -->
  <div class="card" style="padding:24px 28px">
    <form id="auth-form" autocomplete="on" novalidate>

      <div id="auth-name-row" style="margin-bottom:16px;display:none">
        <label style="font-size:0.78rem;color:var(--text-sec);display:block;margin-bottom:6px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase">Display Name</label>
        <input type="text" id="auth-name" class="bet-input"
          style="width:100%;box-sizing:border-box;font-size:1rem"
          placeholder="Your casino username" maxlength="20" autocomplete="username"/>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:0.78rem;color:var(--text-sec);display:block;margin-bottom:6px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase">Email</label>
        <input type="email" id="auth-email" class="bet-input"
          style="width:100%;box-sizing:border-box;font-size:1rem"
          placeholder="you@example.com" required autocomplete="email"/>
      </div>

      <div style="margin-bottom:20px">
        <label style="font-size:0.78rem;color:var(--text-sec);display:block;margin-bottom:6px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase">Password</label>
        <input type="password" id="auth-password" class="bet-input"
          style="width:100%;box-sizing:border-box;font-size:1rem"
          placeholder="At least 6 characters" required minlength="6" autocomplete="current-password"/>
      </div>

      <div id="auth-error" style="display:none;background:rgba(255,59,48,0.1);border:1px solid var(--red,#FF3B30);
        border-radius:var(--radius-sm,6px);padding:10px 14px;font-size:0.82rem;
        color:var(--red,#FF3B30);margin-bottom:16px;line-height:1.5"></div>

      <button type="submit" class="btn btn-gold" style="width:100%;font-size:1rem;padding:12px" id="auth-submit">
        Sign In
      </button>
    </form>
  </div>

  <p style="text-align:center;margin-top:16px;font-size:0.72rem;color:var(--text-dim,#444)">
    For entertainment only — all chips are virtual with no monetary value.
  </p>
</div>`;
  }

  function _switchTab(tab) {
    activeTab = tab;
    const isSignup = tab === 'signup';
    document.getElementById('auth-tab-login').classList.toggle('active', !isSignup);
    document.getElementById('auth-tab-signup').classList.toggle('active', isSignup);
    const nameRow = document.getElementById('auth-name-row');
    if (nameRow) nameRow.style.display = isSignup ? 'block' : 'none';
    const btn = document.getElementById('auth-submit');
    if (btn) btn.textContent = isSignup ? 'Create Account & Play' : 'Sign In';
    const pw = document.getElementById('auth-password');
    if (pw) pw.setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
    _clearError();
  }

  function _clearError() {
    const el = document.getElementById('auth-error');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }

  function _showError(msg) {
    const el = document.getElementById('auth-error');
    if (el) { el.style.display = 'block'; el.textContent = msg; }
  }

  async function _handleSubmit(e) {
    e.preventDefault();
    _clearError();

    const email    = (document.getElementById('auth-email')?.value || '').trim();
    const password = document.getElementById('auth-password')?.value || '';
    const name     = (document.getElementById('auth-name')?.value || '').trim();
    const btn      = document.getElementById('auth-submit');

    if (!email || !password) { _showError('Please fill in all fields.'); return; }
    if (activeTab === 'signup' && !name) { _showError('Please choose a display name.'); return; }

    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
      if (activeTab === 'signup') {
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });
        // onAuthStateChanged fires, handles the rest
      } else {
        await firebase.auth().signInWithEmailAndPassword(email, password);
      }
    } catch(err) {
      _showError(_friendlyError(err.code));
      if (btn) {
        btn.disabled = false;
        btn.textContent = activeTab === 'signup' ? 'Create Account & Play' : 'Sign In';
      }
    }
  }

  function _friendlyError(code) {
    const map = {
      'auth/email-already-in-use':   'That email is already registered. Try signing in.',
      'auth/invalid-email':          'Please enter a valid email address.',
      'auth/weak-password':          'Password must be at least 6 characters.',
      'auth/user-not-found':         'No account found with that email.',
      'auth/wrong-password':         'Incorrect password. Please try again.',
      'auth/invalid-credential':     'Invalid email or password.',
      'auth/too-many-requests':      'Too many attempts. Please wait a moment.',
      'auth/network-request-failed': 'Network error — check your connection.',
    };
    return map[code] || 'Something went wrong. Please try again.';
  }

  // ── Header user UI ─────────────────────────────────────────────────────────

  function _injectUserUI(displayName) {
    if (document.getElementById('auth-account-btn')) return;
    const right = document.querySelector('.header-right');
    if (!right) return;

    const btn = document.createElement('button');
    btn.id = 'auth-account-btn';
    btn.className = 'btn-icon';
    btn.title = `Signed in as ${displayName}`;
    btn.style.cssText = 'position:relative';
    btn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#icon-profile"/></svg>`;
    btn.addEventListener('click', _showAccountMenu);
    right.insertBefore(btn, right.firstChild);
  }

  function _showAccountMenu() {
    const user = currentUser;
    if (!user) return;
    const name = user.displayName || user.email.split('@')[0];
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    if (!overlay || !content) return;
    content.innerHTML = `
      <div class="modal-title">
        <svg class="icon" style="width:18px;height:18px" aria-hidden="true"><use href="#icon-profile"/></svg>
        Your Account
      </div>
      <div style="text-align:center;margin:16px 0 24px">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--bg-panel);
          border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
          <svg class="icon" style="width:36px;height:36px;color:var(--gold)" aria-hidden="true"><use href="#icon-profile"/></svg>
        </div>
        <div style="font-size:1.2rem;font-weight:800;color:var(--gold)">${name}</div>
        <div style="font-size:0.82rem;color:var(--text-sec);margin-top:4px">${user.email}</div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <a href="profile.html" class="btn btn-ghost btn-sm" onclick="closeModal()">
          <svg class="icon" aria-hidden="true"><use href="#icon-trophy"/></svg>
          My Profile
        </a>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="Auth.signOut()">
          <svg class="icon" aria-hidden="true"><use href="#icon-warning"/></svg>
          Sign Out
        </button>
      </div>`;
    overlay.classList.add('open');
  }

  async function signOut() {
    try {
      closeModal && closeModal();
      await firebase.auth().signOut();
      window.location.reload();
    } catch(e) {
      console.warn('Sign out failed:', e);
    }
  }

  return { init, onReady, getUser, signOut };
})();

window.Auth = Auth;
