async function carregarLivros() {
    console.log("Iniciando a busca de livros...");
    
    try {
        // Busca os dados da rota que criamos no index.js
        const resposta = await fetch('/api/livros');
        
        if (!resposta.ok) {
            throw new Error("Erro ao conectar com a API");
        }

        const livros = await resposta.json();
        console.log("Livros recebidos do banco:", livros);

        const container = document.getElementById('lista-livros');

        if (livros.length === 0) {
            container.innerHTML = "<p>Nenhum livro cadastrado no banco de dados.</p>";
            return;
        }

        // Limpa o container
        container.innerHTML = '';

        // Cria os blocos para cada livro
        livros.forEach(livro => {
            const divLivro = document.createElement('div');
            divLivro.classList.add('block');

            // Importante: Verifique se os nomes (nome, autor, genero) 
            // são iguais aos das colunas da sua tabela no pgAdmin!
            divLivro.innerHTML = `
                <h3>${livro.nome || 'Sem título'}</h3>
                <p><strong>Autor:</strong> ${livro.autor || 'Desconhecido'}</p>
                <p><strong>Gênero:</strong> ${livro.genero || 'N/A'}</p>
            `;

            container.appendChild(divLivro);
        });

    } catch (erro) {
        console.error("Erro fatal no front.js:", erro);
        document.getElementById('lista-livros').innerHTML = "<p>Erro ao carregar livros. Verifique o console (F12).</p>";
    }
}

// Chama a função assim que a página abre
carregarLivros();