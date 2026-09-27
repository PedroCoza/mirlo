@echo off
REM Mirlo - arranque completo (PostgreSQL + LibreTranslate + backend GPU + frontend)

docker compose up -d --build

echo Esperando al backend...
:espera
curl -s -o NUL http://localhost:8000/health
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto espera
)

echo Mirlo listo en http://localhost:3000
start http://localhost:3000
