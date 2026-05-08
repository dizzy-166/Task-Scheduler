"""
Seed: одна компания «Цифровые Решения» — 27 сотрудников, 5 проектов, 43 задачи.

  python manage.py seed_company
  python manage.py seed_company --flush
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta, date

SEED_MARKER = "@seed.test"
CO_NAME = "Цифровые Решения"

# (first, last, patronymic, slug)
_USERS = [
    ("Владимир",  "Соловьёв",   "Андреевич",    "v.solovyev"),    # 0  CEO / owner
    ("Артём",     "Захаров",    "Дмитриевич",   "a.zaharov"),     # 1  CTO
    ("Наталья",   "Белова",     "Сергеевна",    "n.belova"),      # 2  CPO
    ("Светлана",  "Орлова",     "Игоревна",     "s.orlova"),      # 3  HR
    ("Кирилл",    "Романов",    "Алексеевич",   "k.romanov"),     # 4  Frontend
    ("Полина",    "Николаева",  "Викторовна",   "p.nikolaeva"),   # 5  Frontend
    ("Максим",    "Ефимов",     "Петрович",     "m.efimov"),      # 6  Frontend
    ("Дарья",     "Куликова",   "Николаевна",   "d.kulikova"),    # 7  Frontend
    ("Андрей",    "Тихонов",    "Юрьевич",      "a.tihonov"),     # 8  Backend
    ("Юлия",      "Фомина",     "Александровна","yu.fomina"),     # 9  Backend
    ("Роман",     "Волков",     "Денисович",    "r.volkov"),      # 10 Backend
    ("Алина",     "Степанова",  "Ивановна",     "a.stepanova"),   # 11 Backend
    ("Олег",      "Сергеев",    "Михайлович",   "o.sergeev"),     # 12 Mobile
    ("Виктория",  "Смирнова",   "Андреевна",    "v.smirnova"),    # 13 Mobile
    ("Илья",      "Громов",     "Сергеевич",    "i.gromov"),      # 14 DevOps
    ("Павел",     "Зайцев",     "Владимирович", "p.zaitsev"),     # 15 DevOps
    ("Мария",     "Лебедева",   "Ивановна",     "m.lebedeva"),    # 16 QA
    ("Евгений",   "Попов",      "Алексеевич",   "e.popov"),       # 17 QA
    ("Анастасия", "Коновалова", "Дмитриевна",   "an.konovalova"), # 18 Design
    ("Тимур",     "Асланов",    "Рустамович",   "t.aslanov"),     # 19 Design
    ("Елена",     "Михайлова",  "Сергеевна",    "el.mihailova"),  # 20 Analytics
    ("Никита",    "Рябов",      "Игоревич",     "ni.ryabov"),     # 21 Analytics
    ("Ксения",    "Дорогова",   "Алексеевна",   "k.dorogova"),    # 22 PM
    ("Денис",     "Воробьёв",   "Павлович",     "d.vorobev"),     # 23 PM
    ("Сергей",    "Крылов",     "Андреевич",    "s.krylov"),      # 24 Backend
    ("Алиса",     "Ковалёва",   "Никитична",    "al.kovaleva"),   # 25 Frontend
    ("Григорий",  "Панов",      "Евгеньевич",   "g.panov"),       # 26 Data Science
]

# (name, code, description, manager_idx, days_started_ago, deadline_days)
_PROJECTS = [
    (
        "Маркетплейс v2.0", "MKT2",
        "Полная переработка платформы: микросервисная архитектура, новый UI/UX, улучшенная производительность",
        1, 60, 45,
    ),
    (
        "Мобильное приложение iOS/Android", "MOBI",
        "Нативное приложение для покупателей и продавцов на Flutter. MVP + публикация в сторах",
        22, 40, 70,
    ),
    (
        "Аналитическая платформа", "ANLT",
        "BI-система: дашборды продаж и маркетинга, когортный анализ, предиктивные отчёты",
        23, 30, 60,
    ),
    (
        "DevOps & Инфраструктура", "DOPS",
        "Переход на Kubernetes, CI/CD, Vault, мониторинг и disaster recovery",
        1, 50, 20,
    ),
    (
        "HR-портал", "HRPT",
        "Внутренний портал: учёт рабочего времени, отпуска, онбординг, интеграция с 1С:ЗУП",
        22, 10, 80,
    ),
]

# (title, description, status, priority, assignee_idx, est_hours, actual_hours|None, days_due, days_created_ago)
_TASKS = {
    "MKT2": [
        ("Архитектура микросервисов",       "Декомпозиция монолита: Users, Products, Orders, Payments, Notifications",  "done",        "critical",  1, 24, 28, -35, 58),
        ("Дизайн-система компонентов",      "Переиспользуемые React-компоненты: Button, Input, Card, Modal, Table",     "done",        "high",     18, 40, 38, -20, 55),
        ("Сервис авторизации и JWT",         "Регистрация, вход, refresh token, OAuth Google и ВКонтакте",              "done",        "critical",  8, 16, 20, -15, 50),
        ("API каталога товаров",            "CRUD товаров, категорий, фильтрация, пагинация, сортировка",               "done",        "high",      9, 32, 30,  -8, 45),
        ("Корзина и оформление заказа",     "Мультишаговый чекаут: адрес, доставка, оплата, подтверждение",             "in_progress", "high",      4, 40, None, 12, 22),
        ("Личный кабинет продавца",         "Управление товарами, заказы, статистика продаж, вывод средств",            "in_progress", "high",      6, 48, None, 18, 20),
        ("Интеграция платёжных систем",     "ЮКасса, Tinkoff Pay, СБП. Webhook, возвраты, холдирование",               "in_progress", "critical",  8, 24, None,  8, 15),
        ("Поиск и фильтрация товаров",      "Полнотекстовый поиск через Elasticsearch, фасетная фильтрация",           "review",      "high",      9, 20, None,  5, 18),
        ("Адаптивная вёрстка каталога",     "Responsive layout: mobile 375px, tablet 768px, desktop 1440px",           "review",      "medium",    5, 16, None,  3, 14),
        ("Система отзывов и рейтингов",     "Отзывы на товары и продавцов, модерация, агрегированный рейтинг",          "in_progress", "medium",    5, 24, None, 20, 10),
        ("Email-уведомления о заказах",     "Транзакционные письма: подтверждение, смена статуса, доставка",            "new",         "medium",    6, 12, None, 25,  7),
        ("Нагрузочное тестирование",        "k6 сценарии: 1000 RPS на каталог и чекаут, профилирование узких мест",    "new",         "high",     16, 16, None, 30,  5),
    ],
    "MOBI": [
        ("Дизайн онбординга",               "3 экрана-слайдера: ценностное предложение и CTA на регистрацию",          "done",        "high",     18, 12, 14, -18, 38),
        ("Авторизация через соцсети",       "Sign in with Apple (обязателен для App Store), Google OAuth для Android", "done",        "critical", 12,  8, 10, -10, 35),
        ("Push-уведомления",                "Firebase Cloud Messaging: новые заказы, акции, смена статуса доставки",   "in_progress", "high",     13, 16, None, 15, 20),
        ("Главный экран — лента товаров",   "Бесконечный скролл, карточки товаров, баннеры акций, категории",          "in_progress", "high",     12, 32, None, 20, 18),
        ("Профиль пользователя",            "Редактирование данных, история заказов, избранное, адреса доставки",      "in_progress", "medium",   13, 20, None, 25, 15),
        ("Экран корзины и чекаут",          "Список товаров, промокоды, выбор доставки, оплата через SDK",             "review",      "critical", 12, 24, None,  7, 22),
        ("QA: автотесты на Flutter",        "Widget-тесты ключевых экранов, integration test для чекаута",            "review",      "high",     17, 20, None, 10, 12),
        ("Оплата Apple Pay / Google Pay",   "Интеграция с in-app payment SDK, тестирование на sandbox",               "in_progress", "critical", 13, 16, None, 18, 10),
        ("Оффлайн-режим",                   "Кэширование каталога и избранного, синхронизация при появлении сети",     "new",         "medium",   12, 24, None, 45,  5),
        ("Аналитика событий Amplitude",     "Трекинг 50+ событий: просмотр, добавление в корзину, конверсия",          "new",         "low",       7,  8, None, 50,  3),
    ],
    "ANLT": [
        ("Сбор требований и ТЗ",            "Интервью с продажами и маркетингом, описание 12 ключевых метрик",         "done",        "high",     20,  8, 10, -20, 28),
        ("ETL-пайплайн из основной БД",     "Airflow DAG: инкрементальная выгрузка в Data Warehouse каждые 2 часа",   "done",        "critical", 10, 32, 36, -10, 25),
        ("Дашборд продаж",                  "GMV, средний чек, конверсия воронки, сравнение период-к-периоду",         "in_progress", "high",     21, 24, None, 15, 15),
        ("Когортный анализ пользователей",  "Retention по неделям, LTV когорт, тепловая карта активности",             "in_progress", "high",     26, 32, None, 20, 12),
        ("API отчётов для фронтенда",       "GraphQL эндпоинты, фильтры по дате и сегменту, кэш на Redis",             "review",      "medium",   10, 16, None,  5, 10),
        ("Дашборд маркетинга",              "CAC по каналам, ROI кампаний, атрибуция first/last/linear click",         "in_progress", "medium",   20, 20, None, 25,  8),
        ("Предиктивная аналитика оттока",   "Модель XGBoost на признаках активности, скоринг раз в сутки",             "new",         "medium",   26, 40, None, 40,  5),
        ("Экспорт отчётов в Excel и PDF",   "openpyxl + ReportLab, шаблоны с брендингом, автоотправка по расписанию", "new",         "low",      21, 12, None, 45,  3),
    ],
    "DOPS": [
        ("Миграция на Kubernetes",          "k8s кластер из 5 нод в Yandex Cloud, namespace по окружениям",            "done",        "critical", 14, 40, 48, -25, 48),
        ("Мониторинг Prometheus и Grafana", "Метрики сервисов, алерты в Telegram, дашборды CPU/RAM/Latency",           "done",        "high",     15, 16, 18, -15, 40),
        ("CI/CD пайплайны в GitLab",        "Build → Test → Lint → Deploy на staging; ручной триггер в прод",         "done",        "high",     14, 24, 22,  -5, 35),
        ("Vault для управления секретами",  "HashiCorp Vault: dynamic secrets для БД, ротация ключей, аудит",          "in_progress", "critical", 15, 20, None, 10, 12),
        ("Disaster Recovery план",          "RPO ≤ 1ч, RTO ≤ 4ч: резервный кластер, бэкапы БД, runbook",             "in_progress", "critical", 14, 32, None, 15, 10),
        ("Оптимизация Docker-образов",      "Multi-stage builds, distroless base, сокращение с 2GB до ~200MB",        "review",      "medium",   15,  8, None,  4,  8),
        ("Автомасштабирование HPA",         "HPA по CPU и custom metrics (RPS), стресс-тесты пиковой нагрузки",       "new",         "medium",   14, 16, None, 18,  3),
    ],
    "HRPT": [
        ("Сбор требований HR",              "Воркшоп с HR-отделом: учёт времени, отпуска, онбординг",                 "done",        "high",      3,  8,  6,  -3,  9),
        ("Прототип в Figma",                "Wireframes главных разделов: дашборд, профиль сотрудника, заявки",        "in_progress", "high",     19, 12, None, 10,  7),
        ("API управления сотрудниками",     "CRUD: профили, должности, подразделения, иерархия менеджеров",            "in_progress", "high",     24, 24, None, 20,  6),
        ("Модуль учёта рабочего времени",   "Табели, переработки, больничные, сводные отчёты для бухгалтерии",        "new",         "medium",   25, 32, None, 40,  4),
        ("Интеграция с 1С:ЗУП",            "Синхронизация сотрудников и зарплатных начислений через REST API 1С",    "new",         "medium",   24, 24, None, 55,  3),
        ("Портал вакансий и онбординг",     "Карточки вакансий, анкеты кандидатов, чек-листы онбординга",             "new",         "low",      25, 20, None, 65,  2),
    ],
}

# (task_title, author_idx, text, days_ago)
_COMMENTS = [
    # MKT2 — Корзина и оформление заказа
    ("Корзина и оформление заказа", 1,  "Кирилл, нужно закрыть шаг оплаты до конца спринта, иначе QA не успеют. Как статус?", 5),
    ("Корзина и оформление заказа", 4,  "Шаги 1–3 готовы (адрес, доставка, промокод). Оплата в процессе — жду ключи от Tinkoff-песочницы от Андрея.", 4),
    ("Корзина и оформление заказа", 8,  "Ключи положил в Vault: secret/payments/tinkoff-sandbox. Там же инструкция по подключению.", 4),

    # MKT2 — Интеграция платёжных систем
    ("Интеграция платёжных систем", 8,  "ЮКасса и СБП закрыты, тесты зелёные. Осталась Tinkoff Pay — у них нестандартный SDK, разбираюсь.", 6),
    ("Интеграция платёжных систем", 1,  "Если задержка более 2 дней — пиши, есть контакт в техподдержке Tinkoff.", 5),
    ("Интеграция платёжных систем", 8,  "Решил! Проблема в Content-Type — нужен form-urlencoded, а не JSON. Документация у них устаревшая.", 3),
    ("Интеграция платёжных систем", 16, "Отлично! Когда будешь готов — создам тест-кейсы на refund и partial capture.", 2),

    # MKT2 — Поиск и фильтрация товаров
    ("Поиск и фильтрация товаров",  9,  "PR готов, покрытие 82%. При пустом запросе теперь отдаём не более 24 результатов.", 2),
    ("Поиск и фильтрация товаров",  1,  "Глянул MR — в целом хорошо. Добавь fuzzy matching с fuzziness=AUTO и прогони ещё раз.", 1),
    ("Поиск и фильтрация товаров",  9,  "Готово, добавила fuzzy matching. Также добавила синонимы для топ-50 запросов из аналитики.", 0),

    # MOBI — Главный экран
    ("Главный экран — лента товаров", 22, "Олег, можешь показать промежуточный результат завтра на стендапе? Стейкхолдеры хотят видеть прогресс.", 3),
    ("Главный экран — лента товаров", 12, "Конечно. Лента готова на 70%, основная задержка — shimmer loading state, чуть намудрил с анимацией.", 3),

    # MOBI — Экран корзины
    ("Экран корзины и чекаут", 17, "Android 12: при вводе промокода иногда вылетает. NullPointerException в логах, стектрейс приложил.", 2),
    ("Экран корзины и чекаут", 12, "Спасибо, поймал — discount поле nullable, но я не проверял. Фикс сделал, прогони ещё раз.", 1),
    ("Экран корзины и чекаут", 17, "Краш ушёл. Все тест-кейсы в норме, MR апрувлю.", 0),

    # ANLT — Дашборд продаж
    ("Дашборд продаж", 23, "Никита, уточни с Еленой — что важнее первым: выручка или конверсия воронки?", 5),
    ("Дашборд продаж", 20, "Приоритет: GMV и конверсия корзина→оплата. Остальное вторично. Макап добавила в Figma.", 4),
    ("Дашборд продаж", 21, "Принято. Начинаю с этих двух. Использую Recharts — если есть предпочтения по библиотеке, скажите.", 3),

    # DOPS — Vault
    ("Vault для управления секретами", 1,  "Павел, дедлайн жёсткий — без Vault не выпускаем платёжный сервис в прод. Как статус?", 4),
    ("Vault для управления секретами", 15, "Инсталляция в k8s готова, настраиваю dynamic secrets для PostgreSQL. Покажу на деме завтра.", 3),

    # DOPS — Disaster Recovery
    ("Disaster Recovery план", 14, "Провёл DR-drill — восстановление заняло 3ч 20мин. Нам нужно RTO ≤ 4ч, уже на пределе.", 5),
    ("Disaster Recovery план",  1, "Хорошо что проверили. Что стало основным узким местом?", 4),
    ("Disaster Recovery план", 14, "Восстановление из S3 — 1.2TB скачивается 2ч. Перехожу на streaming replication, резервный инстанс уже синхронизируется.", 3),

    # DOPS — Docker
    ("Оптимизация Docker-образов", 14, "Отличная работа! Backend похудел с 1.8GB до 180MB. Посмотри ещё frontend — там тоже раздут.", 2),
    ("Оптимизация Docker-образов", 15, "Frontend в следующем PR. Здесь только бэкенд-сервисы — скопировал подход и на analytics-сервис.", 1),

    # HRPT — API сотрудников
    ("API управления сотрудниками", 22, "Сергей, иерархия должна поддерживать неограниченную глубину — у нас 4 уровня в орг-структуре.", 3),
    ("API управления сотрудниками", 24, "Сделал через closure table — быстрее nested sets для запросов «все подчинённые». Задокументировал в README.", 2),
]


class Command(BaseCommand):
    help = "Создаёт компанию «Цифровые Решения»: 27 сотрудников, 5 проектов, 43 задачи."

    def add_arguments(self, parser):
        parser.add_argument("--flush", action="store_true",
                            help="Удалить существующие данные и создать заново")

    def handle(self, *args, **options):
        from apps.users.models import User
        from apps.companies.models import Company, CompanyMember
        from apps.core.models import Project
        from apps.tasks.models import Task, KanbanColumn, TaskComment

        if options["flush"]:
            self._flush(User, Company, Project, Task, KanbanColumn, TaskComment)

        users = self._create_users(User)
        company, cols = self._setup_company(Company, CompanyMember, KanbanColumn, users)
        projects = self._create_projects(Project, company, users)
        tasks = self._create_tasks(Task, company, projects, cols, users)
        self._add_comments(TaskComment, tasks, users)

        self.stdout.write(self.style.SUCCESS("\nГотово!"))
        self.stdout.write(f"  Компания:   {company.name}")
        self.stdout.write(f"  Участников: {len(users)}")
        self.stdout.write(f"  Проектов:   {len(projects)}")
        self.stdout.write(f"  Задач:      {len(tasks)}")
        self.stdout.write(f"\n  Пароль для всех: 123456")
        self.stdout.write("\nЛогины:")
        for u in users:
            self.stdout.write(f"  {u.email}  --  {u.full_name}")

    # ── flush ──────────────────────────────────────────────────────────────────

    def _flush(self, User, Company, Project, Task, KanbanColumn, TaskComment):
        company = Company.objects.filter(name=CO_NAME).first()
        if company:
            TaskComment.objects.filter(task__company=company).delete()
            Task.objects.filter(company=company).delete()
            KanbanColumn.objects.filter(company=company).delete()
            Project.objects.filter(company=company).delete()
            company.delete()
        emails = [f"{slug}{SEED_MARKER}" for *_, slug in _USERS]
        User.objects.filter(email__in=emails).delete()
        self.stdout.write(self.style.WARNING("Данные удалены."))

    # ── users ──────────────────────────────────────────────────────────────────

    def _create_users(self, User):
        users, PASSWORD = [], "123456"
        for first, last, patr, slug in _USERS:
            email = f"{slug}{SEED_MARKER}"
            u, created = User.objects.get_or_create(
                email=email,
                defaults=dict(first_name=first, last_name=last, patronymic=patr,
                              is_active=True, is_verified=True),
            )
            if created:
                u.set_password(PASSWORD)
                u.save()
        users = list(User.objects.filter(
            email__in=[f"{slug}{SEED_MARKER}" for *_, slug in _USERS]
        ).order_by("email"))
        # Re-order to match _USERS order
        email_to_user = {u.email: u for u in users}
        users = [email_to_user[f"{slug}{SEED_MARKER}"] for *_, slug in _USERS]
        self.stdout.write(f"  Пользователей: {len(users)}")
        return users

    # ── company + kanban columns ───────────────────────────────────────────────

    def _setup_company(self, Company, CompanyMember, KanbanColumn, users):
        owner = users[0]
        company, _ = Company.objects.get_or_create(
            name=CO_NAME, owner=owner,
            defaults={"description": (
                "Разработка корпоративного ПО, аналитических платформ и мобильных приложений. "
                "100+ проектов за 8 лет, команда 30 специалистов."
            )},
        )

        admin_indices = {1, 2}
        for i, u in enumerate(users):
            role = "owner" if i == 0 else ("admin" if i in admin_indices else "member")
            CompanyMember.objects.get_or_create(
                company=company, user=u,
                defaults={"role": role, "status": "active", "joined_at": timezone.now()},
            )

        self.stdout.write(f"  Компания создана: {company.name}")

        cols = {}
        for name, color, order, key in [
            ("К выполнению", "#6B7280", 0, "new"),
            ("В работе",     "#3B82F6", 1, "in_progress"),
            ("На проверке",  "#F59E0B", 2, "review"),
            ("Готово",       "#10B981", 3, "done"),
        ]:
            col, _ = KanbanColumn.objects.get_or_create(
                company=company, name=name,
                defaults={"color": color, "order": order, "status_key": key},
            )
            cols[key] = col

        return company, cols

    # ── projects ───────────────────────────────────────────────────────────────

    def _create_projects(self, Project, company, users):
        today = date.today()
        projects = {}
        for name, code, desc, manager_idx, days_ago, deadline_days in _PROJECTS:
            proj, created = Project.objects.get_or_create(
                name=name, company=company,
                defaults=dict(
                    code=code,
                    description=desc,
                    owner=users[0],
                    manager=users[manager_idx],
                    status="active",
                    start_date=today - timedelta(days=days_ago),
                    deadline=today + timedelta(days=deadline_days),
                ),
            )
            if created:
                self.stdout.write(f"    Проект: {proj.name}")
            projects[code] = proj
        return projects

    # ── tasks ──────────────────────────────────────────────────────────────────

    def _create_tasks(self, Task, company, projects, cols, users):
        now = timezone.now()
        all_tasks = []

        for proj_code, specs in _TASKS.items():
            project = projects.get(proj_code)
            for title, desc, status, priority, assignee_idx, est_h, actual_h, days_due, days_created in specs:
                task, _ = Task.objects.get_or_create(
                    title=title,
                    company=company,
                    defaults=dict(
                        description=desc,
                        status=status,
                        priority=priority,
                        assignee=users[assignee_idx],
                        creator=users[0],
                        project=project,
                        kanban_column=cols[status],
                        due_date=now + timedelta(days=days_due),
                        estimated_hours=est_h,
                    ),
                )

                update_fields = {"created_at": now - timedelta(days=days_created)}
                if status == "done":
                    update_fields["completed_at"] = now + timedelta(days=days_due)
                    if actual_h:
                        update_fields["actual_hours"] = actual_h
                Task.objects.filter(id=task.id).update(**update_fields)
                all_tasks.append(task)

        self.stdout.write(f"  Задач: {len(all_tasks)}")
        return all_tasks

    # ── comments ───────────────────────────────────────────────────────────────

    def _add_comments(self, TaskComment, tasks, users):
        now = timezone.now()
        task_by_title = {t.title: t for t in tasks}
        count = 0

        for task_title, author_idx, text, days_ago in _COMMENTS:
            task = task_by_title.get(task_title)
            if not task:
                self.stdout.write(self.style.WARNING(f"  ⚠️  Задача не найдена: {task_title}"))
                continue
            comment, _ = TaskComment.objects.get_or_create(
                task=task, author=users[author_idx], text=text,
            )
            TaskComment.objects.filter(id=comment.id).update(
                created_at=now - timedelta(days=days_ago)
            )
            count += 1

        self.stdout.write(f"  Комментариев: {count}")
