from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import UUID

from app.database.database import Base

class User(Base):
    __tablename__ = "users"
    __table_args__ = {'schema': 'auth'}

    id = Column(SQLAlchemyUUID(as_uuid=True), primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    # Add other fields you might have in auth.users
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    journal_templates = relationship("JournalTemplate", back_populates="user")
    journal_entries = relationship("JournalEntry", back_populates="user")