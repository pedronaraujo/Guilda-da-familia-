# Cópias de segurança e como voltar atrás

São dois tipos de cópia: do **código** (o app em si) e dos **dados** (heróis, tarefas, batalhas de cada sala).

## 1. Código

Antes de toda atualização, a versão que está no ar é guardada numa branch `backup/AAAA-MM-DD-HHMM`
no GitHub (`sh scripts/backup.sh`). A lista fica em
GitHub → repositório → **Branches** (as que começam com `backup/`).

### Voltar atrás rápido (1 minuto, sem mexer no código)
1. Abra o painel da Cloudflare → **Workers & Pages** → `guilda-da-familia` → **Deployments**.
2. Na versão anterior que funcionava, clique em **⋯ → Rollback**.

O site volta na hora. A próxima atualização enviada ao GitHub publica de novo por cima.

### Voltar o código para um backup (definitivo)
No GitHub, abra o backup desejado e compare com `main`, ou peça ao Claude:
"volte o projeto para o backup `backup/2026-11-14-0249`". Ele cria um commit novo em `main`
com o conteúdo daquele backup, e a Cloudflare publica sozinha.

## 2. Dados das salas

O servidor guarda sozinho, em cada sala:
- uma cópia **antes da primeira gravação de cada versão nova do app** (os dados como a versão anterior deixou);
- uma cópia **por dia**;
- uma cópia **antes de cada restauração** (para dar para desfazer).

Ficam as 14 mais recentes. O organizador vê, baixa (arquivo .json) e restaura em
**Menu → Configurações → Cópias de segurança**. Restaurar pede para escrever RESTAURAR.
