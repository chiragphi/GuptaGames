// LuckyDev Casino — Firebase Auth Module

const Auth = (() => {
  const ADMIN_EMAILS = ['chiragphiig@gmail.com'];

  let currentUser = null;
  let wallEl = null;

  function init() {
    if (typeof firebase === 'undefined' || !firebase.auth) return;

    _buildWall();

    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        currentUser = user;
        _onSignedIn(user);
      } else {
        currentUser = null;
        _showWall();
      }
    });
  }

  function _buildWall() {
    if (document.getElementById('auth-wall')) return;
    wallEl = document.createElement('div');
    wallEl.id = 'auth-wall';
    wallEl.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:#F5F1E8;
      display:flex;align-items:center;justify-content:center;
      font-family:var(--font-main,'Inter',sans-serif);
    `;
    wallEl.innerHTML = `
      <div style="background:#EDE7D5;border:1px solid #C8C0A8;border-radius:16px;padding:40px 36px;width:100%;max-width:400px;box-shadow:0 8px 40px rgba(0,0,0,0.12)">
        <div style="text-align:center;margin-bottom:28px">
          <div style="font-size:2rem;font-weight:800;color:#1F4032;letter-spacing:-0.5px">LuckyDev Casino</div>
          <div style="color:#6B6558;font-size:0.9rem;margin-top:6px">Sign in to play</div>
        </div>
        <div style="display:flex;gap:0;margin-bottom:24px;border:1px solid #C8C0A8;border-radius:8px;overflow:hidden">
          <button id="auth-tab-in"  onclick="Auth._switchTab('in')"  style="flex:1;padding:10px;border:none;background:#1F4032;color:#fff;font-weight:600;cursor:pointer;transition:background .2s">Sign In</button>
          <button id="auth-tab-up"  onclick="Auth._switchTab('up')"  style="flex:1;padding:10px;border:none;background:transparent;color:#6B6558;font-weight:600;cursor:pointer;transition:background .2s">Sign Up</button>
        </div>
        <form id="auth-form" onsubmit="Auth._handleSubmit(event)" style="display:flex;flex-direction:column;gap:14px">
          <div id="auth-username-row" style="display:none;flex-direction:column;gap:6px">
            <label style="font-size:0.8rem;font-weight:600;color:#6B6558;text-transform:uppercase;letter-spacing:.5px">Username</label>
            <input id="auth-username" type="text" placeholder="Choose a username" maxlength="20"
              style="padding:12px 14px;border:1px solid #C8C0A8;border-radius:8px;background:#F5F1E8;color:#2A2420;font-size:0.95rem;outline:none"/>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label style="font-size:0.8rem;font-weight:600;color:#6B6558;text-transform:uppercase;letter-spacing:.5px">Email</label>
            <input id="auth-email" type="email" placeholder="you@example.com" required autocomplete="email"
              style="padding:12px 14px;border:1px solid #C8C0A8;border-radius:8px;background:#F5F1E8;color:#2A2420;font-size:0.95rem;outline:none"/>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label style="font-size:0.8rem;font-weight:600;color:#6B6558;text-transform:uppercase;letter-spacing:.5px">Password</label>
            <input id="auth-password" type="password" placeholder="••••••••" required minlength="6" autocomplete="current-password"
              style="padding:12px 14px;border:1px solid #C8C0A8;border-radius:8px;background:#F5F1E8;color:#2A2420;font-size:0.95rem;outline:none"/>
          </div>
          <div id="auth-error" style="color:#B03020;font-size:0.82rem;display:none;padding:8px 12px;background:rgba(176,48,32,0.08);border-radius:6px"></div>
          <button type="submit" id="auth-submit"
            style="padding:13px;background:linear-gradient(135deg,#1F4032,#2E6048);color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;letter-spacing:.3px;margin-top:4px">
            Sign In
          </button>
        </form>
      </div>
    `;
    document.body.appendChild(wallEl);
  }

  function _switchTab(tab) {
    const isUp = tab === 'up';
    document.getElementById('auth-tab-in').style.background = isUp ? 'transparent' : '#1F4032';
    document.getElementById('auth-tab-in').style.color     = isUp ? '#6B6558' : '#fff';
    document.getElementById('auth-tab-up').style.background = isUp ? '#1F4032' : 'transparent';
    document.getElementById('auth-tab-up').style.color     = isUp ? '#fff' : '#6B6558';
    const usernameRow = document.getElementById('auth-username-row');
    if (usernameRow) usernameRow.style.display = isUp ? 'flex' : 'none';
    document.getElementById('auth-submit').textContent = isUp ? 'Create Account' : 'Sign In';
    const passInput = document.getElementById('auth-password');
    if (passInput) passInput.setAttribute('autocomplete', isUp ? 'new-password' : 'current-password');
    _clearError();
  }

  async function _handleSubmit(e) {
    e.preventDefault();
    const email    = document.getElementById('auth-email')?.value.trim();
    const password = document.getElementById('auth-password')?.value;
    const isSignUp = document.getElementById('auth-tab-up')?.style.background === 'rgb(31, 64, 50)';
    const username = document.getElementById('auth-username')?.value.trim();
    const btn      = document.getElementById('auth-submit');

    if (!email || !password) return;
    if (isSignUp && !username) { _showError('Please choose a username.'); return; }

    btn.disabled = true;
    btn.textContent = '...';
    _clearError();

    try {
      if (isSignUp) {
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: username });
        // updateProfile doesn't trigger onAuthStateChanged, so handle manually
        currentUser = cred.user;
        _onSignedIn(cred.user, username);
      } else {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        // onAuthStateChanged will fire
      }
    } catch(err) {
      btn.disabled = false;
      btn.textContent = isSignUp ? 'Create Account' : 'Sign In';
      _showError(_friendlyError(err.code));
    }
  }

  function _onSignedIn(user, overrideName) {
    const username = overrideName || user.displayName || ('Player' + user.uid.slice(0, 6));
    if (window.Core) {
      Core.setUID(user.uid);
      // Set username in state if not already set
      const state = Core.getState();
      if (!state.username || state.username.startsWith('Player')) {
        state.username = username;
        Core.save();
      }
    }
    _hideWall();
    _injectAccountMenu(user, username);
  }

  function _showWall() {
    if (!wallEl) _buildWall();
    if (wallEl) wallEl.style.display = 'flex';
  }

  function _hideWall() {
    if (wallEl) wallEl.style.display = 'none';
  }

  function _injectAccountMenu(user, username) {
    // Add sign-out option to header
    const headerRight = document.querySelector('.header-right');
    if (!headerRight || document.getElementById('auth-signout-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'auth-signout-btn';
    btn.className = 'btn-icon';
    btn.title = `Signed in as ${username}`;
    btn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#icon-profile"/></svg>`;
    btn.onclick = signOut;
    headerRight.appendChild(btn);
  }

  function signOut() {
    firebase.auth().signOut().catch(() => {});
  }

  function _showError(msg) {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }

  function _clearError() {
    const el = document.getElementById('auth-error');
    if (el) el.style.display = 'none';
  }

  function _friendlyError(code) {
    const map = {
      'auth/user-not-found':      'No account with that email.',
      'auth/wrong-password':      'Incorrect password.',
      'auth/email-already-in-use':'Email already registered — sign in instead.',
      'auth/invalid-email':       'Invalid email address.',
      'auth/weak-password':       'Password must be at least 6 characters.',
      'auth/too-many-requests':   'Too many attempts — try again later.',
      'auth/network-request-failed': 'Network error — check your connection.',
      'auth/invalid-credential':  'Invalid email or password.',
    };
    return map[code] || 'Something went wrong. Try again.';
  }

  function isAdmin() {
    return currentUser && ADMIN_EMAILS.includes(currentUser.email);
  }

  function getCurrentUser() { return currentUser; }

  return { init, signOut, isAdmin, getCurrentUser, _switchTab, _handleSubmit };
})();

window.Auth = Auth;
