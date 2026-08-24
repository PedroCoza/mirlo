import io

import pytest

pytestmark = [pytest.mark.integration, pytest.mark.biblioteca]


def _subir_audio(client, perfil_id, nombre="cancion.mp3", contenido=b"audio"):
    files = {"archivo": (nombre, io.BytesIO(contenido), "audio/mpeg")}
    return client.post(f"/biblioteca/subir?perfil_id={perfil_id}", files=files)


def test_subir_audio(client, perfil, tmp_descargas):
    resp = _subir_audio(client, perfil["id"], "cancion.mp3", b"audio")
    assert resp.status_code == 201
    cuerpo = resp.json()
    assert cuerpo["nombre"] == "cancion.mp3"
    assert cuerpo["tipo"] == "audio"
    assert cuerpo["origen"] == "local"
    assert cuerpo["estado"] == "pendiente"
    assert cuerpo["perfil_id"] == perfil["id"]


def test_subir_video(client, perfil, tmp_descargas):
    files = {"archivo": ("clip.mp4", io.BytesIO(b"video"), "video/mp4")}
    resp = client.post(f"/biblioteca/subir?perfil_id={perfil['id']}", files=files)
    assert resp.status_code == 201
    assert resp.json()["tipo"] == "video"


def test_subir_formato_invalido(client, perfil, tmp_descargas):
    files = {"archivo": ("notas.txt", io.BytesIO(b"hola"), "text/plain")}
    resp = client.post(f"/biblioteca/subir?perfil_id={perfil['id']}", files=files)
    assert resp.status_code == 400


def test_subir_404(client, tmp_descargas):
    files = {"archivo": ("cancion.mp3", io.BytesIO(b"audio"), "audio/mpeg")}
    resp = client.post(
        "/biblioteca/subir?perfil_id=00000000-0000-0000-0000-000000000000",
        files=files,
    )
    assert resp.status_code == 404


def test_listar(client, perfil, tmp_descargas):
    perfil_id = perfil["id"]
    _subir_audio(client, perfil_id, "uno.mp3")
    _subir_audio(client, perfil_id, "dos.mp3")

    resp = client.get(f"/biblioteca/{perfil_id}")
    assert resp.status_code == 200
    nombres = {c["nombre"] for c in resp.json()}
    assert {"uno.mp3", "dos.mp3"}.issubset(nombres)


def test_aislamiento_perfiles(client, tmp_descargas):
    p1 = client.post("/perfiles", json={"nombre": "P1"}).json()
    p2 = client.post("/perfiles", json={"nombre": "P2"}).json()
    _subir_audio(client, p1["id"], "solo-de-p1.mp3")

    resp_p2 = client.get(f"/biblioteca/{p2['id']}")
    assert resp_p2.json() == []


def test_obtener_por_id(client, perfil, tmp_descargas):
    subida = _subir_audio(client, perfil["id"], "identificable.mp3").json()

    resp = client.get(f"/biblioteca/contenido/{subida['id']}")

    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["id"] == subida["id"]
    assert cuerpo["nombre"] == "identificable.mp3"


def test_eliminar(client, perfil, tmp_descargas):
    perfil_id = perfil["id"]
    contenido = _subir_audio(client, perfil_id, "borrar.mp3").json()

    resp = client.delete(f"/biblioteca/contenido/{contenido['id']}")
    assert resp.status_code == 204

    listado = client.get(f"/biblioteca/{perfil_id}").json()
    assert all(c["id"] != contenido["id"] for c in listado)


def test_eliminar_404(client):
    resp = client.delete("/biblioteca/contenido/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_eliminar_borra_archivo(client, perfil, tmp_descargas):
    perfil_id = perfil["id"]
    contenido = _subir_audio(client, perfil_id, "fisico.mp3").json()
    ruta = tmp_descargas / perfil_id / contenido["ruta"]
    assert ruta.exists()

    client.delete(f"/biblioteca/contenido/{contenido['id']}")
    assert not ruta.exists()
