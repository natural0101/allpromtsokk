from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ..auth_crud import (
    create_session,
    create_user,
    get_user_by_telegram_id,
    revoke_session,
    update_user_login_time,
)
from ..db import get_db
from ..dependencies import get_current_user
from ..schemas import TelegramAuthData, UserOut, AuthResponse
from ..models import User
from ..settings import settings
from ..utils import verify_telegram_auth
from pydantic import ValidationError

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=UserOut)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Получить информацию о текущем авторизованном пользователе.
    """
    return current_user


@router.post("/telegram", response_model=AuthResponse)
async def telegram_auth(
    payload: dict = Body(...),
    response: Response = None,
    db: Session = Depends(get_db),
):
    """
    Авторизация через Telegram.
    Создаёт/обновляет пользователя и создаёт сессию.
    Проверяет подпись Telegram Login Widget.
    """
    # Проверка подписи Telegram
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Telegram bot token not configured"
        )
    
    # Проверяем подпись на raw-payload
    if not verify_telegram_auth(payload, settings.TELEGRAM_BOT_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram authentication hash"
        )
    # Пытаемся привести к нашей внутренней модели
    try:
        data = TelegramAuthData.model_validate(payload)
    except ValidationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Telegram payload",
        )

    user = get_user_by_telegram_id(db, telegram_id=data.id)
    
    if not user:
        # Новый пользователь: создаём со status="pending", access_level="user"
        user = create_user(
            db,
            telegram_id=data.id,
            username=data.username,
            first_name=data.first_name,
            last_name=data.last_name,
        )
    else:
        # Существующий пользователь: обновляем только данные профиля, НЕ меняем status и access_level
        if data.username and data.username != user.username:
            user.username = data.username
        if data.first_name and data.first_name != user.first_name:
            user.first_name = data.first_name
        if data.last_name and data.last_name != user.last_name:
            user.last_name = data.last_name
        db.commit()
        db.refresh(user)
    
    user = update_user_login_time(db, user)
    session = create_session(db, user_id=user.id)
    
    # Устанавливаем cookie с токеном
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session.token,
        httponly=settings.cookie_httponly,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.SESSION_EXPIRES_DAYS * 24 * 60 * 60,  # в секундах
        path="/",
    )
    
    return {
        "token": session.token,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "status": user.status,
            "access_level": user.access_level,
        }
    }


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Выход из системы. Отзывает текущую сессию и удаляет cookie.
    """
    # Получаем токен из cookie
    session_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    
    if session_token:
        revoke_session(db, session_token)
    
    # Удаляем cookie
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")
    
    return {"detail": "ok"}

