// DADOS
let livros = [];
let agendamentoLivroId = null;
let paginaAtual = 1;
let totalPaginas = 1;
let totalLivros = 0;

const canalAtualizacao = new BroadcastChannel('livros-update');

const apiLivrosUrl = window.location.protocol === 'file:'
  || ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '3000'
  ? 'http://localhost:3000/api/livros'
  : '/api/livros';
const apiBaseUrl = apiLivrosUrl.replace('/api/livros', '');

function escapeHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[caractere]));
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

// Monta a query string com busca/filtros + paginação, e busca no servidor.
// O catálogo tem milhares de livros (planilha de tombamento), então o painel
// nunca carrega tudo de uma vez — só a página atual, filtrada no banco.
function montarParametros(pagina) {
  const busca = document.getElementById('busca')?.value.trim() || '';
  const genero = document.getElementById('filtro-genero')?.value || '';
  const status = document.getElementById('filtro-status')?.value || '';

  const params = new URLSearchParams({ page: pagina, limit: 30 });
  if (busca) params.set('busca', busca);
  if (genero) params.set('genero', genero);
  if (status) params.set('status', status);
  return params;
}

async function carregarLivros(pagina = 1) {
  renderizarCarregando();

  try {
    const params = montarParametros(pagina);
    const resposta = await fetch(`${apiLivrosUrl}?${params.toString()}`, { cache: 'no-store' });

    if (!resposta.ok) {
      throw new Error(`Erro ao conectar com a API: ${resposta.status} ${resposta.statusText}`);
    }

    const dados = await resposta.json();
    livros = (dados.livros ?? dados).map(normalizarLivro);
    paginaAtual = dados.pagina ?? 1;
    totalPaginas = dados.totalPaginas ?? 1;
    totalLivros = dados.total ?? livros.length;

    renderizarTabela(livros);
    renderizarPaginacao();
    atualizarStats();
  } catch (erro) {
    console.error('Erro ao carregar livros no painel:', erro);
    livros = [];
    renderizarErroCarregamento();
    atualizarStats();
    mostrarToast('Não foi possível carregar os livros do banco de dados.', true);
  }
}

// Carrega a lista de gêneros (para o filtro) uma vez, sem depender de ter
// todos os livros carregados no cliente.
async function carregarGeneros() {
  const filtroGenero = document.getElementById('filtro-genero');
  const novoGenero = document.getElementById('novo-genero');
  if (!filtroGenero && !novoGenero) return;

  try {
    const resposta = await fetch(`${apiBaseUrl}/api/generos`, { cache: 'no-store' });
    if (!resposta.ok) return;
    const generos = await resposta.json();

    if (filtroGenero) {
      filtroGenero.innerHTML = '<option value="">Todos</option>' + generos.map(g => `<option>${escapeHTML(g)}</option>`).join('');
    }
    if (novoGenero && generos.length) {
      novoGenero.innerHTML = generos.map(g => `<option>${escapeHTML(g)}</option>`).join('');
    }
  } catch (erro) {
    console.error('Erro ao carregar gêneros:', erro);
  }
}

function renderizarCarregando() {
  const tbody = document.getElementById('tbody-livros');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--texto-claro);font-style:italic;">Carregando livros do banco de dados...</td></tr>`;
}

function renderizarErroCarregamento() {
  const tbody = document.getElementById('tbody-livros');
  const dicaServidor = window.location.protocol === 'file:'
    ? '<br>Abra pelo servidor em http://localhost:3000/painel.html.'
    : '';

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--vermelho);font-style:italic;">Erro ao carregar livros.${dicaServidor}</td></tr>`;
}

function badgeHTML(status) {
  const classes = {
    'Disponível': 'badge-disponivel',
    'Emprestado': 'badge-emprestado',
    'Indisponível': 'badge-indisponivel'
  };
  return `<span class="badge ${classes[status] || 'badge-disponivel'}"><span class="badge-dot"></span>${escapeHTML(status)}</span>`;
}

function capaHTML(livro) {
  if (livro.imagem) {
    return `<div class="book-cover-small"><img src="${escapeHTML(livro.imagem)}" alt="${escapeHTML(livro.titulo)}"></div>`;
  }

  return '<div class="book-cover-small">📖</div>';
}

function renderizarTabela(dados) {
  const tbody = document.getElementById('tbody-livros');
  if (!dados.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--texto-claro);font-style:italic;">Nenhum livro encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = dados.map(l => `
    <tr data-id="${l.id}">
      <td data-label="Livro">
        <div class="book-cell">
          ${capaHTML(l)}
          <div>
            <div class="book-name">${escapeHTML(l.titulo)}</div>
            <div class="book-author">${escapeHTML(l.autor)}</div>
          </div>
        </div>
      </td>
      <td data-label="Gênero"><div class="book-genre">${escapeHTML(l.genero)}</div></td>
      <td data-label="Exemplares">
        <div class="qty-control">
          <button class="qty-btn" onclick="alterarQtd(${l.id}, -1)">−</button>
          <input class="qty-input" type="number" value="${l.exemplares}" min="0" id="qty-${l.id}" onchange="atualizarQtdManual(${l.id})">
          <button class="qty-btn" onclick="alterarQtd(${l.id}, 1)">+</button>
        </div>
      </td>
      <td data-label="Status">${badgeHTML(l.status)}</td>
      <td data-label="Alterar">
        <select class="status-select" id="status-${l.id}" onchange="salvarAlteracoes(${l.id})">
          <option ${l.status === 'Disponível' ? 'selected' : ''}>Disponível</option>
          <option ${l.status === 'Emprestado' ? 'selected' : ''}>Emprestado</option>
          <option ${l.status === 'Indisponível' ? 'selected' : ''}>Indisponível</option>
        </select>
      </td>
      <td data-label="Ações">
        <div class="actions">
          <button class="btn-action btn-salvar" onclick="salvarAlteracoes(${l.id})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Salvar
          </button>
          <button class="btn-action btn-agendar" onclick="abrirModalAgendar(${l.id})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Agendar
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Cria (uma vez) e atualiza os controles de paginação, logo abaixo da tabela.
function renderizarPaginacao() {
  let container = document.getElementById('paginacao-painel');
  if (!container) {
    container = document.createElement('div');
    container.id = 'paginacao-painel';
    container.className = 'paginacao';
    const tabela = document.getElementById('tbody-livros').closest('table');
    tabela.insertAdjacentElement('afterend', container);
  }

  if (totalPaginas <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';

  const botaoAnterior = document.createElement('button');
  botaoAnterior.textContent = '← Anterior';
  botaoAnterior.disabled = paginaAtual <= 1;
  botaoAnterior.addEventListener('click', () => carregarLivros(paginaAtual - 1));

  const indicador = document.createElement('span');
  indicador.className = 'paginacao-indicador';
  indicador.textContent = `Página ${paginaAtual} de ${totalPaginas} (${totalLivros} livros)`;

  const botaoProximo = document.createElement('button');
  botaoProximo.textContent = 'Próxima →';
  botaoProximo.disabled = paginaAtual >= totalPaginas;
  botaoProximo.addEventListener('click', () => carregarLivros(paginaAtual + 1));

  container.append(botaoAnterior, indicador, botaoProximo);
}

function atualizarStats() {
  // Com paginação, as estatísticas de disponibilidade/empréstimo/indisponível
  // são calculadas a partir de contagens no servidor, não só da página atual.
  atualizarStatsServidor();
}

async function atualizarStatsServidor() {
  try {
    const [disp, emp, indisp] = await Promise.all([
      fetch(`${apiLivrosUrl}?limit=1&status=Disponível`).then(r => r.json()),
      fetch(`${apiLivrosUrl}?limit=1&status=Emprestado`).then(r => r.json()),
      fetch(`${apiLivrosUrl}?limit=1&status=Indisponível`).then(r => r.json())
    ]);
    document.getElementById('stat-disp').textContent = disp.total ?? 0;
    document.getElementById('stat-emp').textContent = emp.total ?? 0;
    document.getElementById('stat-indisp').textContent = indisp.total ?? 0;
  } catch (erro) {
    console.error('Erro ao carregar estatísticas:', erro);
  }
}

function filtrarTabela() {
  carregarLivros(1);
}

function limparFiltros() {
  document.getElementById('busca').value = '';
  document.getElementById('filtro-genero').value = '';
  document.getElementById('filtro-status').value = '';
  carregarLivros(1);
}

function alterarQtd(id, delta) {
  const livro = livros.find(l => l.id === id);
  if (!livro) return;
  livro.exemplares = Math.max(0, livro.exemplares + delta);
  const input = document.getElementById(`qty-${id}`);
  if (input) input.value = livro.exemplares;
}

function atualizarQtdManual(id) {
  const livro = livros.find(l => l.id === id);
  const input = document.getElementById(`qty-${id}`);
  if (!livro || !input) return;
  livro.exemplares = Math.max(0, parseInt(input.value, 10) || 0);
  input.value = livro.exemplares;
}

async function salvarAlteracoes(id) {
  const livro = livros.find(l => l.id === id);
  const statusEl = document.getElementById(`status-${id}`);
  const qtyEl = document.getElementById(`qty-${id}`);
  if (!livro) return;

  const novoStatus = statusEl ? statusEl.value : livro.status;
  const novaQuantidade = qtyEl ? Math.max(0, parseInt(qtyEl.value, 10) || 0) : livro.exemplares;

  try {
    await salvarDisponibilidadeNoBanco(id, novoStatus, novaQuantidade);
    livro.status = novoStatus;
    livro.exemplares = novaQuantidade;
    atualizarStats();
    canalAtualizacao.postMessage('update');
    localStorage.setItem('livros-update', Date.now().toString());
    mostrarToast(`✅ "${livro.titulo}" atualizado no painel e na biblioteca!`);
  } catch (erro) {
    console.error('Erro ao salvar alterações:', erro);
    mostrarToast(`Erro ao salvar: ${erro.message}`, true);
  }
}


async function salvarDisponibilidadeNoBanco(id, disponibilidade, exemplares) {
  if (id < 0) return;

  const resposta = await fetch(`${apiBaseUrl}/api/livros/${id}/disponibilidade`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ disponibilidade, exemplares })
  });

  if (!resposta.ok) {
    const mensagem = await resposta.text();
    throw new Error(mensagem || 'Erro ao atualizar disponibilidade');
  }
}
function abrirModalAgendar(id) {
  const livro = livros.find(l => l.id === id);
  if (!livro) return;
  agendamentoLivroId = id;
  document.getElementById('modal-book-title').textContent = livro.titulo;
  document.getElementById('modal-book-author').textContent = livro.autor;
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('ag-retirada').value = hoje;
  document.getElementById('ag-devolucao').value = '';
  document.getElementById('ag-aluno').value = '';
  document.getElementById('ag-matricula').value = '';
  document.getElementById('ag-turma').value = '';
  document.getElementById('ag-telefone').value = '';
  document.getElementById('ag-obs').value = '';
  abrirModal('modal-agendamento');
}

async function confirmarAgendamento() {
  const aluno = document.getElementById('ag-aluno').value.trim();
  const retirada = document.getElementById('ag-retirada').value;
  const devolucao = document.getElementById('ag-devolucao').value;
  if (!aluno || !retirada || !devolucao) {
    mostrarToast('⚠️ Preencha aluno, datas de retirada e devolução.', true);
    return;
  }

  const livro = livros.find(l => l.id === agendamentoLivroId);
  if (!livro) return;

  try {
    await salvarDisponibilidadeNoBanco(livro.id, 'Emprestado');
    livro.status = 'Emprestado';
    document.getElementById('stat-agend').textContent =
      parseInt(document.getElementById('stat-agend').textContent, 10) + 1;
    fecharModal('modal-agendamento');
    atualizarStats();
    canalAtualizacao.postMessage('update');
    localStorage.setItem('livros-update', Date.now().toString());
    mostrarToast(`📅 Agendamento para "${livro.titulo}" confirmado!`);
  } catch (erro) {
    console.error('Erro ao confirmar agendamento:', erro);
    mostrarToast('Erro ao salvar agendamento no banco.', true);
  }
}

function abrirModalAdicionar() {
  document.getElementById('novo-titulo').value = '';
  document.getElementById('novo-autor').value = '';
  document.getElementById('novo-qtd').value = '1';
  abrirModal('modal-adicionar');
}

async function adicionarLivro() {
  const titulo = document.getElementById('novo-titulo').value.trim();
  const autor = document.getElementById('novo-autor').value.trim();
  const genero = document.getElementById('novo-genero').value;
  const qtd = parseInt(document.getElementById('novo-qtd').value, 10) || 1;
  const status = document.getElementById('novo-status').value;
  if (!titulo || !autor) {
    mostrarToast('⚠️ Preencha título e autor.', true);
    return;
  }

  try {
    const resposta = await fetch(`${apiBaseUrl}/api/livros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, autor, genero, status })
    });

    if (!resposta.ok) {
      const msg = await resposta.text();
      mostrarToast(msg || '⚠️ Erro ao adicionar livro.', true);
      return;
    }

    await resposta.json();
    fecharModal('modal-adicionar');
    await carregarGeneros();
    carregarLivros(1);
    mostrarToast(`📚 "${titulo}" adicionado e salvo no banco!`);
  } catch (erro) {
    console.error('Erro ao adicionar livro:', erro);
    mostrarToast('Erro ao conectar com o servidor.', true);
  }
}

function abrirModal(id) {
  document.getElementById(id).classList.add('open');
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Fechar modal clicando fora
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

let toastTimer;
function mostrarToast(msg, erro = false) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  msgEl.textContent = msg;
  toast.className = 'toast' + (erro ? ' error' : '');
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), erro ? 8000 : 3200);
}

// Inicializar
carregarGeneros();
carregarLivros(1);