# Mirlo

Transcripción, traducción y diarización de audio. Este proyecto nace como Trabajo de Fin de Grado de Ingeniería de Software de la Universidad de Sevilla. Sus fines son meramente académicos y de cara a la evaluación.

## Arranque con Docker

Requisitos: Docker Desktop y una GPU NVIDIA con el driver al dia (el
backend usa CUDA para transcribir y diarizar).

```bash
# Windows
start.bat

# Linux
./start.sh
```

Levanta los cuatro servicios (PostgreSQL, LibreTranslate, backend con GPU y
frontend) y abre la app en http://localhost:3000. La primera construccion
descarga una imagen de varios GB con PyTorch y CUDA; las siguientes usan la
cache. Los archivos subidos quedan en `descargas/` y la base de datos
persiste en un volumen de Docker.

## Desarrollo

```bash
docker compose up -d db libretranslate

cd backend && uv venv && uv pip install -r requirements.txt && uvicorn app.main:app --reload
cd frontend && pnpm install && pnpm dev
```
