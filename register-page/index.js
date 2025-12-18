const API_URL = 'https://school-diary-production.up.railway.app/api';

window.handleGoogleLogin = handleGoogleLogin;

const form = document.getElementById('register-form');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!name || !email || !password) {
    alert('Preencha todos os campos.');
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
      alert('Cadastro realizado com sucesso! Faça login.');
      window.location.href = '../login-page/index.html';
    } else {
      alert(data.message || 'Erro ao criar conta.');
    }
  } catch (error) {
    alert('Erro ao criar conta. Tente novamente.');
  }
});
