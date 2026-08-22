import os
import subprocess

import torch
import whisperx

_modelo = None


def cargar_modelo():
    global _modelo
    if _modelo is not None:
        return _modelo
    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    _modelo = whisperx.load_model("base", device=device, compute_type=compute_type)
    return _modelo


def transcribir(ruta_audio):
    modelo = cargar_modelo()
    audio = whisperx.load_audio(ruta_audio)
    resultado = modelo.transcribe(audio, batch_size=8)
    return [
        {
            "start": round(s["start"], 3),
            "end": round(s["end"], 3),
            "text": s["text"].strip(),
        }
        for s in resultado["segments"]
    ]


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
