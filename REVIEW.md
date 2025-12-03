# Полное ревью проекта allpromtsokk

## 1. Структура проекта

### Директории
- `backend/` — FastAPI backend
  - `models.py` — SQLAlchemy модели (User, Session, Prompt, PromptVersion)
  - `schemas.py` — Pydantic схемы для валидации
  - `crud.py` — CRUD операции для промптов и версий
  - `auth_crud.py` — CRUD операции для авторизации (пользователи, сессии)
  - `main.py` — FastAPI приложение, endpoints для промптов
  - `middleware.py` — AuthMiddleware для проверки токенов
  - `db.py` — настройка SQLAlchemy (SQLite)
  - `utils.py` — утилиты (slugify)
  - `routers/` — роутеры
    - `auth.py` — авторизация через Telegram
    - `admin.py` — админ-панель (управление пользователями)
- `assets/` — статические файлы (SVG логотип)
- Корень — фронтенд (vanilla JS)
  - `index.html` — HTML структура
  - `main.js` — вся логика фронтенда (2467 строк)
  - `styles.css` — стили
  - `version.json` — версия приложения
  - `prompts.json` — (не используется в коде)

---

## 2. Что за проект

**allpromtsokk** — веб-приложение для управления промптами (шаблонами текстовых инструкций) с версионированием.

**Основная функциональность:**
- Хранение промптов с поддержкой папок, тегов, уровней важности
- Редактирование промптов с Markdown-поддержкой
- История версий промптов с визуальным diff
- Авторизация через Telegram
- Роли пользователей (admin, tech, user) с разными правами доступа

**Целевая аудитория:**
- Команды, работающие с AI-промптами
- Пользователи, которым нужна версионность и организация промптов

---

## 3. Что реализовано

### Backend

**Модели данных:**
- `User` — пользователи (telegram_id, username, status, access_level, role)
- `Session` — сессии (token, expires_at, revoked_at)
- `Prompt` — промпты (slug, name, text, folder, tags, importance)
- `PromptVersion` — версии промптов (version, title, content, updated_by_user_id)

**Endpoints:**
- `GET /api/health` — проверка здоровья
- `GET /api/prompts` — список промптов (фильтры: folder, search)
- `GET /api/prompts/{slug}` — получить промпт
- `POST /api/prompts` — создать промпт (требует editor access)
- `PUT /api/prompts/{slug}` — обновить промпт (требует editor access)
- `DELETE /api/prompts/{slug}` — удалить промпт (требует editor access)
- `GET /api/prompts/{prompt_id}/versions` — список версий
- `GET /api/prompts/{prompt_id}/versions/{version_id}` — получить версию
- `POST /api/auth/telegram` — авторизация через Telegram
- `POST /api/auth/logout` — выход
- `GET /api/auth/me` — текущий пользователь
- `GET /api/admin/users` — список пользователей (admin only)
- `PATCH /api/admin/users/{user_id}` — обновить пользователя (admin only)

**Логика авторизации:**
- Middleware проверяет токен из cookie `session_token`
- Токены хранятся в БД с временем истечения
- Роли: `admin` (полный доступ), `tech` (редактирование промптов), `user` (просмотр)
- Статусы: `pending` (ожидает одобрения), `active`, `blocked`

**Интеграции:**
- Telegram Widget для авторизации (frontend)
- SQLite база данных

**Версионирование:**
- Автоматическое создание версии при создании/обновлении промпта
- Версии хранят полный текст и метаданные

### Frontend

**UI компоненты:**
- Экран логина (Telegram Widget)
- Экран ожидания одобрения
- Основной интерфейс:
  - Левая панель: дерево папок/промптов, фильтры (папка, тег, поиск)
  - Правая панель: просмотр/редактирование промпта
  - Табы: "Текст" / "История"
  - Markdown-тулбар для редактирования
  - История версий с визуальным diff (jsdiff + diff2html)

**Функциональность:**
- CRUD промптов (создание, редактирование, удаление, дублирование)
- Поиск по названию/тексту
- Фильтрация по папкам и тегам
- Drag & Drop для перемещения промптов между папками
- Автосохранение изменений (индикатор несохранённых изменений)
- Просмотр версий с выбором двух для сравнения
- Копирование текста промпта
- Горячие клавиши (Ctrl+S сохранить, Esc отмена)

**Технологии:**
- Vanilla JavaScript (без фреймворков)
- Marked.js для рендеринга Markdown
- jsdiff + diff2html для сравнения версий
- Fetch API для запросов

### Инфраструктура

**Конфигурация:**
- `requirements.txt` — зависимости Python (FastAPI, SQLAlchemy, pydantic)
- `version.json` — версия приложения
- SQLite БД (путь хардкод: `/var/www/allpromtsokk/backend/prompts.db`)

**Отсутствует:**
- Docker/Docker Compose
- nginx конфиги
- .env.example
- Скрипты деплоя
- Миграции БД (используется `Base.metadata.create_all`)

---

## 4. Технический долг и проблемы

### Архитектура

**Проблемы:**
1. **Монолитный frontend** — весь код в одном файле `main.js` (2467 строк)
   - Сложно поддерживать
   - Нет модульности
   - **Решение:** разбить на модули/компоненты

2. **Смешение ответственности** — в `main.py` и endpoints, и dependencies, и бизнес-логика
   - **Решение:** вынести endpoints в роутеры, dependencies в отдельный модуль

3. **Хардкод путей БД** — `SQLALCHEMY_DATABASE_URL = "sqlite:////var/www/allpromtsokk/backend/prompts.db"`
   - **Решение:** использовать переменные окружения

4. **Нет миграций** — используется `create_all`, миграции в `on_startup`
   - **Решение:** Alembic для миграций

5. **Дублирование логики** — `get_current_user` определён и в `main.py`, и в `auth.py`
   - **Решение:** вынести в общий модуль dependencies

### Качество кода

**Проблемы:**
1. **Отсутствие типизации** — JavaScript без TypeScript, Python без type hints в некоторых местах
   - **Решение:** добавить type hints, рассмотреть TypeScript

2. **Магические константы** — строки типа `"pending"`, `"active"` разбросаны по коду
   - **Решение:** вынести в константы/enums

3. **Дублирование кода** — повторяющиеся паттерны обработки ошибок в fetch-функциях
   - **Решение:** создать обёртку для API-запросов

4. **Большие функции** — `renderViewMode`, `loadPromptVersions` содержат много логики
   - **Решение:** разбить на меньшие функции

5. **Глобальные переменные** — множество глобальных переменных состояния
   - **Решение:** инкапсулировать в объект состояния

### Безопасность

**Проблемы:**
1. **Валидация Telegram auth** — нет проверки подписи Telegram Widget на backend
   - **Решение:** добавить проверку `hash` от Telegram

2. **SQL injection риски** — использование `.ilike()` с f-strings в некоторых местах
   - **Решение:** использовать параметризованные запросы (уже используется в основном)

3. **CORS** — не настроен явно (может быть проблема при деплое)
   - **Решение:** настроить CORS middleware

4. **Secure cookies** — `secure=True` в production требует HTTPS
   - **Решение:** проверять окружение

5. **Нет rate limiting** — возможны атаки на endpoints
   - **Решение:** добавить rate limiting middleware

6. **Отсутствие валидации входных данных** — некоторые поля не валидируются строго
   - **Решение:** усилить Pydantic схемы

### Производительность

**Проблемы:**
1. **N+1 запросы** — при загрузке версий может быть много запросов
   - **Решение:** использовать eager loading или batch-запросы

2. **Нет пагинации** — список промптов загружается целиком
   - **Решение:** добавить пагинацию

3. **SQLite в production** — не подходит для высокой нагрузки
   - **Решение:** мигрировать на PostgreSQL

4. **Нет кэширования** — каждый запрос идёт в БД
   - **Решение:** добавить кэш для часто запрашиваемых данных

---

## 5. План доработок

### Срочно (безопасность и стабильность)

1. **Безопасность:**
   - Добавить проверку подписи Telegram Widget
   - Настроить CORS
   - Добавить rate limiting
   - Усилить валидацию входных данных

2. **Конфигурация:**
   - Вынести путь БД в переменные окружения
   - Создать .env.example
   - Настроить разные конфиги для dev/prod

3. **Ошибки:**
   - Улучшить обработку ошибок (логирование, пользовательские сообщения)
   - Добавить try-catch в критических местах

### Ближайшие релизы (архитектура и качество)

1. **Рефакторинг:**
   - Разбить `main.js` на модули
   - Вынести endpoints в роутеры
   - Создать общий модуль dependencies
   - Вынести константы в отдельный файл

2. **Миграции:**
   - Настроить Alembic
   - Убрать миграции из `on_startup`

3. **Тесты:**
   - Unit-тесты для CRUD операций
   - Интеграционные тесты для API
   - E2E тесты для критических сценариев

4. **Документация:**
   - API документация (Swagger уже есть, но можно улучшить)
   - Комментарии в коде
   - README с инструкциями

### Можно отложить (улучшения)

1. **UX:**
   - Улучшить обработку ошибок (toast-уведомления вместо alert)
   - Добавить loading states
   - Оптимизировать производительность UI

2. **Функциональность:**
   - Пагинация для списка промптов
   - Экспорт/импорт промптов
   - Поиск по версиям
   - Восстановление из версии

3. **Инфраструктура:**
   - Docker контейнеризация
   - CI/CD pipeline
   - Мониторинг и логирование

4. **Оптимизации:**
   - Кэширование
   - Lazy loading для версий
   - Оптимизация запросов к БД

---

## 6. Черновики документации

### A) README.md

```markdown
# allpromtsokk

Веб-приложение для управления промптами с версионированием и авторизацией через Telegram.

## Стек

- **Backend:** FastAPI, SQLAlchemy, SQLite
- **Frontend:** Vanilla JavaScript, Marked.js, jsdiff, diff2html
- **Авторизация:** Telegram Widget

## Запуск Backend

1. Установить зависимости:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. Настроить переменные окружения (создать `.env`):
   ```
   DATABASE_URL=sqlite:///./prompts.db
   TELEGRAM_BOT_NAME=autookk_bot
   ```

3. Запустить сервер:
   ```bash
   uvicorn main:app --reload
   ```

## Запуск Frontend

1. Открыть `index.html` в браузере или использовать статический сервер:
   ```bash
   python -m http.server 8000
   ```

2. Открыть `http://localhost:8000`

## Запуск вместе

Backend должен быть доступен на `/api`, frontend на `/`.

Можно использовать nginx для проксирования или запустить backend отдельно.

## Переменные окружения

- `DATABASE_URL` — путь к БД SQLite
- `TELEGRAM_BOT_NAME` — имя Telegram бота для авторизации

## Troubleshooting

1. **Ошибка подключения к БД:**
   - Проверить путь к БД в `DATABASE_URL`
   - Убедиться, что директория существует

2. **Telegram авторизация не работает:**
   - Проверить имя бота в `TELEGRAM_BOT_NAME`
   - Убедиться, что бот настроен в Telegram

3. **CORS ошибки:**
   - Настроить CORS в FastAPI для вашего домена
```

### B) ARCHITECTURE.md

```markdown
# Архитектура проекта

## Общая схема

```
Frontend (Vanilla JS) → FastAPI Backend → SQLite Database
         ↓
    Telegram Widget (авторизация)
```

## Слои

### Frontend
- `index.html` — структура
- `main.js` — вся логика (2467 строк)
- `styles.css` — стили

### Backend
- `main.py` — FastAPI app, endpoints для промптов
- `routers/` — роутеры (auth, admin)
- `models.py` — SQLAlchemy модели
- `schemas.py` — Pydantic схемы
- `crud.py` — операции с БД
- `middleware.py` — авторизация

### Database
- SQLite с таблицами: users, sessions, prompts, prompt_versions

## Модели и связи

- `User` 1:N `Session` (cascade delete)
- `User` 1:N `PromptVersion` (через updated_by_user_id)
- `Prompt` 1:N `PromptVersion` (через prompt_id)

## Авторизация

1. Пользователь авторизуется через Telegram Widget
2. Frontend отправляет данные на `/api/auth/telegram`
3. Backend создаёт/обновляет пользователя, создаёт сессию
4. Токен сохраняется в cookie `session_token`
5. `AuthMiddleware` проверяет токен на каждом запросе
6. Пользователь добавляется в `request.state.user`

## Версионирование промптов

1. При создании промпта автоматически создаётся версия №1
2. При обновлении создаётся новая версия (номер = последний + 1)
3. Версии хранят полный текст и метаданные
4. Frontend может запросить список версий и сравнить две версии

## Поток данных: создание промпта

1. Frontend: `createPrompt(data)` → `POST /api/prompts`
2. Backend: `create_prompt()` в `crud.py`
3. Создаётся `Prompt` в БД
4. Автоматически создаётся `PromptVersion` (версия 1)
5. Возвращается `PromptOut` во frontend
6. Frontend обновляет UI
```

### C) API.md

```markdown
# API Документация

## Авторизация

### POST /api/auth/telegram
Авторизация через Telegram.

**Тело:**
```json
{
  "id": 123456789,
  "username": "user",
  "first_name": "Name",
  "last_name": "Last"
}
```

**Ответ:**
```json
{
  "token": "session_token",
  "user": { ... }
}
```

### POST /api/auth/logout
Выход из системы.

### GET /api/auth/me
Получить текущего пользователя.

## Промпты

### GET /api/prompts
Список промптов.

**Параметры:**
- `folder` (optional) — фильтр по папке
- `search` (optional) — поиск по названию/тексту

**Ответ:** `List[PromptOut]`

### GET /api/prompts/{slug}
Получить промпт по slug.

**Ответ:** `PromptOut`

### POST /api/prompts
Создать промпт. Требует editor access.

**Тело:**
```json
{
  "name": "Название",
  "text": "Текст",
  "folder": "папка",
  "tags": "тег1,тег2",
  "importance": "normal"
}
```

**Ответ:** `PromptOut`

### PUT /api/prompts/{slug}
Обновить промпт. Требует editor access.

**Тело:** `PromptUpdate` (все поля optional)

**Ответ:** `PromptOut`

### DELETE /api/prompts/{slug}
Удалить промпт. Требует editor access.

## Версии

### GET /api/prompts/{prompt_id}/versions
Список версий промпта.

**Ответ:** `List[PromptVersionBase]`

### GET /api/prompts/{prompt_id}/versions/{version_id}
Получить версию.

**Ответ:** `PromptVersionDetail`

## Админ

### GET /api/admin/users
Список пользователей. Admin only.

**Ответ:** `List[UserOut]`

### PATCH /api/admin/users/{user_id}
Обновить пользователя. Admin only.

**Тело:**
```json
{
  "status": "active",
  "access_level": "admin"
}
```

**Ответ:** `UserOut`
```

### D) DEV.md

```markdown
# Руководство разработчика

## Внесение изменений

1. **Новые endpoints:**
   - Добавить в соответствующий роутер (`routers/auth.py`, `routers/admin.py`)
   - Или создать новый роутер и подключить в `main.py`

2. **Новые модели:**
   - Добавить в `models.py`
   - Создать схемы в `schemas.py`
   - Добавить CRUD операции в `crud.py` или отдельный файл

3. **Изменения в UI:**
   - Структура: `index.html`
   - Логика: `main.js` (разбить на функции)
   - Стили: `styles.css`

## Обновление зависимостей

**Backend:**
```bash
pip install -r requirements.txt
pip freeze > requirements.txt  # после установки новых
```

**Frontend:**
Библиотеки подключаются через CDN в `index.html`.

## Миграции БД

Сейчас используется `Base.metadata.create_all()`.

**Планируется:** Alembic для миграций.

**Временное решение:** изменения моделей применяются автоматически при старте.

## Стиль кода

**Python:**
- PEP 8
- Type hints где возможно
- Docstrings для функций

**JavaScript:**
- camelCase для переменных/функций
- Комментарии для сложной логики
- Разделение на секции (API, UI, Events)

## Структура файлов

```
backend/
  models.py       # модели БД
  schemas.py      # Pydantic схемы
  crud.py         # CRUD для промптов
  auth_crud.py    # CRUD для авторизации
  main.py         # FastAPI app, endpoints промптов
  routers/        # роутеры
    auth.py       # авторизация
    admin.py      # админ-панель
  middleware.py   # авторизация middleware
  db.py           # настройка БД
  utils.py        # утилиты

frontend/
  index.html      # структура
  main.js         # вся логика
  styles.css      # стили
```

## Тестирование

**Планируется:**
- Unit-тесты для CRUD
- Интеграционные тесты для API
- E2E тесты для UI

**Сейчас:** ручное тестирование.
```

### E) PROMPTS.md

```markdown
# Модель промптов

## Структура промпта

- `id` — уникальный ID
- `slug` — URL-friendly идентификатор (уникальный)
- `name` — название
- `text` — текст промпта (Markdown)
- `folder` — папка (optional)
- `tags` — теги через запятую (optional)
- `importance` — важность: "normal", "important", "test"
- `created_at`, `updated_at` — временные метки

## Версионирование

- Каждое сохранение создаёт новую версию
- Версии нумеруются: 1, 2, 3...
- Версия хранит:
  - `version` — номер версии
  - `title` — название (копия из Prompt.name)
  - `content` — текст (копия из Prompt.text)
  - `updated_by_user_id` — кто изменил
  - `created_at` — когда создана

## Теги и метаданные

- Теги хранятся как строка: `"тег1,тег2,тег3"`
- Разделитель: запятая
- Фильтрация по тегам на frontend

## Важность (importance)

- `normal` — обычный промпт
- `important` — важный (визуально выделяется)
- `test` — тестовый

## Правила формулировки

Не определены в коде. Промпты — это произвольный Markdown-текст.

## Добавление полей

1. Добавить колонку в `Prompt` модель (`models.py`)
2. Добавить поле в схемы (`schemas.py`)
3. Обновить CRUD операции (`crud.py`)
4. Обновить UI (`main.js`, `index.html`)
5. Создать миграцию (когда будет Alembic)
```

### F) ROADMAP.md

```markdown
# Roadmap

## Текущая версия: 1.0.22

## Сделано

### Backend
- ✅ Модели: User, Session, Prompt, PromptVersion
- ✅ Авторизация через Telegram
- ✅ CRUD промптов
- ✅ Версионирование промптов
- ✅ Роли и права доступа
- ✅ Админ-панель для управления пользователями

### Frontend
- ✅ Интерфейс управления промптами
- ✅ Редактирование с Markdown-тулбаром
- ✅ История версий
- ✅ Визуальное сравнение версий (diff)
- ✅ Поиск и фильтрация
- ✅ Drag & Drop

### UX
- ✅ Горячие клавиши
- ✅ Автосохранение
- ✅ Индикатор несохранённых изменений

## В работе / Планируется

### Backend
- [ ] Рефакторинг архитектуры (роутеры, dependencies)
- [ ] Миграции (Alembic)
- [ ] Проверка подписи Telegram
- [ ] Rate limiting
- [ ] Улучшенная валидация
- [ ] Тесты

### Frontend
- [ ] Модульная структура (разбить main.js)
- [ ] Улучшенная обработка ошибок
- [ ] Loading states
- [ ] Пагинация

### UX
- [ ] Toast-уведомления
- [ ] Экспорт/импорт промптов
- [ ] Восстановление из версии
- [ ] Поиск по версиям

### Инфраструктура
- [ ] Docker контейнеризация
- [ ] CI/CD
- [ ] Мониторинг
- [ ] Логирование
- [ ] Миграция на PostgreSQL
```






