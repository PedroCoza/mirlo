from pathlib import Path

from requests_oauthlib import OAuth2Session
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import yt_dlp

from app.config import settings

SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"]
AUTH_URI = "https://accounts.google.com/o/oauth2/auth"
TOKEN_URI = "https://oauth2.googleapis.com/token"

# Almacenamiento en memoria para desarrollo.
# En producción iría en base de datos o sesión.
_credenciales: dict[str, object] = {}


def iniciar_oauth(perfil_id: str) -> str:
    """Genera la URL de autorización de Google para el perfil dado."""
    oauth = OAuth2Session(
        settings.google_client_id,
        redirect_uri=settings.youtube_redirect_uri,
        scope=SCOPES,
        state=perfil_id,
    )
    auth_url, _ = oauth.authorization_url(
        AUTH_URI, access_type="offline", prompt="consent"
    )
    return auth_url


def canjear_codigo(code: str, perfil_id: str):
    """Intercambia el código de autorización por credenciales y las guarda."""
    oauth = OAuth2Session(
        settings.google_client_id,
        redirect_uri=settings.youtube_redirect_uri,
        scope=SCOPES,
        state=perfil_id,
    )
    token = oauth.fetch_token(
        TOKEN_URI,
        code=code,
        client_secret=settings.google_client_secret,
    )
    creds = Credentials(
        token=token["access_token"],
        refresh_token=token.get("refresh_token"),
        token_uri=TOKEN_URI,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )
    _credenciales[perfil_id] = creds
    return creds


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
