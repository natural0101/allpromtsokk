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
from ..schemas import TelegramAuthData, UserOut

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
    else:
        # Обновляем данные пользователя, если изменились
        if payload.username and payload.username != user.username:
            user.username = payload.username
        if payload.first_name and payload.first_name != user.first_name:
            user.first_name = payload.first_name
        if payload.last_name and payload.last_name != user.last_name:
            user.last_name = payload.last_name
        db.commit()
        db.refresh(user)
    
    user = update_user_login_time(db, user)
    session = create_session(db, user_id=user.id)
    
    # Устанавливаем cookie с токеном (используем session_token для единообразия)
    response.set_cookie(
        key="session_token",
        value=session.token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=30 * 24 * 60 * 60,  # 30 дней в секундах
        path="/",
    )
    
    return {
        "token": session.token,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
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
    session_token = request.cookies.get("session_token")
    
    if session_token:
        revoke_session(db, session_token)
    
    # Удаляем cookie
    response.delete_cookie(key="session_token", path="/")
    
    return {"detail": "ok"}

