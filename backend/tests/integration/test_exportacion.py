"""Pruebas de los generadores de exportacion."""
import io
import json

import pytest

from app import exportacion

pytestmark = [pytest.mark.integration, pytest.mark.exportacion]


def _segmentos():
    return [
        {"start": 0.0, "end": 3.5, "text": "Hola mundo", "hablante": "Entrevistador"},
        {"start": 3.5, "end": 7.2, "text": "Segundo segmento"},
    ]


def _contenido_exportable(client, perfil, tmp_descargas, mock_whisperx):
    files = {"archivo": ("audio.m4a", io.BytesIO(b"audio-fake"), "audio/mp4")}
    subida = client.post(f"/biblioteca/subir?perfil_id={perfil['id']}", files=files)
    contenido = subida.json()
    client.post(f"/transcribir/{contenido['id']}")
    client.post(
        "/transcripciones",
        json={"contenido_id": contenido["id"], "segmentos": mock_whisperx},
    )
    return contenido


def test_formatear_tiempo():
    assert exportacion.formatear_tiempo(3661.5) == "01:01:01,500"
    assert exportacion.formatear_tiempo(59.999, separador=".") == "00:00:59.999"


def test_srt_numeracion_y_separador():
    srt = exportacion.generar_srt(_segmentos())

    bloques = srt.strip().split("\n\n")
    assert bloques[0].splitlines()[0] == "1"
    assert bloques[1].splitlines()[0] == "2"
    assert " --> " in bloques[0]
    assert "," in bloques[0].splitlines()[1]


def test_vtt_cabecera_y_punto_decimal():
    vtt = exportacion.generar_vtt(_segmentos())

    assert vtt.startswith("WEBVTT")
    assert "00:00:00.000 --> 00:00:03.500" in vtt


def test_txt_marca_de_tiempo():
    txt = exportacion.generar_txt(_segmentos())

    assert txt.strip().splitlines()[0] == "[00:00:00,000] Hola mundo"


def test_json_estructura_completa():
    datos = json.loads(exportacion.generar_json(_segmentos()))

    assert datos[0] == {
        "start": 0.0,
        "end": 3.5,
        "text": "Hola mundo",
        "hablante": "Entrevistador",
    }


def test_endpoint_exporta_txt(client, perfil, tmp_descargas, mock_whisperx):
    contenido = _contenido_exportable(client, perfil, tmp_descargas, mock_whisperx)

    resp = client.get(f"/exportar/{contenido['id']}?formato=txt")

    assert resp.status_code == 200
    assert "[00:00:00,000] Hola mundo" in resp.text
    assert resp.headers["content-disposition"].endswith('.txt"')


def test_endpoint_exporta_json(client, perfil, tmp_descargas, mock_whisperx):
    contenido = _contenido_exportable(client, perfil, tmp_descargas, mock_whisperx)

    resp = client.get(f"/exportar/{contenido['id']}?formato=json")

    assert resp.status_code == 200
    assert json.loads(resp.text)[0]["text"] == "Hola mundo"


def test_endpoint_formato_invalido(client, perfil, tmp_descargas, mock_whisperx):
    contenido = _contenido_exportable(client, perfil, tmp_descargas, mock_whisperx)

    resp = client.get(f"/exportar/{contenido['id']}?formato=pdf")

    assert resp.status_code == 400


def test_endpoint_sin_transcripcion(client, perfil, tmp_descargas):
    files = {"archivo": ("audio.m4a", io.BytesIO(b"audio-fake"), "audio/mp4")}
    contenido = client.post(
        f"/biblioteca/subir?perfil_id={perfil['id']}", files=files
    ).json()

    resp = client.get(f"/exportar/{contenido['id']}")

    assert resp.status_code == 404
