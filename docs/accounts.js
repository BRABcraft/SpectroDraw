(function () {
  const oauthBase = "https://oauth.spectrodraw.com/login";
  const authBase  = "https://auth.spectrodraw.com";

  const signupLink = document.getElementById('signup-link');
  const signinLink = document.getElementById('signin-link');
  const accountWrap = document.getElementById('account-wrap');
  const accountBtn = document.getElementById('account-btn');
  const accountEmailSpan = document.getElementById('account-email');
  const accountMenu = document.getElementById('account-menu');
  const accountLogoutBtn = document.getElementById('account-logout');
  const myProductsLink = document.getElementById('my-products');

  const panel = document.getElementById('login-panel');
  const modal = document.getElementById('login-modal');
  const closeBtn = modal.querySelector('.modal-close');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const form = document.getElementById('login-form');
  const googleBtn = document.getElementById('google-login');
  const googleBtnText = document.getElementById('google-btn-text');
  const toggleSignup = document.getElementById('toggle-signup');
  const signupOnlyElems = document.querySelectorAll('.signup-only');
  const primaryBtn = document.getElementById('primary-btn');
  const loginError = document.getElementById('login-error');

  let isSignup = false;
  let menuOpen = false;
  function isLoggedIn() {
    const wrap = document.getElementById('account-wrap');
    return !!wrap && getComputedStyle(wrap).display !== 'none';
  }

  function openOAuthPopup() {
    const width = 500, height = 600;
    const left = (screen.width / 2) - (width / 2);
    const top = (screen.height / 2) - (height / 2);
    const returnTo = encodeURIComponent(window.location.href);
    const oauthUrl = `${oauthBase}?state=${returnTo}`;
    window.open(oauthUrl, "Login with Google", `width=${width},height=${height},top=${top},left=${left}`);
  }

  function openPanel() {
    panel.setAttribute('aria-hidden', 'false');
    setTimeout(() => emailInput.focus(), 50);
    document.addEventListener('keydown', escHandler);
  }
  function closePanel() {
    panel.setAttribute('aria-hidden', 'true');
    loginError.style.display = 'none';
    document.removeEventListener('keydown', escHandler);
  }
  function escHandler(e) { if (e.key === 'Escape') { closePanel(); closeAccountMenu(); } }

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

  googleBtn.addEventListener('click', (e) => { e.preventDefault(); openOAuthPopup(); });

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
          credentials: 'include',
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
          credentials: 'include',
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

  function setLoggedInState(user) {
    signupLink.style.display = 'none';
    signinLink.style.display = 'none';
    accountWrap.style.display = 'block';
    let username = user.email && user.email.includes('@') ? user.email.substring(0,user.email.indexOf("@")) : (user.name || 'user');
    accountEmailSpan.textContent = username;
    accountEmailSpan.title = username || user.name || '';
    try {if (typeof updateNav === 'function') updateNav();} catch (err) {}
  }


  function setLoggedOutState() {
    signupLink.style.display = '';
    signinLink.style.display = '';
    accountWrap.style.display = 'none';
    closeAccountMenu();
    try{if (typeof updateNav === 'function') updateNav();} catch (err) {}
  }

  function onLoginSuccess(user) {
    try {
      localStorage.setItem('spectrodraw_user', JSON.stringify(user));
    } catch (e) {}
    setLoggedInState(user);
    window.location.reload();
  }
  accountBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAccountMenu();
  });
  accountLogoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await doLogout();
  });

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
    } catch (e) {}

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
  myProductsLink.addEventListener('click', () => { closeAccountMenu(); });

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
  (function readUserFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('user')) {
      try {
        const user = JSON.parse(decodeURIComponent(params.get('user')));
        if (user && (user.email || user.name)) {
          onLoginSuccess(user);
          const url = new URL(window.location.href);
          url.searchParams.delete('user');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (e) {}
    }
  })();
  window.addEventListener('message', (ev) => {
    try {
      if (!ev.data || !ev.data.type) return;
      if (ev.data.type === 'oauth-success' && ev.data.user) {
        onLoginSuccess(ev.data.user);
        closePanel();
        if (ev.data.returnTo) {
          try {
            const target = ev.data.returnTo;
            if (target && target !== window.location.href) window.location.href = target;
          } catch (e) {}
        }
      }
    } catch (e) {}
  });
  setSignupMode(false);
  const tagline = document.querySelector('.tagline');
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  const originalNavHTML = navRight.innerHTML;
  let transformed = false;
  let _outsideClickHandler = null;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildMobileNav() {
    if (transformed) return;

    if (tagline) tagline.style.display = 'none';

    const links = Array.from(navRight.querySelectorAll('a'));
    const launchLink =
      links.find(a => a.textContent.trim().toLowerCase() === 'launch app') ||
      links[0] ||
      null;

    const launchHTML = launchLink ? launchLink.outerHTML : '';

    const signupEl = document.getElementById('signup-link');
    const signinEl = document.getElementById('signin-link');

    const excludedIds = new Set(['my-products', 'review', 'account-logout']);
    const excludedHrefs = new Set(['/products', '/review']);
    const excludedTexts = new Set(['log out', 'logout']);

    const otherLinks = links.filter(a => {
      if (a === launchLink) return false;
      if (a.id && excludedIds.has(a.id)) return false;
      if (excludedHrefs.has((a.getAttribute('href') || '').trim())) return false;
      if (excludedTexts.has(a.textContent.trim().toLowerCase())) return false;
      if (a.id === 'signup-link' || a.id === 'signin-link') return false;
      return true;
    });

    const itemsHTML = otherLinks.map(link => `
      <li role="menuitem"
          tabindex="-1"
          data-href="${escapeHtml(link.getAttribute('href') || '#')}"
          style="padding:8px 12px;cursor:pointer;white-space:nowrap;">
        ${escapeHtml(link.textContent.trim())}
      </li>
    `).join('');

    // Build mobile user menu items. If the user is logged in, reuse the items
    // from the desktop accountMenu (anchors and logout button). Otherwise show
    // the default Sign up / Sign in entries.
    let userItemsHTML = '';

    if (isLoggedIn() && accountMenu) {
      // Grab anchors and buttons from desktop account menu
      const accountItems = Array.from(accountMenu.querySelectorAll('a, button'));
      userItemsHTML = accountItems.map(el => {
        const text = escapeHtml(el.textContent.trim());
        if (el.tagName.toLowerCase() === 'a') {
          const href = escapeHtml(el.getAttribute('href') || '#');
          return `
            <li role="menuitem" tabindex="-1" data-href="${href}"
                style="padding:8px 12px;cursor:pointer;white-space:nowrap;">
              ${text}
            </li>
          `;
        } else {
          // button (e.g. logout). Preserve id so we can identify it on click.
          const id = el.id ? escapeHtml(el.id) : '';
          const action = id === 'account-logout' ? 'logout' : (id || 'action');
          return `
            <li role="menuitem" tabindex="-1" data-action="${action}" data-id="${id}"
                style="padding:8px 12px;cursor:pointer;white-space:nowrap;">
              ${text}
            </li>
          `;
        }
      }).join('');
    } else {
      // default when logged out
      const su = { text: 'Sign up', href: '#' };
      const si = { text: 'Sign in', href: '#' };
      userItemsHTML = `
        <li role="menuitem" tabindex="-1" data-href="${escapeHtml(su.href)}"
            style="padding:8px 12px;cursor:pointer;white-space:nowrap;">
          ${escapeHtml(su.text)}
        </li>
        <li role="menuitem" tabindex="-1" data-href="${escapeHtml(si.href)}"
            style="padding:8px 12px;cursor:pointer;white-space:nowrap;">
          ${escapeHtml(si.text)}
        </li>
      `;
    }
    if (isLoggedIn()) {
      const emailToShow = (accountEmailSpan && (accountEmailSpan.title || accountEmailSpan.textContent))
        ? (accountEmailSpan.title || accountEmailSpan.textContent)
        : '';
      if (emailToShow) {
        const emailLine = `
          <li role="presentation" tabindex="-1"
              style="padding:8px 12px;white-space:nowrap;color:rgba(0,0,0,0.7);cursor:default;border-bottom:1px solid rgba(0,0,0,0.06);">
            ${escapeHtml(emailToShow)}
          </li>
        `;
        userItemsHTML = emailLine + userItemsHTML;
      }
    }


    const userSVG = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
           stroke="white" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8" r="4"></circle>
        <path d="M4 20c0-3.3137 2.6863-6 6-6h4c3.3137 0 6 2.6863 6 6"></path>
      </svg>
    `;

    const hamburgerSVG = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
           stroke="white" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;

    navRight.innerHTML = `
      ${launchHTML}
      <button data-mobile-user-button="1"
              aria-haspopup="true"
              aria-expanded="false"
              aria-label="User menu"
              style="margin-right:8px;background:transparent;border:none;padding:4px;cursor:pointer;display:inline-flex;">
        ${userSVG}
      </button>

      <button data-mobile-button="1"
              aria-haspopup="true"
              aria-expanded="false"
              aria-label="More menu"
              style="margin-left:8px;background:transparent;border:none;padding:4px;cursor:pointer;display:inline-flex;">
        ${hamburgerSVG}
      </button>

      <ul data-mobile-user-menu="1" role="menu"
          style="position:absolute;z-index:9999;min-width:140px;margin:0;padding:6px 0;
                 list-style:none;box-shadow:0 6px 18px rgba(0,0,0,0.12);
                 border-radius:6px;background:white;color:black;display:none;right:0;">
        ${userItemsHTML}
      </ul>

      <ul data-mobile-menu="1" role="menu"
          style="position:absolute;z-index:9999;min-width:160px;margin:0;padding:6px 0;
                 list-style:none;box-shadow:0 6px 18px rgba(0,0,0,0.12);
                 border-radius:6px;background:white;color:black;display:none;right:0;">
        ${itemsHTML}
      </ul>
    `;

    if (getComputedStyle(navRight).position === 'static') {
      navRight.style.position = 'relative';
    }

    const userBtn = navRight.querySelector('[data-mobile-user-button]');
    const userMenu = navRight.querySelector('[data-mobile-user-menu]');
    const btn = navRight.querySelector('[data-mobile-button]');
    const menu = navRight.querySelector('[data-mobile-menu]');

    function positionMenu(button, menu) {
      const b = button.getBoundingClientRect();
      const n = navRight.getBoundingClientRect();
      menu.style.right = "0";
      menu.style.top = `${b.bottom - n.top + 6}px`;
    }

    function toggle(menu, btn) {
      const open = menu.style.display === 'block';
      menu.style.display = open ? 'none' : 'block';
      btn.setAttribute('aria-expanded', String(!open));
      if (!open) positionMenu(btn, menu);
    }

    userBtn.onclick = e => {
      e.stopPropagation();
      menu.style.display = 'none';
      toggle(userMenu, userBtn);
    };

    btn.onclick = e => {
      e.stopPropagation();
      userMenu.style.display = 'none';
      toggle(menu, btn);
    };

    document.addEventListener('click', _outsideClickHandler = e => {
      if (!navRight.contains(e.target)) {
        menu.style.display = 'none';
        userMenu.style.display = 'none';
      }
    });

    userMenu.addEventListener('click', e => {
      const li = e.target.closest('[data-href],[data-action]');
      if (!li) return;

      const href = li.getAttribute('data-href');
      const action = li.getAttribute('data-action');
      const text = (li.textContent || '').trim().toLowerCase();

      // Old behavior: sign in / sign up
      if (text === 'sign in') {
        e.preventDefault();
        setSignupMode(false);
        openPanel();
        return;
      }
      if (text === 'sign up') {
        e.preventDefault();
        setSignupMode(true);
        openPanel();
        return;
      }

      // Account action (logout)
      if (action === 'logout' || li.getAttribute('data-id') === 'account-logout') {
        e.preventDefault();
        // trigger the same logout logic used by the desktop account menu
        if (typeof accountLogoutBtn !== 'undefined' && accountLogoutBtn) {
          accountLogoutBtn.click();
        } else if (typeof doLogout === 'function') {
          doLogout();
        }
        return;
      }

      // Anchor navigation
      if (href && href !== '#') {
        window.location.href = href;
      }
    });

    menu.addEventListener('click', e => {
      const li = e.target.closest('[data-href]');
      if (!li) return;

      const href = li.getAttribute('data-href');
      if (href && href !== '#') {
        window.location.href = href;
      }
    });


    transformed = true;
  }

  function teardownMobileNav() {
    if (!transformed) return;
    if (tagline) tagline.style.display = '';
    if (_outsideClickHandler)
      document.removeEventListener('click', _outsideClickHandler);
    navRight.innerHTML = originalNavHTML;
    navRight.style.position = '';
    transformed = false;
  }

  function updateNav() {
    window.innerWidth < 700 ? buildMobileNav() : teardownMobileNav();
  }

  window.addEventListener('resize', updateNav);
  updateNav();
})();


window.addEventListener('message', async (ev) => {
  if (!ev.data || ev.data.type !== 'oauth-success') return;
  const user = ev.data.user;
  try {
    try { localStorage.setItem('spectrodraw_user', JSON.stringify(user)); } catch (e) {}
    let stored = null;
    try { stored = localStorage.getItem('spectrodraw_user'); } catch (e) { stored = null; }
    const res = await fetch('https://api.spectrodraw.com/auth/session', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Spectrodraw-User': stored || JSON.stringify(user)
      },
      body: JSON.stringify({ email: user.email, username: user.name || user.email })
    });
    if (!res.ok) throw new Error('Session creation failed');
    document.getElementById('signup-link').style.display = 'none';
    document.getElementById('signin-link').style.display = 'none';
    const accountWrap = document.getElementById('account-wrap');
    accountWrap.style.display = 'block';
    document.getElementById('account-email').textContent = user.email.replace(/@.*/, "");
  } catch (err) {
    console.error('auth session error', err);
  }
});