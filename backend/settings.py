from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Literal, List, Union


class Settings(BaseSettings):
    """Настройки приложения из переменных окружения."""
    
    # База данных
    DATABASE_URL: str = "sqlite:////var/www/allpromtsokk/backend/prompts.db"
    
    # Telegram
    TELEGRAM_BOT_NAME: str = "autookk_bot"
    TELEGRAM_BOT_TOKEN: str = ""  # Токен бота для проверки подписи (получить у @BotFather)
    
    # Сессии
    SESSION_COOKIE_NAME: str = "session_token"
    SESSION_EXPIRES_DAYS: int = 30
    
    # Окружение
    ENV: Literal["dev", "prod"] = "dev"
    
    # CORS
    # Может быть строкой (через запятую) или списком
    ALLOWED_ORIGINS: Union[str, List[str]] = "https://autookk.ru"
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10
    
    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        """Парсит ALLOWED_ORIGINS из строки (через запятую) или списка."""
        if isinstance(v, str):
            # Разделяем по запятой и очищаем от пробелов
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v
    
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
    
    def get_allowed_origins(self) -> List[str]:
        """Получить список разрешённых origin'ов с учётом окружения."""
        # ALLOWED_ORIGINS уже список после валидации
        origins = list(self.ALLOWED_ORIGINS) if isinstance(self.ALLOWED_ORIGINS, list) else [self.ALLOWED_ORIGINS]
        if not self.is_production:
            # В dev режиме добавляем localhost
            dev_origins = [
                "http://localhost:8000",
                "http://localhost:5173",
                "http://127.0.0.1:8000",
                "http://127.0.0.1:5173",
            ]
            origins.extend(dev_origins)
        return origins


# Глобальный экземпляр настроек
settings = Settings()

