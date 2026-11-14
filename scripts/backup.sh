#!/bin/sh
# Guarda a versão que está no ar (o que está em main no GitHub) numa branch
# backup/AAAA-MM-DD-HHMM. Rode SEMPRE antes de publicar uma atualização.
# Uso: sh scripts/backup.sh
set -e
git fetch -q origin main
NOME="backup/$(TZ=America/Sao_Paulo date +%Y-%m-%d-%H%M)"
git push -q origin "refs/remotes/origin/main:refs/heads/$NOME"
echo "Backup salvo: $NOME ($(git rev-parse --short origin/main))"
