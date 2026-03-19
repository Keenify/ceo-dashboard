from sqlalchemy import Column, String, UUID, DateTime, Text
from app.models import Base
import uuid
from datetime import datetime


class FreelanceProject(Base):
    """Model for freelance projects entries."""
    __tablename__ = 'freelance_projects'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    title = Column(Text, nullable=True)
    date = Column(Text, nullable=True)
    keep = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
