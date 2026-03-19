import uuid
from sqlalchemy import Column, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.sql import func
from app.database.database import Base

class UserGoogleToken(Base):
    __tablename__ = "user_google_tokens"

    user_id = Column(PG_UUID(as_uuid=True), primary_key=True, comment="Primary key, reference to auth.users(id).")
    access_token = Column(Text, nullable=True, comment="Google OAuth access token.")
    refresh_token = Column(Text, nullable=True, comment="Google OAuth refresh token for obtaining new access tokens.")
    expires_at = Column(DateTime(timezone=False), nullable=True, comment="Timestamp when the access token expires.")
