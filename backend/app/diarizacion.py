import torch
import whisperx
from pyannote.audio import Pipeline

UMBRAL_CORTO = 0.3

_pipelines = {}


class ErrorDiarizacion(Exception):
    pass


def cargar_pipeline(hf_token):
    if hf_token not in _pipelines:
        pipe = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1", token=hf_token
        )
        if pipe is None:
            raise ErrorDiarizacion("No se pudo cargar el pipeline de diarización")
        if torch.cuda.is_available():
            pipe.to(torch.device("cuda"))
        _pipelines[hf_token] = pipe
    return _pipelines[hf_token]


def diarizar(ruta_audio, hf_token, num_hablantes=None):
    pipe = cargar_pipeline(hf_token)
    
    # torchcodec no carga en este entorno: el audio se entrega ya decodificado
    onda = torch.from_numpy(whisperx.load_audio(ruta_audio)).unsqueeze(0)
    resultado = pipe(
        {"waveform": onda, "sample_rate": 16000},
        **({"num_speakers": num_hablantes} if num_hablantes else {}),
    )
    turnos = [
        (t.start, t.end, hablante)
        for t, _, hablante in resultado.speaker_diarization.itertracks(
            yield_label=True
        )
    ]
    return [
        {"start": round(ini, 3), "end": round(fin, 3), "speaker": hablante}
        for ini, fin, hablante in turnos
        if fin - ini >= UMBRAL_CORTO
    ]


def asignar_hablantes(segmentos, turnos):
    for segmento in segmentos:
        mejor, mejor_solape = None, 0.0
        for turno in turnos:
            solape = min(segmento["end"], turno["end"]) - max(
                segmento["start"], turno["start"]
            )
            if solape > mejor_solape:
                mejor, mejor_solape = turno["speaker"], solape
        segmento["hablante"] = mejor
    return segmentos
