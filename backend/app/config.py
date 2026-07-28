from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    frontend_origin: str = "http://localhost:5173"

    data_dir: Path = REPO_ROOT / "data"
    artifacts_dir: Path = REPO_ROOT / "backend" / "artifacts"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.gemini_api_key)


settings = Settings()
