from typing import Optional

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from ..auth_crud import (
    create_session,
    create_user,
    get_user_by_telegram_id,
    revoke_session,
    update_user_login_time,
)
from ..db import get_db
from ..schemas import TelegramAuthData

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/telegram")
def telegram_login(
    payload: TelegramAuthData,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Авторизация через Telegram.
    Создаёт/обновляет пользователя и создаёт сессию.
    """
    user = get_user_by_telegram_id(db, telegram_id=payload.id)
    
    if not user:
        user = create_user(
            db,
            telegram_id=payload.id,
            username=payload.username,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
    
    user = update_user_login_time(db, user)
    session = create_session(db, user_id=user.id)
    
    # Устанавливаем cookie с токеном
    response.set_cookie(
        key="session_id",
        value=session.token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=30 * 24 * 60 * 60,  # 30 дней в секундах
        path="/",
    )
    
    return {"token": session.token}


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Выход из системы. Отзывает текущую сессию и удаляет cookie.
    """
    # Получаем токен из cookie или заголовка
    session_token = request.cookies.get("session_id")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
        else:
            session_token = request.headers.get("X-Session-Token")
    
    if session_token:
        revoke_session(db, session_token)
    
    # Удаляем cookie
    response.delete_cookie(key="session_id", path="/")
    
    return {"message": "Logged out successfully"}

