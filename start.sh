#!/bin/sh
# Mirlo - arranque completo (PostgreSQL + LibreTranslate + backend GPU + frontend)

docker compose up -d --build

echo "Esperando al backend..."
until curl -sf http://localhost:8000/health > /dev/null; do
    sleep 2
done

echo "Mirlo listo en http://localhost:3000"
