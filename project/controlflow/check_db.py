import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from django.db import connection
c = connection.cursor()
c.execute("SELECT tablename FROM pg_tables WHERE schemaname='ControlFlow' ORDER BY tablename")
tables = [r[0] for r in c.fetchall()]
print(f"Tables in ControlFlow ({len(tables)}):", tables)
