const form = document.getElementById('form');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nome = document.getElementById('nome').value;
      const autor = document.getElementById('autor').value;
      const genero = document.getElementById('genero').value;

      const res = await fetch('/cadastro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nome, autor, genero })
      });

      const msg = await res.text();
      alert(msg);
    });