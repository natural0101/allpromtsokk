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
    session_token = request.cookies.get("session_id")
    if session_token:
        revoke_session(db, session_token)
    
    # Удаляем cookie
    response.delete_cookie(key="session_id", path="/")
    
    return {"message": "Logged out successfully"}

