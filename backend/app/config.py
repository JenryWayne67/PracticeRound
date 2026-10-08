from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All config comes from backend/.env (see .env.example). Add new settings here."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Hackathon API"
    database_url: str = "sqlite:///./app.db"
    secret_key: str = "dev-secret-change-me-before-deploying-anywhere"
    access_token_minutes: int = 60 * 24 * 7
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    upload_dir: str = "uploads"

    # None falls back to the ANTHROPIC_API_KEY environment variable.
    anthropic_api_key: str | None = None
    ai_model: str = "claude-opus-5-5"
    ai_system_prompt: str = "You are a helpful assistant inside a hackathon demo app. Be concise."


settings = Settings()
