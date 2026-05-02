-- ============================================================
-- ControlFlow — Demo Seed
-- 12 сотрудников · 6 проектов · 56 задач (с подзадачами) · 12 комментариев
--
-- ПРИМЕНЕНИЕ:
--   psql -U <user> -d <db> -f seed_demo.sql
--   или через DBeaver: Open SQL Script → Execute
--
-- ПАРОЛИ — после выполнения скрипта запустить в терминале:
--   python manage.py shell -c "
--   from apps.users.models import User
--   users = User.objects.filter(email__endswith='@demo.cf')
--   for u in users:
--       u.set_password('Test1234!')
--       u.save()
--   print(f'OK: установлен пароль Test1234! для {users.count()} пользователей')
--   "
-- ============================================================

DO $$
DECLARE
  -- ── Пользователи ────────────────────────────────────────────
  u1  uuid := gen_random_uuid();  -- Иванов Денис       (owner, CEO)
  u2  uuid := gen_random_uuid();  -- Петрова Анна        (admin, PM)
  u3  uuid := gen_random_uuid();  -- Сидоров Сергей      (admin, Tech Lead)
  u4  uuid := gen_random_uuid();  -- Козлова Ольга       (member, Backend Dev)
  u5  uuid := gen_random_uuid();  -- Морозов Иван        (member, Frontend Dev)
  u6  uuid := gen_random_uuid();  -- Волкова Елена       (member, Designer)
  u7  uuid := gen_random_uuid();  -- Новиков Дмитрий     (member, Full-stack Dev)
  u8  uuid := gen_random_uuid();  -- Соколова Наташа     (member, QA Engineer)
  u9  uuid := gen_random_uuid();  -- Лебедев Алексей     (member, Backend Dev)
  u10 uuid := gen_random_uuid();  -- Попова Марина       (member, Analyst)
  u11 uuid := gen_random_uuid();  -- Зайцев Виктор       (member, DevOps)
  u12 uuid := gen_random_uuid();  -- Фёдорова Татьяна    (member, PM)

  -- ── Компания ────────────────────────────────────────────────
  c1  uuid := gen_random_uuid();

  -- ── Kanban-колонки ──────────────────────────────────────────
  col1 uuid := gen_random_uuid();  -- Новые
  col2 uuid := gen_random_uuid();  -- В работе
  col3 uuid := gen_random_uuid();  -- На проверке
  col4 uuid := gen_random_uuid();  -- Готово

  -- ── Проекты ─────────────────────────────────────────────────
  p1 uuid := gen_random_uuid();  -- Мобильное приложение v2.0
  p2 uuid := gen_random_uuid();  -- Редизайн корпоративного сайта
  p3 uuid := gen_random_uuid();  -- CRM-интеграция
  p4 uuid := gen_random_uuid();  -- Внутренний HR-портал
  p5 uuid := gen_random_uuid();  -- Миграция на Kubernetes
  p6 uuid := gen_random_uuid();  -- Маркетинговая кампания Q3

  -- ── Родительские задачи (для подзадач и комментариев) ───────
  tp1 uuid := gen_random_uuid();  -- Система аутентификации       (p1)
  tp2 uuid := gen_random_uuid();  -- Новый главный экран           (p2)
  tp3 uuid := gen_random_uuid();  -- API-адаптер для CRM           (p3)
  tp4 uuid := gen_random_uuid();  -- Проектирование БД HR         (p4)
  tp5 uuid := gen_random_uuid();  -- Контейнеризация сервисов     (p5)
  tp6 uuid := gen_random_uuid();  -- Контент-план кампании         (p6)

BEGIN

  -- ===========================================================
  -- 1. ПОЛЬЗОВАТЕЛИ
  -- ===========================================================
  INSERT INTO users_user (
    id, email, password,
    first_name, last_name, patronymic,
    is_active, is_verified, is_staff, is_superuser,
    deleted_at, last_login, created_at, updated_at
  ) VALUES
  (u1,  'denis.ivanov@demo.cf',    '!', 'Денис',   'Иванов',   'Александрович', true, true, false, false, null, null, NOW()-'180 days'::interval, NOW()),
  (u2,  'anna.petrova@demo.cf',    '!', 'Анна',    'Петрова',  'Сергеевна',     true, true, false, false, null, null, NOW()-'175 days'::interval, NOW()),
  (u3,  'sergei.sidorov@demo.cf',  '!', 'Сергей',  'Сидоров',  'Николаевич',    true, true, false, false, null, null, NOW()-'160 days'::interval, NOW()),
  (u4,  'olga.kozlova@demo.cf',    '!', 'Ольга',   'Козлова',  'Ивановна',      true, true, false, false, null, null, NOW()-'155 days'::interval, NOW()),
  (u5,  'ivan.morozov@demo.cf',    '!', 'Иван',    'Морозов',  'Петрович',      true, true, false, false, null, null, NOW()-'130 days'::interval, NOW()),
  (u6,  'elena.volkova@demo.cf',   '!', 'Елена',   'Волкова',  'Дмитриевна',    true, true, false, false, null, null, NOW()-'120 days'::interval, NOW()),
  (u7,  'dmitry.novikov@demo.cf',  '!', 'Дмитрий', 'Новиков',  'Олегович',      true, true, false, false, null, null, NOW()-'100 days'::interval, NOW()),
  (u8,  'natasha.sokolova@demo.cf','!', 'Наталья', 'Соколова', 'Игоревна',      true, true, false, false, null, null, NOW()-'90 days'::interval,  NOW()),
  (u9,  'alexei.lebedev@demo.cf',  '!', 'Алексей', 'Лебедев',  'Викторович',    true, true, false, false, null, null, NOW()-'75 days'::interval,  NOW()),
  (u10, 'marina.popova@demo.cf',   '!', 'Марина',  'Попова',   'Андреевна',     true, true, false, false, null, null, NOW()-'65 days'::interval,  NOW()),
  (u11, 'viktor.zaitsev@demo.cf',  '!', 'Виктор',  'Зайцев',   'Семёнович',     true, true, false, false, null, null, NOW()-'45 days'::interval,  NOW()),
  (u12, 'tatyana.fedorova@demo.cf','!', 'Татьяна', 'Фёдорова', 'Михайловна',    true, true, false, false, null, null, NOW()-'40 days'::interval,  NOW());

  -- ===========================================================
  -- 2. КОМПАНИЯ
  -- ===========================================================
  INSERT INTO companies_company (id, name, description, owner_id, deleted_at, created_at, updated_at)
  VALUES (
    c1,
    'ControlFlow Demo Inc.',
    'Демонстрационная компания. Разрабатываем мобильные и веб-приложения, поддерживаем собственную инфраструктуру и растём с помощью data-driven маркетинга.',
    u1, null, NOW()-'180 days'::interval, NOW()
  );

  -- ===========================================================
  -- 3. KANBAN-КОЛОНКИ
  -- ===========================================================
  INSERT INTO kanban_columns (id, company_id, name, color, "order", status_key, created_at)
  VALUES
  (col1, c1, 'Новые',       '#6B7280', 0, 'new',         NOW()-'180 days'::interval),
  (col2, c1, 'В работе',    '#2196F3', 1, 'in_progress', NOW()-'180 days'::interval),
  (col3, c1, 'На проверке', '#FF9800', 2, 'review',      NOW()-'180 days'::interval),
  (col4, c1, 'Готово',      '#4CAF50', 3, 'done',        NOW()-'180 days'::interval);

  -- ===========================================================
  -- 4. УЧАСТНИКИ КОМПАНИИ
  -- ===========================================================
  INSERT INTO companies_companymember
    (id, company_id, user_id, role, status, invited_by_id, joined_at, created_at)
  VALUES
  (gen_random_uuid(), c1, u1,  'owner',  'active', null, NOW()-'180 days'::interval, NOW()-'180 days'::interval),
  (gen_random_uuid(), c1, u2,  'admin',  'active', u1,   NOW()-'175 days'::interval, NOW()-'175 days'::interval),
  (gen_random_uuid(), c1, u3,  'admin',  'active', u1,   NOW()-'160 days'::interval, NOW()-'160 days'::interval),
  (gen_random_uuid(), c1, u4,  'member', 'active', u2,   NOW()-'155 days'::interval, NOW()-'155 days'::interval),
  (gen_random_uuid(), c1, u5,  'member', 'active', u2,   NOW()-'130 days'::interval, NOW()-'130 days'::interval),
  (gen_random_uuid(), c1, u6,  'member', 'active', u2,   NOW()-'120 days'::interval, NOW()-'120 days'::interval),
  (gen_random_uuid(), c1, u7,  'member', 'active', u3,   NOW()-'100 days'::interval, NOW()-'100 days'::interval),
  (gen_random_uuid(), c1, u8,  'member', 'active', u3,   NOW()-'90 days'::interval,  NOW()-'90 days'::interval),
  (gen_random_uuid(), c1, u9,  'member', 'active', u2,   NOW()-'75 days'::interval,  NOW()-'75 days'::interval),
  (gen_random_uuid(), c1, u10, 'member', 'active', u1,   NOW()-'65 days'::interval,  NOW()-'65 days'::interval),
  (gen_random_uuid(), c1, u11, 'member', 'active', u3,   NOW()-'45 days'::interval,  NOW()-'45 days'::interval),
  (gen_random_uuid(), c1, u12, 'member', 'active', u1,   NOW()-'40 days'::interval,  NOW()-'40 days'::interval);

  -- ===========================================================
  -- 5. ПРОЕКТЫ
  -- ===========================================================
  INSERT INTO projects
    (id, name, description, code, status, company_id, owner_id, manager_id,
     start_date, end_date, deadline, deleted_at, created_at, updated_at)
  VALUES
  (p1,
   'Мобильное приложение v2.0',
   'Разработка второй версии мобильного приложения для iOS и Android. Новый дизайн, push-уведомления, офлайн-режим, биометрическая аутентификация.',
   'MOB-V2', 'active', c1, u1, u2,
   CURRENT_DATE-90, null, CURRENT_DATE+60,
   null, NOW()-'90 days'::interval, NOW()),

  (p2,
   'Редизайн корпоративного сайта',
   'Полный редизайн под новый брендбук: адаптивная вёрстка, интеграция с Strapi CMS, SEO-оптимизация.',
   'SITE-REV', 'active', c1, u2, u12,
   CURRENT_DATE-60, null, CURRENT_DATE+30,
   null, NOW()-'60 days'::interval, NOW()),

  (p3,
   'CRM-интеграция',
   'Двусторонняя синхронизация с HubSpot: контакты, сделки, активность. Вебхуки + Celery-очередь.',
   'CRM-INT', 'active', c1, u3, u3,
   CURRENT_DATE-45, null, CURRENT_DATE+45,
   null, NOW()-'45 days'::interval, NOW()),

  (p4,
   'Внутренний HR-портал',
   'Онбординг, заявки на отпуск, KPI-дашборд, оргструктура. Приостановлен до Q4.',
   'HR-PORTAL', 'on_hold', c1, u1, u12,
   CURRENT_DATE-120, null, CURRENT_DATE+90,
   null, NOW()-'120 days'::interval, NOW()),

  (p5,
   'Миграция на Kubernetes',
   'Перевод всей инфраструктуры на k8s: Helm-чарты, Ingress, мониторинг Prometheus/Grafana, CI/CD.',
   'K8S-MIG', 'active', c1, u3, u11,
   CURRENT_DATE-30, null, CURRENT_DATE+90,
   null, NOW()-'30 days'::interval, NOW()),

  (p6,
   'Маркетинговая кампания Q3',
   'Контент для соцсетей, email-рассылки, Google Ads, A/B-тест лендинга. Кампания успешно завершена.',
   'MKT-Q3', 'completed', c1, u2, u10,
   CURRENT_DATE-180, CURRENT_DATE-30, CURRENT_DATE-30,
   null, NOW()-'180 days'::interval, NOW()-'30 days'::interval);

  -- ===========================================================
  -- 6. ЗАДАЧИ — P1: Мобильное приложение v2.0
  -- ===========================================================

  -- Родительская задача
  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     kanban_column_id, status, priority, start_date, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES (tp1,
    'Разработать систему аутентификации',
    'OAuth2 + JWT, экраны входа/регистрации/восстановления, refresh token в httpOnly cookie.',
    c1, p1, u2, u4, col2, 'in_progress', 'high',
    NOW()-'30 days'::interval, NOW()+'7 days'::interval,
    40, 22, null, NOW()-'30 days'::interval, NOW());

  -- Подзадачи tp1
  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     parent_task_id, kanban_column_id, status, priority, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES
  (gen_random_uuid(),
   'Интегрировать Google OAuth',
   'Кнопка «Войти через Google» + серверная верификация id_token.',
   c1, p1, u4, u4, tp1, col4, 'done', 'high',
   NOW()-'5 days'::interval, 8, 8, null, NOW()-'20 days'::interval, NOW()),

  (gen_random_uuid(),
   'Экран восстановления пароля',
   'One-time токен на email, форма смены пароля, TTL 15 мин.',
   c1, p1, u4, u5, tp1, col2, 'in_progress', 'medium',
   NOW()+'5 days'::interval, 8, 3, null, NOW()-'10 days'::interval, NOW()),

  (gen_random_uuid(),
   'Юнит-тесты авторизации',
   'Покрытие >80%: login, register, refresh, logout, revoke.',
   c1, p1, u8, u8, tp1, col1, 'new', 'medium',
   NOW()+'10 days'::interval, 6, null, null, NOW()-'5 days'::interval, NOW());

  -- Остальные задачи p1
  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     kanban_column_id, status, priority, start_date, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES
  (gen_random_uuid(),
   'Спроектировать дизайн-систему',
   'Компоненты: кнопки, инпуты, карточки, навигация. Figma + Storybook.',
   c1, p1, u2, u6, col3, 'review', 'high',
   NOW()-'40 days'::interval, NOW()+'3 days'::interval,
   60, 55, null, NOW()-'40 days'::interval, NOW()),

  (gen_random_uuid(),
   'Реализовать push-уведомления',
   'Firebase Cloud Messaging для iOS и Android. Топики, тихие уведомления.',
   c1, p1, u2, u7, col2, 'in_progress', 'critical',
   NOW()-'10 days'::interval, NOW()+'14 days'::interval,
   32, 10, null, NOW()-'10 days'::interval, NOW()),

  (gen_random_uuid(),
   'Офлайн-режим и синхронизация',
   'SQLite-кэш на устройстве, очередь операций при отсутствии сети, merge-стратегия.',
   c1, p1, u1, u9, col1, 'new',
   NOW()-'5 days'::interval, NOW()+'30 days'::interval,
   NOW()+'30 days'::interval, null, null, NOW()-'5 days'::interval, NOW()),

  (gen_random_uuid(),
   'Экран профиля пользователя',
   'Аватар, редактирование данных, смена пароля, удаление аккаунта.',
   c1, p1, u2, u4, col4, 'done', 'medium',
   NOW()-'50 days'::interval, NOW()-'10 days'::interval,
   16, 14, null, NOW()-'50 days'::interval, NOW()-'10 days'::interval),

  (gen_random_uuid(),
   'Интеграционное тестирование API',
   'Postman-коллекция + Newman в CI. Покрытие всех эндпоинтов мобильного API.',
   c1, p1, u8, u8, col2, 'in_progress', 'high',
   NOW()-'7 days'::interval, NOW()+'7 days'::interval,
   20, 8, null, NOW()-'7 days'::interval, NOW()),

  (gen_random_uuid(),
   'Оптимизация размера APK/IPA',
   'ProGuard/R8, удаление неиспользуемых ресурсов, tree shaking, сплит по ABI.',
   c1, p1, u3, u7, col1, 'new', 'low',
   null, NOW()+'45 days'::interval,
   12, null, null, NOW()-'2 days'::interval, NOW()),

  (gen_random_uuid(),
   'Настроить CI/CD для мобильного',
   'GitHub Actions: lint → test → build → деплой в TestFlight и Play Internal Track.',
   c1, p1, u3, u11, col2, 'in_progress', 'medium',
   NOW()-'15 days'::interval, NOW()+'10 days'::interval,
   24, 12, null, NOW()-'15 days'::interval, NOW());

  -- ===========================================================
  -- 7. ЗАДАЧИ — P2: Редизайн корпоративного сайта
  -- ===========================================================

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     kanban_column_id, status, priority, start_date, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES (tp2,
    'Разработать новый главный экран',
    'Hero-секция с видео-фоном, анимации появления, CTA-кнопка. Адаптив 320-1920px.',
    c1, p2, u2, u6, col3, 'review', 'high',
    NOW()-'20 days'::interval, NOW()+'5 days'::interval,
    24, 20, null, NOW()-'20 days'::interval, NOW());

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     parent_task_id, kanban_column_id, status, priority, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES
  (gen_random_uuid(),
   'CSS-анимация hero-секции',
   'Анимация появления заголовка, подзаголовка и кнопки. Intersection Observer.',
   c1, p2, u6, u6, tp2, col4, 'done', 'medium',
   NOW()-'3 days'::interval, 8, 8, null, NOW()-'15 days'::interval, NOW()),

  (gen_random_uuid(),
   'Адаптивная вёрстка < 768px',
   'Мобильная верстка главной: гамбургер-меню, стек-секции.',
   c1, p2, u6, u5, tp2, col3, 'review', 'high',
   NOW()+'3 days'::interval, 6, 5, null, NOW()-'8 days'::interval, NOW()),

  (gen_random_uuid(),
   'Кросс-браузерное тестирование',
   'Chrome, Firefox, Safari, Edge, Samsung Internet. BrowserStack.',
   c1, p2, u8, u8, tp2, col1, 'new', 'low',
   NOW()+'7 days'::interval, 4, null, null, NOW()-'2 days'::interval, NOW());

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     kanban_column_id, status, priority, start_date, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES
  (gen_random_uuid(),
   'Интегрировать Strapi CMS',
   'Контент-типы: страницы, блог, кейсы, команда. REST + Webhooks для ISR.',
   c1, p2, u3, u9, col4, 'done', 'critical',
   NOW()-'45 days'::interval, NOW()-'5 days'::interval,
   32, 30, null, NOW()-'45 days'::interval, NOW()-'5 days'::interval),

  (gen_random_uuid(),
   'SEO-оптимизация',
   'Meta-теги, Open Graph, Twitter Cards, sitemap.xml, schema.org, robots.txt.',
   c1, p2, u10, u10, col2, 'in_progress', 'high',
   NOW()-'10 days'::interval, NOW()+'10 days'::interval,
   16, 6, null, NOW()-'10 days'::interval, NOW()),

  (gen_random_uuid(),
   'Страница «О компании»',
   'Команда с фото, история компании, ценности, вакансии.',
   c1, p2, u2, u6, col4, 'done', 'medium',
   NOW()-'30 days'::interval, NOW()-'15 days'::interval,
   12, 10, null, NOW()-'30 days'::interval, NOW()-'15 days'::interval),

  (gen_random_uuid(),
   'Форма обратной связи',
   'Валидация + reCAPTCHA + интеграция с HubSpot и почтой.',
   c1, p2, u2, u5, col2, 'in_progress', 'medium',
   NOW()-'5 days'::interval, NOW()+'7 days'::interval,
   8, 3, null, NOW()-'5 days'::interval, NOW()),

  (gen_random_uuid(),
   'Lighthouse: Performance > 90',
   'WebP/AVIF, lazy loading, preconnect, inline critical CSS, удалить unused JS.',
   c1, p2, u3, u9, col1, 'new', 'high',
   null, NOW()+'20 days'::interval,
   16, null, null, NOW()-'1 day'::interval, NOW()),

  (gen_random_uuid(),
   'Кейсы и портфолио',
   'Шаблон кейса, 5 кейсов с метриками: до/после.',
   c1, p2, u2, u10, col3, 'review', 'low',
   NOW()-'20 days'::interval, NOW()+'5 days'::interval,
   20, 18, null, NOW()-'20 days'::interval, NOW()),

  (gen_random_uuid(),
   'Production-деплой',
   'CDN (CloudFront), SSL, blue-green деплой, health check.',
   c1, p2, u3, u11, col1, 'new', 'critical',
   null, NOW()+'25 days'::interval,
   8, null, null, NOW()-'3 days'::interval, NOW());

  -- ===========================================================
  -- 8. ЗАДАЧИ — P3: CRM-интеграция
  -- ===========================================================

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     kanban_column_id, status, priority, start_date, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES (tp3,
    'Разработать API-адаптер для HubSpot',
    'Унифицированный адаптер: маппинг полей, rate limiting (100 req/10s), retry с exponential backoff.',
    c1, p3, u3, u9, col2, 'in_progress', 'critical',
    NOW()-'20 days'::interval, NOW()+'10 days'::interval,
    40, 18, null, NOW()-'20 days'::interval, NOW());

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     parent_task_id, kanban_column_id, status, priority, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES
  (gen_random_uuid(),
   'Таблица маппинга полей',
   'Документ соответствия: наши поля ↔ HubSpot-свойства. Согласовано с Sales.',
   c1, p3, u10, u10, tp3, col4, 'done', 'high',
   NOW()-'10 days'::interval, 8, 6, null, NOW()-'18 days'::interval, NOW()),

  (gen_random_uuid(),
   'Webhook-обработчик входящих событий',
   'Верификация подписи HMAC-SHA256, очередь Celery, idempotency-key.',
   c1, p3, u9, u9, tp3, col2, 'in_progress', 'critical',
   NOW()+'5 days'::interval, 12, 4, null, NOW()-'10 days'::interval, NOW()),

  (gen_random_uuid(),
   'Rate limiting и retry-логика',
   'Token bucket на стороне адаптера, 3 попытки, backoff x2.',
   c1, p3, u9, u7, tp3, col1, 'new', 'high',
   NOW()+'12 days'::interval, 8, null, null, NOW()-'3 days'::interval, NOW());

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     kanban_column_id, status, priority, start_date, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES
  (gen_random_uuid(),
   'Двусторонняя синхронизация сделок',
   'Статусы сделок в реальном времени, debounce 3с, разрешение конфликтов last-write-wins.',
   c1, p3, u3, u7, col2, 'in_progress', 'high',
   NOW()-'15 days'::interval, NOW()+'15 days'::interval,
   32, 10, null, NOW()-'15 days'::interval, NOW()),

  (gen_random_uuid(),
   'Дашборд аналитики продаж',
   'Воронка конверсии, топ-менеджеры, сравнение периодов. Recharts.',
   c1, p3, u10, u10, col1, 'new', 'medium',
   null, NOW()+'30 days'::interval,
   24, null, null, NOW()-'5 days'::interval, NOW()),

  (gen_random_uuid(),
   'Нагрузочное тестирование интеграции',
   'Locust: 500 одновременных пользователей, sync 10k записей за 60с.',
   c1, p3, u8, u8, col1, 'new', 'high',
   null, NOW()+'35 days'::interval,
   16, null, null, NOW()-'2 days'::interval, NOW()),

  (gen_random_uuid(),
   'Документация адаптера',
   'OpenAPI-схема, sequence-диаграммы в Mermaid, FAQ, Postman-коллекция.',
   c1, p3, u10, u10, col3, 'review', 'low',
   NOW()-'10 days'::interval, NOW()+'5 days'::interval,
   12, 10, null, NOW()-'10 days'::interval, NOW()),

  (gen_random_uuid(),
   'Алёрты мониторинга интеграции',
   'Grafana AlertManager: ошибки синхронизации > 5%, лаг очереди > 5 мин.',
   c1, p3, u3, u11, col2, 'in_progress', 'medium',
   NOW()-'7 days'::interval, NOW()+'14 days'::interval,
   16, 6, null, NOW()-'7 days'::interval, NOW()),

  (gen_random_uuid(),
   'UAT с командой Sales',
   '3 сессии по 2 часа с командой Sales. Чеклист приёмки, баг-трекер.',
   c1, p3, u12, u12, col1, 'new', 'high',
   null, NOW()+'40 days'::interval,
   8, null, null, NOW()-'1 day'::interval, NOW());

  -- ===========================================================
  -- 9. ЗАДАЧИ — P4: Внутренний HR-портал (on_hold)
  -- ===========================================================

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     kanban_column_id, status, priority, start_date, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES (tp4,
    'Проектирование базы данных HR',
    'ER-диаграмма, схема: сотрудники, должности, отделы, отпуска, KPI. Согласование с HR.',
    c1, p4, u1, u10, col4, 'done', 'high',
    NOW()-'100 days'::interval, NOW()-'60 days'::interval,
    20, 18, null, NOW()-'100 days'::interval, NOW()-'60 days'::interval);

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     parent_task_id, kanban_column_id, status, priority, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES
  (gen_random_uuid(),
   'ER-диаграмма в draw.io',
   'Нарисовать, согласовать с командой, зафиксировать в Confluence.',
   c1, p4, u10, u10, tp4, col4, 'done', 'medium',
   NOW()-'80 days'::interval, 4, 3, null, NOW()-'95 days'::interval, NOW()-'80 days'::interval),

  (gen_random_uuid(),
   'Django-миграции HR-моделей',
   'Начальные миграции для Employee, Department, Position, Leave, KPIRecord.',
   c1, p4, u10, u4, tp4, col4, 'done', 'high',
   NOW()-'70 days'::interval, 8, 7, null, NOW()-'85 days'::interval, NOW()-'70 days'::interval);

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     kanban_column_id, status, priority, start_date, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES
  (gen_random_uuid(),
   'Модуль управления отпусками',
   'Заявка → согласование менеджером → календарь отсутствий. Email-уведомления.',
   c1, p4, u12, u4, col2, 'in_progress', 'medium',
   NOW()-'30 days'::interval, NOW()+'60 days'::interval,
   40, 12, null, NOW()-'30 days'::interval, NOW()),

  (gen_random_uuid(),
   'Онбординг-чеклист',
   'Шаблон онбординга, автоназначение задач при создании сотрудника.',
   c1, p4, u12, u12, col1, 'new', 'low',
   null, NOW()+'90 days'::interval,
   24, null, null, NOW()-'20 days'::interval, NOW()),

  (gen_random_uuid(),
   'KPI-дашборд для руководителей',
   'Графики выполнения целей, heatmap активности, сравнение с прошлым кварталом.',
   c1, p4, u1, u10, col1, 'new', 'high',
   null, NOW()+'120 days'::interval,
   48, null, null, NOW()-'10 days'::interval, NOW()),

  (gen_random_uuid(),
   'Интеграция с 1С:Зарплата',
   'Выгрузка начислений и вычетов, сверка данных.',
   c1, p4, u3, u7, col1, 'new', 'critical',
   null, NOW()+'150 days'::interval,
   64, null, null, NOW()-'5 days'::interval, NOW()),

  (gen_random_uuid(),
   'Интерактивная оргструктура',
   'D3.js дерево подразделений, поиск по сотруднику, карточка должности.',
   c1, p4, u12, u6, col1, 'new', 'medium',
   null, NOW()+'100 days'::interval,
   20, null, null, NOW()-'15 days'::interval, NOW());

  -- ===========================================================
  -- 10. ЗАДАЧИ — P5: Миграция на Kubernetes
  -- ===========================================================

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     kanban_column_id, status, priority, start_date, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES (tp5,
    'Контейнеризация всех сервисов',
    'Multistage Dockerfile для backend, frontend, worker, scheduler. Non-root user, healthcheck.',
    c1, p5, u11, u11, col4, 'done', 'critical',
    NOW()-'25 days'::interval, NOW()-'5 days'::interval,
    24, 22, null, NOW()-'25 days'::interval, NOW()-'5 days'::interval);

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     parent_task_id, kanban_column_id, status, priority, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES
  (gen_random_uuid(),
   'Dockerfile для Django',
   'Multistage: builder + runtime. collectstatic, gunicorn, SIGTERM-обработчик.',
   c1, p5, u11, u11, tp5, col4, 'done', 'high',
   NOW()-'20 days'::interval, 6, 5, null, NOW()-'22 days'::interval, NOW()-'20 days'::interval),

  (gen_random_uuid(),
   'Dockerfile для React',
   'Nginx + статическая сборка, gzip, cache-headers, security headers.',
   c1, p5, u11, u9, tp5, col4, 'done', 'high',
   NOW()-'18 days'::interval, 4, 4, null, NOW()-'20 days'::interval, NOW()-'18 days'::interval),

  (gen_random_uuid(),
   'Dockerfile для Celery Worker',
   'Worker + Beat в одном образе, graceful shutdown на SIGTERM.',
   c1, p5, u11, u7, tp5, col4, 'done', 'medium',
   NOW()-'10 days'::interval, 4, 3, null, NOW()-'15 days'::interval, NOW()-'10 days'::interval);

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     kanban_column_id, status, priority, start_date, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES
  (gen_random_uuid(),
   'Написать Helm-чарты',
   'Chart для каждого сервиса: values.yaml, secrets через External Secrets, HPA, PDB.',
   c1, p5, u11, u11, col2, 'in_progress', 'critical',
   NOW()-'10 days'::interval, NOW()+'10 days'::interval,
   32, 14, null, NOW()-'10 days'::interval, NOW()),

  (gen_random_uuid(),
   'Настроить Ingress + TLS',
   'Nginx Ingress Controller + cert-manager + Let''s Encrypt wildcard-сертификат.',
   c1, p5, u3, u11, col2, 'in_progress', 'high',
   NOW()-'5 days'::interval, NOW()+'15 days'::interval,
   16, 4, null, NOW()-'5 days'::interval, NOW()),

  (gen_random_uuid(),
   'Prometheus + Grafana',
   'kube-prometheus-stack, кастомные дашборды: latency, error rate, saturation.',
   c1, p5, u3, u11, col1, 'new', 'high',
   null, NOW()+'25 days'::interval,
   24, null, null, NOW()-'3 days'::interval, NOW()),

  (gen_random_uuid(),
   'Нагрузочный тест кластера',
   'k6: 1000 rps на API, проверка автоскейлинга HPA, latency P99 < 300ms.',
   c1, p5, u8, u8, col1, 'new', 'medium',
   null, NOW()+'40 days'::interval,
   16, null, null, NOW()-'2 days'::interval, NOW()),

  (gen_random_uuid(),
   'Disaster Recovery Runbook',
   'Velero backup, процедура восстановления кластера, RTO < 1ч, RPO < 15мин.',
   c1, p5, u1, u11, col1, 'new', 'high',
   null, NOW()+'60 days'::interval,
   20, null, null, NOW()-'1 day'::interval, NOW()),

  (gen_random_uuid(),
   'GitLab CI/CD pipeline',
   'Этапы: lint → test → build → push → deploy (staging auto / prod manual).',
   c1, p5, u3, u7, col3, 'review', 'critical',
   NOW()-'15 days'::interval, NOW()+'5 days'::interval,
   24, 20, null, NOW()-'15 days'::interval, NOW());

  -- ===========================================================
  -- 11. ЗАДАЧИ — P6: Маркетинговая кампания Q3 (завершён)
  -- ===========================================================

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     kanban_column_id, status, priority, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES (tp6,
    'Разработать контент-план Q3',
    'Контент на 3 месяца: Instagram, Telegram, блог. Контент-календарь в Notion.',
    c1, p6, u2, u10, col4, 'done', 'high',
    NOW()-'150 days'::interval, 20, 18,
    null, NOW()-'180 days'::interval, NOW()-'120 days'::interval);

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     parent_task_id, kanban_column_id, status, priority, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES
  (gen_random_uuid(),
   'Instagram: 30 постов + 90 stories',
   'Визуальный контент, фирменные шаблоны, Reels 3 шт./неделю.',
   c1, p6, u10, u10, tp6, col4, 'done', 'medium',
   NOW()-'120 days'::interval, 8, 8, null, NOW()-'170 days'::interval, NOW()-'100 days'::interval),

  (gen_random_uuid(),
   'Telegram-канал: 3 поста/неделю',
   'Аналитика, кейсы, behind-the-scenes. Рост подписчиков +2400 за квартал.',
   c1, p6, u10, u6, tp6, col4, 'done', 'medium',
   NOW()-'120 days'::interval, 8, 7, null, NOW()-'165 days'::interval, NOW()-'100 days'::interval);

  INSERT INTO tasks
    (id, title, description, company_id, project_id, creator_id, assignee_id,
     kanban_column_id, status, priority, due_date,
     estimated_hours, actual_hours, deleted_at, created_at, updated_at)
  VALUES
  (gen_random_uuid(),
   'Email-рассылка: реактивация базы',
   '50k подписчиков, A/B-тест темы, сегментация по активности. OR 32%, CTR 8%.',
   c1, p6, u10, u10, col4, 'done', 'critical',
   NOW()-'60 days'::interval, 16, 15,
   null, NOW()-'90 days'::interval, NOW()-'60 days'::interval),

  (gen_random_uuid(),
   'A/B-тест лендинга',
   'Вариант A: видео-фон (+12% CR), вариант B: статичный хиро. Winner: A.',
   c1, p6, u10, u5, col4, 'done', 'high',
   NOW()-'50 days'::interval, 12, 10,
   null, NOW()-'80 days'::interval, NOW()-'50 days'::interval),

  (gen_random_uuid(),
   'Google Ads: поиск + ремаркетинг',
   'ROAS 4.2, CPC $0.38, ремаркетинг на посетителей блога.',
   c1, p6, u2, u10, col4, 'done', 'high',
   NOW()-'120 days'::interval, 20, 18,
   null, NOW()-'160 days'::interval, NOW()-'110 days'::interval),

  (gen_random_uuid(),
   'Итоговый отчёт Q3',
   'ROI 320%, CAC снизился на 18%, LTV/CAC = 5.4. Презентация для CEO.',
   c1, p6, u10, u10, col4, 'done', 'medium',
   NOW()-'30 days'::interval, 8, 6,
   null, NOW()-'45 days'::interval, NOW()-'30 days'::interval),

  (gen_random_uuid(),
   'Инфлюенсер-партнёрства',
   '5 микро-инфлюенсеров (10k-100k). Охват 180k уникальных, CPM $2.10.',
   c1, p6, u2, u10, col4, 'done', 'medium',
   NOW()-'45 days'::interval, 16, 14,
   null, NOW()-'90 days'::interval, NOW()-'45 days'::interval);

  -- ===========================================================
  -- 12. КОММЕНТАРИИ
  -- ===========================================================
  INSERT INTO task_comments (id, task_id, author_id, text, created_at, updated_at)
  VALUES
  -- Система аутентификации (tp1)
  (gen_random_uuid(), tp1, u2,
   'Оля, посмотри RFC 8628 — Device Authorization Grant. Может пригодиться для TV-версии в следующем спринте.',
   NOW()-'20 days'::interval, NOW()-'20 days'::interval),
  (gen_random_uuid(), tp1, u4,
   'Посмотрела, спасибо. Пока не в скоупе, добавила в backlog как отдельную задачу.',
   NOW()-'19 days'::interval, NOW()-'19 days'::interval),
  (gen_random_uuid(), tp1, u5,
   'Обратите внимание: refresh token надо хранить в httpOnly cookie, не в localStorage — иначе уязвимо к XSS.',
   NOW()-'18 days'::interval, NOW()-'18 days'::interval),
  (gen_random_uuid(), tp1, u4,
   'Полностью согласна, уже переделала. Заодно добавила SameSite=Strict.',
   NOW()-'17 days'::interval, NOW()-'17 days'::interval),

  -- Контейнеризация (tp5)
  (gen_random_uuid(), tp5, u3,
   'Виктор, добавь PodDisruptionBudget — без него rolling update может уронить весь сервис.',
   NOW()-'8 days'::interval, NOW()-'8 days'::interval),
  (gen_random_uuid(), tp5, u11,
   'Добавил PDB minAvailable=1. Ещё настроил livenessProbe с initialDelaySeconds=30 — лишних рестартов в prod больше нет.',
   NOW()-'7 days'::interval, NOW()-'7 days'::interval),

  -- CRM-адаптер (tp3)
  (gen_random_uuid(), tp3, u3,
   'HubSpot квотирует 100 req/10s на приватное приложение. Нужен token bucket на нашей стороне.',
   NOW()-'15 days'::interval, NOW()-'15 days'::interval),
  (gen_random_uuid(), tp3, u9,
   'Реализовал через Celery rate_limit + Redis. Тест 30 мин — ни одного 429. Мержу в main.',
   NOW()-'12 days'::interval, NOW()-'12 days'::interval),
  (gen_random_uuid(), tp3, u10,
   'Отлично! Добавь лог при каждой ротации OAuth-токена — нужно для аудита безопасности.',
   NOW()-'11 days'::interval, NOW()-'11 days'::interval),

  -- Главный экран сайта (tp2)
  (gen_random_uuid(), tp2, u6,
   'Макет в Figma готов — ссылка в описании. Жду фидбек по цвету кнопки CTA.',
   NOW()-'16 days'::interval, NOW()-'16 days'::interval),
  (gen_random_uuid(), tp2, u2,
   'Смотрелась, очень круто! Только tap target кнопки на мобиле маловат — увеличь до 44px по гайдлайнам Apple.',
   NOW()-'15 days'::interval, NOW()-'15 days'::interval),
  (gen_random_uuid(), tp2, u6,
   'Исправила, Figma обновила. Заодно добавила hover-state для десктопа.',
   NOW()-'14 days'::interval, NOW()-'14 days'::interval);

  RAISE NOTICE 'Demo seed выполнен успешно!';
  RAISE NOTICE '  Пользователей:  12 (@ demo.cf)';
  RAISE NOTICE '  Компаний:        1 (ControlFlow Demo Inc.)';
  RAISE NOTICE '  Kanban-колонок:  4';
  RAISE NOTICE '  Проектов:        6';
  RAISE NOTICE '  Задач:          56+ (включая подзадачи)';
  RAISE NOTICE '  Комментариев:   12';
  RAISE NOTICE '';
  RAISE NOTICE 'ВАЖНО: пароли не установлены (значение "!").';
  RAISE NOTICE 'Запустите команду из заголовка файла для установки пароля Test1234!';

END;
$$;
