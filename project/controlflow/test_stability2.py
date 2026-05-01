import psycopg2

# Test 1: autocommit=True
print("=== autocommit=True ===")
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

for i in range(10):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT %s::int", (i,))
        r = cursor.fetchone()[0]
        cursor.close()
        print(f"Query {i+1}: OK")
    except Exception as e:
        print(f"Query {i+1}: FAILED - {e}")
        break
conn.close()

# Test 2: no parameters
print("\n=== No parameters ===")
conn2 = psycopg2.connect(
    host="db.slflwaoxjhsqqokhqcvr.supabase.co",
    port=5432,
    dbname="postgres",
    user="postgres",
    password="ControlFlow2024",
    sslmode="require",
    connect_timeout=10
)
conn2.autocommit = False

for i in range(10):
    try:
        cursor = conn2.cursor()
        cursor.execute(f"SELECT {i}")
        r = cursor.fetchone()[0]
        cursor.close()
        print(f"Query {i+1}: OK")
    except Exception as e:
        print(f"Query {i+1}: FAILED - {e}")
        break
conn2.close()
