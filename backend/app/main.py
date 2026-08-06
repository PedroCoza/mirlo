from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, engine, get_db
from app.models import Perfil
from app.schemas import PerfilCreate, PerfilUpdate, PerfilOut

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
