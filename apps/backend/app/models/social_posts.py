from sqlalchemy import Column, String, UUID, DateTime, Text, ARRAY, ForeignKey
from app.models import Base
import uuid
from datetime import datetime

class SocialPost(Base):
    __tablename__ = 'social_posts'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    instruction = Column(Text, nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    platforms = Column(ARRAY(Text), nullable=False)
    generated_content = Column(Text, nullable=True)
    generated_post_url = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default='pending')
    completed_at = Column(DateTime, nullable=True)