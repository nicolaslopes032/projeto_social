const usernameEl = document.getElementById('email');
const passwordEl = document.getElementById('password');

document.getElementById('form').addEventListener('submit', (e) => e.preventDefault());

const username = usernameEl.value.trim(); // remove espaços
  const password = passwordEl.value.trim();
  let valido = true;

errUser.style.display = 'none';
  errPass.style.display = 'none';

  // Validação do usuário
  if (!username) {
    errUser.style.display = 'block';
    valido = false;
  }

  // Validação da senha
  if (!password) {
    errPass.textContent = 'Campo obrigatório.';
    errPass.style.display = 'block';
    valido = false;
  } else if (password.length < 6) {
    errPass.textContent = 'Senha muito curta. Mínimo 6 caracteres.';
    errPass.style.display = 'block';
    valido = false;
  }

  if (valido) {
    // Aqui você faz a requisição ao servidor / verifica no banco SQL
    console.log('Login válido, enviando ao servidor...');
  }

