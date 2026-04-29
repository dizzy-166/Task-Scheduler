"""
Seed command: создаёт тестовые компании, проекты, пользователей и задачи.

Использование:
  python manage.py seed_data          # создать данные
  python manage.py seed_data --flush  # удалить все тестовые данные и создать заново
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta, date
import random

SEED_EMAIL_MARKER = "@seed.test"   # по этому суффиксу определяем seed-пользователей


class Command(BaseCommand):
    help = "Создаёт тестовые данные: компании, проекты, пользователей, задачи."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Удалить существующие тестовые данные перед созданием новых",
        )

    def handle(self, *args, **options):
        from apps.users.models import User
        from apps.companies.models import Company, CompanyMember
        from apps.core.models import Project
        from apps.tasks.models import Task, KanbanColumn

        if options["flush"]:
            self._flush(User, Company, Project, Task, KanbanColumn)

        users = self._create_users(User)
        companies = self._create_companies(Company, CompanyMember, users)
        columns_map = self._create_columns(KanbanColumn, companies)
        projects_map = self._create_projects(Project, companies, users)
        self._create_tasks(Task, companies, projects_map, columns_map, users)

        self.stdout.write(self.style.SUCCESS("\n✅  Тестовые данные успешно созданы!\n"))
        self.stdout.write("Пользователи (пароль для всех: Test1234!):")
        for u in users:
            self.stdout.write(f"  {u.email}  —  {u.full_name}")

    # ── helpers ────────────────────────────────────────────────────────────────

    def _flush(self, User, Company, Project, Task, KanbanColumn):
        seed_users = User.objects.filter(email__endswith=SEED_EMAIL_MARKER)
        seed_company_ids = Company.objects.filter(
            owner__email__endswith=SEED_EMAIL_MARKER
        ).values_list("id", flat=True)

        Task.objects.filter(company_id__in=seed_company_ids).delete()
        KanbanColumn.objects.filter(company_id__in=seed_company_ids).delete()
        Project.objects.filter(company_id__in=seed_company_ids).delete()
        Company.objects.filter(id__in=seed_company_ids).delete()
        seed_users.delete()
        self.stdout.write(self.style.WARNING("🗑️  Старые тестовые данные удалены."))

    # ── users ──────────────────────────────────────────────────────────────────

    def _create_users(self, User):
        PASSWORD = "Test1234!"
        specs = [
            ("Алексей",   "Соколов",   "Иванович",  "sokolov"  ),
            ("Мария",     "Иванова",   "Петровна",  "ivanova"  ),
            ("Дмитрий",   "Петров",    "Алексеевич","petrov"   ),
            ("Анна",      "Сидорова",  "Дмитриевна","sidorova" ),
            ("Игорь",     "Козлов",    "Сергеевич", "kozlov"   ),
            ("Екатерина", "Морозова",  "Ивановна",  "morozova" ),
        ]
        users = []
        for first, last, patr, slug in specs:
            email = f"{slug}{SEED_EMAIL_MARKER}"
            u, created = User.objects.get_or_create(
                email=email,
                defaults=dict(
                    first_name=first,
                    last_name=last,
                    patronymic=patr,
                    is_active=True,
                    is_verified=True,
                ),
            )
            if created:
                u.set_password(PASSWORD)
                u.save()
                self.stdout.write(f"  👤 Создан: {email}")
            users.append(u)
        return users

    # ── companies ──────────────────────────────────────────────────────────────

    def _create_companies(self, Company, CompanyMember, users):
        sokolov, ivanova, petrov, sidorova, kozlov, morozova = users

        specs = [
            {
                "name": "ТехСтарт",
                "description": "Разработка мобильных и веб-приложений для стартапов",
                "owner": sokolov,
                "members": [
                    (ivanova,  "admin"),
                    (petrov,   "member"),
                    (sidorova, "member"),
                    (kozlov,   "member"),
                ],
            },
            {
                "name": "МаркетПро",
                "description": "Digital-маркетинг, SEO и performance-реклама",
                "owner": ivanova,
                "members": [
                    (sokolov,  "admin"),
                    (morozova, "member"),
                    (kozlov,   "member"),
                ],
            },
            {
                "name": "Дизайн Студия",
                "description": "UI/UX дизайн, брендинг и визуальные коммуникации",
                "owner": petrov,
                "members": [
                    (sidorova, "admin"),
                    (morozova, "member"),
                    (ivanova,  "member"),
                ],
            },
        ]

        companies = []
        for spec in specs:
            company, created = Company.objects.get_or_create(
                name=spec["name"],
                owner=spec["owner"],
                defaults={"description": spec["description"]},
            )
            if created:
                self.stdout.write(f"  🏢 Компания: {company.name}")

            # owner membership
            CompanyMember.objects.get_or_create(
                company=company,
                user=spec["owner"],
                defaults={"role": "owner", "status": "active", "joined_at": timezone.now()},
            )
            # other members
            for member_user, role in spec["members"]:
                CompanyMember.objects.get_or_create(
                    company=company,
                    user=member_user,
                    defaults={"role": role, "status": "active", "joined_at": timezone.now()},
                )
            companies.append(company)
        return companies

    # ── kanban columns ─────────────────────────────────────────────────────────

    def _create_columns(self, KanbanColumn, companies):
        default_cols = [
            ("К выполнению", "#6B7280", 0, "new"),
            ("В работе",     "#3B82F6", 1, "in_progress"),
            ("На проверке",  "#F59E0B", 2, "review"),
            ("Готово",       "#10B981", 3, "done"),
        ]
        columns_map = {}   # company_id → list[KanbanColumn]
        for company in companies:
            cols = []
            for name, color, order, status_key in default_cols:
                col, _ = KanbanColumn.objects.get_or_create(
                    company=company,
                    name=name,
                    defaults={"color": color, "order": order, "status_key": status_key},
                )
                cols.append(col)
            columns_map[company.id] = cols
        return columns_map

    # ── projects ───────────────────────────────────────────────────────────────

    def _create_projects(self, Project, companies, users):
        sokolov, ivanova, petrov, sidorova, kozlov, morozova = users
        techstart, marketpro, dizain = companies

        today = date.today()
        specs = [
            # ТехСтарт
            dict(name="Мобильное приложение",  company=techstart, owner=sokolov,
                 description="iOS и Android приложение для корпоративных клиентов",
                 status="active",  start_date=today - timedelta(days=45), deadline=today + timedelta(days=60)),
            dict(name="Веб-платформа",         company=techstart, owner=sokolov,
                 description="SaaS-платформа для управления проектами",
                 status="active",  start_date=today - timedelta(days=20), deadline=today + timedelta(days=90)),
            dict(name="API интеграции",        company=techstart, owner=ivanova,
                 description="Интеграции с внешними сервисами: CRM, ERP, платёжные системы",
                 status="active",  start_date=today - timedelta(days=10), deadline=today + timedelta(days=30)),

            # МаркетПро
            dict(name="Рекламная кампания Q2", company=marketpro, owner=ivanova,
                 description="Performance-кампании в Google Ads и Яндекс.Директ",
                 status="active",  start_date=today - timedelta(days=30), deadline=today + timedelta(days=62)),
            dict(name="SEO оптимизация",       company=marketpro, owner=morozova,
                 description="Технический SEO-аудит и продвижение в топ-10",
                 status="active",  start_date=today - timedelta(days=60), deadline=today + timedelta(days=30)),
            dict(name="Email маркетинг",       company=marketpro, owner=ivanova,
                 description="Автоматизация email-цепочек и A/B тесты",
                 status="active",  start_date=today,                       deadline=today + timedelta(days=45)),

            # Дизайн Студия
            dict(name="Редизайн сайта",        company=dizain,    owner=petrov,
                 description="Полный редизайн корпоративного сайта под новый брендбук",
                 status="active",  start_date=today - timedelta(days=15), deadline=today + timedelta(days=45)),
            dict(name="Брендбук 2025",         company=dizain,    owner=sidorova,
                 description="Разработка фирменного стиля и руководства по применению",
                 status="active",  start_date=today - timedelta(days=5),  deadline=today + timedelta(days=25)),
            dict(name="UX-исследование",       company=dizain,    owner=petrov,
                 description="Качественные интервью и количественные опросы пользователей",
                 status="active",  start_date=today,                       deadline=today + timedelta(days=20)),
        ]

        projects_map = {}   # company_id → list[Project]
        for spec in specs:
            proj, created = Project.objects.get_or_create(
                name=spec["name"],
                company=spec["company"],
                defaults={k: v for k, v in spec.items() if k not in ("name", "company")},
            )
            if created:
                self.stdout.write(f"    📁 Проект: {proj.name} ({proj.company.name})")
            projects_map.setdefault(spec["company"].id, []).append(proj)
        return projects_map

    # ── tasks ──────────────────────────────────────────────────────────────────

    def _create_tasks(self, Task, companies, projects_map, columns_map, users):
        sokolov, ivanova, petrov, sidorova, kozlov, morozova = users
        techstart, marketpro, dizain = companies

        today = timezone.now()

        # (title, description, status, priority, assignee, days_due)
        task_specs = {
            techstart.id: [
                # Мобильное приложение tasks
                ("Настроить CI/CD для iOS",       "Настроить GitHub Actions + Fastlane",           "done",        "high",     sokolov,  -5),
                ("Дизайн онбординга",             "Разработать экраны приветствия и туториала",     "review",      "medium",   ivanova,   3),
                ("Push-уведомления",              "Интегрировать Firebase Cloud Messaging",         "in_progress", "high",     petrov,    7),
                ("Offline-режим",                 "Кэширование данных при отсутствии интернета",   "new",         "medium",   sidorova, 14),
                ("Тесты авторизации",             "Unit и UI-тесты для флоу входа и регистрации",  "in_progress", "medium",   kozlov,    5),
                ("Аналитика (Amplitude)",         "Логирование ключевых событий пользователя",     "new",         "low",      petrov,   20),

                # Веб-платформа tasks
                ("Реализовать drag-and-drop",     "Перетаскивание задач и колонок канбана",         "done",        "high",     sokolov,  -2),
                ("Фильтрация задач",              "Фильтры по статусу, приоритету, исполнителю",   "in_progress", "medium",   ivanova,   8),
                ("Экспорт в CSV",                 "Выгрузка задач с фильтрами в CSV",              "new",         "low",      kozlov,   25),
                ("Ролевая модель доступа",        "RBAC: ограничение по компании и проекту",        "review",      "critical", sokolov,   2),
                ("Тёмная тема",                   "Переключение light/dark через CSS-переменные",  "done",        "medium",   sidorova, -10),
                ("WebSocket для live-обновлений", "Django Channels + Redis для realtime",           "new",         "high",     petrov,   30),

                # API tasks
                ("Интеграция с 1C",               "REST-адаптер для обмена данными с 1С:ERP",      "in_progress", "critical", sokolov,   5),
                ("OAuth 2.0 для партнёров",       "Выдача токенов внешним приложениям",            "new",         "high",     ivanova,  15),
                ("Rate limiting",                 "Ограничение запросов на уровне Nginx + Redis",  "review",      "medium",   petrov,    3),
            ],

            marketpro.id: [
                # Рекламная кампания tasks
                ("Аудит рекламных кабинетов",    "Проверить структуру кампаний и минус-слова",     "done",        "high",     ivanova,  -3),
                ("Настройка ретаргетинга",        "Аудитории look-alike и ремаркетинг",            "in_progress", "high",     morozova,  6),
                ("Баннеры для РСЯ",               "Создать 5 форматов баннеров под разные сегм.",  "review",      "medium",   kozlov,    4),
                ("Отчёт по CPL за апрель",        "Сравнение CPL по каналам и гео",               "new",         "medium",   ivanova,  10),
                ("A/B тест заголовков",           "Тестировать 3 варианта заголовков объявлений",  "in_progress", "low",      morozova,  8),

                # SEO tasks
                ("Технический аудит",             "Crawler + анализ Core Web Vitals",              "done",        "high",     morozova, -7),
                ("Кластеризация запросов",        "Группировка 5000 ключей по интенту",           "done",        "medium",   kozlov,   -4),
                ("Написание мета-тегов",          "Title и Description для 200 страниц",           "in_progress", "medium",   ivanova,   5),
                ("Построение ссылочной массы",    "Аутрич: 20 площадок для размещения",           "new",         "high",     morozova, 20),
                ("Анализ конкурентов",             "Топ-10 конкурентов по семантике",              "review",      "low",      kozlov,    2),

                # Email tasks
                ("Welcome-цепочка",               "5 писем после регистрации",                     "in_progress", "high",     ivanova,   7),
                ("Сегментация базы",              "Разбить базу по активности и интересам",        "new",         "medium",   morozova, 12),
                ("A/B тест темы письма",          "Тестировать эмодзи vs без эмодзи в теме",      "new",         "low",      kozlov,   18),
            ],

            dizain.id: [
                # Редизайн tasks
                ("Анализ текущего сайта",         "Heatmap, запись сессий, метрики отказов",       "done",        "medium",   petrov,  -10),
                ("Wireframes главной страницы",   "Low-fidelity скетчи основных секций",           "done",        "high",     sidorova, -5),
                ("Дизайн главной — desktop",      "Pixel-perfect макет в Figma",                   "review",      "high",     petrov,    2),
                ("Дизайн главной — mobile",       "Адаптация под 375px и 390px",                  "in_progress", "high",     sidorova,  5),
                ("Дизайн внутренних страниц",     "О нас, Услуги, Контакты",                       "new",         "medium",   morozova, 14),
                ("Анимации и микровзаимодействия","Hover-эффекты, переходы между страницами",      "new",         "low",      petrov,   20),

                # Брендбук tasks
                ("Логотип и монограмма",          "3 концепции + финальная версия",               "done",        "critical", sidorova, -8),
                ("Цветовая палитра",              "Основные и дополнительные цвета + CMYK/RGB",    "done",        "high",     petrov,   -3),
                ("Типографика",                   "Выбор шрифтов, размерная шкала, межстрочный",  "review",      "medium",   morozova,  1),
                ("Гайдлайн по применению",        "Примеры использования фирстиля",               "in_progress", "medium",   sidorova,  6),

                # UX tasks
                ("Скрининг респондентов",         "Найти 12 человек для интервью",                "done",        "high",     petrov,   -2),
                ("Проведение интервью",           "8 глубинных интервью по 60 минут",              "in_progress", "high",     sidorova,  4),
                ("Обработка данных",              "Аффинити-диаграмма, Jobs To Be Done",          "new",         "medium",   morozova, 10),
                ("Презентация инсайтов",          "Deck с выводами и рекомендациями для клиента", "new",         "medium",   petrov,   15),
            ],
        }

        status_to_col_idx = {"new": 0, "in_progress": 1, "review": 2, "done": 3}

        total = 0
        for company in companies:
            cols = columns_map[company.id]
            projects = projects_map.get(company.id, [])
            specs = task_specs.get(company.id, [])

            for i, (title, desc, status, priority, assignee, days) in enumerate(specs):
                project = projects[i % len(projects)] if projects else None
                col = cols[status_to_col_idx.get(status, 0)]
                due = today + timedelta(days=days) if days else None

                Task.objects.get_or_create(
                    title=title,
                    company=company,
                    defaults=dict(
                        description=desc,
                        status=status,
                        priority=priority,
                        assignee=assignee,
                        creator=company.owner,
                        project=project,
                        kanban_column=col,
                        due_date=due,
                        estimated_hours=random.choice([2, 4, 8, 16, 24]),
                    ),
                )
                total += 1

        self.stdout.write(f"  ✅ Создано задач: {total}")
