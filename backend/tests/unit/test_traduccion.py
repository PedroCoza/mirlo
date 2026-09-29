"""Pruebas funcionales de la traduccion de segmentos."""
import io
import uuid

import pytest

from app import traduccion

pytestmark = [pytest.mark.unit, pytest.mark.traduccion]


def _segmentos():
    return [
        {"start": 0.0, "end": 3.5, "text": "Hola mundo"},
        {"start": 3.5, "end": 7.2, "text": "Segundo segmento de prueba"},
    ]


def _contenido_traducible(client, perfil, tmp_descargas, mock_whisperx):
    files = {"archivo": ("audio.m4a", io.BytesIO(b"audio-fake"), "audio/mp4")}
    subida = client.post(f"/biblioteca/subir?perfil_id={perfil['id']}", files=files)
    contenido = subida.json()
    client.post(f"/transcribir/{contenido['id']}")
    guardado = client.post(
        "/transcripciones",
        json={"contenido_id": contenido["id"], "segmentos": mock_whisperx},
    )
    return contenido, guardado.json()


def test_traduce_todos_los_segmentos(mock_libretranslate):
    resultado = traduccion.traducir_segmentos(_segmentos(), "en")

    assert len(resultado) == 2
    assert resultado[0]["text"] == "[en] Hola mundo"
    assert resultado[1]["text"] == "[en] Segundo segmento de prueba"


def test_conserva_marcas_de_tiempo(mock_libretranslate):
    resultado = traduccion.traducir_segmentos(_segmentos(), "en")

    assert resultado[0]["start"] == 0.0
    assert resultado[0]["end"] == 3.5
    assert resultado[1]["start"] == 3.5
    assert resultado[1]["end"] == 7.2


def test_una_peticion_por_segmento(mock_libretranslate):
    traduccion.traducir_segmentos(_segmentos(), "en")

    assert len(mock_libretranslate) == 2


def test_idioma_destino_en_la_peticion(mock_libretranslate):
    traduccion.traducir_segmentos(_segmentos(), "fr")

    assert all(p["target"] == "fr" for p in mock_libretranslate)


def test_lista_vacia(mock_libretranslate):
    assert traduccion.traducir_segmentos([], "en") == []
    assert mock_libretranslate == []


def test_error_de_servicio(mock_libretranslate_error):
    with pytest.raises(traduccion.ErrorTraduccion):
        traduccion.traducir_segmentos(_segmentos(), "en")


def test_endpoint_traduce_y_guarda(
    client, perfil, tmp_descargas, mock_whisperx, mock_libretranslate
):
    contenido, transcripcion = _contenido_traducible(
        client, perfil, tmp_descargas, mock_whisperx
    )

    resp = client.post(f"/traducir/{transcripcion['id']}", json={"idioma": "en"})

    assert resp.status_code == 201, resp.text
    cuerpo = resp.json()
    assert cuerpo["idioma"] == "en"
    assert cuerpo["segmentos"][0]["text"] == "[en] Hola mundo"
    detalle = client.get(f"/biblioteca/contenido/{contenido['id']}")
    assert detalle.json()["estado"] == "traducido"


def test_endpoint_sin_transcripcion(client, perfil):
    resp = client.post(f"/traducir/{uuid.uuid4()}", json={"idioma": "en"})
    assert resp.status_code == 404


def test_endpoint_servicio_caido(
    client, perfil, tmp_descargas, mock_whisperx, mock_libretranslate_error
):
    _, transcripcion = _contenido_traducible(
        client, perfil, tmp_descargas, mock_whisperx
    )

    resp = client.post(f"/traducir/{transcripcion['id']}", json={"idioma": "en"})

    assert resp.status_code == 503


def test_recuperar_traduccion_guardada(
    client, perfil, tmp_descargas, mock_whisperx, mock_libretranslate
):
    _, transcripcion = _contenido_traducible(
        client, perfil, tmp_descargas, mock_whisperx
    )
    client.post(f"/traducir/{transcripcion['id']}", json={"idioma": "en"})

    resp = client.get(f"/traducciones/{transcripcion['id']}")

    assert resp.status_code == 200
    assert resp.json()["segmentos"][0]["text"] == "[en] Hola mundo"
