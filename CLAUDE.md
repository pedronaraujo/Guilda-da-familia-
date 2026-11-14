# Guilda da Família: instruções para o Claude

Responda ao Pedro sempre em português do Brasil.

## Regra fixa: backup antes de qualquer atualização

Pedido do Pedro: **sempre** salvar um backup da última versão antes de publicar uma atualização.
Antes de cada `git push` para `main` (que publica o site sozinho pela Cloudflare):

1. `sh scripts/backup.sh`: guarda o `main` atual (a versão no ar) em `backup/AAAA-MM-DD-HHMM`.
   O proxy desta sessão não aceita enviar tags; use branches.
2. `python3 build.py` e os testes em `test/` contra `wrangler dev --port 8787`.
3. Só então commit + `git -c push.negotiate=true push`.
4. Depois do deploy (~2 min), conferir o site no navegador e dizer ao Pedro o nome do backup.

Os dados das salas têm cópias automáticas no servidor (veja `BACKUP.md`).
Nunca apague branches `backup/`.

## Estrutura
- `src/` (data, engine, calibration, avatar, app, style) → `build.py` → `public/index.html`.
- `worker/index.js`: servidor (Durable Objects Room e Account).
- Mudou o motor de batalha? Rode `node test/calibrate.js` para refazer a calibração da dificuldade.
