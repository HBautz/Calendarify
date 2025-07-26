
async function apiRequest(path, data) {
  console.log(`Making API request to: ${API_URL}${path}`, data);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  console.log(`API response status: ${res.status}`);
  if (!res.ok) {
    const text = await res.text();
    console.error(`API error: ${text}`);
    throw new Error(text || res.statusText);
  }
  const result = await res.json();
  console.log('API response:', result);
  return result;
}

function register(data) {
  return apiRequest('/auth/register', data);
}

function login(data) {
  return apiRequest('/auth/login', data);
}

function storeToken(token, persist) {
  console.log('[TEMP-DEBUG] storeToken', { token, persist });
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
    value = sessionStorage.getItem('calendarify-token') || localStorage.getItem('calendarify-token');
  }
  console.log('[TEMP-DEBUG] getToken', { persistentOnly, value });
  return value;
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
  console.log('[TEMP-DEBUG] loadUserState called', { token });
  // Remove surrounding quotes if they exist
  const cleanToken = token.replace(/^"|"$/g, '');
  
  const res = await fetch(`${API_URL}/users/me/state`, {
    headers: { Authorization: `Bearer ${cleanToken}` },
  });
  if (res.ok) {
    const data = await res.json();
    Object.entries(data).forEach(([k, v]) => {
      localStorage.setItem(k, JSON.stringify(v));
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('[TEMP-DEBUG] DOM loaded, setting up forms...');
  
  // Only set up forms if we're on a page that has them
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');
  
  console.log('[TEMP-DEBUG] Signup form found:', signupForm);
  console.log('[TEMP-DEBUG] Login form found:', loginForm);
  
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      console.log('[TEMP-DEBUG] Signup form submitted!');
      e.preventDefault();
      const name = signupForm.querySelector('#signup-name').value.trim();
      const email = signupForm.querySelector('#signup-email').value.trim();
      const password = signupForm.querySelector('#signup-password').value;
      const confirm = signupForm.querySelector('#signup-confirm').value;
      const err = document.getElementById('signup-error');
      
      console.log('[TEMP-DEBUG] Form data:', { name, email, password: '***', confirm: '***' });
      
      err.textContent = '';
      if (password !== confirm) {
        err.textContent = 'Passwords do not match';
        return;
      }
      try {
        console.log('[TEMP-DEBUG] Registering user...');
        await register({ name, email, password });
        console.log('[TEMP-DEBUG] User registered, logging in...');
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
      console.log('[TEMP-DEBUG] Login form submitted');
      e.preventDefault();
      const email = loginForm.querySelector('#login-email').value.trim();
      const password = loginForm.querySelector('#login-password').value;
      const err = document.getElementById('login-error');
      err.textContent = '';
      try {
        console.log('[TEMP-DEBUG] Attempting login for', email);
        const { access_token } = await login({ email, password });
        const remember = loginForm.querySelector('#login-remember').checked;
        storeToken(access_token, remember);
        await loadUserState(access_token);
        window.location.href = '/dashboard';
      } catch (e) {
        console.log('[TEMP-DEBUG] Login error', e);
        err.textContent = 'Invalid credentials';
      }
    });
  }
});

async function verifyToken(persistentOnly = false) {
  console.log('[TEMP-DEBUG] verifyToken called', { persistentOnly });
  const token = getToken(persistentOnly);
  if (!token) {
    console.log('[TEMP-DEBUG] verifyToken no token found');
    return false;
  }
  
  // Remove surrounding quotes if they exist
  const cleanToken = token.replace(/^"|"$/g, '');
  
  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${cleanToken}` },
    });
    
    if (res.ok) {
      console.log('[TEMP-DEBUG] verifyToken success');
      return true;
    }
  } catch (error) {
    console.log('[TEMP-DEBUG] verifyToken fetch error', error);
  }
  clearToken();
  return false;
}

async function requireAuth() {
  console.log('[TEMP-DEBUG] requireAuth called');
  const ok = await verifyToken();
  if (!ok) {
    window.location.replace('/log-in');
    return false;
  }
  return true;
}

async function initAuth(bodyId, onSuccess) {
  console.log('[TEMP-DEBUG] initAuth called', { bodyId });
  const t = getToken();
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
window.clearToken = clearToken;
