const campoPesquisa = document.getElementById('campo-pesquisa');
const listaLivros = document.getElementById('lista-livros');
let paginaAtual = 1;
let totalPaginas = 1;
let termoBusca = '';
let debounceBusca = null;

const apiLivrosUrl = window.location.protocol === 'file:'
    || ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '3000'
    ? 'http://localhost:3000/api/livros'
    : '/api/livros';

// Container de paginação, criado dinamicamente logo após a lista de livros
// (não depende de nada existir no HTML).
const paginacaoEl = document.createElement('div');
paginacaoEl.id = 'paginacao-livros';
paginacaoEl.className = 'paginacao';
listaLivros.insertAdjacentElement('afterend', paginacaoEl);

async function carregarLivros(pagina = 1) {
    listaLivros.innerHTML = '<p>Carregando livros do banco de dados...</p>';
    paginacaoEl.innerHTML = '';

    const params = new URLSearchParams({
        page: pagina,
        limit: 24
    });
    if (termoBusca) params.set('busca', termoBusca);

    try {
        const resposta = await fetch(`${apiLivrosUrl}?${params.toString()}`, { cache: 'no-store' });

        if (!resposta.ok) {
            throw new Error(`Erro ao conectar com a API: ${resposta.status} ${resposta.statusText}`);
        }

        const dados = await resposta.json();
        const livros = (dados.livros ?? dados).map(normalizarLivro);

        paginaAtual = dados.pagina ?? 1;
        totalPaginas = dados.totalPaginas ?? 1;

        renderizarLivros(livros);
        renderizarPaginacao();
    } catch (erro) {
        console.error('Erro fatal no front.js:', erro);
        listaLivros.innerHTML = '<p>Erro ao carregar livros.</p>';
        if (apiLivrosUrl.startsWith('http://localhost:3000')) {
            listaLivros.innerHTML += '<p>Verifique se o servidor está rodando em http://localhost:3000.</p>';
        }
    }
}

function renderizarLivros(livros) {
    if (livros.length === 0) {
        listaLivros.innerHTML = '<p>Nenhum livro encontrado para essa pesquisa.</p>';
        return;
    }

    listaLivros.innerHTML = '';

    livros.forEach(livro => {
        const divLivro = document.createElement('div');
        divLivro.classList.add('block');
        divLivro.innerHTML = `
            ${capaHTML(livro)}
            <h3>${escapeHTML(livro.titulo)}</h3>
            <p class="autor-livro"><strong>Autor:</strong> ${escapeHTML(livro.autor)}</p>
            <p><strong>Gênero:</strong> <span class="genero-texto">${escapeHTML(livro.genero)}</span></p>
            <p><strong>Exemplares:</strong> ${livro.exemplares}</p>
            <span class="book-status ${classeStatus(livro.status)}">${escapeHTML(livro.status)}</span>
        `;
        listaLivros.appendChild(divLivro);
    });
}

function renderizarPaginacao() {
    paginacaoEl.innerHTML = '';
    if (totalPaginas <= 1) return;

    const botaoAnterior = document.createElement('button');
    botaoAnterior.textContent = '← Anterior';
    botaoAnterior.disabled = paginaAtual <= 1;
    botaoAnterior.addEventListener('click', () => carregarLivros(paginaAtual - 1));

    const indicador = document.createElement('span');
    indicador.className = 'paginacao-indicador';
    indicador.textContent = `Página ${paginaAtual} de ${totalPaginas}`;

    const botaoProximo = document.createElement('button');
    botaoProximo.textContent = 'Próxima →';
    botaoProximo.disabled = paginaAtual >= totalPaginas;
    botaoProximo.addEventListener('click', () => carregarLivros(paginaAtual + 1));

    paginacaoEl.append(botaoAnterior, indicador, botaoProximo);
}

function capaHTML(livro) {
    if (livro.imagem) {
        return `<img src="${escapeHTML(livro.imagem)}" alt="${escapeHTML(livro.titulo)}" width="150" height="200">`;
    }

    return '<div class="book-cover-placeholder">📖</div>';
}

function classeStatus(status) {
    const texto = removerAcentos(status);
    if (texto.includes('emprest')) return 'status-emprestado';
    if (texto.includes('indispon')) return 'status-indisponivel';
    return 'status-disponivel';
}

function normalizarLivro(livro) {
    return {
        id: livro.id,
        titulo: normalizarTexto(livro.titulo ?? livro.nome, 'Sem título'),
        autor: normalizarTexto(livro.autor, 'Desconhecido'),
        genero: normalizarTexto(livro.genero, 'Sem gênero'),
        exemplares: normalizarExemplares(livro),
        status: normalizarStatus(livro.status ?? livro.disponibilidade),
        imagem: normalizarTexto(livro.imagens ?? livro.imagem)
    };
}

function normalizarTexto(valor, fallback = '') {
    if (Array.isArray(valor)) return valor.filter(Boolean).join(', ');
    const texto = String(valor ?? '').trim();
    return texto || fallback;
}

function removerAcentos(valor) {
    return normalizarTexto(valor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function normalizarStatus(valor) {
    if (typeof valor === 'boolean') return valor ? 'Disponível' : 'Indisponível';

    const status = removerAcentos(valor);
    if (status.includes('emprest')) return 'Emprestado';
    if (status.includes('indispon') || status === 'false' || status === '0') return 'Indisponível';
    return 'Disponível';
}

function normalizarExemplares(livro) {
    const quantidade = livro.exemplares ?? livro.quantidade ?? livro.qtd ?? livro.total_exemplares ?? 1;
    return Math.max(0, parseInt(quantidade, 10) || 0);
}

function escapeHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[caractere]));
}

// A busca agora é feita no servidor (com debounce), já que o catálogo tem
// milhares de livros e carregar tudo de uma vez travaria a página.
campoPesquisa.addEventListener('input', () => {
    clearTimeout(debounceBusca);
    debounceBusca = setTimeout(() => {
        termoBusca = campoPesquisa.value.trim();
        carregarLivros(1);
    }, 350);
});

// Atualiza quando o painel salvar alguma mudança (mesma aba do navegador)
const canalAtualizacao = new BroadcastChannel('livros-update');
canalAtualizacao.addEventListener('message', () => carregarLivros(paginaAtual));

// Atualiza quando o painel salvar em outra aba do navegador
window.addEventListener('storage', (e) => {
    if (e.key === 'livros-update') carregarLivros(paginaAtual);
});

carregarLivros(1);