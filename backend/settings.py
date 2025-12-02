from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    """Настройки приложения из переменных окружения."""
    
    # База данных
    DATABASE_URL: str = "sqlite:////var/www/allpromtsokk/backend/prompts.db"
    
    # Telegram
    TELEGRAM_BOT_NAME: str = "autookk_bot"
    TELEGRAM_BOT_SECRET: str = ""  # Для проверки подписи в будущем
    
    # Сессии
    SESSION_COOKIE_NAME: str = "session_token"
    SESSION_EXPIRES_DAYS: int = 30
    
    # Окружение
    ENV: Literal["dev", "prod"] = "dev"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
    
    @property
    def is_production(self) -> bool:
        """Проверка, что приложение работает в production."""
        return self.ENV == "prod"
    
    @property
    def cookie_secure(self) -> bool:
        """Использовать secure cookies (только HTTPS)."""
        return self.is_production
    
    @property
    def cookie_httponly(self) -> bool:
        """Использовать HttpOnly cookies."""
        return True
    
    @property
    def cookie_samesite(self) -> str:
        """SameSite политика для cookies."""
        return "lax"


# Глобальный экземпляр настроек
settings = Settings()

