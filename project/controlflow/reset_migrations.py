from django.db import connection

# Удаляем записи о миграциях companies
cursor = connection.cursor()
cursor.execute("DELETE FROM django_migrations WHERE app='companies'")
print('Deleted companies migrations from django_migrations table')

# Проверяем, что удалено
cursor.execute("SELECT * FROM django_migrations WHERE app='companies'")
rows = cursor.fetchall()
print(f'Remaining companies migrations: {len(rows)}')