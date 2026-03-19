from sqlalchemy import Column, String, Text, UUID, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from app.models import Base
import uuid
from datetime import datetime


class Mindmap(Base):
    """
    Mindmap model matching your final table schema.
    """
    __tablename__ = "mindmaps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    mindmap = Column(JSONB, nullable=False)
    updated_by = Column(UUID(as_uuid=True), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return (
            f"<Mindmap(id={self.id}, title={self.title}, "
            f"user_id={self.user_id}, created_at={self.created_at})>"
        ) 