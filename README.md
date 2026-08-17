# Mirlo

Transcripción, traducción y diarización de audio. Este proyecto nace como Trabajo de Fin de Grado de Ingeniería de Software de la Universidad de Sevilla. Sus fines son meramente académicos y de cara a la evaluación.

## Desarrollo

```bash
# todo (db + backend + frontend) con un solo comando
docker-compose up -d

# frontend  -> http://localhost:3000
# backend   -> http://localhost:8000  (health en /health)
```

Modo dev individual (recarga en caliente):

```bash
docker-compose up -d db
cd backend && uv venv && uv pip install -r requirements.txt && uvicorn app.main:app --reload
cd frontend && pnpm install && pnpm dev
```
