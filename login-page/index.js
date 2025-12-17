function togglePassword() {
  const passwordInput = document.getElementById('password');
  const toggleIcon = document.getElementById('toggle-icon');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleIcon.src = '../images/hide-password.svg';
    toggleIcon.alt = 'Esconder senha';
  } else {
    passwordInput.type = 'password';
    toggleIcon.src = '../images/show-password.svg';
    toggleIcon.alt = 'Mostrar senha';
  }
}

const API_URL = 'https://school-diary-production.up.railway.app/api';

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

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    const result = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await result.json();
    
    if (data.success) {
      // Redirecionar para dashboard
    } else {
      alert('Credenciais inválidas!');
    }
  } catch (error) {
    alert('Erro ao fazer login. Tente novamente.');
  }
});
