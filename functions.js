const API_URL = 'https://school-diary-production.up.railway.app/api';
const SIDEBAR_STATE_KEY = 'sidebarCollapsed';
const SESSION_KEY = 'sd-session';
const USER_ID_KEY = 'sd-user-id';

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setSession(data = {}) {
  const session = {
    token: data.token || data.accessToken || data.idToken || null,
    userId: data.userId || data.user?.id || data.user?.userId || data.user?.uid || data.email || data.id || null,
    user: data.user || null,
  };
  // Se não veio userId, cria um persistente
  if (!session.userId) {
    let uid = localStorage.getItem(USER_ID_KEY);
    if (!uid) {
      uid = `user-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(USER_ID_KEY, uid);
    }
    session.userId = uid;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function getSession() {
  return readSession();
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getOrCreateUserId() {
  const sess = readSession();
  if (sess?.userId) return sess.userId;
  let uid = localStorage.getItem(USER_ID_KEY);
  if (!uid) {
    uid = `user-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(USER_ID_KEY, uid);
  }
  return uid;
}

window.SessionManager = { getSession, setSession, clearSession, getOrCreateUserId };

// Variáveis CSS
function cssVar(name, fallback = '') {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v && v.trim()) || fallback;
}

const COLOR_WEAK = cssVar('--red-alert', '#e53935');
const COLOR_MEDIUM = cssVar('--blue-alert', '#f9a825');
const COLOR_STRONG = cssVar('--green-alert', '#43a047');

function initSidebar() {
  const layout = document.querySelector('.layout');
  const toggle = document.querySelector('[data-role="sidebar-toggle"]');
  if (!layout || !toggle) return;

  layout.style.transition = 'none';

  const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
  const isCollapsed = saved === 'true';
  if (isCollapsed) {
    layout.classList.add('collapsed');
  } else {
    layout.classList.remove('collapsed');
  }

  requestAnimationFrame(() => {
    layout.style.transition = '';
  });

  toggle.addEventListener('click', () => {
    layout.classList.toggle('collapsed');
    const nowCollapsed = layout.classList.contains('collapsed');
    localStorage.setItem(SIDEBAR_STATE_KEY, String(nowCollapsed));
  });
}

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const tab = item.dataset.tab;
      if (tab === 'calendar') {
        e.preventDefault();
        window.location.href = '/dashboard/calendar/';
      }else if (tab === 'dashboard') {
        e.preventDefault();
        window.location.href = '/dashboard/';
      }else if (tab === 'classes') {
        e.preventDefault();
        window.location.href = '/dashboard/classes/';
      }
    });
  });
}

function togglePassword() {
  const passwordInput = document.getElementById('password');
  const toggleIcon = document.getElementById('toggle-icon');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleIcon.src = '/images/hide-password.svg';
    toggleIcon.alt = 'Esconder senha';
  } else {
    passwordInput.type = 'password';
    toggleIcon.src = '/images/show-password.svg';
    toggleIcon.alt = 'Mostrar senha';
  }
}

async function handleGoogleLogin(response) {
  try {
    const credential = response.credential;
    
    const result = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential }),
    });
    
    const data = await result.json();
    
    if (data.success) {
      if (window.SessionManager) {
        window.SessionManager.setSession({
          token: data.token || data.accessToken || credential,
          userId: data.userId || data.user?.id || data.user?.userId,
          user: data.user,
          email: data.user?.email,
        });
      }
      window.location.href = '/dashboard/index.html';
    } else {
      alert('Erro ao fazer login: ' + data.message);
    }
  } catch (error) {
    alert('Erro ao fazer login com Google. Tente novamente.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initNavigation();
});