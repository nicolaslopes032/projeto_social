ALTER TABLE Livros
ALTER COLUMN cdd TYPE CHAR(20)
USING cdd::CHAR(20);
ALTER TABLE exemplares ADD COLUMN livro_cdd CHAR(20) NOT NULL;
ALTER TABLE exemplares ADD CONSTRAINT fk_exemplares_livros
FOREIGN KEY (livro_cdd) REFERENCES Livros(cdd);
