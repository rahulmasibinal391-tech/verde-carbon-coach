/**
 * @fileoverview Google Identity Services sign-in integration for Verde.
 * Handles login/logout state and persists user session across reloads.
 */

const CLIENT_ID = '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com';
// NOTE: Replace CLIENT_ID with your own Google OAuth 2.0 client ID from
// https://console.cloud.google.com/. The above is a placeholder demo ID.

/** @type {{ name: string, email: string, picture: string } | null} */
let currentUser = null;

/**
 * Persists user data to localStorage.
 * @param {{ name: string, email: string, picture: string }} user
 */
function saveUser(user) {
  localStorage.setItem('verde_user', JSON.stringify(user));
}

/**
 * Loads persisted user data from localStorage.
 * @returns {{ name: string, email: string, picture: string } | null}
 */
function loadUser() {
  try {
    const raw = localStorage.getItem('verde_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clears user session from localStorage.
 */
function clearUser() {
  localStorage.removeItem('verde_user');
}

/**
 * Decodes a Google JWT credential payload without external libraries.
 * @param {string} token - JWT token from Google
 * @returns {{ name: string, email: string, picture: string, sub: string }}
 */
function decodeJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
      .join('')
  );
  return JSON.parse(jsonPayload);
}

/**
 * Updates navbar UI to reflect signed-in state.
 * @param {{ name: string, email: string, picture: string }} user
 */
function renderSignedIn(user) {
  const authArea = document.getElementById('auth-area');
  if (!authArea) return;

  authArea.innerHTML = `
    <div class="user-menu" id="user-menu">
      <button class="user-avatar-btn" id="user-avatar-btn" aria-label="User menu for ${user.name}" aria-expanded="false">
        <img 
          src="${user.picture}" 
          alt="${user.name}" 
          class="user-avatar"
          referrerpolicy="no-referrer"
          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%2334D399%22/><text x=%2220%22 y=%2226%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2218%22 font-family=%22Inter%22>${user.name.charAt(0).toUpperCase()}</text></svg>'"
        />
        <span class="user-name">${user.name.split(' ')[0]}</span>
        <svg class="user-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      <div class="user-dropdown" id="user-dropdown" role="menu" aria-label="Account menu">
        <div class="user-info">
          <img src="${user.picture}" alt="" class="user-avatar-lg" referrerpolicy="no-referrer" 
               onerror="this.style.display='none'"/>
          <div>
            <p class="user-display-name">${user.name}</p>
            <p class="user-email">${user.email}</p>
          </div>
        </div>
        <hr class="dropdown-divider"/>
        <button class="dropdown-item signout-btn" id="signout-btn" role="menuitem">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>
    </div>
  `;

  // Toggle dropdown on avatar click
  const avatarBtn = document.getElementById('user-avatar-btn');
  const dropdown = document.getElementById('user-dropdown');

  avatarBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    dropdown.classList.toggle('open', !isOpen);
    avatarBtn.setAttribute('aria-expanded', String(!isOpen));
  });

  // Close dropdown on outside click
  document.addEventListener('click', () => {
    dropdown?.classList.remove('open');
    avatarBtn?.setAttribute('aria-expanded', 'false');
  });

  // Sign-out
  document.getElementById('signout-btn')?.addEventListener('click', signOut);
}

/**
 * Updates navbar UI to reflect signed-out state.
 */
function renderSignedOut() {
  const authArea = document.getElementById('auth-area');
  if (!authArea) return;

  authArea.innerHTML = `
    <button class="google-signin-btn" id="google-signin-btn" aria-label="Sign in with Google">
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google
    </button>
  `;

  // Wire up button after render
  document.getElementById('google-signin-btn')?.addEventListener('click', triggerSignIn);
}

/**
 * Triggers Google One Tap / popup sign-in flow.
 */
function triggerSignIn() {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.prompt();
  }
}

/**
 * Handles credential response from Google Identity Services.
 * @param {{ credential: string }} response
 */
function handleCredentialResponse(response) {
  try {
    const payload = decodeJwt(response.credential);
    currentUser = {
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      sub: payload.sub
    };
    saveUser(currentUser);
    renderSignedIn(currentUser);
    showToast(`Welcome, ${currentUser.name.split(' ')[0]}! 🌿`);
  } catch (err) {
    console.error('Google sign-in error:', err);
  }
}

/**
 * Signs the user out — clears state and re-renders sign-in button.
 */
function signOut() {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }
  currentUser = null;
  clearUser();
  renderSignedOut();
  showToast('Signed out. See you next time! 👋');
}

/**
 * Shows a brief toast notification.
 * @param {string} message
 */
function showToast(message) {
  let toast = document.getElementById('verde-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'verde-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

/**
 * Returns the currently signed-in user, or null.
 * @returns {{ name: string, email: string, picture: string } | null}
 */
export function getUser() {
  return currentUser;
}

/**
 * Initializes Google Sign-In — loads GIS, sets up callbacks, restores session.
 */
export function initAuth() {
  // Restore session from localStorage first
  const savedUser = loadUser();
  if (savedUser) {
    currentUser = savedUser;
    renderSignedIn(savedUser);
  } else {
    renderSignedOut();
  }

  // Wait for GIS script to be ready
  function initGIS() {
    if (!window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
      context: 'signin'
    });

    // If no user logged in, show One Tap after a short delay
    if (!currentUser) {
      setTimeout(() => {
        window.google.accounts.id.prompt();
      }, 1500);
    }
  }

  // GIS script may already be loaded or loading
  if (window.google?.accounts?.id) {
    initGIS();
  } else {
    // Poll until GIS is ready (it loads async)
    const poll = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(poll);
        initGIS();
      }
    }, 200);
    // Stop polling after 10 seconds
    setTimeout(() => clearInterval(poll), 10000);
  }
}

// Self-bootstrap when loaded as a standalone module script tag
document.addEventListener('DOMContentLoaded', initAuth);

// Expose callback globally for Google One Tap data-callback attribute
window.handleGoogleCredential = handleCredentialResponse;

