import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

USE_SQLITE = os.getenv("USE_SQLITE", "false").lower() == "true"
OVERRIDE_URL = os.getenv("DATABASE_URL")

if USE_SQLITE and not OVERRIDE_URL:
    SQLITE_PATH = os.getenv("SQLITE_PATH", "/home/site/wwwroot/customers.db")
    DATABASE_URL = f"sqlite:///{SQLITE_PATH}"
else:
    if OVERRIDE_URL:
        DATABASE_URL = OVERRIDE_URL
    else:
        POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
        POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
        POSTGRES_DB = os.getenv("POSTGRES_DB", "customers")
        POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
        POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
        DATABASE_URL = (
            f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@"
            f"{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
        )

# Add sslmode=require automatically for Azure Flexible Server, if not present
if (
    DATABASE_URL.startswith("postgresql://")
    and "postgres.database.azure.com" in DATABASE_URL
    and "sslmode=" not in DATABASE_URL
):
    sep = "&" if "?" in DATABASE_URL else "?"
    DATABASE_URL = f"{DATABASE_URL}{sep}sslmode=require"

engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()