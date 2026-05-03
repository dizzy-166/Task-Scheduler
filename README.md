# ControlFlow

**Корпоративный планировщик задач с Kanban-доской, ролевой моделью и AI-генерацией задач**

[![Django](https://img.shields.io/badge/Django-6.0.4-092E20?logo=django)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 🌐 Демо

| Сервис | Ссылка |
|--------|--------|
| Фронтенд (Vercel) | https://task-scheduler-snowy.vercel.app |
| Бэкенд API (Render) | https://flow-2wq1.onrender.com/api/v1/ |
| API-документация | https://flow-2wq1.onrender.com/api/docs/ |

> Render использует бесплатный план — первый запрос может занять ~30 сек (cold start).

## ✨ Функциональность

| Раздел | Возможности |
|--------|-------------|
| 🏠 Главная | Обзор активных задач и дедлайнов |
| 📊 Kanban | Drag-and-drop, настраиваемые колонки, фильтрация по проекту |
| 📋 Список | Таблица задач с сортировкой и поиском |
| 📅 Gantt | Диаграмма Ганта с временной шкалой |
| 🤖 AI-генерация | Создание задач по описанию проекта (Cerebras Llama 3.1) |
| 📊 AI-анализ | Анализ состояния задач и рекомендации через ИИ |
| ✉️ Email | Верификация при регистрации, сброс пароля по ссылке |
| ⏱ Таймер | Встроенный трекер времени с историей |
| 📝 Подзадачи | Иерархия задач с прогресс-баром |
| 💬 Чат | Общение внутри компании в реальном времени |
| 🔔 Уведомления | Лента событий по задачам и проектам |
| 👥 Компании | Мультитенантность — несколько компаний на аккаунт |
| 🗂 Проекты | Фильтрация задач по проекту |
| 🔑 Роли | Owner / Admin / Member + кастомные роли с гибкими правами |
| 📈 Аналитика | Отчёты по задачам и участникам |
| 🌓 Темы | Светлая и тёмная тема |

## 🏗 Стек

**Бэкенд**
- Django 6.0.4 + Django REST Framework
- PostgreSQL (Render Managed PostgreSQL)
- SimpleJWT — авторизация по токенам
- drf-spectacular — авто-генерация OpenAPI-документации
- Whitenoise — раздача статики
- Gunicorn — WSGI-сервер в production
- Cerebras API (Llama 3.1 8B) — AI-генерация задач и аналитика
- Brevo — отправка email (верификация, сброс пароля)

**Фронтенд**
- React 19 + Vite
- React Router 7
- Zustand — управление состоянием
- Axios — HTTP-клиент

**Деплой**
- Backend → [Render](https://render.com) (Web Service + PostgreSQL)
- Frontend → [Vercel](https://vercel.com)

## 🚀 Локальный запуск

### Требования
- Python 3.12+
- Node.js 18+
- PostgreSQL 16

### Бэкенд

```bash
git clone https://github.com/dizzy-166/Task-Scheduler.git
cd Task-Scheduler/project/controlflow

python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
```

Создай файл `.env` в папке `project/controlflow/`:

```env
SECRET_KEY=django-insecure-замени-меня
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=controlflow
DB_USER=postgres
DB_PASSWORD=твой_пароль
DB_HOST=localhost
DB_PORT=5432
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
BREVO_API_KEY=твой_brevo_ключ
DEFAULT_FROM_EMAIL=noreply@example.com
FRONTEND_URL=http://localhost:5173
```

```bash
python manage.py migrate
python manage.py createsuperuser  # опционально
python manage.py runserver
```

### Фронтенд

```bash
cd Task-Scheduler/project/frontend
npm install
npm run dev
```

Открой http://localhost:5173, зарегистрируйся и создай компанию.

## ☁️ Деплой на Render + Vercel

### Render (бэкенд)

1. New → **Web Service**, Root Directory: `project/controlflow`
2. Build Command: `pip install -r requirements.txt && python manage.py migrate`
3. Start Command: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2`
4. Создай **PostgreSQL** базу и подключи через переменные окружения:

| Переменная | Значение |
|------------|---------|
| `SECRET_KEY` | случайная строка |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | `.onrender.com,localhost` |
| `DB_NAME` | из Render PostgreSQL |
| `DB_USER` | из Render PostgreSQL |
| `DB_PASSWORD` | из Render PostgreSQL |
| `DB_HOST` | из Render PostgreSQL |
| `DB_PORT` | `5432` |
| `CORS_ALLOWED_ORIGINS` | URL фронтенда на Vercel |
| `BREVO_API_KEY` | Ключ Brevo для отправки email |
| `DEFAULT_FROM_EMAIL` | Адрес отправителя |
| `FRONTEND_URL` | URL фронтенда (для ссылок в письмах) |

### Vercel (фронтенд)

1. Импортируй репозиторий, Root Directory: `project/frontend`
2. Добавь переменные окружения:

```
VITE_API_URL=https://<твой-сервис>.onrender.com/api/v1
VITE_CEREBRAS_API_KEY=твой_cerebras_ключ
```

> AI-запросы идут напрямую из браузера на Cerebras API — Render не участвует.

## 📁 Структура проекта

```
Task-Scheduler/
├── project/
│   ├── controlflow/          # Django бэкенд
│   │   ├── apps/
│   │   │   ├── users/        # Пользователи, роли, права
│   │   │   ├── companies/    # Компании и участники
│   │   │   ├── tasks/        # Задачи, Kanban, проекты
│   │   │   ├── activity/     # Лог активности
│   │   │   └── chat/         # Чат и уведомления
│   │   ├── config/           # Настройки Django
│   │   ├── requirements.txt
│   │   └── Procfile
│   └── frontend/             # React фронтенд
│       ├── src/
│       │   ├── pages/        # DashboardPage и др.
│       │   ├── components/   # Компоненты UI
│       │   ├── store/        # Zustand-хранилища
│       │   └── api/          # Axios-сервисы
│       └── vite.config.js
└── README.md
```

## 📄 Лицензия

MIT
