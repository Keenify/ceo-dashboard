from sqlalchemy import Column, String, UUID, DateTime, Integer, Numeric, Date, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.models import Base
import uuid
from datetime import datetime

class Habit(Base):
    __tablename__ = 'habits'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    habit_type = Column(String, nullable=False, default='build')
    color_code = Column(String(7), nullable=True, default='#3B82F6')
    created_at = Column(DateTime, default=datetime.utcnow)
    sort_order = Column(Integer, nullable=True, default=0)

    # Relationships
    entries = relationship(
        "HabitEntry",
        back_populates="habit",
        cascade="all, delete-orphan"
    )
    streak = relationship(
        "HabitStreak",
        back_populates="habit",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True
    )

class HabitEntry(Base):
    __tablename__ = 'habit_entries'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    habit_id = Column(UUID(as_uuid=True), ForeignKey('habits.id'), nullable=False)
    entry_date = Column(Date, nullable=False)
    status = Column(String, nullable=False)
    note = Column(String, nullable=True)
    value = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    habit = relationship("Habit", back_populates="entries")

class HabitStreak(Base):
    __tablename__ = 'habit_streaks'

    habit_id = Column(UUID(as_uuid=True), ForeignKey('habits.id'), primary_key=True)
    current_streak = Column(Integer, nullable=True, default=0)
    longest_streak = Column(Integer, nullable=True, default=0)
    last_entry_date = Column(Date, nullable=True)
    last_value = Column(String, nullable=True)
    total_streak = Column(Integer, nullable=True, default=0)

    # Relationships
    habit = relationship("Habit", back_populates="streak")

class HabitBuddy(Base):
    __tablename__ = 'habit_buddies'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    buddy_email = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    censor_habits = Column(Boolean, nullable=False, default=False) 