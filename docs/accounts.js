(function () {
  const oauthBase = "https://oauth.spectrodraw.com/login";
  const authBase  = "https://auth.spectrodraw.com"; // <- new auth worker base

  const signupLink = document.getElementById('signup-link');
  const signinLink = document.getElementById('signin-link');
  const accountWrap = document.getElementById('account-wrap');
  const accountBtn = document.getElementById('account-btn');
  const accountEmailSpan = document.getElementById('account-email');
  const accountMenu = document.getElementById('account-menu');
  const accountLogoutBtn = document.getElementById('account-logout');
  const myProductsLink = document.getElementById('my-products');

  const loginBtn = document.getElementById('signin-link'); // reuse signin-link to open modal
  const panel = document.getElementById('login-panel');
  const modal = document.getElementById('login-modal');
  const closeBtn = modal.querySelector('.modal-close');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const form = document.getElementById('login-form');
  const googleBtn = document.getElementById('google-login');
  const googleBtnText = document.getElementById('google-btn-text');
  const toggleSignup = document.getElementById('toggle-signup');
  const signupOnlyElems = document.querySelectorAll('.signup-only');
  const primaryBtn = document.getElementById('primary-btn');
  const loginError = document.getElementById('login-error');

  let isSignup = false;
  let menuOpen = false;

  // open OAuth popup centered and pass return url via state
  function openOAuthPopup() {
    const width = 500, height = 600;
    const left = (screen.width / 2) - (width / 2);
    const top = (screen.height / 2) - (height / 2);
    const returnTo = encodeURIComponent(window.location.href);
    const oauthUrl = `${oauthBase}?state=${returnTo}`;
    window.open(oauthUrl, "Login with Google", `width=${width},height=${height},top=${top},left=${left}`);
  }

  // show modal (signin or signup)
  function openPanel() {
    panel.setAttribute('aria-hidden', 'false');
    // focus
    setTimeout(() => emailInput.focus(), 50);
    document.addEventListener('keydown', escHandler);
  }
  function closePanel() {
    panel.setAttribute('aria-hidden', 'true');
    loginError.style.display = 'none';
    document.removeEventListener('keydown', escHandler);
  }
  function escHandler(e) { if (e.key === 'Escape') { closePanel(); closeAccountMenu(); } }

  // account menu open/close
  function toggleAccountMenu() {
    menuOpen ? closeAccountMenu() : openAccountMenu();
  }
  function openAccountMenu() {
    accountMenu.style.display = '';
    accountMenu.setAttribute('aria-hidden', 'false');
    accountBtn.setAttribute('aria-expanded', 'true');
    menuOpen = true;
    document.addEventListener('click', outsideClickHandler);
  }
  function closeAccountMenu() {
    accountMenu.style.display = 'none';
    accountMenu.setAttribute('aria-hidden', 'true');
    accountBtn.setAttribute('aria-expanded', 'false');
    menuOpen = false;
    document.removeEventListener('click', outsideClickHandler);
  }
  function outsideClickHandler(e) {
    if (!accountWrap.contains(e.target)) closeAccountMenu();
  }

  // wire up link clicks
  signinLink.addEventListener('click', (e) => {
    e.preventDefault();
    setSignupMode(false);
    openPanel();
  });
  signupLink.addEventListener('click', (e) => {
    e.preventDefault();
    setSignupMode(true);
    openPanel();
  });

  closeBtn.addEventListener('click', closePanel);
  panel.addEventListener('click', (e) => { if (e.target === panel) closePanel(); });

  toggleSignup.addEventListener('click', (e) => { e.preventDefault(); setSignupMode(!isSignup); });

  function setSignupMode(on) {
    isSignup = !!on;
    signupOnlyElems.forEach(el => { el.style.display = isSignup ? 'flex' : 'none'; });
    primaryBtn.textContent = isSignup ? 'Sign up' : 'Sign in';
    googleBtnText.textContent = isSignup ? 'Sign up with Google' : 'Log in with Google';
    toggleSignup.textContent = isSignup ? 'Back to login' : 'New? Sign up';
    document.getElementById('login-title').textContent = isSignup ? 'Create account' : 'Sign in';
    if (isSignup) {
      document.getElementById('username').setAttribute('required', 'required');
      document.getElementById('confirm-password').setAttribute('required', 'required');
    } else {
      document.getElementById('username').removeAttribute('required');
      document.getElementById('confirm-password').removeAttribute('required');
    }
    setTimeout(() => emailInput.focus(), 50);
  }

  // Google button
  googleBtn.addEventListener('click', (e) => { e.preventDefault(); openOAuthPopup(); });

  // form submit (uses auth.spectrodraw.com)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) { showError('Please enter email and password.'); return; }

    if (isSignup) {
      const username = (document.getElementById('username').value || '').trim();
      const confirm = (document.getElementById('confirm-password').value || '');
      if (!username) { showError('Please choose a username.'); return; }
      if (password !== confirm) { showError('Passwords do not match.'); return; }

      try {
        const res = await fetch(`${authBase}/auth/signup`, {
          method: 'POST',
          mode: 'cors',
          credentials: 'include', // important to accept cookies from auth.spectrodraw.com
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, username, password })
        });
        if (!res.ok) { const text = await res.text(); showError(text || 'Sign up failed.'); return; }
        const data = await res.json();
        if (data && data.user) { onLoginSuccess(data.user); closePanel(); }
        else if (data && data.redirect) window.location.href = data.redirect;
        else showError('Unexpected response from server.');
      } catch (err) { showError(err.message || 'Network error.'); }
    } else {
      try {
        const res = await fetch(`${authBase}/auth/login`, {
          method: 'POST',
          mode: 'cors',
          credentials: 'include', // send/receive cookies
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (!res.ok) { const text = await res.text(); showError(text || 'Login failed.'); return; }
        const data = await res.json();
        if (data && data.user) { onLoginSuccess(data.user); closePanel(); }
        else if (data && data.redirect) window.location.href = data.redirect;
        else showError('Unexpected response from server.');
      } catch (err) { showError(err.message || 'Network error.'); }
    }
  });

  function showError(msg) { loginError.textContent = msg; loginError.style.display = ''; }

  // set UI to logged-in state
  function setLoggedInState(user) {
    // hide links
    signupLink.style.display = 'none';
    signinLink.style.display = 'none';
    // show account
    accountWrap.style.display = 'block';
    let username = user.email && user.email.includes('@') ? user.email.substring(0,user.email.indexOf("@")) : (user.name || 'user');
    accountEmailSpan.textContent = username;
    accountEmailSpan.title = username || user.name || '';
  }

  // set UI to logged-out state
  function setLoggedOutState() {
    signupLink.style.display = '';
    signinLink.style.display = '';
    accountWrap.style.display = 'none';
    closeAccountMenu();
  }

  // handle login success (from form or postMessage)
  function onLoginSuccess(user) {
    try {
      localStorage.setItem('spectrodraw_user', JSON.stringify(user));
    } catch (e) { /* ignore storage error */ }
    setLoggedInState(user);
    window.location.reload();
  }

  // account button toggles menu
  accountBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAccountMenu();
  });

  // account logout in menu
  accountLogoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await doLogout();
  });

  // logout logic (clears storage, attempts server logout, reloads)
  async function doLogout() {
    try { 
      localStorage.removeItem('spectrodraw_user'); 
    } catch (e) {}

    try {
      await fetch(`${authBase}/auth/logout`, { 
        method: 'POST', 
        mode: 'cors', 
        credentials: 'include' 
      });
    } catch (e) {
      /* ignore */
    }

    const href = window.location.href;
    const shouldRedirectHome =
      href.startsWith('https://spectrodraw.com/products/') ||
      href.startsWith('https://spectrodraw.com/review/');

    if (shouldRedirectHome) {
      window.location.href = 'https://spectrodraw.com';
    } else {
      window.location.reload();
    }
  }

  // My products (close menu, navigate)
  myProductsLink.addEventListener('click', () => { closeAccountMenu(); });

  // restore user from storage on load
  (async function restoreUserFromStorage() {
    try {
      const stored = (() => {
        try { return localStorage.getItem('spectrodraw_user'); } catch (e) { return null; }
      })();

      if (stored) {
        let user = null;
        try { user = JSON.parse(stored); } catch (e) { user = { email: stored }; }
        
        if (user && (user.email || user.name)) {
          setLoggedInState(user);

          // Attempt to create/restore server session by posting to auth-worker.
          // Send the raw stored localStorage value in the header so the worker can use it if desired.
          try {
            await fetch('https://api.spectrodraw.com/auth/session', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'X-Spectrodraw-User': stored
              },
              body: JSON.stringify({ email: user.email, username: user.name || user.email })
            });
            // ignore response — session cookie (Set-Cookie) will be handled by browser
          } catch (err) {
            console.warn('restoreUserFromStorage: session creation failed', err);
          }
        } else {
          setLoggedOutState();
        }
      } else {
        setLoggedOutState();
      }
    } catch (e) {
      setLoggedOutState();
    }
  })();

  // detect ?user=... param (from worker fallback) - prefer this to stored user on initial arrival
  (function readUserFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('user')) {
      try {
        const user = JSON.parse(decodeURIComponent(params.get('user')));
        if (user && (user.email || user.name)) {
          onLoginSuccess(user);
          // remove param from URL without reload
          const url = new URL(window.location.href);
          url.searchParams.delete('user');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (e) { /* ignore */ }
    }
  })();

  // receive oauth-success from popup (popup -> opener)
  window.addEventListener('message', (ev) => {
    try {
      if (!ev.data || !ev.data.type) return;
      if (ev.data.type === 'oauth-success' && ev.data.user) {
        onLoginSuccess(ev.data.user);
        closePanel();
        if (ev.data.returnTo) {
          // navigate user back to returnTo (if different)
          try {
            const target = ev.data.returnTo;
            if (target && target !== window.location.href) window.location.href = target;
          } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore bad messages */ }
  });

  // Keep modal initialized in sign-in mode
  setSignupMode(false);
})();

// Bottom listener: OAuth popup -> parent (create session at api.spectrodraw.com)
// Modified to send X-Spectrodraw-User header containing the localStorage value (if available)
window.addEventListener('message', async (ev) => {
  if (!ev.data || ev.data.type !== 'oauth-success') return;
  const user = ev.data.user; // { email, name, ... }

  try {
    // Ensure localStorage has the user (defensive)
    try { localStorage.setItem('spectrodraw_user', JSON.stringify(user)); } catch (e) { /* ignore */ }

    // Read the stored value (if accessible)
    let stored = null;
    try { stored = localStorage.getItem('spectrodraw_user'); } catch (e) { stored = null; }

    // POST to auth-worker to create a real session cookie
    const res = await fetch('https://api.spectrodraw.com/auth/session', {
      method: 'POST',
      credentials: 'include',            // important — accept Set-Cookie
      headers: {
        'Content-Type': 'application/json',
        // Send the localStorage value (or fallback to the user JSON)
        'X-Spectrodraw-User': stored || JSON.stringify(user)
      },
      body: JSON.stringify({ email: user.email, username: user.name || user.email })
    });
    if (!res.ok) throw new Error('Session creation failed');

    // Success: browser now has session cookie for .spectrodraw.com
    // update UI
    document.getElementById('signup-link').style.display = 'none';
    document.getElementById('signin-link').style.display = 'none';
    const accountWrap = document.getElementById('account-wrap');
    accountWrap.style.display = 'block';
    document.getElementById('account-email').textContent = user.email.replace(/@.*/, "");
  } catch (err) {
    console.error('auth session error', err);
  }
});
