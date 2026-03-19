import uuid
from sqlalchemy import Column, DateTime, Integer, Text, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func, text
from app.database.database import Base


class Manifestation(Base):
    """
    SQLAlchemy model for the 'manifestation' table.
    Represents a user's manifestation data, potentially for a specific year.
    """
    __tablename__ = "manifestation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, generated UUID.")
    user_id = Column(UUID(as_uuid=True), nullable=False, comment="Reference to the user (auth.users).")
    strong_life_changes = Column(JSONB, nullable=False, comment="5 strong life changes.")
    big_targets = Column(JSONB, nullable=False, comment="5 big targets.")
    top_values = Column(JSONB, nullable=False, comment="5 top values.")
    non_negotiables = Column(JSONB, nullable=False, comment="5 main non-negotiables.")
    life_rules = Column(JSONB, nullable=False, comment="5 key life rules.")
    rituals = Column(JSONB, nullable=False, comment="5 best rituals.")

    courage_list = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"), comment="List describing moments of courage.")
    year = Column(Integer, nullable=True, comment="The specific year this manifestation applies to (optional).")
    theme = Column(Text, nullable=True, comment="Optional theme for the manifestation/year.")
    category = Column(Text, nullable=False, server_default="personal", comment="Category: personal or business.")

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False, comment="Timestamp when the record was created.")
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.")

    __table_args__ = (
        CheckConstraint('(year >= 1000) AND (year <= 9999)', name='manifestation_year_check'),
    )

    # Note: If you add relationships to a User model in the future, add them here.
