from urllib.parse import parse_qs, urlparse

import pytest

import app.youtube as youtube
from app.config import settings

pytestmark = [pytest.mark.unit, pytest.mark.youtube]


def test_oauth_url():
    perfil_id = "perfil-123"
    url = youtube.iniciar_oauth(perfil_id)

    parseada = urlparse(url)
    qs = parse_qs(parseada.query)

    assert parseada.netloc == "accounts.google.com"
    assert parseada.path == "/o/oauth2/auth"
    assert qs["client_id"] == [settings.google_client_id]
    assert qs["redirect_uri"] == [settings.youtube_redirect_uri]
    assert qs["state"] == [perfil_id]
    assert "youtube.readonly" in qs["scope"][0]


def test_oauth_callback(mock_oauth):
    perfil_id = "perfil-callback"
    assert youtube.hay_credenciales(perfil_id) is False

    creds = youtube.canjear_codigo("codigo-falso", perfil_id)

    assert creds is not None
    assert youtube.hay_credenciales(perfil_id) is True


def test_oauth_desconectar(mock_oauth):
    perfil_id = "perfil-desconectar"
    youtube.canjear_codigo("codigo-falso", perfil_id)
    assert youtube.hay_credenciales(perfil_id) is True

    youtube.desconectar(perfil_id)

    assert youtube.hay_credenciales(perfil_id) is False


def test_videos_sin_creds():
    with pytest.raises(ValueError):
        youtube.listar_videos("perfil-sin-credenciales")
