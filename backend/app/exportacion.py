import json


def _formatear_tiempo(t: float, separador: str = ",") -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int((t - int(t)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{separador}{ms:03d}"


def generar_srt(segmentos: list[dict]) -> str:
    bloques = []
    for i, seg in enumerate(segmentos, start=1):
        inicio = _formatear_tiempo(seg["start"])
        fin = _formatear_tiempo(seg["end"])
        bloques.append(f"{i}\n{inicio} --> {fin}\n{seg['text']}")
    return "\n\n".join(bloques) + "\n"


def generar_vtt(segmentos: list[dict]) -> str:
    bloques = ["WEBVTT"]
    for seg in segmentos:
        inicio = _formatear_tiempo(seg["start"], separador=".")
        fin = _formatear_tiempo(seg["end"], separador=".")
        bloques.append(f"{inicio} --> {fin}\n{seg['text']}")
    return "\n\n".join(bloques) + "\n"


def generar_txt(segmentos: list[dict]) -> str:
    lineas = []
    for seg in segmentos:
        inicio = _formatear_tiempo(seg["start"])
        lineas.append(f"[{inicio}] {seg['text']}")
    return "\n".join(lineas) + "\n"


def generar_json(segmentos: list[dict]) -> str:
    return json.dumps(segmentos, ensure_ascii=False, indent=2)
