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
