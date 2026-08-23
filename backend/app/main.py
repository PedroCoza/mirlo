import os
import uuid
import shutil

import torch
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.config import settings
from app.database import Base, engine, get_db
from app.models import Perfil, Contenido, Transcripcion
from app.schemas import (
    PerfilCreate,
    PerfilUpdate,
    PerfilOut,
    ContenidoOut,
    TranscripcionOut,
)
from app import youtube
from app.transcripcion import transcribir, preprocesar_audio

EXTENSIONES_AUDIO = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac"}
EXTENSIONES_VIDEO = {".mp4", ".mkv", ".avi", ".webm", ".mov"}
MEDIA_TYPES = {
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
    ".flac": "audio/flac", ".ogg": "audio/ogg", ".aac": "audio/aac",
    ".mp4": "video/mp4", ".mkv": "video/x-matroska", ".avi": "video/x-msvideo",
    ".webm": "video/webm", ".mov": "video/quicktime",
}
DESCARGAS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "descargas")

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


@app.post("/biblioteca/subir", response_model=ContenidoOut, status_code=201)
def subir_archivo(perfil_id: str, archivo: UploadFile = File(...), db: Session = Depends(get_db)):
    nombre = archivo.filename or "sin_nombre"
    ext = os.path.splitext(nombre)[1].lower()

    if ext in EXTENSIONES_AUDIO:
        tipo = "audio"
    elif ext in EXTENSIONES_VIDEO:
        tipo = "video"
    else:
        raise HTTPException(400, f"Formato no soportado: {ext}")

    perfil = db.query(Perfil).filter(Perfil.id == perfil_id).first()
    if not perfil:
        raise HTTPException(404, "Perfil no encontrado")

    carpeta = os.path.join(DESCARGAS_DIR, perfil_id)
    os.makedirs(carpeta, exist_ok=True)

    nombre_archivo = f"{uuid.uuid4().hex}{ext}"
    ruta_absoluta = os.path.join(carpeta, nombre_archivo)

    with open(ruta_absoluta, "wb") as f:
        shutil.copyfileobj(archivo.file, f)

    contenido = Contenido(
        perfil_id=perfil.id,
        nombre=nombre,
        tipo=tipo,
        ruta=nombre_archivo,
        origen="local",
        estado="pendiente",
    )
    db.add(contenido)
    db.commit()
    db.refresh(contenido)
    return contenido


@app.get("/biblioteca/{perfil_id}", response_model=list[ContenidoOut])
def listar_biblioteca(perfil_id: str, db: Session = Depends(get_db)):
    return (
        db.query(Contenido)
        .filter(Contenido.perfil_id == perfil_id)
        .order_by(Contenido.creado_en.desc())
        .all()
    )


@app.get("/biblioteca/contenido/{contenido_id}", response_model=ContenidoOut)
def obtener_contenido(contenido_id: str, db: Session = Depends(get_db)):
    contenido = db.query(Contenido).filter(Contenido.id == contenido_id).first()
    if not contenido:
        raise HTTPException(404, "Contenido no encontrado")
    return contenido


@app.get("/biblioteca/archivo/{contenido_id}")
def servir_archivo(contenido_id: str, db: Session = Depends(get_db)):
    contenido = db.query(Contenido).filter(Contenido.id == contenido_id).first()
    if not contenido:
        raise HTTPException(404, "Contenido no encontrado")
    ruta = os.path.join(DESCARGAS_DIR, str(contenido.perfil_id), contenido.ruta)
    if not os.path.exists(ruta):
        raise HTTPException(404, "Archivo no encontrado en disco")
    ext = os.path.splitext(contenido.ruta)[1].lower()
    return FileResponse(ruta, media_type=MEDIA_TYPES.get(ext, "application/octet-stream"))


@app.delete("/biblioteca/contenido/{contenido_id}", status_code=204)
def eliminar_contenido(contenido_id: str, db: Session = Depends(get_db)):
    contenido = db.query(Contenido).filter(Contenido.id == contenido_id).first()
    if not contenido:
        raise HTTPException(404, "Contenido no encontrado")

    ruta_absoluta = os.path.join(DESCARGAS_DIR, str(contenido.perfil_id), contenido.ruta)
    if os.path.exists(ruta_absoluta):
        os.remove(ruta_absoluta)

    db.delete(contenido)
    db.commit()


@app.post("/transcribir/{contenido_id}")
def transcribir_contenido(contenido_id: str, db: Session = Depends(get_db)):
    contenido = db.query(Contenido).filter(Contenido.id == contenido_id).first()
    if not contenido:
        raise HTTPException(404, "Contenido no encontrado")

    ruta_original = os.path.join(DESCARGAS_DIR, str(contenido.perfil_id), contenido.ruta)
    if not os.path.exists(ruta_original):
        raise HTTPException(500, "Archivo no encontrado en disco")

    try:
        ruta_audio = preprocesar_audio(ruta_original)
    except ValueError as e:
        raise HTTPException(400, str(e))

    try:
        segmentos = transcribir(ruta_audio)
    finally:
        if os.path.exists(ruta_audio):
            os.remove(ruta_audio)

    contenido.estado = "procesado"
    db.commit()

    return {"segmentos": segmentos}


class TranscripcionCreate(BaseModel):
    contenido_id: str
    segmentos: list
    idioma: str | None = None


@app.post("/transcripciones", status_code=201)
def guardar_transcripcion(data: TranscripcionCreate, db: Session = Depends(get_db)):
    contenido = db.query(Contenido).filter(Contenido.id == data.contenido_id).first()
    if not contenido:
        raise HTTPException(404, "Contenido no encontrado")
    transcripcion = Transcripcion(
        contenido_id=data.contenido_id,
        segmentos=data.segmentos,
        idioma=data.idioma,
    )
    db.add(transcripcion)
    db.commit()
    return {"ok": True}


@app.get("/transcripciones/{contenido_id}", response_model=TranscripcionOut)
def cargar_transcripcion(contenido_id: str, db: Session = Depends(get_db)):
    transcripcion = (
        db.query(Transcripcion)
        .filter(Transcripcion.contenido_id == contenido_id)
        .order_by(Transcripcion.creado_en.desc())
        .first()
    )
    return transcripcion


class ConfigUpdate(BaseModel):
    modelo: str
    compute_type: str
    batch_size: int
    hf_token: str | None = None


@app.get("/config")
def obtener_config(perfil_id: str, db: Session = Depends(get_db)):
    perfil = db.query(Perfil).filter(Perfil.id == perfil_id).first()
    if not perfil:
        raise HTTPException(404, "Perfil no encontrado")

    gpu = torch.cuda.is_available()
    return {
        "gpu_disponible": gpu,
        "gpu_nombre": torch.cuda.get_device_name(0) if gpu else None,
        "vram_mb": round(torch.cuda.get_device_properties(0).total_memory / 1024**2)
        if gpu
        else None,
        "recomendado": {
            "modelo": "base",
            "compute_type": "float16" if gpu else "int8",
            "batch_size": 8,
        },
        "actual": {
            "modelo": perfil.modelo_whisper,
            "compute_type": perfil.compute_type,
            "batch_size": perfil.batch_size,
            "hf_token_configurado": bool(perfil.hf_token),
        },
    }


@app.put("/config/{perfil_id}")
def guardar_config(perfil_id: str, config: ConfigUpdate, db: Session = Depends(get_db)):
    perfil = db.query(Perfil).filter(Perfil.id == perfil_id).first()
    if not perfil:
        raise HTTPException(404, "Perfil no encontrado")

    perfil.modelo_whisper = config.modelo
    perfil.compute_type = config.compute_type
    perfil.batch_size = config.batch_size
    if config.hf_token:
        perfil.hf_token = config.hf_token
    db.commit()
    return {"ok": True}
