from pathlib import Path

from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import yt_dlp

from app.config import settings

SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"]

# Almacenamiento en memoria para desarrollo.
# En producción iría en base de datos o sesión.
_credenciales: dict[str, object] = {}


def _client_config():
    return {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.youtube_redirect_uri],
        }
    }


def iniciar_oauth(perfil_id: str) -> str:
    """Genera la URL de autorización de Google para el perfil dado."""
    flow = Flow.from_client_config(
        _client_config(), scopes=SCOPES, state=perfil_id
    )
    flow.redirect_uri = settings.youtube_redirect_uri
    auth_url, _ = flow.authorization_url(access_type="offline", prompt="consent")
    return auth_url


def canjear_codigo(code: str, perfil_id: str):
    """Intercambia el código de autorización por credenciales y las guarda."""
    flow = Flow.from_client_config(
        _client_config(), scopes=SCOPES, state=perfil_id
    )
    flow.redirect_uri = settings.youtube_redirect_uri
    flow.fetch_token(code=code)
    _credenciales[perfil_id] = flow.credentials
    return flow.credentials


def hay_credenciales(perfil_id: str) -> bool:
    return perfil_id in _credenciales


def desconectar(perfil_id: str):
    _credenciales.pop(perfil_id, None)


def listar_videos(perfil_id: str) -> list[dict]:
    """Lista los vídeos del canal del usuario autenticado."""
    creds = _credenciales.get(perfil_id)
    if not creds:
        raise ValueError("No hay credenciales para este perfil")

    youtube = build("youtube", "v3", credentials=creds)
    canal = youtube.channels().list(part="contentDetails", mine=True).execute()
    uploads = canal["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]

    videos = []
    resp = youtube.playlistItems().list(
        part="snippet", playlistId=uploads, maxResults=50
    ).execute()

    for item in resp["items"]:
        sn = item["snippet"]
        videos.append({
            "id": sn["resourceId"]["videoId"],
            "titulo": sn["title"],
            "thumbnail": sn["thumbnails"]["default"]["url"],
        })

    return videos


def descargar_audio(video_id: str, perfil_id: str) -> str:
    """Descarga el audio de un vídeo con yt-dlp y devuelve la ruta del archivo."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    destino = Path("descargas") / perfil_id
    destino.mkdir(parents=True, exist_ok=True)

    opciones = {
        "format": "bestaudio/best",
        "outtmpl": str(destino / "%(title).80s.%(ext)s"),
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
        "quiet": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(opciones) as ydl:
        ydl.download([url])

    archivos = sorted(destino.glob("*.mp3"), key=lambda f: f.stat().st_mtime)
    return str(archivos[-1]) if archivos else ""
