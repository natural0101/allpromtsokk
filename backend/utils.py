import hmac
import hashlib
import re
import time
import unicodedata
from typing import Dict, Any


def slugify(name: str) -> str:
    """
    Normalize string to ASCII, replace non-alphanumeric chars with dashes,
    lowercase, strip extra dashes. If empty, return 'prompt'.
    """
    if not name:
        return "prompt"

    # Normalize to NFKD and encode to ASCII
    normalized = unicodedata.normalize("NFKD", name)
    ascii_str = normalized.encode("ascii", "ignore").decode("ascii")

    # Replace non-alphanumeric with dashes
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_str)
    slug = slug.strip("-").lower()

    if not slug:
        slug = "prompt"

    return slug


def verify_telegram_auth(data: Dict[str, Any], bot_token: str) -> bool:
    """
    Проверка подписи Telegram Login Widget.
    
    Алгоритм согласно https://core.telegram.org/widgets/login#checking-authorization:
    1. Все поля кроме 'hash' сортируются по ключу
    2. Формируется строка "key=value\nkey2=value2\n..."
    3. Вычисляется HMAC-SHA256 от этой строки с секретом бота
    4. Сравнивается с переданным hash (constant-time сравнение)
    
    Args:
        data: Словарь с данными от Telegram (id, first_name, username, auth_date, hash и т.д.)
        bot_token: Токен бота (TELEGRAM_BOT_TOKEN)
    
    Returns:
        True если подпись валидна, False иначе
    """
    if not bot_token:
        return False
    
    if "hash" not in data:
        return False
    
    # Создаём копию, чтобы не изменять исходный словарь
    data_copy = dict(data)
    received_hash = data_copy.pop("hash")
    
    # Проверка времени (auth_date не должен быть старше 24 часов)
    if "auth_date" in data_copy:
        try:
            auth_date = int(data_copy["auth_date"])
            current_time = int(time.time())
            # Проверяем, что auth_date не старше 24 часов
            if current_time - auth_date > 86400:  # 24 часа в секундах
                return False
        except (ValueError, TypeError):
            return False
    
    # Сортируем поля по ключу (кроме hash, который уже удалён)
    sorted_data = sorted(data_copy.items())
    
    # Формируем строку "key=value\nkey2=value2\n..."
    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted_data)
    
    # Вычисляем секретный ключ: SHA256 от bot_token
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    
    # Вычисляем HMAC-SHA256
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # Constant-time сравнение
    return hmac.compare_digest(calculated_hash, received_hash)



