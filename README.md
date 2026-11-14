# Guilda da Família

Gestor de tarefas da família em forma de RPG: cada pessoa cria um herói, cumpre tarefas do dia, ganha experiência, ouro e itens, e à meia-noite o grupo enfrenta uma batalha automática.

Criado por Pedro Tostes com o Claude.

## Estrutura

- `public/index.html` — o aplicativo pronto, num arquivo só (é o que vai para o ar).
- `src/` — código-fonte: `data.js` (classes, habilidades, itens), `engine.js` (batalhas e regras), `avatar.js` (desenhos), `app.js` (telas) e `style.css`.
- `build.py` — junta o `src/` em `public/index.html`.
- `gas/Code.gs` — servidor antigo no Google Apps Script (mantido como referência).
- `test/` — testes automáticos.

## Como gerar uma nova versão

```
python3 build.py
```
