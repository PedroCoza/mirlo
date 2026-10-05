import os
import subprocess

import torch
import whisperx

MODELO_POR_DEFECTO = "base"

_modelo = None
_modelo_cargado = None


def cargar_modelo(nombre=None, compute_type=None):
    # El modelo se cachea entre peticiones, pero la caché se invalida si el
    # perfil activo pide uno distinto al que hay en memoria.
    global _modelo, _modelo_cargado
    nombre = nombre or MODELO_POR_DEFECTO
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if compute_type is None:
        compute_type = "float16" if device == "cuda" else "int8"
    clave = (nombre, device, compute_type)
    if _modelo is not None and _modelo_cargado == clave:
        return _modelo
    _modelo = whisperx.load_model(nombre, device=device, compute_type=compute_type)
    _modelo_cargado = clave
    return _modelo


def transcribir(ruta_audio, modelo_nombre=None, compute_type=None, batch_size=8):
    modelo = cargar_modelo(modelo_nombre, compute_type)
    audio = whisperx.load_audio(ruta_audio)
    resultado = modelo.transcribe(audio, batch_size=batch_size)
    segmentos = [
        {
            "start": round(s["start"], 3),
            "end": round(s["end"], 3),
            "text": s["text"].strip(),
        }
        for s in resultado["segments"]
    ]
    return segmentos, resultado.get("language")


def detectar_idioma(ruta_audio, modelo_nombre=None, compute_type=None):
    # Con los primeros 30 segundos de audio basta para identificar el idioma.
    modelo = cargar_modelo(modelo_nombre, compute_type)
    audio = whisperx.load_audio(ruta_audio)
    ventana = audio[: 16000 * 30]
    resultado = modelo.transcribe(ventana, batch_size=1)
    return resultado.get("language")


def preprocesar_audio(ruta_entrada):
    # Convierte a WAV 16kHz mono con ffmpeg (necesario para vídeo).
    ruta_wav = os.path.splitext(ruta_entrada)[0] + "_proc.wav"
    resultado = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            ruta_entrada,
            "-ar",
            "16000",
            "-ac",
            "1",
            "-f",
            "wav",
            ruta_wav,
        ],
        capture_output=True,
    )

    if resultado.returncode != 0 or not os.path.exists(ruta_wav):
        raise ValueError("El archivo no contiene pista de audio")
    return ruta_wav
