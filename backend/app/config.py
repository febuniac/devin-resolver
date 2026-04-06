from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # GitHub
    github_token: str = ""
    github_app_id: str = ""
    github_app_private_key: str = ""

    # Devin API
    devin_api_token: str = ""
    devin_api_base_url: str = "https://api.devin.ai/v1"

    # Slack
    slack_webhook_url: str = ""
    slack_bot_token: str = ""

    # Database
    database_url: str = "sqlite+aiosqlite:///./devin_resolver.db"

    # App
    app_name: str = "DevinResolver"
    debug: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
