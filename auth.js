const API_URL = 'http://localhost:3001/api';

async function apiRequest(path, data) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

function register(data) {
  return apiRequest('/auth/register', data);
}

function login(data) {
  return apiRequest('/auth/login', data);
}

document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signup-form');
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
        localStorage.setItem('calendarify-token', access_token);
        window.location.href = '/dashboard';
      } catch (e) {
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
        window.location.href = '/dashboard';
      } catch (e) {
        err.textContent = 'Invalid credentials';
      }
    });
  }
});
