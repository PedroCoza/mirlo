import os

import pytest

import app.youtube as youtube

pytestmark = [pytest.mark.integration, pytest.mark.youtube]


def test_descarga(mock_ytdlp, monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    ruta = youtube.descargar_video("dQw4w9WgXcQ", "perfil-1")

    assert ruta
    assert ruta.endswith(".mp4")
    assert os.path.exists(ruta)


def test_registro_descarga(client, perfil, mock_ytdlp, monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    peticion = {
        "video_id": "abc123",
        "perfil_id": perfil["id"],
        "titulo": "Vídeo de YouTube",
    }

    resp = client.post("/youtube/registrar", json=peticion)
    assert resp.status_code == 201, resp.text
    contenido = resp.json()
    assert contenido["estado"] == "descargando"
    assert contenido["origen"] == "youtube"
    assert contenido["video_id"] == "abc123"

    # La descarga en segundo plano ya se ha ejecutado al cerrar la peticion
    detalle = client.get(f"/biblioteca/contenido/{contenido['id']}").json()
    assert detalle["estado"] == "pendiente"
    assert detalle["tipo"] == "video"
    assert detalle["ruta"].endswith(".mp4")

    listado = client.get(f"/biblioteca/{perfil['id']}").json()
    encontrados = [c for c in listado if c["id"] == contenido["id"]]
    assert len(encontrados) == 1
    assert encontrados[0]["video_id"] == "abc123"

    # Registrar el mismo video devuelve el contenido existente
    resp2 = client.post("/youtube/registrar", json=peticion)
    assert resp2.status_code == 201
    assert resp2.json()["id"] == contenido["id"]


def test_descarga_error(mock_ytdlp_error, monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    with pytest.raises(youtube.yt_dlp.DownloadError):
        youtube.descargar_video("invalido", "perfil-err")


def test_registro_fallo_limpia(client, perfil, mock_ytdlp_error, monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    resp = client.post(
        "/youtube/registrar",
        json={
            "video_id": "invalido",
            "perfil_id": perfil["id"],
            "titulo": "Vídeo de YouTube",
        },
    )
    assert resp.status_code == 201
    contenido = resp.json()

    # La descarga falla en segundo plano y el contenido queda eliminado
    detalle = client.get(f"/biblioteca/contenido/{contenido['id']}")
    assert detalle.status_code == 404


def test_endpoint_videos_401(client, mock_oauth):
    youtube._credenciales.clear()
    resp = client.get("/youtube/videos?perfil_id=perfil-no-conectado")
    assert resp.status_code == 401


def test_endpoint_auth_503(client, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "google_client_id", "")

    resp = client.get("/youtube/auth?perfil_id=perfil-x")
    assert resp.status_code == 503
