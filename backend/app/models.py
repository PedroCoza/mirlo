import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Integer, JSON, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Perfil(Base):
    __tablename__ = "perfiles"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar: Mapped[str] = mapped_column(String(10), default="🐣")
    modelo_whisper: Mapped[str] = mapped_column(String(20), default="base")
    compute_type: Mapped[str] = mapped_column(String(10), default="int8")
    batch_size: Mapped[int] = mapped_column(Integer, default=8)
    hf_token: Mapped[str | None] = mapped_column(String(200), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    contenidos: Mapped[list["Contenido"]] = relationship(
        back_populates="perfil", cascade="all, delete-orphan"
    )


class Contenido(Base):
    __tablename__ = "contenidos"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    perfil_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("perfiles.id"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo: Mapped[str] = mapped_column(String(10), nullable=False)  # audio | video
    ruta: Mapped[str] = mapped_column(String(500), nullable=False)
    origen: Mapped[str] = mapped_column(String(10), default="local")  # local | youtube
    video_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    estado: Mapped[str] = mapped_column(String(15), default="pendiente")  # pendiente | procesado | traducido | descargando
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    perfil: Mapped["Perfil"] = relationship(back_populates="contenidos")
    transcripciones: Mapped[list["Transcripcion"]] = relationship(
        back_populates="contenido", cascade="all, delete-orphan"
    )


class Transcripcion(Base):
    __tablename__ = "transcripciones"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    contenido_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("contenidos.id"), nullable=False
    )
    segmentos: Mapped[list] = mapped_column(JSON, nullable=False)
    idioma: Mapped[str | None] = mapped_column(String(10), nullable=True)
    hablantes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    contenido: Mapped["Contenido"] = relationship(
        back_populates="transcripciones"
    )
    traducciones: Mapped[list["Traduccion"]] = relationship(
        back_populates="transcripcion", cascade="all, delete-orphan"
    )


class Traduccion(Base):
    __tablename__ = "traducciones"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    transcripcion_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("transcripciones.id"), nullable=False
    )
    idioma: Mapped[str] = mapped_column(String(10), nullable=False)
    segmentos: Mapped[list] = mapped_column(JSON, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    transcripcion: Mapped["Transcripcion"] = relationship(
        back_populates="traducciones"
    )
