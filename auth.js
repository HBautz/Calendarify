
async function apiRequest(path, data) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`API error: ${text}`);
    throw new Error(text || res.statusText);
  }
  const result = await res.json();
  return result;
}

function register(data) {
  return apiRequest('/auth/register', data);
}

function login(data) {
  return apiRequest('/auth/login', data);
}

function storeToken(token, persist) {
  if (persist) {
    localStorage.setItem('calendarify-token', token);
    sessionStorage.removeItem('calendarify-token');
  } else {
    sessionStorage.setItem('calendarify-token', token);
    localStorage.removeItem('calendarify-token');
  }
}

function getToken(persistentOnly = false) {
  let value;
  if (persistentOnly) {
    value = localStorage.getItem('calendarify-token');
  } else {
    // Only check sessionStorage when persistentOnly is false
    value = sessionStorage.getItem('calendarify-token');
  }
  return value;
}

// For API calls that need any valid token
function getAnyToken() {
  const sessionToken = sessionStorage.getItem('calendarify-token');
  const persistentToken = localStorage.getItem('calendarify-token');
  const token = sessionToken || persistentToken;
  return token;
}

function clearToken() {
  console.log('[TEMP-DEBUG] clearToken called');
  sessionStorage.removeItem('calendarify-token');
  localStorage.removeItem('calendarify-token');
}

function logout() {
  console.log('[TEMP-DEBUG] logout invoked');
  clearToken();
  // mark that user actively logged out so login page clears any lingering tokens
  sessionStorage.setItem('calendarify-logged-out', '1');
  window.location.href = '/log-in';
}

async function loadUserState(token) {
  // Remove surrounding quotes if they exist
  const cleanToken = token.replace(/^"|"$/g, '');
  
  const res = await fetch(`${API_URL}/users/me/state`, {
    headers: { Authorization: `Bearer ${cleanToken}` },
  });
  if (res.ok) {
    const data = await res.json();
    Object.entries(data).forEach(([k, v]) => {
      // Don't store the token in localStorage - it should only be in sessionStorage/localStorage based on user choice
      if (k !== 'calendarify-token') {
        localStorage.setItem(k, JSON.stringify(v));
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Only set up forms if we're on a page that has them
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');
  
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = signupForm.querySelector('#signup-name').value.trim();
      const email = signupForm.querySelector('#signup-email').value.trim();
      const password = signupForm.querySelector('#signup-password').value;
      const confirm = signupForm.querySelector('#signup-confirm').value;
      const err = document.getElementById('signup-error');
      
      err.textContent = '';
      if (password !== confirm) {
        err.textContent = 'Passwords do not match';
        return;
      }
      try {
        await register({ name, email, password });
        const { access_token } = await login({ email, password });
        const remember = signupForm.querySelector('#signup-remember').checked;
        storeToken(access_token, remember);
        await loadUserState(access_token);
        window.location.href = '/dashboard';
      } catch (e) {
        console.error('Signup error:', e);
        err.textContent = e.message || 'Sign up failed';
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('#login-email').value.trim();
      const password = loginForm.querySelector('#login-password').value;
      const err = document.getElementById('login-error');
      err.textContent = '';
      try {
        const { access_token } = await login({ email, password });
        const rememberCheckbox = loginForm.querySelector('#login-remember');
        const remember = rememberCheckbox.checked;
        storeToken(access_token, remember);
        await loadUserState(access_token);
        window.location.href = '/dashboard';
      } catch (e) {
        err.textContent = 'Invalid credentials';
      }
    });
  }
});

async function verifyToken(persistentOnly = false) {
  let token;
  if (persistentOnly) {
    token = localStorage.getItem('calendarify-token');
  } else {
    token = sessionStorage.getItem('calendarify-token');
  }
  
  if (!token) {
    return false;
  }
  
  // Remove surrounding quotes if they exist
  const cleanToken = token.replace(/^"|"$/g, '');
  
  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${cleanToken}` },
    });
    
    if (res.ok) {
      return true;
    }
  } catch (error) {
    // Token verification failed
  }
  
  // Only clear the specific token that failed verification
  if (persistentOnly) {
    localStorage.removeItem('calendarify-token');
  } else {
    sessionStorage.removeItem('calendarify-token');
  }
  
  return false;
}

async function requireAuth() {
  // Try session token first, then persistent token
  let ok = await verifyToken(false); // Check sessionStorage
  if (!ok) {
    ok = await verifyToken(true); // Check localStorage
  }
  
  if (!ok) {
    window.location.replace('/log-in');
    return false;
  }
  return true;
}

async function initAuth(bodyId, onSuccess) {
  // Check both sessionStorage and localStorage for tokens
  const sessionToken = sessionStorage.getItem('calendarify-token');
  const persistentToken = localStorage.getItem('calendarify-token');
  const t = sessionToken || persistentToken;
  
  if (!t) {
    window.location.replace('/log-in');
    return;
  }
  if (await requireAuth()) {
    if (bodyId) {
      const el = document.getElementById(bodyId);
      if (el) el.classList.remove('hidden');
    }
    if (typeof onSuccess === 'function') {
      await onSuccess();
    }
  }
}

window.verifyToken = verifyToken;
window.requireAuth = requireAuth;
window.initAuth = initAuth;
window.logout = logout;
window.getToken = getToken;
window.getAnyToken = getAnyToken;
window.clearToken = clearToken;


