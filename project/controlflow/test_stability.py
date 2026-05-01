import psycopg2

conn = psycopg2.connect(
    host="db.slflwaoxjhsqqokhqcvr.supabase.co",
    port=5432,
    dbname="postgres",
    user="postgres",
    password="ControlFlow2024",
    sslmode="require",
    connect_timeout=10,
    keepalives=1,
    keepalives_idle=30,
    keepalives_interval=10,
    keepalives_count=5,
    options="-c TimeZone=Europe/Moscow -c client_encoding=UTF8 -c default_transaction_isolation=read\ committed"
)
conn.autocommit = False

print("Connected OK")
for i in range(20):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT %s::int", (i,))
        r = cursor.fetchone()[0]
        cursor.close()
        print(f"Query {i+1}: OK (got {r})")
    except Exception as e:
        print(f"Query {i+1}: FAILED - {e}")
        break

conn.close()
