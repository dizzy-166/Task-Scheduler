import psycopg2

conn = psycopg2.connect(
    host="db.slflwaoxjhsqqokhqcvr.supabase.co",
    port=5432,
    dbname="postgres",
    user="postgres",
    password="ControlFlow2024",
    sslmode="require",
    connect_timeout=10
)
conn.autocommit = True
cursor = conn.cursor()

# Test parameterized SELECT
try:
    cursor.execute("SELECT count(*) FROM django_migrations WHERE app = %s", ("auth",))
    print("Parameterized SELECT: SUCCESS, count =", cursor.fetchone()[0])
except Exception as e:
    print("Parameterized SELECT FAILED:", e)

# Test parameterized INSERT
try:
    cursor.execute("INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, NOW())", ("test2", "test2"))
    print("Parameterized INSERT: SUCCESS")
    cursor.execute("DELETE FROM django_migrations WHERE app = %s", ("test2",))
    print("Parameterized DELETE: SUCCESS")
except Exception as e:
    print("Parameterized INSERT FAILED:", e)

cursor.close()
conn.close()
