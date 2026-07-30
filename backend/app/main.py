from fastapi import FastAPI

from app.config import settings

app = FastAPI(title="Mirlo API")


@app.get("/health")
def health():
    return {"status": "ok"}
