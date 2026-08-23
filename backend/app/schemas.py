from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PerfilBase(BaseModel):
    nombre: str
    avatar: str = "🐣"


class PerfilCreate(PerfilBase):
    pass


class PerfilUpdate(PerfilBase):
    pass


class PerfilOut(PerfilBase):
    id: UUID
    creado_en: datetime

    class Config:
        from_attributes = True


class ContenidoOut(BaseModel):
    id: UUID
    perfil_id: UUID
    nombre: str
    tipo: str
    ruta: str
    origen: str
    estado: str
    creado_en: datetime

    class Config:
        from_attributes = True


class TranscripcionOut(BaseModel):
    id: UUID
    contenido_id: UUID
    segmentos: list
    idioma: str | None
    creado_en: datetime

    class Config:
        from_attributes = True
