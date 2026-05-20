async function carregarLivros() {
    console.log("Iniciando a busca de livros...");
    
    try {
        const resposta = await fetch('/api/livros');
        
        if (!resposta.ok) {
            throw new Error("Erro ao conectar com a API");
        }

        const livros = await resposta.json();
        const container = document.getElementById('lista-livros');

        if (livros.length === 0) {
            container.innerHTML = "<p>Nenhum livro cadastrado.</p>";
            return;
        }

        container.innerHTML = '';

        livros.forEach(livro => {
            const divLivro = document.createElement('div');
            divLivro.classList.add('block');

            divLivro.innerHTML = `
                <img src="${livro.imagens}" alt="${livro.nome}" width="150px" height="200px">
                <h3>${livro.nome || 'Sem título'}</h3>
                <p><strong>Autor:</strong> ${livro.autor || 'Desconhecido'}</p>
                <p><strong>Gênero:</strong> ${livro.genero || 'N/A'}</p>
            `;

            container.appendChild(divLivro);
        });

    } catch (erro) {
        console.error("Erro fatal no front.js:", erro);
        document.getElementById('lista-livros').innerHTML = "<p>Erro ao carregar livros.</p>";
    }
}

carregarLivros();