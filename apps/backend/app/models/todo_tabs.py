import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class TodoTab(Base):
    __tablename__ = "todo_tabs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)  # Assuming FK to a users table
    name = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=False),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=False),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    todo_lists = relationship("TodoList", back_populates="tab")
    # user = relationship("User", back_populates="todo_tabs") # Uncomment if User model exists
