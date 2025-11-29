from datetime import datetime
from typing import Optional

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from .auth_crud import get_session_by_token
from .db import SessionLocal


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware для проверки авторизации.
    Извлекает session_id из cookie, проверяет сессию и добавляет user в request.state.
    """
    
    # Роуты, которые не требуют авторизации
    PUBLIC_ROUTES = [
        "/api/health",
        "/api/auth/telegram",
        "/api/auth/logout",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/version.json",
    ]
    
    async def dispatch(self, request: Request, call_next):
        # Проверяем, нужна ли авторизация для этого роута
        path = request.url.path
        is_public = any(path.startswith(route) for route in self.PUBLIC_ROUTES)
        
        if is_public:
            return await call_next(request)
        
        # Извлекаем токен из cookie
        session_token = request.cookies.get("session_id")
        
        if not session_token:
            return Response(
                content='{"detail":"Unauthorized"}',
                status_code=status.HTTP_401_UNAUTHORIZED,
                media_type="application/json"
            )
        
        # Проверяем сессию в БД
        db = SessionLocal()
        try:
            session = get_session_by_token(db, session_token)
            if not session:
                return Response(
                    content='{"detail":"Invalid or expired session"}',
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    media_type="application/json"
                )
            
            # Добавляем пользователя в request.state
            request.state.user = session.user
            request.state.session = session
        finally:
            db.close()
        
        response = await call_next(request)
        return response

