"""Pruebas del modulo de transcripcion."""
import os
import wave

import pytest

from app import transcripcion

pytestmark = [pytest.mark.unit, pytest.mark.transcripcion]


def _escribir_wav(ruta, duracion=1):
    # WAV estereo 44.1 kHz generado con la libreria estandar
    with wave.open(str(ruta), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(44100)
        w.writeframes(b"\x00\x00\x00\x00" * 44100 * duracion)


def test_preprocesar_convierte_a_wav_16k_mono(tmp_path):
    entrada = tmp_path / "entrada.wav"
    _escribir_wav(entrada)

    salida = transcripcion.preprocesar_audio(str(entrada))

    assert salida.endswith("_proc.wav")
    assert os.path.exists(salida)
    with wave.open(salida, "rb") as w:
        assert w.getframerate() == 16000
        assert w.getnchannels() == 1


def test_preprocesar_sin_pista_de_audio(tmp_path):
    entrada = tmp_path / "sin_audio.mp4"
    entrada.write_bytes(b"datos sin pista de audio")

    with pytest.raises(ValueError, match="pista de audio"):
        transcripcion.preprocesar_audio(str(entrada))


def test_transcribir_da_formato_a_los_segmentos(monkeypatch):
    class _ModeloFalso:
        def transcribe(self, audio, batch_size=8):
            return {
                "segments": [
                    {"start": 0.0004, "end": 3.49991, "text": "  Hola mundo  "},
                ]
            }

    cargas = []

    def _load_model_fake(*args, **kwargs):
        cargas.append(1)
        return _ModeloFalso()

    monkeypatch.setattr(transcripcion, "_modelo", None)
    monkeypatch.setattr(transcripcion.whisperx, "load_model", _load_model_fake)
    monkeypatch.setattr(transcripcion.whisperx, "load_audio", lambda ruta: b"audio")

    segmentos = transcripcion.transcribir("x.wav")

    assert segmentos == [{"start": 0.0, "end": 3.5, "text": "Hola mundo"}]

    # el modelo se cachea: una segunda pasada no vuelve a cargarlo
    transcripcion.transcribir("x.wav")
    assert len(cargas) == 1
