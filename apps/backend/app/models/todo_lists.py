import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class TodoList(Base):
    __tablename__ = "todo_lists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tab_id = Column(UUID(as_uuid=True), ForeignKey("todo_tabs.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)  # Assuming FK to a users table
    name = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=False), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=False),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    tab = relationship("TodoTab", back_populates="todo_lists")
    todos = relationship("Todo", back_populates="list")
    # user = relationship("User", back_populates="todo_lists") # Uncomment if User model exists
