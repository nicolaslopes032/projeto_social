const form = document.getElementById('form-cadastro');
const mensagem = document.getElementById('mensagem');

const apiBaseUrl = window.location.protocol === 'file:'
  || ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '3000'
  ? 'http://localhost:3000'
  : '';

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = document.getElementById('usuario').value.trim().replace(/\s+/g, '');
    const senha = document.getElementById('password').value.trim().replace(/\s+/g, '');

    mensagem.textContent = '';
    mensagem.classList.remove('erro', 'sucesso');

    try {
        const resposta = await fetch(`${apiBaseUrl}/api/registrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, senha })
        });

        if (resposta.ok) {
            mensagem.textContent = 'Cadastro realizado! Redirecionando...';
            mensagem.classList.add('sucesso');
            setTimeout(() => window.location.href = 'entrar.html', 1500);
        } else if (resposta.status === 409) {
            mensagem.textContent = 'Esse usuário já existe.';
            mensagem.classList.add('erro');
        } else {
            const erroTexto = await resposta.text();
            mensagem.textContent = erroTexto || 'Erro ao cadastrar. Tente novamente.';
            mensagem.classList.add('erro');
        }
    } catch (erro) {
        console.error('Erro:', erro);
        mensagem.textContent = 'Erro ao conectar com o servidor. Verifique se o servidor está rodando em http://localhost:3000.';
        mensagem.classList.add('erro');
    }
});