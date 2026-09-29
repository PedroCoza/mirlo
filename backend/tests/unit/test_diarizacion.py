"""Pruebas funcionales de la diarizacion y la asignacion de hablantes."""
import io
import uuid

import pytest

from app import diarizacion

pytestmark = [pytest.mark.unit, pytest.mark.diarizacion]


def test_asigna_por_mayor_solape():
    segmentos = [{"start": 1.0, "end": 4.0, "text": "uno"}]
    turnos = [
        {"start": 0.0, "end": 2.0, "speaker": "SPEAKER_00"},
        {"start": 2.0, "end": 6.0, "speaker": "SPEAKER_01"},
    ]

    diarizacion.asignar_hablantes(segmentos, turnos)

    assert segmentos[0]["hablante"] == "SPEAKER_01"


def test_segmento_sin_cobertura_queda_sin_hablante():
    segmentos = [{"start": 10.0, "end": 12.0, "text": "lejos"}]
    turnos = [{"start": 0.0, "end": 5.0, "speaker": "SPEAKER_00"}]

    diarizacion.asignar_hablantes(segmentos, turnos)

    assert segmentos[0]["hablante"] is None


def test_cada_segmento_recibe_su_hablante():
    segmentos = [
        {"start": 0.5, "end": 2.5, "text": "a"},
        {"start": 3.0, "end": 5.0, "text": "b"},
        {"start": 5.2, "end": 8.0, "text": "c"},
    ]
    turnos = [
        {"start": 0.0, "end": 3.0, "speaker": "SPEAKER_00"},
        {"start": 3.0, "end": 9.0, "speaker": "SPEAKER_01"},
    ]

    diarizacion.asignar_hablantes(segmentos, turnos)

    assert [s["hablante"] for s in segmentos] == [
        "SPEAKER_00",
        "SPEAKER_01",
        "SPEAKER_01",
    ]


class _Turno:
    def __init__(self, start, end):
        self.start = start
        self.end = end


class _PipelineFalso:
    def __init__(self, turnos):
        self._turnos = turnos
        self.payload = None
        self.kwargs = None

    def __call__(self, payload, **kwargs):
        self.payload = payload
        self.kwargs = kwargs
        tracks = [(t, None, hablante) for t, hablante in self._turnos]

        class _Resultado:
            speaker_diarization = type(
                "Diarizacion",
                (),
                {"itertracks": staticmethod(lambda yield_label=True: iter(tracks))},
            )

        return _Resultado()


class _WhisperxFalso:
    @staticmethod
    def load_audio(ruta):
        import numpy as np

        return np.zeros(16000, dtype="float32")


def _pinchar_pipeline(monkeypatch, turnos):
    pipeline = _PipelineFalso(turnos)
    monkeypatch.setattr(diarizacion, "cargar_pipeline", lambda token: pipeline)
    monkeypatch.setattr(diarizacion, "whisperx", _WhisperxFalso)
    return pipeline


def test_filtro_de_turnos_cortos(monkeypatch):
    _pinchar_pipeline(
        monkeypatch,
        [
            (_Turno(0.0, 0.2), "SPEAKER_00"),
            (_Turno(0.2, 1.5), "SPEAKER_00"),
            (_Turno(1.5, 3.0), "SPEAKER_01"),
        ],
    )

    turnos = diarizacion.diarizar("x.wav", "token")

    assert len(turnos) == 2
    assert all(t["end"] - t["start"] >= diarizacion.UMBRAL_CORTO for t in turnos)


def test_num_hablantes_se_pasa_al_pipeline(monkeypatch):
    pipeline = _pinchar_pipeline(monkeypatch, [(_Turno(0.0, 2.0), "SPEAKER_00")])

    diarizacion.diarizar("x.wav", "token", num_hablantes=3)

    assert pipeline.kwargs == {"num_speakers": 3}


def test_audio_en_memoria_al_pipeline(monkeypatch):
    pipeline = _pinchar_pipeline(monkeypatch, [(_Turno(0.0, 2.0), "SPEAKER_00")])

    diarizacion.diarizar("x.wav", "token")

    # torchcodec no carga en este entorno: el audio viaja ya decodificado
    assert set(pipeline.payload) == {"waveform", "sample_rate"}
    assert pipeline.payload["sample_rate"] == 16000


def _contenido_diarizable(client, perfil, tmp_descargas, mock_whisperx):
    files = {"archivo": ("audio.m4a", io.BytesIO(b"audio-fake"), "audio/mp4")}
    subida = client.post(f"/biblioteca/subir?perfil_id={perfil['id']}", files=files)
    contenido = subida.json()
    client.post(f"/transcribir/{contenido['id']}")
    guardado = client.post(
        "/transcripciones",
        json={"contenido_id": contenido["id"], "segmentos": mock_whisperx},
    )
    return contenido, guardado.json()


def _conectar_hf(client, perfil):
    resp = client.put(
        f"/config/{perfil['id']}",
        json={
            "modelo": "base",
            "compute_type": "int8",
            "batch_size": 8,
            "hf_token": "token-fake",
        },
    )
    assert resp.status_code == 200


def test_endpoint_diariza_y_persiste(
    client, perfil, tmp_descargas, mock_whisperx, mock_diarizar
):
    _conectar_hf(client, perfil)
    contenido, transcripcion = _contenido_diarizable(
        client, perfil, tmp_descargas, mock_whisperx
    )

    resp = client.post(f"/diarizar/{transcripcion['id']}", json={})

    assert resp.status_code == 200, resp.text
    cuerpo = resp.json()
    assert cuerpo["hablantes"] == ["SPEAKER_00", "SPEAKER_01"]
    assert all("hablante" in s for s in cuerpo["segmentos"])
    recarga = client.get(f"/transcripciones/{contenido['id']}")
    assert recarga.json()["segmentos"][0]["hablante"] == "SPEAKER_00"


def test_endpoint_parametros(mock_diarizar, client, perfil, tmp_descargas, mock_whisperx):
    _conectar_hf(client, perfil)
    _, transcripcion = _contenido_diarizable(
        client, perfil, tmp_descargas, mock_whisperx
    )

    client.post(f"/diarizar/{transcripcion['id']}", json={"num_hablantes": 4})

    assert mock_diarizar["num"] == 4


def test_endpoint_sin_token(client, perfil, tmp_descargas, mock_whisperx):
    _, transcripcion = _contenido_diarizable(
        client, perfil, tmp_descargas, mock_whisperx
    )

    resp = client.post(f"/diarizar/{transcripcion['id']}", json={})

    assert resp.status_code == 400
    assert "token" in resp.json()["detail"].lower()


def test_endpoint_sin_transcripcion(client, perfil):
    resp = client.post(f"/diarizar/{uuid.uuid4()}", json={})
    assert resp.status_code == 404


def test_endpoint_pipeline_caido(
    client, perfil, tmp_descargas, mock_whisperx, monkeypatch
):
    def _explota(ruta, token, num_hablantes=None):
        raise diarizacion.ErrorDiarizacion("el pipeline no responde")

    monkeypatch.setattr(diarizacion, "diarizar", _explota)
    _conectar_hf(client, perfil)
    _, transcripcion = _contenido_diarizable(
        client, perfil, tmp_descargas, mock_whisperx
    )

    resp = client.post(f"/diarizar/{transcripcion['id']}", json={})

    assert resp.status_code == 503
