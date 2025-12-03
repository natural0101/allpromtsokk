from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Tuple

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from .settings import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Простой in-memory rate limiting middleware.
    Хранит счётчики запросов по ключу (ip, endpoint).
    """
    
    def __init__(self, app, enabled: bool = True, limits: Dict[str, int] = None):
        super().__init__(app)
        self.enabled = enabled
        # Словарь: (ip, endpoint) -> список timestamps
        self.requests: Dict[Tuple[str, str], list] = defaultdict(list)
        # Лимиты по умолчанию: endpoint -> запросов в минуту
        self.limits = limits or {
            "/api/auth/telegram": settings.RATE_LIMIT_AUTH_PER_MINUTE,
        }
        # Очистка старых записей каждые N запросов
        self._cleanup_counter = 0
        self._cleanup_interval = 100
    
    def _get_client_ip(self, request: Request) -> str:
        """Получить IP адрес клиента."""
        # Проверяем заголовки прокси
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Берём первый IP из списка
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback на client.host
        if hasattr(request, "client") and request.client:
            return request.client.host
        
        return "unknown"
    
    def _cleanup_old_requests(self):
        """Удалить старые записи (старше 1 минуты)."""
        self._cleanup_counter += 1
        if self._cleanup_counter < self._cleanup_interval:
            return
        
        self._cleanup_counter = 0
        cutoff_time = datetime.utcnow() - timedelta(minutes=1)
        
        keys_to_remove = []
        for key, timestamps in self.requests.items():
            # Оставляем только timestamps за последнюю минуту
            filtered = [ts for ts in timestamps if ts > cutoff_time]
            if filtered:
                self.requests[key] = filtered
            else:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.requests[key]
    
    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)
        
        path = request.url.path
        
        # Проверяем, есть ли лимит для этого endpoint
        limit = None
        for endpoint, endpoint_limit in self.limits.items():
            if path.startswith(endpoint):
                limit = endpoint_limit
                break
        
        if limit is None:
            # Нет лимита для этого endpoint
            return await call_next(request)
        
        # Получаем IP клиента
        client_ip = self._get_client_ip(request)
        key = (client_ip, path)
        
        # Очистка старых записей
        self._cleanup_old_requests()
        
        # Получаем текущее время
        now = datetime.utcnow()
        cutoff_time = now - timedelta(minutes=1)
        
        # Фильтруем старые запросы
        timestamps = self.requests[key]
        timestamps = [ts for ts in timestamps if ts > cutoff_time]
        
        # Проверяем лимит
        if len(timestamps) >= limit:
            return Response(
                content='{"detail":"Too many requests"}',
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                media_type="application/json",
                headers={"Retry-After": "60"}
            )
        
        # Добавляем текущий запрос
        timestamps.append(now)
        self.requests[key] = timestamps
        
        # Продолжаем обработку запроса
        response = await call_next(request)
        return response



