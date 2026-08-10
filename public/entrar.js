const form = document.getElementById('form-login');
const mensagem = document.getElementById('mensagem-erro');

const apiBaseUrl = window.location.protocol === 'file:'
  || ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '3000'
  ? 'http://localhost:3000'
  : '';

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = document.getElementById('usuario').value.trim();
    const senha = document.getElementById('password').value.trim();

    mensagem.textContent = '';
    mensagem.classList.remove('erro', 'sucesso');

    try {
        const resposta = await fetch(`${apiBaseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, senha })
        });

        if (resposta.ok) {
            window.location.href = 'painel.html';
        } else {
            mensagem.textContent = 'Usuário ou senha incorretos.';
            mensagem.classList.add('erro');
        }
    } catch (erro) {
        console.error('Erro:', erro);
        mensagem.textContent = 'Erro ao conectar com o servidor. Verifique se o servidor está rodando em http://localhost:3000.';
        mensagem.classList.add('erro');
    }
});