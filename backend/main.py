import os
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from sqlalchemy.orm import Session

from . import crud
from .db import Base, engine, get_db
from .middleware import AuthMiddleware
from .models import User
from .routers import auth
from .schemas import PromptCreate, PromptOut, PromptUpdate

# Загружаем переменные окружения из .env
load_dotenv()

app = FastAPI(title="autookk backend", version="1.0.0")

# Подключаем middleware авторизации
app.add_middleware(AuthMiddleware)

# Подключаем роутер авторизации
app.include_router(auth.router)


@app.on_event("startup")
def on_startup() -> None:
    # Ensure all tables are created
    Base.metadata.create_all(bind=engine)


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


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency для проверки, что пользователь является администратором.
    """
    if current_user.role != "admin":
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
):
    return crud.list_prompts(db=db, folder=folder, search=search)


@app.get("/api/prompts/{slug}", response_model=PromptOut)
def get_prompt(
    slug: str,
    db: Session = Depends(get_db),
):
    prompt = crud.get_prompt_by_slug(db, slug=slug)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return prompt


@app.post("/api/prompts", response_model=PromptOut, status_code=status.HTTP_201_CREATED)
def create_prompt(
    payload: PromptCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    prompt = crud.create_prompt(db=db, data=payload)
    return prompt


@app.put("/api/prompts/{slug}", response_model=PromptOut)
def update_prompt(
    slug: str,
    payload: PromptUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    prompt = crud.update_prompt(db=db, slug=slug, data=payload)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return prompt


@app.delete("/api/prompts/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prompt(
    slug: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    deleted = crud.delete_prompt(db=db, slug=slug)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return None



