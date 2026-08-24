"""Validación de la integridad de los timestamps que alimentan la sincronización.

La bidireccionalidad en navegador (click en subtítulo → salto del audio,
reproducción → resaltado del segmento) se valida manualmente. Estos tests
garantizan que los timestamps exportados son fieles a los segmentos
originales, que es el dato del que depende esa sincronización.
"""
import io

import pytest

pytestmark = [pytest.mark.integration, pytest.mark.transcripcion]


def _a_vtt(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int((t - int(t)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


@pytest.fixture()
def contenido_guardado(client, perfil, tmp_descargas, mock_whisperx):
    files = {"archivo": ("audio.m4a", io.BytesIO(b"audio-fake"), "audio/mp4")}
    contenido = client.post(
        f"/biblioteca/subir?perfil_id={perfil['id']}", files=files
    ).json()
    resp = client.post(
        "/transcripciones",
        json={"contenido_id": contenido["id"], "segmentos": mock_whisperx},
    )
    assert resp.status_code == 201
    return contenido


def test_vtt_roundtrip(client, contenido_guardado, mock_whisperx):
    """Exporta a VTT, re-parsea y verifica que los tiempos no se corrompen."""
    resp = client.get(f"/exportar/{contenido_guardado['id']}?formato=vtt")
    assert resp.status_code == 200

    lineas = resp.text.strip().split("\n")
    assert lineas[0] == "WEBVTT"

    cues = []
    for i, linea in enumerate(lineas):
        if "-->" in linea:
            inicio, fin = linea.split(" --> ")
            cues.append((inicio, fin, lineas[i + 1]))

    assert len(cues) == len(mock_whisperx)
    for cue, seg in zip(cues, mock_whisperx):
        assert cue[0] == _a_vtt(seg["start"])
        assert cue[1] == _a_vtt(seg["end"])
        assert cue[2] == seg["text"]


def test_srt_estructura(client, contenido_guardado, mock_whisperx):
    """El SRT lleva numeración secuencial y coma decimal en los tiempos."""
    resp = client.get(f"/exportar/{contenido_guardado['id']}?formato=srt")
    assert resp.status_code == 200

    bloques = resp.text.strip().split("\n\n")
    assert len(bloques) == len(mock_whisperx)
    for i, bloque in enumerate(bloques, start=1):
        lineas = bloque.split("\n")
        assert lineas[0] == str(i)
        assert "," in lineas[1]
        assert "-->" in lineas[1]
        assert lineas[2] == mock_whisperx[i - 1]["text"]
