const API_URL = 'http://localhost:3001/api';

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

async function loadUserState(token) {
  const res = await fetch(`${API_URL}/users/me/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const data = await res.json();
    Object.entries(data).forEach(([k, v]) => {
      localStorage.setItem(k, JSON.stringify(v));
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, setting up forms...');
  
  const signupForm = document.getElementById('signup-form');
  console.log('Signup form found:', signupForm);
  
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      console.log('Signup form submitted!');
      e.preventDefault();
      const name = signupForm.querySelector('#signup-name').value.trim();
      const email = signupForm.querySelector('#signup-email').value.trim();
      const password = signupForm.querySelector('#signup-password').value;
      const confirm = signupForm.querySelector('#signup-confirm').value;
      const err = document.getElementById('signup-error');
      
      console.log('Form data:', { name, email, password: '***', confirm: '***' });
      
      err.textContent = '';
      if (password !== confirm) {
        err.textContent = 'Passwords do not match';
        return;
      }
      try {
        console.log('Registering user...');
        await register({ name, email, password });
        console.log('User registered, logging in...');
        const { access_token } = await login({ email, password });
        localStorage.setItem('calendarify-token', access_token);
        await loadUserState(access_token);
        window.location.href = '/dashboard';
      } catch (e) {
        console.error('Signup error:', e);
        err.textContent = e.message || 'Sign up failed';
      }
    });
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('#login-email').value.trim();
      const password = loginForm.querySelector('#login-password').value;
      const err = document.getElementById('login-error');
      err.textContent = '';
      try {
        const { access_token } = await login({ email, password });
        localStorage.setItem('calendarify-token', access_token);
        await loadUserState(access_token);
        window.location.href = '/dashboard';
      } catch (e) {
        err.textContent = 'Invalid credentials';
      }
    });
  }
});

async function verifyToken() {
  const token = localStorage.getItem('calendarify-token');
  if (!token) return false;
  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return true;
  } catch {}
  localStorage.removeItem('calendarify-token');
  return false;
}

async function requireAuth() {
  const ok = await verifyToken();
  if (!ok) {
    window.location.replace('/log-in');
    return false;
  }
  return true;
}

window.verifyToken = verifyToken;
window.requireAuth = requireAuth;
