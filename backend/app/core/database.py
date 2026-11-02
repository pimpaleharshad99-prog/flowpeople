from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

# Enable foreign key constraints for SQLite
if "sqlite" in settings.DATABASE_URL:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Safe incremental SQLite migration for newly added columns
def _migrate_columns():
    try:
        from sqlalchemy import text
        import uuid
        with engine.connect() as conn:
            # attendance_punches columns
            try:
                conn.execute(text("ALTER TABLE attendance_punches ADD COLUMN verification_method VARCHAR(50) DEFAULT 'FACE'"))
                conn.commit()
            except Exception:
                pass

            # companies columns
            company_cols = [
                ("brand_name", "VARCHAR(200)"),
                ("uuid", "VARCHAR(36)"),
                ("slug", "VARCHAR(100)"),
                ("owner_user_id", "INTEGER"),
                ("phone", "VARCHAR(50)"),
                ("address", "TEXT"),
                ("industry", "VARCHAR(100)"),
                ("company_size", "VARCHAR(50)"),
                ("status", "VARCHAR(50) DEFAULT 'ACTIVE'"),
                ("updated_at", "DATETIME")
            ]
            for col_name, col_type in company_cols:
                try:
                    conn.execute(text(f"ALTER TABLE companies ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception:
                    pass

            # users columns
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN uuid VARCHAR(36)"))
                conn.commit()
            except Exception:
                pass

            # create organization_members table if not exists
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS organization_members (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        uuid VARCHAR(36) UNIQUE,
                        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        role VARCHAR(50) NOT NULL DEFAULT 'EMPLOYEE',
                        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
                        joined_at DATETIME,
                        created_at DATETIME,
                        updated_at DATETIME,
                        UNIQUE(company_id, user_id)
                    )
                """))
                conn.commit()
            except Exception:
                pass

            # Populate missing UUIDs for existing companies
            try:
                rows = conn.execute(text("SELECT id FROM companies WHERE uuid IS NULL OR uuid = ''")).fetchall()
                for (cid,) in rows:
                    conn.execute(text("UPDATE companies SET uuid = :u WHERE id = :id"), {"u": str(uuid.uuid4()), "id": cid})
                conn.commit()
            except Exception:
                pass

            # Populate missing UUIDs for existing users
            try:
                rows = conn.execute(text("SELECT id FROM users WHERE uuid IS NULL OR uuid = ''")).fetchall()
                for (uid,) in rows:
                    conn.execute(text("UPDATE users SET uuid = :u WHERE id = :id"), {"u": str(uuid.uuid4()), "id": uid})
                conn.commit()
            except Exception:
                pass

            # Sync existing users into organization_members
            try:
                conn.execute(text("""
                    INSERT OR IGNORE INTO organization_members (uuid, company_id, user_id, role, status, joined_at, created_at, updated_at)
                    SELECT 
                        hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)),
                        company_id,
                        id,
                        role,
                        status,
                        created_at,
                        created_at,
                        updated_at
                    FROM users
                    WHERE company_id IS NOT NULL
                """))
                conn.commit()
            except Exception:
                pass

            # Create organization_integrations table if not exists
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS organization_integrations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        uuid VARCHAR(36) UNIQUE,
                        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                        organization_uuid VARCHAR(36),
                        provider VARCHAR(50) NOT NULL DEFAULT 'google_drive',
                        connected_account_email VARCHAR(255),
                        encrypted_refresh_token TEXT,
                        access_token TEXT,
                        access_token_expiry DATETIME,
                        drive_root_folder_id VARCHAR(255),
                        drive_company_folder_id VARCHAR(255),
                        drive_attendance_folder_id VARCHAR(255),
                        drive_employees_folder_id VARCHAR(255),
                        drive_payroll_folder_id VARCHAR(255),
                        drive_leave_folder_id VARCHAR(255),
                        connection_status VARCHAR(50) NOT NULL DEFAULT 'NOT_CONNECTED',
                        auto_attendance_reports BOOLEAN DEFAULT 1,
                        auto_monthly_reports BOOLEAN DEFAULT 1,
                        last_successful_sync DATETIME,
                        last_error TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(company_id, provider)
                    )
                """))
                conn.commit()
            except Exception:
                pass

            # Create organization_drive_uploads table if not exists
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS organization_drive_uploads (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        uuid VARCHAR(36) UNIQUE,
                        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                        organization_uuid VARCHAR(36),
                        report_type VARCHAR(100) NOT NULL,
                        file_name VARCHAR(255) NOT NULL,
                        file_size_bytes INTEGER DEFAULT 0,
                        mime_type VARCHAR(100) DEFAULT 'application/pdf',
                        drive_file_id VARCHAR(255),
                        drive_folder_id VARCHAR(255),
                        drive_web_view_link VARCHAR(1000),
                        upload_status VARCHAR(50) DEFAULT 'PENDING',
                        retry_count INTEGER DEFAULT 0,
                        error_message TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
            except Exception:
                pass

            # Create platform_admins table if not exists
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS platform_admins (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id VARCHAR(64) UNIQUE NOT NULL,
                        role VARCHAR(50) NOT NULL DEFAULT 'SUPER_ADMIN',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
            except Exception:
                pass

    except Exception:
        pass

_migrate_columns()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

