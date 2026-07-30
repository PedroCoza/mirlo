# Mirlo

Transcripción, traducción y diarización de audio.

## Desarrollo

```bash
# base de datos
docker-compose up -d

# backend
cd backend && uv venv && uv pip install -r requirements.txt
uvicorn app.main:app --reload

# frontend
cd frontend && pnpm install && pnpm dev
```
