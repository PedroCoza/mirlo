import os
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("YOUTUBE_REDIRECT_URI", "http://localhost:8000/youtube/callback")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base
from app import models  # noqa: F401
from app.main import app, get_db


@pytest.fixture()
def engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(eng, "connect")
    def _activar_fk(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(engine, monkeypatch):
    import app.main as app_main

    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def _override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    # Las tareas en segundo plano abren su propia sesion contra el mismo engine
    monkeypatch.setattr(app_main, "SessionLocal", SessionLocal)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def tmp_descargas(tmp_path, monkeypatch):
    import app.main
    monkeypatch.setattr(app.main, "DESCARGAS_DIR", str(tmp_path))
    yield tmp_path


@pytest.fixture()
def perfil_datos():
    return {"nombre": "Test", "avatar": "🦊"}


@pytest.fixture()
def perfil(client, perfil_datos):
    resp = client.post("/perfiles", json=perfil_datos)
    assert resp.status_code == 201, resp.text
    return resp.json()


SEGMENTOS_FAKE = [
    {"start": 0.0, "end": 3.5, "text": "Hola mundo"},
    {"start": 3.5, "end": 7.2, "text": "Segundo segmento de prueba"},
]


@pytest.fixture()
def mock_whisperx(monkeypatch):
    import app.main

    def _preprocesar_fake(ruta):
        return str(ruta) + ".wav"

    def _transcribir_fake(ruta, **kwargs):
        return [dict(s) for s in SEGMENTOS_FAKE], "es"

    monkeypatch.setattr(app.main, "preprocesar_audio", _preprocesar_fake)
    monkeypatch.setattr(app.main, "transcribir", _transcribir_fake)
    monkeypatch.setattr(app.main, "detectar_idioma", lambda ruta, **kwargs: "es")
    return SEGMENTOS_FAKE


class _FakeYoutubeDL:
    descargar_con_error: bool = False

    def __init__(self, opciones):
        self.opciones = opciones
        self.descargados: list[str] = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def download(self, urls):
        if _FakeYoutubeDL.descargar_con_error:
            raise _FakeDownloadError("Error simulado de yt-dlp")
        self.descargados.extend(urls)
        outtmpl = self.opciones.get("outtmpl", "%(title)s.%(ext)s")
        destino = Path(outtmpl).parent
        destino.mkdir(parents=True, exist_ok=True)
        (destino / "titulo-fake.mp4").write_bytes(b"video-fake")

    def extract_info(self, url, download=False):
        return {
            "id": "abc123",
            "title": "Título de prueba",
            "ext": "mp4",
            "duration": 180,
            "uploader": "Canal Fake",
            "thumbnail": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
        }


class _FakeDownloadError(Exception):
    pass


@pytest.fixture()
def mock_ytdlp(monkeypatch):
    import app.youtube
    _FakeYoutubeDL.descargar_con_error = False

    class _FakeModule:
        YoutubeDL = _FakeYoutubeDL
        DownloadError = _FakeDownloadError

    monkeypatch.setattr(app.youtube, "yt_dlp", _FakeModule)
    return _FakeModule


@pytest.fixture()
def mock_ytdlp_error(monkeypatch):
    import app.youtube
    _FakeYoutubeDL.descargar_con_error = True

    class _FakeModule:
        YoutubeDL = _FakeYoutubeDL
        DownloadError = _FakeDownloadError

    monkeypatch.setattr(app.youtube, "yt_dlp", _FakeModule)
    return _FakeModule


class _FakeOAuth2Session:
    def __init__(self, client_id=None, redirect_uri=None, scope=None, state=None):
        self.client_id = client_id
        self.redirect_uri = redirect_uri
        self.scope = scope
        self.state = state

    def authorization_url(self, auth_url, **kwargs):
        url = (
            f"{auth_url}?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&state={self.state}"
            f"&scope={'+'.join(self.scope or [])}"
        )
        return url, None

    def fetch_token(self, token_url, code=None, client_secret=None):
        return {
            "access_token": "fake-access-token",
            "refresh_token": "fake-refresh-token",
            "token_type": "Bearer",
            "expires_in": 3600,
        }


@pytest.fixture()
def mock_oauth(monkeypatch):
    import app.youtube
    monkeypatch.setattr(app.youtube, "OAuth2Session", _FakeOAuth2Session)
    app.youtube._credenciales.clear()
    return _FakeOAuth2Session


class _FakeRespuestaLibre:
    def __init__(self, texto):
        self._texto = texto

    def raise_for_status(self):
        pass

    def json(self):
        return {"translatedText": self._texto}


@pytest.fixture()
def mock_libretranslate(monkeypatch):
    import app.traduccion

    llamadas = []

    def _post_fake(url, json=None, timeout=None):
        llamadas.append(json)
        return _FakeRespuestaLibre(f"[{json['target']}] {json['q']}")

    monkeypatch.setattr(app.traduccion.requests, "post", _post_fake)
    return llamadas


@pytest.fixture()
def mock_libretranslate_error(monkeypatch):
    import app.traduccion
    import requests as _requests

    def _post_falla(url, json=None, timeout=None):
        raise _requests.ConnectionError("servicio caido")

    monkeypatch.setattr(app.traduccion.requests, "post", _post_falla)


TURNOS_FAKE = [
    {"start": 0.0, "end": 3.0, "speaker": "SPEAKER_00"},
    {"start": 2.8, "end": 5.5, "speaker": "SPEAKER_01"},
    {"start": 5.5, "end": 9.0, "speaker": "SPEAKER_00"},
]


@pytest.fixture()
def mock_diarizar(monkeypatch):
    import app.diarizacion

    llamadas = {}

    def _diarizar_fake(ruta, hf_token, num_hablantes=None):
        llamadas["ruta"] = ruta
        llamadas["token"] = hf_token
        llamadas["num"] = num_hablantes
        return [dict(t) for t in TURNOS_FAKE]

    monkeypatch.setattr(app.diarizacion, "diarizar", _diarizar_fake)
    return llamadas
