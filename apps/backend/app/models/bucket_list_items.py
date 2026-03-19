import uuid
from sqlalchemy import Column, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database.database import Base

class BucketListItems(Base):
    """
    SQLAlchemy model for the 'bucket_list_items' table.
    Represents a user's bucket list items organized by category with JSONB data storage.
    """
    __tablename__ = "bucket_list_items"
    __table_args__ = (
        {'schema': 'public'}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), nullable=False)
    category = Column(Text, nullable=False)
    items = Column(JSONB, nullable=False)
    sort_order = Column(Integer, nullable=False, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True) 