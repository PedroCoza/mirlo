from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://mirlo:mirlo@localhost:5432/mirlo"


settings = Settings()
