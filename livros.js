// import-livros.js
//
// Importa os livros de livros_tombamento.json para a tabela "livros",
// evitando duplicar livros que já existem no banco.
//
// IMPORTANTE: neste banco, as colunas "autor" e "genero" são do tipo
// array (text[]), não texto simples — por isso o script trata elas como
// arrays de um único elemento na hora de comparar e inserir.
//
// Regra aplicada (conforme pedido):
//  - Se o livro (mesmo nome + autor) NÃO existe no banco -> insere um registro
//    novo, com disponibilidade = 'Disponível' e exemplares = quantidade
//    encontrada na planilha (quantas cópias físicas tinham o mesmo tombamento).
//  - Se o livro JÁ existe no banco -> NÃO cria linha nova; apenas soma +1
//    exemplar ao que já está cadastrado (um a mais do que já tinha na tabela).
//
// Como rodar:
//   1. Coloque este arquivo e o livros_tombamento.json na raiz do projeto
//      (mesma pasta do index.js e do db.js).
//   2. node import-livros.js
//
// O script é seguro para rodar mais de uma vez: na segunda execução ele vai
// reconhecer os livros já importados (pelo nome+autor) e só incrementar
// exemplares, em vez de duplicar.

const fs = require('fs');
const path = require('path');
const pool = require('./db');

const ARQUIVO_DADOS = path.join(__dirname, 'livros_tombamento.json');

function normalizar(valor) {
    return String(valor ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function garantirColunaExemplares() {
    // Cria a coluna exemplares caso ainda não exista (o restante do app já
    // assume que ela pode existir, então isso deixa tudo consistente).
    await pool.query(`
        ALTER TABLE livros
        ADD COLUMN IF NOT EXISTS exemplares INTEGER DEFAULT 1
    `);
}

// nome é texto simples; autor/genero são array (text[]) neste banco, então
// convertemos o array pra texto (array_to_string) antes de comparar.
async function buscarLivroExistente(nome, autor) {
    const resultado = await pool.query(
        `SELECT id, exemplares FROM livros
         WHERE LOWER(TRIM(nome)) = $1
           AND LOWER(TRIM(array_to_string(autor, ', '))) = $2
         LIMIT 1`,
        [normalizar(nome), normalizar(autor)]
    );
    return resultado.rows[0] || null;
}

async function inserirLivro(livro) {
    await pool.query(
        `INSERT INTO livros (cdd, nome, autor, genero, imagens, disponibilidade, exemplares)
         VALUES ($1, $2, ARRAY[$3]::text[], ARRAY[$4]::text[], $5, $6, $7)`,
        [
            livro.cdd || null,
            livro.nome,
            livro.autor || 'Desconhecido',
            livro.genero || 'Sem gênero',
            null,
            'Disponível',
            livro.exemplares || 1
        ]
    );
}

async function incrementarExemplar(id, exemplaresAtuais) {
    const novoTotal = (exemplaresAtuais ?? 1) + 1;
    await pool.query(
        `UPDATE livros SET exemplares = $1 WHERE id = $2`,
        [novoTotal, id]
    );
}

async function main() {
    if (!fs.existsSync(ARQUIVO_DADOS)) {
        console.error(`Arquivo não encontrado: ${ARQUIVO_DADOS}`);
        process.exit(1);
    }

    const livros = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf-8'));
    console.log(`Lidos ${livros.length} livros do arquivo.`);

    await garantirColunaExemplares();

    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;

    for (const livro of livros) {
        try {
            const existente = await buscarLivroExistente(livro.nome, livro.autor);
            if (existente) {
                await incrementarExemplar(existente.id, existente.exemplares);
                atualizados++;
            } else {
                await inserirLivro(livro);
                inseridos++;
            }
        } catch (erro) {
            erros++;
            console.error(`Erro no livro "${livro.nome}":`, erro.message);
        }

        if ((inseridos + atualizados + erros) % 200 === 0) {
            console.log(`Progresso: ${inseridos + atualizados + erros}/${livros.length}`);
        }
    }

    console.log('--- Importação concluída ---');
    console.log(`Novos livros inseridos: ${inseridos}`);
    console.log(`Livros já existentes (exemplar +1): ${atualizados}`);
    console.log(`Erros: ${erros}`);

    await pool.end();
}

main().catch(erro => {
    console.error('Falha na importação:', erro);
    process.exit(1);
});