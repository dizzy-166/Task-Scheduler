import psycopg2

# Test: many queries in ONE transaction (single BEGIN/COMMIT)
print("=== One transaction, many queries ===")
conn = psycopg2.connect(
    host="db.slflwaoxjhsqqokhqcvr.supabase.co",
    port=5432,
    dbname="postgres",
    user="postgres",
    password="ControlFlow2024",
    sslmode="require",
    connect_timeout=10
)
conn.autocommit = False

try:
    cursor = conn.cursor()
    cursor.execute("BEGIN")
    print("BEGIN: OK")
    for i in range(10):
        cursor.execute(f"SELECT {i}")
        r = cursor.fetchone()[0]
        print(f"  Query {i+1}: OK")
    cursor.execute("COMMIT")
    print("COMMIT: OK")
    cursor.close()
except Exception as e:
    print(f"FAILED at query: {e}")
conn.close()
