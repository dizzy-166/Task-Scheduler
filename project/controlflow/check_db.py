import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection
from django.conf import settings

def check_database():
    print("=" * 60)
    print("DATABASE CONNECTION CHECK")
    print("=" * 60)
    
    # Параметры подключения
    db_config = settings.DATABASES['default']
    print(f"\n📊 Connection parameters:")
    print(f"   Database: {db_config['NAME']}")
    print(f"   User: {db_config['USER']}")
    print(f"   Host: {db_config['HOST']}:{db_config['PORT']}")
    
    try:
        with connection.cursor() as cursor:
            # Проверка подключения
            cursor.execute("SELECT version();")
            version = cursor.fetchone()[0]
            print(f"\n✅ Connected to PostgreSQL")
            print(f"   Version: {version.split(',')[0]}")
            
            # Текущая база данных
            cursor.execute("SELECT current_database();")
            current_db = cursor.fetchone()[0]
            print(f"\n📁 Current database: {current_db}")
            
            # Текущая схема
            cursor.execute("SELECT current_schema();")
            current_schema = cursor.fetchone()[0]
            print(f"   Current schema: {current_schema}")
            
            # Проверка search_path
            cursor.execute("SHOW search_path;")
            search_path = cursor.fetchone()[0]
            print(f"   Search path: {search_path}")
            
            # Таблицы в схеме ControlFlow
            cursor.execute("""
                SELECT table_name, 
                       (SELECT count(*) FROM information_schema.columns 
                        WHERE table_schema = 'ControlFlow' AND table_name = t.table_name) as column_count
                FROM information_schema.tables t
                WHERE table_schema = 'ControlFlow'
                ORDER BY table_name;
            """)
            tables = cursor.fetchall()
            
            print(f"\n📋 Tables in ControlFlow schema:")
            if tables:
                for table, col_count in tables:
                    print(f"   ✅ {table} ({col_count} columns)")
            else:
                print("   ⚠️  No tables found in ControlFlow schema!")
            
            # Проверка таблицы users
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'ControlFlow' AND table_name = 'users'
                );
            """)
            users_exists = cursor.fetchone()[0]
            
            if users_exists:
                cursor.execute('SELECT COUNT(*) FROM "ControlFlow".users;')
                user_count = cursor.fetchone()[0]
                print(f"\n👥 Users table: EXISTS")
                print(f"   Total users: {user_count}")
            else:
                print(f"\n⚠️  Users table NOT FOUND in ControlFlow schema!")
                
    except Exception as e:
        print(f"\n❌ Database connection failed!")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Error message: {str(e)}")

if __name__ == "__main__":
    check_database()