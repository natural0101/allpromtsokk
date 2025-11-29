import hashlib
import hmac
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ..auth_crud import (
    create_session,
    create_user,
    get_session_by_token,
    get_user_by_telegram_id,
    revoke_session,
    update_user_login_time,
)
from ..db import get_db
from ..schemas import TelegramAuthData, UserOut

# Загружаем переменные окружения
load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Получаем токен бота из переменной окружения
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


def verify_telegram_hash(data: TelegramAuthData) -> bool:
    """
    Проверяет подпись Telegram Login Widget по алгоритму HMAC-SHA256.
    """
    if not TELEGRAM_BOT_TOKEN:
        return False
    
    # Создаём строку для проверки (только непустые поля, кроме hash)
    data_check_string_parts = []
    
    if data.id:
        data_check_string_parts.append(f"id={data.id}")
    if data.first_name:
        data_check_string_parts.append(f"first_name={data.first_name}")
    if data.last_name:
        data_check_string_parts.append(f"last_name={data.last_name}")
    if data.username:
        data_check_string_parts.append(f"username={data.username}")
    if data.auth_date:
        data_check_string_parts.append(f"auth_date={data.auth_date}")
    
    # Сортируем и объединяем через \n
    data_check_string = "\n".join(sorted(data_check_string_parts))
    
    # Вычисляем секретный ключ из токена бота (SHA256 от токена)
    secret_key = hashlib.sha256(TELEGRAM_BOT_TOKEN.encode()).digest()
    
    # Вычисляем HMAC
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return calculated_hash == data.hash


@router.post("/telegram", response_model=UserOut)
def telegram_login(
    data: TelegramAuthData,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Авторизация через Telegram Login Widget.
    Проверяет подпись, создаёт/обновляет пользователя и создаёт сессию.
    """
    # Проверяем подпись
    if not verify_telegram_hash(data):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram hash"
        )
    
    # Проверяем, что auth_date не старше 24 часов
    from datetime import datetime, timedelta
    auth_datetime = datetime.fromtimestamp(data.auth_date)
    if datetime.utcnow() - auth_datetime > timedelta(hours=24):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Auth data expired"
        )
    
    # Ищем или создаём пользователя
    user = get_user_by_telegram_id(db, telegram_id=data.id)
    if not user:
        user = create_user(
            db,
            telegram_id=data.id,
            username=data.username,
            first_name=data.first_name,
            last_name=data.last_name,
        )
    else:
        # Обновляем данные пользователя, если изменились
        if data.username != user.username:
            user.username = data.username
        if data.first_name != user.first_name:
            user.first_name = data.first_name
        if data.last_name != user.last_name:
            user.last_name = data.last_name
        db.commit()
        db.refresh(user)
        
        # Обновляем время последнего входа
        user = update_user_login_time(db, user)
    
    # Создаём сессию
    session = create_session(db, user_id=user.id, expires_in_days=30)
    
    # Устанавливаем cookie
    response.set_cookie(
        key="session_id",
        value=session.token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=30 * 24 * 60 * 60,  # 30 дней в секундах
        path="/",
    )
    
    return user


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

