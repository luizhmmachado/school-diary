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
      if (window.SessionManager) {
        window.SessionManager.setSession({
          token: data.token || data.accessToken,
          userId: data.userId || data.user?.id || data.user?.userId,
          user: data.user,
          email,
        });
      }
      console.log("Login concluído com sucesso")
      window.location.href = '../dashboard/index.html';
    } else {
      alert('Credenciais inválidas!');
    }
  } catch (error) {
    alert('Erro ao fazer login. Tente novamente.');
  }
});

document.querySelector('.btn-signup').addEventListener('click', () => {
  window.location.href = '../register-page/index.html';
});
