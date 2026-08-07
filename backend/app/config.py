from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://mirlo:mirlo@localhost:5432/mirlo"
    google_client_id: str = ""
    google_client_secret: str = ""
    youtube_redirect_uri: str = "http://localhost:8000/youtube/callback"
    frontend_url: str = "http://localhost:3000"


settings = Settings()
