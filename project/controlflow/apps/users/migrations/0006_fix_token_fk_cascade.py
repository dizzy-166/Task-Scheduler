from django.db import migrations


FIX_CASCADE_SQL = """
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Fix email_verification_tokens FK
    FOR r IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'email_verification_tokens'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'user_id'
    LOOP
        EXECUTE format(
            'ALTER TABLE email_verification_tokens DROP CONSTRAINT %I',
            r.constraint_name
        );
        EXECUTE format(
            'ALTER TABLE email_verification_tokens ADD CONSTRAINT %I
             FOREIGN KEY (user_id) REFERENCES users(id)
             ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
            r.constraint_name
        );
    END LOOP;

    -- Fix password_reset_tokens FK
    FOR r IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'password_reset_tokens'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'user_id'
    LOOP
        EXECUTE format(
            'ALTER TABLE password_reset_tokens DROP CONSTRAINT %I',
            r.constraint_name
        );
        EXECUTE format(
            'ALTER TABLE password_reset_tokens ADD CONSTRAINT %I
             FOREIGN KEY (user_id) REFERENCES users(id)
             ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
            r.constraint_name
        );
    END LOOP;
END $$;
"""

REVERSE_SQL = migrations.RunSQL.noop


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_emailverificationtoken_passwordresettoken'),
    ]

    operations = [
        migrations.RunSQL(FIX_CASCADE_SQL, reverse_sql=REVERSE_SQL),
    ]
