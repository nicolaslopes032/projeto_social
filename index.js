const express = require('express');
const pool = require('./db');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/livros', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM livros ORDER BY nome ASC');
    res.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar no banco:", erro);
    res.status(500).send('Erro ao buscar os livros');
  }
});

app.post('/cadastro', async (req, res) => {
  const { nome, autor, genero, cdd, imagens, disponibilidade } = req.body;
  try {
    await pool.query(
      'INSERT INTO livros (nome, autor, genero, cdd, imagens, disponibilidade) VALUES ($1, $2, $3, $4, $5, $6)',
      [nome, autor, genero, cdd, imagens, disponibilidade]
    );
    res.send('Livro cadastrado com sucesso!');
  } catch (erro) {
    console.error("Erro ao cadastrar:", erro);
    res.status(500).send('Erro ao cadastrar');
  }
});

app.get('/', (req, res) => {
  res.send('Servidor funcionando!');
});

app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});