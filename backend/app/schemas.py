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
