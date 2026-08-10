require('dotenv').config();
const express = require('express');
const pool = require('./db');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const bcrypt = require('bcrypt');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET
});

const upload = multer({ dest: 'uploads/' });
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const STATUS_LIVRO_PERMITIDOS = ['Disponível', 'Emprestado', 'Indisponível'];

// Limites de paginação: evita que uma consulta sem limite (milhares de
// livros da planilha de tombamento) trave o servidor ou o navegador.
const LIMITE_PADRAO = 30;
const LIMITE_MAXIMO = 100;

// ─── Livros ───────────────────────────────────────────

// GET /api/livros?page=1&limit=30&busca=texto&genero=X&status=Y
// Retorna sempre paginado: { livros, pagina, limite, total, totalPaginas }
app.get('/api/livros', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const pagina = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limite = Math.min(LIMITE_MAXIMO, Math.max(1, parseInt(req.query.limit, 10) || LIMITE_PADRAO));
        const offset = (pagina - 1) * limite;

        const busca = (req.query.busca || '').trim();
        const genero = (req.query.genero || '').trim();
        const status = (req.query.status || '').trim();

        const condicoes = [];
        const valores = [];

        if (busca) {
            valores.push(`%${busca}%`);
            const idx = valores.length;
            condicoes.push(`(nome ILIKE $${idx} OR autor ILIKE $${idx} OR genero ILIKE $${idx})`);
        }
        if (genero) {
            valores.push(genero);
            condicoes.push(`genero = $${valores.length}`);
        }
        if (status && STATUS_LIVRO_PERMITIDOS.includes(status)) {
            valores.push(status);
            condicoes.push(`disponibilidade = $${valores.length}`);
        }

        const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

        const totalResultado = await pool.query(`SELECT COUNT(*) FROM livros ${where}`, valores);
        const total = parseInt(totalResultado.rows[0].count, 10);
        const totalPaginas = Math.max(1, Math.ceil(total / limite));

        const valoresPagina = [...valores, limite, offset];
        const resultado = await pool.query(
            `SELECT * FROM livros ${where} ORDER BY nome ASC LIMIT $${valoresPagina.length - 1} OFFSET $${valoresPagina.length}`,
            valoresPagina
        );

        res.json({
            livros: resultado.rows,
            pagina,
            limite,
            total,
            totalPaginas
        });
    } catch (erro) {
        console.error("Erro ao buscar no banco:", erro);
        res.status(500).send('Erro ao buscar os livros');
    }
});

// Lista de gêneros distintos, usada para preencher filtros sem carregar
// todos os livros no cliente.
app.get('/api/generos', async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT DISTINCT genero FROM livros WHERE genero IS NOT NULL AND genero <> '' ORDER BY genero ASC`
        );
        res.json(resultado.rows.map(r => r.genero));
    } catch (erro) {
        console.error("Erro ao buscar gêneros:", erro);
        res.status(500).send('Erro ao buscar gêneros');
    }
});

app.post('/api/cadastro', upload.single('imagem'), async (req, res) => {
    const { nome, autor, genero, cdd, disponibilidade } = req.body;
    try {
        const resultado = await cloudinary.uploader.upload(req.file.path);
        const urlImagem = resultado.secure_url;

        await pool.query(
            'INSERT INTO livros (nome, autor, genero, cdd, imagens, disponibilidade) VALUES ($1, $2, $3, $4, $5, $6)',
            [nome, autor, genero, cdd, urlImagem, disponibilidade]
        );
        res.send('Livro cadastrado com sucesso!');
    } catch (erro) {
        console.error("Erro ao cadastrar:", erro);
        res.status(500).send('Erro ao cadastrar');
    }
});

app.get('/api/livros/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await pool.query('SELECT * FROM livros WHERE id = $1', [id]);
        if (resultado.rows.length === 0) {
            return res.status(404).send('Livro não encontrado');
        }
        res.json(resultado.rows[0]);
    } catch (erro) {
        console.error("Erro ao buscar livro:", erro);
        res.status(500).send('Erro ao buscar o livro');
    }
});

app.post('/api/livros', async (req, res) => {
    const { titulo, autor, genero, status } = req.body;

    if (!titulo || !autor) {
        return res.status(400).send('Título e autor são obrigatórios');
    }

    const disponibilidade = STATUS_LIVRO_PERMITIDOS.includes(status) ? status : 'Disponível';

    try {
        const resultado = await pool.query(
            'INSERT INTO livros (nome, autor, genero, disponibilidade) VALUES ($1, $2, $3, $4) RETURNING *',
            [titulo, autor, genero || 'Sem gênero', disponibilidade]
        );
        res.json(resultado.rows[0]);
    } catch (erro) {
        console.error('Erro ao adicionar livro:', erro);
        res.status(500).send('Erro ao adicionar livro');
    }
});

app.put('/api/livros/:id/disponibilidade', async (req, res) => {
    const { id } = req.params;
    const { disponibilidade, exemplares } = req.body;

    if (!STATUS_LIVRO_PERMITIDOS.includes(disponibilidade)) {
        return res.status(400).send('Disponibilidade inválida');
    }

    try {
        let resultado;

        if (exemplares !== undefined) {
            const qtd = Math.max(0, parseInt(exemplares, 10) || 0);
            try {
                resultado = await pool.query(
                    'UPDATE livros SET disponibilidade = $1, exemplares = $2 WHERE id = $3 RETURNING *',
                    [disponibilidade, qtd, id]
                );
            } catch (errCol) {
                resultado = await pool.query(
                    'UPDATE livros SET disponibilidade = $1 WHERE id = $2 RETURNING *',
                    [disponibilidade, id]
                );
            }
        } else {
            resultado = await pool.query(
                'UPDATE livros SET disponibilidade = $1 WHERE id = $2 RETURNING *',
                [disponibilidade, id]
            );
        }

        if (resultado.rows.length === 0) {
            return res.status(404).send('Livro não encontrado');
        }

        console.log(`[SALVO] Livro id=${id} → disponibilidade="${disponibilidade}"`);
        res.json(resultado.rows[0]);
    } catch (erro) {
        console.error('Erro ao atualizar disponibilidade:', erro);
        res.status(500).send('Erro ao atualizar disponibilidade');
    }
});

// ─── Usuários ─────────────────────────────────────────

const tentativas = {};

app.post('/api/registrar', async (req, res) => {
    const login = req.body.login?.trim().replace(/\s+/g, '');
    const senha = req.body.senha?.trim().replace(/\s+/g, '');

    if (!login || !senha) {
        return res.status(400).json({ erro: 'Campos obrigatórios.' });
    }

    try {
        const existe = await pool.query(
            'SELECT * FROM usuario WHERE login = $1', [login]
        );
        if (existe.rows.length > 0) {
            return res.status(409).send('Usuário já existe');
        }

        const hash = await bcrypt.hash(senha, 10);

        await pool.query(
            'INSERT INTO usuario (login, senha) VALUES ($1, $2)',
            [login, hash]
        );
        res.send('Usuário registrado com sucesso');
    } catch (erro) {
        console.error('Erro ao registrar:', erro);
        res.status(500).send('Erro no servidor');
    }
});

app.post('/api/login', async (req, res) => {
    const ip = req.ip;
    tentativas[ip] = (tentativas[ip] || 0) + 1;

    if (tentativas[ip] > 10) {
        return res.status(429).json({ erro: 'Muitas tentativas. Aguarde.' });
    }

    const login = req.body.login?.trim().replace(/\s+/g, '');
    const senha = req.body.senha?.trim().replace(/\s+/g, '');

    if (!login || !senha) {
        return res.status(400).json({ erro: 'Campos obrigatórios.' });
    }

    try {
        const resultado = await pool.query(
            'SELECT * FROM usuario WHERE login = $1', [login]
        );
        if (resultado.rows.length === 0) {
            return res.status(401).send('Usuário ou senha incorretos');
        }

        const senhaCorreta = await bcrypt.compare(senha, resultado.rows[0].senha);
        if (!senhaCorreta) {
            return res.status(401).send('Usuário ou senha incorretos');
        }

        tentativas[ip] = 0;
        res.send('Login realizado com sucesso');
    } catch (erro) {
        console.error('Erro ao fazer login:', erro);
        res.status(500).send('Erro no servidor');
    }
});

// ─────────────────────────────────────────────────────

app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});