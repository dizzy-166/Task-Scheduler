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

# Check existing records
cursor.execute("SELECT id, app, name, applied FROM django_migrations ORDER BY id")
rows = cursor.fetchall()
print("Existing records:")
for r in rows:
    print(" ", r)

# Try INSERT without parameters
try:
    cursor.execute("INSERT INTO django_migrations (app, name, applied) VALUES ('test_app', 'test_0001', NOW())")
    print("INSERT without params: SUCCESS")
    cursor.execute("DELETE FROM django_migrations WHERE app='test_app'")
    print("DELETE: SUCCESS")
except Exception as e:
    print("INSERT without params FAILED:", e)

cursor.close()
conn.close()
