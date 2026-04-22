# TaskFlow Pro 🚀

**Корпоративный планировщик задач с канбан-доской и ролевой моделью**

[![Django](https://img.shields.io/badge/Django-6.0.4-092E20?logo=django)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-19.2.4-61DAFB?logo=react)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 📋 О проекте

TaskFlow Pro — современная веб-платформа для управления задачами и проектами с канбан-доской, списком задач, календарем и гибкой системой ролей.

### ✨ Основные возможности

| Функция | Описание |
|---------|----------|
| 📊 Дашборд | Статистика по задачам |
| 🎯 Канбан-доска | Колонки: "К выполнению", "В работе", "На проверке", "Завершено" |
| 📋 Список задач | Фильтрация и поиск |
| 📅 Календарь | Отображение дедлайнов |
| 👥 Ролевая модель | Администратор, Менеджер, Исполнитель, Наблюдатель |
| 🔐 JWT-аутентификация | Автоматическое обновление токенов |
| 📎 Приоритеты | Низкий, Средний, Высокий, Критический |
| ⏰ Отслеживание времени | Оценка и фактические часы |
| 📝 Логирование | Все действия пользователей |

## 🏗 Технологический стек

**Бэкенд:** Django 6.0.4, DRF, JWT, PostgreSQL, django-filter, drf-spectacular

**Фронтенд:** React 19, React Router 7, Zustand, Vite, Axios


## 🚀 Установка и запуск

### Требования
- Python 3.12+
- Node.js 18+
- PostgreSQL 16 (или SQLite)

### Бэкенд

```bash
# 1. Клонирование и переход в папку
git clone <repository-url>
cd Task-Scheduler/project

# 2. Создание виртуального окружения
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 3. Установка зависимостей
cd controlflow
pip install -r requirements.txt

# 4. Создание файла .env
echo SECRET_KEY=your-secret-key > .env
echo DEBUG=True >> .env
echo ALLOWED_HOSTS=localhost,127.0.0.1 >> .env
echo DB_PASSWORD=your-db-password >> .env
echo CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173 >> .env

# 5. Миграции и создание суперпользователя
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser

# 6. Запуск сервера
python manage.py runserver

# В новой терминале
cd ../frontend
npm install
npm run dev
