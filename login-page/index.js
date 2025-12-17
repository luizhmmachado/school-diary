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

// Configuração da API (use HTTPS para evitar mixed content/CORS)
const API_URL = 'https://school-diary-production.up.railway.app/api';

// Função chamada quando o usuário faz login com Google
async function handleGoogleLogin(response) {
  try {
    const credential = response.credential;
    
    // Enviar o token para o backend para validação
    const result = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential }),
    });
    
    const data = await result.json();
    
    if (data.success) {
      console.log('Login bem-sucedido!', data.user);
      alert(`Bem-vindo, ${data.user.name}!`);
      // Aqui você pode redirecionar para a página principal
      // window.location.href = '/dashboard';
    } else {
      alert('Erro ao fazer login: ' + data.message);
    }
  } catch (error) {
    console.error('Erro ao processar login:', error);
    alert('Erro ao fazer login com Google. Tente novamente.');
  }
}

// Login tradicional com email e senha
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
      console.log('Login bem-sucedido!', data.user);
      alert(`Bem-vindo, ${data.user.name}!`);
      // Redirecionar para dashboard
    } else {
      alert('Credenciais inválidas!');
    }
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    alert('Erro ao fazer login. Tente novamente.');
  }
});
