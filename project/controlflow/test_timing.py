import psycopg2
import time

print("=== Test: sleep 3s between queries ===")
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

for i in range(6):
    try:
        cursor = conn.cursor()
        cursor.execute(f"SELECT {i}")
        r = cursor.fetchone()[0]
        cursor.close()
        print(f"Query {i+1}: OK")
        time.sleep(3)
    except Exception as e:
        print(f"Query {i+1}: FAILED - {e}")
        break
conn.close()
