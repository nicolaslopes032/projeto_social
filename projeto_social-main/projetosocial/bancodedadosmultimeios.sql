CREATE TABLE Livros (
    id INT PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    autor VARCHAR(200) NOT NULL,
    genero VARCHAR(50) NOT NULL
);

CREATE TYPE tipo_usuario AS ENUM('aluno', 'professor', 'bibliotecaria');
CREATE Table usuario(
    id INT PRIMARY KEY ,
    nome VARCHAR(100) NOT NULL,
    login VARCHAR(50) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
	tipo_usuario VARCHAR(50) NOT NULL
);

CREATE TABLE aluno(
    id INT PRIMARY KEY,
    matricula VARCHAR(20) UNIQUE NOT NULL,
    Foreign Key (id) REFERENCES usuario(id)
);

CREATE TYPE estado AS ENUM('disponivel', 'agendado', 'emprestado');

CREATE Table exemplares(
	livro_id INT NOT NULL UNIQUE,
    id INT PRIMARY KEY,
    estado VARCHAR(50) NOT NULL,
    Foreign Key (livro_id) REFERENCES Livros(id)
);

CREATE TABLE emprestimos(
    id INT PRIMARY KEY,
    exemplar_id INT UNIQUE NOT NULL,
    usuario_id INT UNIQUE NOT NULL,
    data_emprestimo DATE NOT NULL,
    data_prevista_devolucao DATE NOT NULL,
    Foreign Key (exemplar_id) REFERENCES exemplares(id),
    Foreign Key (usuario_id) REFERENCES usuario(id)
);