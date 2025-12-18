const API_URL = 'https://school-diary-production.up.railway.app/api';
const SIDEBAR_STATE_KEY = 'sidebarCollapsed';

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
      // window.location.href = '/dashboard';
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