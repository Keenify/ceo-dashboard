import uuid
from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database.database import Base


class Ikigai(Base):
    """
    SQLAlchemy model for the 'ikigai' table.
    Represents a user's ikigai data containing their purpose-driven life framework.
    """
    __tablename__ = "ikigai"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, generated UUID.")
    user_id = Column(UUID(as_uuid=True), nullable=False, unique=True, comment="Reference to the user (auth.users). Each user can only have one ikigai.")
    ikigai_data = Column(JSONB, nullable=False, comment="JSONB containing the user's ikigai framework data.")
    
    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False, comment="Timestamp when the record was created.")
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.")

    # Note: If you add relationships to a User model in the future, add them here. 