import os

import pytest

import app.youtube as youtube
from app.models import Contenido

pytestmark = [pytest.mark.integration, pytest.mark.youtube]


def test_descarga(mock_ytdlp, monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    ruta = youtube.descargar_audio("dQw4w9WgXcQ", "perfil-1")

    assert ruta
    assert ruta.endswith(".mp3")
    assert os.path.exists(ruta)


def test_registro_descarga(client, perfil, db_session, mock_ytdlp, monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    perfil_id = perfil["id"]

    ruta_audio = youtube.descargar_audio("dQw4w9WgXcQ", perfil_id)
    nombre_archivo = os.path.basename(ruta_audio)

    contenido = Contenido(
        perfil_id=perfil["id"],
        nombre="Vídeo de YouTube",
        tipo="audio",
        ruta=nombre_archivo,
        origen="youtube",
        estado="procesado",
    )
    db_session.add(contenido)
    db_session.commit()
    db_session.refresh(contenido)

    listado = client.get(f"/biblioteca/{perfil_id}").json()
    encontrados = [c for c in listado if c["id"] == str(contenido.id)]
    assert len(encontrados) == 1
    assert encontrados[0]["origen"] == "youtube"
    assert encontrados[0]["estado"] == "procesado"


def test_descarga_error(mock_ytdlp_error, monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    with pytest.raises(youtube.yt_dlp.DownloadError):
        youtube.descargar_audio("invalido", "perfil-err")


def test_endpoint_500(client, mock_ytdlp_error, perfil):
    resp = client.post(
        "/youtube/descargar",
        json={"video_id": "invalido", "perfil_id": perfil["id"]},
    )
    assert resp.status_code == 500


def test_endpoint_videos_401(client, mock_oauth):
    youtube._credenciales.clear()
    resp = client.get("/youtube/videos?perfil_id=perfil-no-conectado")
    assert resp.status_code == 401


def test_endpoint_auth_503(client, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "google_client_id", "")

    resp = client.get("/youtube/auth?perfil_id=perfil-x")
    assert resp.status_code == 503
