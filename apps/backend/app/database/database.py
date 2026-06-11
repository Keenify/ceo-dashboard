import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.sql import text

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL is not set. Check your .env file.")

# Ensure asyncpg driver is used
if not DATABASE_URL.startswith("postgresql+asyncpg"):
    raise ValueError("❌ DATABASE_URL must use 'postgresql+asyncpg://'")

# print(f"🔑 Using DATABASE_URL: {DATABASE_URL}")

# Create async engine with connection pooling configuration
engine = create_async_engine(
    DATABASE_URL,
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0},
)

# Create session factory
AsyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base class for models
Base = declarative_base()

async def get_db():
    """Dependency function to get a database session."""
    async with AsyncSessionLocal() as session:
        yield session

async def test_connection():
    """Test the database connection by executing a simple query."""
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(text("SELECT 1"))
            print("✅ Database connection successful:", result.scalars().first())
        except Exception as e:
            print(f"❌ Database connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())