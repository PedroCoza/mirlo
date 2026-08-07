from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.config import settings
from app.database import Base, engine, get_db
from app.models import Perfil
from app.schemas import PerfilCreate, PerfilUpdate, PerfilOut
from app import youtube

app = FastAPI(title="Mirlo API")

# El frontend corre en otro contenedor/puerto, necesita CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Crea las tablas al arrancar (suficiente para desarrollo).
Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok", "service": "mirlo-api", "db_url": settings.database_url}


@app.get("/perfiles", response_model=list[PerfilOut])
def listar_perfiles(db: Session = Depends(get_db)):
    return db.query(Perfil).order_by(Perfil.creado_en).all()


@app.post("/perfiles", response_model=PerfilOut, status_code=201)
def crear_perfil(data: PerfilCreate, db: Session = Depends(get_db)):
    perfil = Perfil(nombre=data.nombre, avatar=data.avatar)
    db.add(perfil)
    db.commit()
    db.refresh(perfil)
    return perfil


@app.put("/perfiles/{perfil_id}", response_model=PerfilOut)
def editar_perfil(perfil_id: str, data: PerfilUpdate, db: Session = Depends(get_db)):
    perfil = db.query(Perfil).filter(Perfil.id == perfil_id).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    perfil.nombre = data.nombre
    perfil.avatar = data.avatar
    db.commit()
    db.refresh(perfil)
    return perfil


@app.delete("/perfiles/{perfil_id}", status_code=204)
def eliminar_perfil(perfil_id: str, db: Session = Depends(get_db)):
    perfil = db.query(Perfil).filter(Perfil.id == perfil_id).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    db.delete(perfil)
    db.commit()


class DescargaRequest(BaseModel):
    video_id: str
    perfil_id: str


@app.get("/youtube/auth")
def youtube_auth(perfil_id: str):
    if not settings.google_client_id:
        raise HTTPException(503, "Falta configurar GOOGLE_CLIENT_ID")
    url = youtube.iniciar_oauth(perfil_id)
    return RedirectResponse(url)


@app.get("/youtube/callback")
def youtube_callback(code: str, state: str):
    youtube.canjear_codigo(code, state)
    return RedirectResponse(f"{settings.frontend_url}/nido?youtube=conectado")


@app.get("/youtube/conectado")
def youtube_conectado(perfil_id: str):
    return {"conectado": youtube.hay_credenciales(perfil_id)}


@app.get("/youtube/videos")
def youtube_videos(perfil_id: str):
    try:
        return youtube.listar_videos(perfil_id)
    except ValueError:
        raise HTTPException(401, "No hay cuenta de Google conectada")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/youtube/descargar")
def youtube_descargar(data: DescargaRequest):
    try:
        ruta = youtube.descargar_audio(data.video_id, data.perfil_id)
        if not ruta:
            raise HTTPException(500, "No se pudo descargar el audio")
        return {"ruta": ruta, "video_id": data.video_id}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.delete("/youtube/desconectar")
def youtube_desconectar(perfil_id: str):
    youtube.desconectar(perfil_id)
    return {"ok": True}
