"""Prueba de flujo completo: biblioteca → transcripción → edición → exportación."""
import io

import pytest

pytestmark = [pytest.mark.integration, pytest.mark.flujo]


def _subir_audio(client, perfil_id, nombre="podcast.m4a"):
    files = {"archivo": (nombre, io.BytesIO(b"audio-fake"), "audio/mp4")}
    return client.post(f"/biblioteca/subir?perfil_id={perfil_id}", files=files)


def test_flujo_completo(client, perfil, tmp_descargas, mock_whisperx):
    # Subir un archivo a la biblioteca
    resp = _subir_audio(client, perfil["id"])
    assert resp.status_code == 201, resp.text
    contenido = resp.json()
    assert contenido["estado"] == "pendiente"

    # Transcribir
    resp = client.post(f"/transcribir/{contenido['id']}")
    assert resp.status_code == 200, resp.text
    segmentos = resp.json()["segmentos"]
    assert len(segmentos) == len(mock_whisperx)

    # El contenido pasa a procesado
    resp = client.get(f"/biblioteca/contenido/{contenido['id']}")
    assert resp.json()["estado"] == "procesado"

    # Editar un segmento y guardar la transcripción
    segmentos[0]["text"] = "Hola mundo (editado)"
    resp = client.post(
        "/transcripciones",
        json={"contenido_id": contenido["id"], "segmentos": segmentos},
    )
    assert resp.status_code == 201, resp.text

    # Recargar la transcripción guardada
    resp = client.get(f"/transcripciones/{contenido['id']}")
    assert resp.status_code == 200
    assert resp.json()["segmentos"][0]["text"] == "Hola mundo (editado)"

    # Exportar a SRT con el texto editado
    resp = client.get(f"/exportar/{contenido['id']}?formato=srt")
    assert resp.status_code == 200
    assert resp.headers["content-disposition"].endswith('.srt"')
    assert "-->" in resp.text
    assert "Hola mundo (editado)" in resp.text


def test_transcribir_sin_audio_da_error_claro(
    client, perfil, tmp_descargas, mock_whisperx, monkeypatch
):
    import app.main

    def _preprocesar_falla(ruta):
        raise ValueError("El archivo no contiene pista de audio")

    monkeypatch.setattr(app.main, "preprocesar_audio", _preprocesar_falla)

    contenido = _subir_audio(client, perfil["id"], "video-sin-audio.mp4").json()
    resp = client.post(f"/transcribir/{contenido['id']}")

    assert resp.status_code == 400
    assert "pista de audio" in resp.json()["detail"]
