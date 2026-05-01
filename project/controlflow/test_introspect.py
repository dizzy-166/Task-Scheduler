import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection
cursor = connection.cursor()
# Test the exact query Django's introspection uses
try:
    cursor.execute("SELECT c.relname FROM pg_catalog.pg_class c WHERE pg_catalog.pg_table_is_visible(c.oid) AND c.relkind IN ('r','v','m','p','f') LIMIT 5")
    rows = cursor.fetchall()
    print("introspection query OK:", rows)
except Exception as e:
    print("introspection query FAILED:", e)
