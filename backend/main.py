import os
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud
from .db import Base, engine, get_db
from .middleware import AuthMiddleware
from .rate_limit import RateLimitMiddleware
from .models import User, PromptVersion
from .routers import auth, admin
from .schemas import PromptCreate, PromptOut, PromptUpdate, PromptVersionBase, PromptVersionDetail
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


@app.on_event("startup")
def on_startup() -> None:
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
    return {"status": "ok"}


def get_current_user(request: Request) -> User:
    """
    Dependency для получения текущего пользователя из request.state.
    Middleware уже проверил авторизацию и добавил user в request.state.
    """
    if not hasattr(request.state, "user") or request.state.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return request.state.user


def get_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency для проверки, что пользователь имеет статус "active".
    """
    if current_user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="access_denied",
            headers={"X-Reason": "status_not_active"}
        )
    return current_user


def get_prompt_editor_user(current_user: User = Depends(get_active_user)) -> User:
    """
    Dependency для проверки, что пользователь может редактировать промпты.
    Разрешает доступ для access_level в ("admin", "tech").
    """
    if current_user.access_level not in ("admin", "tech"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Editor access required. Only admin and tech users can modify prompts."
        )
    return current_user


def get_admin_user(current_user: User = Depends(get_active_user)) -> User:
    """
    Dependency для проверки, что пользователь является администратором.
    """
    if current_user.access_level != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@app.get("/api/prompts", response_model=List[PromptOut])
def list_prompts(
    folder: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    return crud.list_prompts(db=db, folder=folder, search=search)


@app.get("/api/prompts/{slug}", response_model=PromptOut)
def get_prompt(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    prompt = crud.get_prompt_by_slug(db, slug=slug)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return prompt


@app.post("/api/prompts", response_model=PromptOut, status_code=status.HTTP_201_CREATED)
def create_prompt(
    payload: PromptCreate,
    db: Session = Depends(get_db),
    editor_user: User = Depends(get_prompt_editor_user),
):
    prompt = crud.create_prompt(db=db, data=payload, user_id=editor_user.id)
    return prompt


@app.put("/api/prompts/{slug}", response_model=PromptOut)
def update_prompt(
    slug: str,
    payload: PromptUpdate,
    db: Session = Depends(get_db),
    editor_user: User = Depends(get_prompt_editor_user),
):
    prompt = crud.update_prompt(db=db, slug=slug, data=payload, user_id=editor_user.id)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return prompt


@app.delete("/api/prompts/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prompt(
    slug: str,
    db: Session = Depends(get_db),
    editor_user: User = Depends(get_prompt_editor_user),
):
    deleted = crud.delete_prompt(db=db, slug=slug)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return None


@app.get("/api/prompts/{prompt_id}/versions", response_model=List[PromptVersionBase])
def get_prompt_versions(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    versions = (
        db.query(PromptVersion)
        .filter(PromptVersion.prompt_id == prompt_id)
        .order_by(PromptVersion.version.desc())
        .all()
    )
    return versions


@app.get("/api/prompts/{prompt_id}/versions/{version_id}", response_model=PromptVersionDetail)
def get_prompt_version(
    prompt_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    version = (
        db.query(PromptVersion)
        .filter(PromptVersion.prompt_id == prompt_id, PromptVersion.id == version_id)
        .first()
    )
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return version



