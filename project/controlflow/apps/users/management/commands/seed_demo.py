"""
Seed command: одна компания, 22 участника, 6 проектов, 28 задач.

  python manage.py seed_demo           # создать данные
  python manage.py seed_demo --flush   # удалить и создать заново
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta, date
import random

MARKER = "@demo.test"
PASSWORD = "123456"


class Command(BaseCommand):
    help = "Создаёт демо-компанию с 22 участниками, 6 проектами и 28 задачами."

    def add_arguments(self, parser):
        parser.add_argument("--flush", action="store_true",
                            help="Удалить демо-данные перед созданием")

    def handle(self, *args, **options):
        from apps.users.models import User
        from apps.companies.models import Company, CompanyMember
        from apps.core.models import Project
        from apps.tasks.models import Task, KanbanColumn

        if options["flush"]:
            self._flush(User, Company, Project, Task, KanbanColumn)

        users   = self._make_users(User)
        company = self._make_company(Company, CompanyMember, users)
        cols    = self._make_columns(KanbanColumn, company)
        projs   = self._make_projects(Project, company, users)
        self._make_tasks(Task, company, projs, cols, users)

        self.stdout.write(self.style.SUCCESS("\n[OK] Демо-данные созданы!\n"))
        self.stdout.write("Пароль для всех: 123456")
        self.stdout.write(f"Владелец компании: {users[0].email}\n")
        for u in users[:5]:
            self.stdout.write(f"  {u.email}")
        self.stdout.write(f"  ... и ещё {len(users)-5} пользователей")

    # ──────────────────────────────────────────────────────────────────────────

    def _flush(self, User, Company, Project, Task, KanbanColumn):
        seed_users = User.objects.filter(email__endswith=MARKER)
        cids = Company.objects.filter(
            owner__email__endswith=MARKER
        ).values_list("id", flat=True)
        Task.objects.filter(company_id__in=cids).delete()
        KanbanColumn.objects.filter(company_id__in=cids).delete()
        Project.objects.filter(company_id__in=cids).delete()
        Company.objects.filter(id__in=cids).delete()
        seed_users.delete()
        self.stdout.write(self.style.WARNING("[flush] Старые демо-данные удалены."))

    def _make_users(self, User):
        specs = [
            # (first, last, patronymic, slug)
            ("Александр", "Волков",      "Игоревич",    "volkov"),
            ("Наталья",   "Романова",    "Сергеевна",   "romanova"),
            ("Сергей",    "Белов",       "Андреевич",   "belov"),
            ("Ольга",     "Новикова",    "Дмитриевна",  "novikova"),
            ("Михаил",    "Захаров",     "Павлович",    "zakharov"),
            ("Татьяна",   "Лебедева",    "Ивановна",    "lebedeva"),
            ("Андрей",    "Смирнов",     "Николаевич",  "smirnov"),
            ("Юлия",      "Фёдорова",    "Алексеевна",  "fedorova"),
            ("Николай",   "Попов",       "Викторович",  "popov"),
            ("Елена",     "Гусева",      "Романовна",   "guseva"),
            ("Павел",     "Орлов",       "Денисович",   "orlov"),
            ("Ирина",     "Зайцева",     "Михайловна",  "zajtseva"),
            ("Денис",     "Соловьёв",    "Артёмович",   "solovyov"),
            ("Алина",     "Шубина",      "Константиновна","shubina"),
            ("Константин","Ермаков",     "Юрьевич",     "ermakov"),
            ("Валерия",   "Крылова",     "Олеговна",    "krylova"),
            ("Артём",     "Никитин",     "Сергеевич",   "nikitin"),
            ("Светлана",  "Виноградова", "Павловна",    "vinogradova"),
            ("Роман",     "Борисов",     "Андреевич",   "borisov"),
            ("Анастасия", "Кузьмина",    "Игоревна",    "kuzmina"),
            ("Владимир",  "Степанов",    "Алексеевич",  "stepanov"),
            ("Кристина",  "Макарова",    "Денисовна",   "makarova"),
        ]
        users = []
        for first, last, patr, slug in specs:
            email = f"{slug}{MARKER}"
            u, created = User.objects.get_or_create(
                email=email,
                defaults=dict(first_name=first, last_name=last,
                              patronymic=patr, is_active=True, is_verified=True),
            )
            if created:
                u.set_password(PASSWORD)
                u.save()
                self.stdout.write(f"  + {u.full_name} — {email}")
            users.append(u)
        return users

    def _make_company(self, Company, CompanyMember, users):
        owner = users[0]  # Волков
        company, created = Company.objects.get_or_create(
            name="ООО «ТехноПром»",
            owner=owner,
            defaults={"description": "Разработка корпоративного ПО и цифровая трансформация бизнеса"},
        )
        if created:
            self.stdout.write(f"\n  [company] {company.name}")

        # owner
        CompanyMember.objects.get_or_create(
            company=company, user=owner,
            defaults={"role": "owner", "status": "active", "joined_at": timezone.now()},
        )

        # admins: Романова, Белов
        for u in users[1:3]:
            CompanyMember.objects.get_or_create(
                company=company, user=u,
                defaults={"role": "admin", "status": "active", "joined_at": timezone.now()},
            )

        # everyone else — member
        for u in users[3:]:
            CompanyMember.objects.get_or_create(
                company=company, user=u,
                defaults={"role": "member", "status": "active", "joined_at": timezone.now()},
            )

        return company

    def _make_columns(self, KanbanColumn, company):
        defs = [
            ("К выполнению", "#6B7280", 0, "new"),
            ("В работе",     "#3B82F6", 1, "in_progress"),
            ("На проверке",  "#F59E0B", 2, "review"),
            ("Готово",       "#10B981", 3, "done"),
        ]
        cols = []
        for name, color, order, key in defs:
            col, _ = KanbanColumn.objects.get_or_create(
                company=company, name=name,
                defaults={"color": color, "order": order, "status_key": key},
            )
            cols.append(col)
        return cols  # [new, in_progress, review, done]

    def _make_projects(self, Project, company, users):
        owner = users[0]
        today = date.today()
        specs = [
            ("Корпоративный портал",    "Внутренний портал: новости, база знаний, HR-модуль",
             "active",    today - timedelta(60), today + timedelta(45)),
            ("Мобильное приложение",    "iOS/Android клиент для сотрудников и партнёров",
             "active",    today - timedelta(30), today + timedelta(90)),
            ("CRM система",             "Управление клиентской базой и воронкой продаж",
             "active",    today - timedelta(90), today + timedelta(30)),
            ("Аналитическая платформа", "BI-дашборды, отчёты, интеграция с 1С и SAP",
             "active",    today - timedelta(15), today + timedelta(60)),
            ("DevOps и инфраструктура", "CI/CD, мониторинг, Kubernetes-кластер",
             "active",    today - timedelta(20), today + timedelta(40)),
            ("HR-система",              "Онбординг, учёт отпусков, оценка персонала",
             "on_hold",   today - timedelta(10), today + timedelta(120)),
        ]
        projs = []
        for name, desc, status, start, deadline in specs:
            p, created = Project.objects.get_or_create(
                name=name, company=company,
                defaults=dict(description=desc, status=status,
                              start_date=start, deadline=deadline, owner=owner),
            )
            if created:
                self.stdout.write(f"    [project] {p.name}")
            projs.append(p)
        return projs

    def _make_tasks(self, Task, company, projs, cols, users):
        portal, mobile, crm, analytics, devops, hr = projs
        col_new, col_wip, col_rev, col_done = cols
        today = timezone.now()

        # u[0]=Волков(owner), u[1]=Романова(admin), u[2]=Белов(admin),
        # u[3..]=члены команды
        u = users

        S2C = {"new": col_new, "in_progress": col_wip, "review": col_rev, "done": col_done}

        tasks = [
            # ── Корпоративный портал ─────────────────────────────────────────
            ("Разработка главной страницы портала",
             "Вёрстка дашборда с новостями, быстрыми ссылками и виджетами",
             "done",        "high",     u[2],  -10, portal, 16),
            ("Модуль базы знаний",
             "Wiki-система с поиском, тегами и версионированием статей",
             "in_progress", "high",     u[5],    7, portal, 24),
            ("Интеграция с Active Directory",
             "SSO через LDAP, синхронизация групп и ролей",
             "review",      "critical", u[2],    2, portal,  8),
            ("Мобильная версия портала",
             "Адаптивная вёрстка под смартфоны и планшеты",
             "new",         "medium",   u[8],   14, portal, 12),
            ("Система уведомлений",
             "Push и email-уведомления о событиях портала",
             "in_progress", "medium",   u[11],   5, portal,  8),

            # ── Мобильное приложение ────────────────────────────────────────
            ("Экраны онбординга",
             "Приветственные экраны, туториал, запрос разрешений",
             "done",        "medium",   u[3],   -7, mobile,  8),
            ("Авторизация через Face ID / Touch ID",
             "Биометрическая аутентификация на iOS и Android",
             "review",      "high",     u[6],    3, mobile,  6),
            ("Чат между сотрудниками",
             "Realtime-мессенджер с поддержкой файлов и реакций",
             "in_progress", "high",     u[9],   10, mobile, 40),
            ("Оффлайн-режим",
             "Локальное кэширование данных и синхронизация при подключении",
             "new",         "medium",   u[12],  21, mobile, 20),
            ("Push-уведомления",
             "FCM и APNs интеграция, настройки категорий уведомлений",
             "in_progress", "medium",   u[15],   6, mobile, 12),
            ("Раздел аналитики для менеджера",
             "Графики продаж, KPI команды, воронка",
             "new",         "low",      u[18],  30, mobile, 16),

            # ── CRM система ─────────────────────────────────────────────────
            ("Карточка клиента",
             "История сделок, контакты, задачи, комментарии в одном месте",
             "done",        "high",     u[1],   -5, crm,    20),
            ("Воронка продаж",
             "Kanban-воронка со стадиями, drag-and-drop, автоматизации",
             "done",        "critical", u[1],   -2, crm,    32),
            ("Email-рассылки из CRM",
             "Шаблоны писем, сегментация, статистика открытий",
             "review",      "medium",   u[4],    1, crm,    16),
            ("Интеграция с телефонией",
             "Запись звонков, click-to-call, всплывающая карточка",
             "in_progress", "high",     u[7],    8, crm,    24),
            ("Отчёты по сделкам",
             "Фильтры, экспорт в Excel, сводная таблица по менеджерам",
             "new",         "medium",   u[10],  15, crm,    12),

            # ── Аналитическая платформа ─────────────────────────────────────
            ("ETL-пайплайн из 1С",
             "Ежедневная выгрузка справочников и оборотов в хранилище",
             "in_progress", "critical", u[2],    5, analytics, 24),
            ("Дашборд финансов",
             "P&L, движение денег, бюджет vs факт в разрезе ЦФО",
             "review",      "high",     u[13],   3, analytics, 16),
            ("Дашборд продаж",
             "Динамика выручки, план-факт, топ клиентов и продуктов",
             "in_progress", "high",     u[16],   7, analytics, 12),
            ("Хранилище данных (DWH)",
             "PostgreSQL + dbt: слои staging, core, mart",
             "new",         "critical", u[2],   20, analytics, 40),
            ("Автоматические алерты",
             "Уведомления при отклонении KPI от плана > 15%",
             "new",         "medium",   u[19],  25, analytics,  8),

            # ── DevOps ──────────────────────────────────────────────────────
            ("Настройка Kubernetes кластера",
             "3 ноды в Yandex Cloud, Helm-чарты для всех сервисов",
             "done",        "critical", u[0],   -3, devops, 20),
            ("CI/CD для всех репозиториев",
             "GitHub Actions: lint → test → build → deploy",
             "in_progress", "high",     u[2],    6, devops, 16),
            ("Мониторинг (Prometheus + Grafana)",
             "Метрики сервисов, дашборды, алерты в Telegram",
             "review",      "high",     u[20],   2, devops, 12),
            ("Централизованный логгинг",
             "ELK стек: сбор, индексация и поиск логов всех сервисов",
             "new",         "medium",   u[14],  18, devops, 16),

            # ── HR-система ──────────────────────────────────────────────────
            ("Онбординг новых сотрудников",
             "Чек-листы, задачи на первую неделю, welcome-пакет",
             "in_progress", "medium",   u[17],  12, hr, 8),
            ("Учёт отпусков и больничных",
             "Календарь, согласование заявок, интеграция с 1С ЗУП",
             "new",         "medium",   u[21],  30, hr, 16),
            ("360-градусная оценка",
             "Анкеты, анонимные отзывы, отчёт по компетенциям",
             "new",         "low",      u[3],   45, hr, 20),
        ]

        created_count = 0
        for title, desc, status, priority, assignee, days, project, hours in tasks:
            due = today + timedelta(days=days) if days else None
            _, created = Task.objects.get_or_create(
                title=title,
                company=company,
                defaults=dict(
                    description=desc,
                    status=status,
                    priority=priority,
                    assignee=assignee,
                    creator=company.owner,
                    project=project,
                    kanban_column=S2C[status],
                    due_date=due,
                    estimated_hours=hours,
                ),
            )
            if created:
                created_count += 1

        self.stdout.write(f"\n  [tasks] Создано: {created_count}/28")
        self.stdout.write(f"  [users] Участников: {len(users)}")
