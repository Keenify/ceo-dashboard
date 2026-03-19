import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class Todo(Base):
    __tablename__ = "todos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)  # Assuming FK to a users table
    list_id = Column(UUID(as_uuid=True), ForeignKey("todo_lists.id"), nullable=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)
    is_completed = Column(Boolean, nullable=False, server_default="false")
    priority = Column(Integer, nullable=True, server_default="0")
    color_code = Column(String, nullable=True)
    sort_order = Column(Integer, nullable=False, server_default="0")
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
    list = relationship("TodoList", back_populates="todos")
    # user = relationship("User", back_populates="todos") # Uncomment if User model exists
