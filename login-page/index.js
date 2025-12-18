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
      console.log("Login concluído com sucesso")
      // Redirecionar para dashboard
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
