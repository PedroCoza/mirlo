import requests

from app.config import settings


class ErrorTraduccion(Exception):
    pass


def traducir_segmentos(segmentos, idioma):
    traducidos = []
    for seg in segmentos:
        try:
            respuesta = requests.post(
                f"{settings.libretranslate_url}/translate",
                json={"q": seg["text"], "source": "auto", "target": idioma},
                timeout=30,
            )
            respuesta.raise_for_status()
        except requests.RequestException as e:
            raise ErrorTraduccion(
                f"El servicio de traducción no responde: {e}"
            ) from e
        traducidos.append(
            {
                "start": seg["start"],
                "end": seg["end"],
                "text": respuesta.json()["translatedText"],
            }
        )
    return traducidos
