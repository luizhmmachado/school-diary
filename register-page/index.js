const form = document.getElementById('register-form');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const strengthLabel = document.getElementById('strength-label');
const strengthLevel = document.getElementById('strength-level');
const requirementsBox = document.getElementById('password-requirements');
const formError = document.getElementById('form-error');
const signupButton = document.querySelector('.btn-signup');

const reqItems = {
  upper: document.querySelector('.req-item[data-req="upper"]'),
  lower: document.querySelector('.req-item[data-req="lower"]'),
  number: document.querySelector('.req-item[data-req="number"]'),
  symbol: document.querySelector('.req-item[data-req="symbol"]'),
  length: document.querySelector('.req-item[data-req="length"]'),
};

// Variáveis CSS
function cssVar(name, fallback = '') {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v && v.trim()) || fallback;
}

const COLOR_WEAK = cssVar('--red-alert', '#e53935');
const COLOR_MEDIUM = cssVar('--blue-alert', '#f9a825');
const COLOR_STRONG = cssVar('--green-alert', '#43a047');

function evaluatePassword(value) {
  return {
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
    length: value.length >= 8,
  };
}

function updatePasswordStrength() {
  if (!requirementsBox || !strengthLevel || !strengthLabel || !signupButton || !passwordInput) {
    return;
  }

  const val = passwordInput.value;

  if (val.length === 0) {
    requirementsBox.classList.remove('visible');
    strengthLevel.style.width = '0%';
    strengthLabel.textContent = 'Senha fraca';
    signupButton.disabled = true;
    signupButton.style.opacity = 0.6;
    return;
  }

  requirementsBox.classList.add('visible');
  const status = evaluatePassword(val);
  let passed = 0;

  Object.entries(status).forEach(([key, ok]) => {
    if (reqItems[key]) {
      if (ok) {
        reqItems[key].classList.add('ok');
        passed += 1;
      } else {
        reqItems[key].classList.remove('ok');
      }
    }
  });

  if (passed <= 2) {
    strengthLabel.textContent = 'Senha fraca';
    strengthLevel.style.width = '33%';
    strengthLevel.style.background = COLOR_WEAK;
    signupButton.disabled = true;
    signupButton.style.opacity = 0.6;
  } else if (passed <= 4) {
    strengthLabel.textContent = 'Senha média';
    strengthLevel.style.width = '66%';
    strengthLevel.style.background = COLOR_MEDIUM;
    signupButton.disabled = false;
    signupButton.style.opacity = 1;
  } else {
    strengthLabel.textContent = 'Senha forte';
    strengthLevel.style.width = '100%';
    strengthLevel.style.background = COLOR_STRONG;
    signupButton.disabled = false;
    signupButton.style.opacity = 1;
  }
}

if (passwordInput) {
  passwordInput.addEventListener('input', updatePasswordStrength);
  passwordInput.addEventListener('focus', () => {
    if (requirementsBox) requirementsBox.classList.add('visible');
    updatePasswordStrength();
  });
  passwordInput.addEventListener('blur', () => {
    if (requirementsBox && passwordInput.value.length === 0) {
      requirementsBox.classList.remove('visible');
    }
  });
  updatePasswordStrength();
}

function clearErrors() {
  [nameInput, emailInput, passwordInput].forEach((el) => el && el.classList.remove('input-error'));
  if (formError) {
    formError.textContent = '';
    formError.classList.remove('visible');
  }
}

function showError(message, fields = []) {
  if (formError) {
    formError.textContent = message;
    formError.classList.add('visible');
  }
  fields.forEach((el) => el && el.classList.add('input-error'));
}

if (nameInput) {
  nameInput.addEventListener('blur', () => {
    if (nameInput.value.trim().length === 0) {
      nameInput.classList.add('input-error');
    } else {
      nameInput.classList.remove('input-error');
    }
  });
  nameInput.addEventListener('input', () => {
    if (formError && formError.textContent) {
      clearErrors();
    }
  });
}

if (emailInput) {
  emailInput.addEventListener('blur', () => {
    const v = emailInput.value.trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (!v || !ok) {
      emailInput.classList.add('input-error');
    } else {
      emailInput.classList.remove('input-error');
    }
  });
  emailInput.addEventListener('input', () => {
    if (formError && formError.textContent) {
      clearErrors();
    }
  });
}

if (passwordInput) {
  passwordInput.addEventListener('input', () => {
    updatePasswordStrength();
    if (formError && formError.textContent) {
      clearErrors();
    }
  });
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    clearErrors();
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!name) {
      showError('Informe seu nome completo.', [nameInput]);
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Informe um email válido.', [emailInput]);
      return;
    }

    if (!password) {
      showError('Informe uma senha.', [passwordInput]);
      return;
    }

    const checks = evaluatePassword(password);
    const passed = Object.values(checks).filter(Boolean).length;

    if (passed < 5) {
      showError('A senha precisa atender a todos os requisitos.', [passwordInput]);
      return;
    }

    try {
      const result = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await result.json();

      if (data.success) {
        window.location.href = '../login-page/index.html';
      } else {
        const msg = data.message || 'Erro ao criar conta.';
        const markEmail = /email/i.test(msg);
        showError(msg, markEmail ? [emailInput] : []);
      }
    } catch (error) {
      showError('Erro ao criar conta. Tente novamente mais tarde.');
    }
  });
}
