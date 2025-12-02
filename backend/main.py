from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine
from .middleware import AuthMiddleware
from .rate_limit import RateLimitMiddleware
from .routers import admin, auth, prompts
from .settings import settings

# Загружаем переменные окружения из .env
load_dotenv()

app = FastAPI(title="autookk backend", version="1.0.0")

# CORS middleware (должен быть первым)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Rate limiting middleware
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(
        RateLimitMiddleware,
        enabled=settings.RATE_LIMIT_ENABLED,
    )

# Подключаем middleware авторизации
app.add_middleware(AuthMiddleware)

# Подключаем роутеры
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(prompts.router)


@app.on_event("startup")
def on_startup() -> None:
    """Инициализация приложения при старте."""
    # Ensure all tables are created
    Base.metadata.create_all(bind=engine)
    
    # Миграция существующих пользователей: устанавливаем status="active" и access_level
    from .db import SessionLocal
    from .models import User
    
    db = SessionLocal()
    try:
        # Получаем всех пользователей
        users = db.query(User).all()
        updated = False
        for user in users:
            user_updated = False
            # Если status не установлен или пустой, устанавливаем "active"
            # SQLAlchemy автоматически создаст колонку при следующем запросе, но проверим явно
            try:
                if not hasattr(user, 'status') or user.status is None or user.status == '':
                    user.status = "active"
                    user_updated = True
            except AttributeError:
                # Колонка может не существовать в старых БД, но SQLAlchemy создаст её
                user.status = "active"
                user_updated = True
            
            # Если access_level не установлен или пустой, устанавливаем на основе role
            try:
                if not hasattr(user, 'access_level') or user.access_level is None or user.access_level == '':
                    if user.role == "admin":
                        user.access_level = "admin"
                    else:
                        user.access_level = "user"
                    user_updated = True
            except AttributeError:
                # Колонка может не существовать в старых БД
                if user.role == "admin":
                    user.access_level = "admin"
                else:
                    user.access_level = "user"
                user_updated = True
            
            if user_updated:
                updated = True
        
        if updated:
            db.commit()
            print("Миграция пользователей завершена успешно")
    except Exception as e:
        print(f"Ошибка при миграции пользователей: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


@app.get("/api/health")
def health() -> dict:
    """Проверка здоровья приложения."""
    return {"status": "ok"}



