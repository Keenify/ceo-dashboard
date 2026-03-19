import uuid
from sqlalchemy import Column, Date, DateTime, Text, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database.database import Base

class Cashflow(Base):
    """
    SQLAlchemy model for the 'cashflow' table.
    Represents a single cash inflow or outflow transaction.
    """
    __tablename__ = "cashflow"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, generated UUID.")
    user_id = Column(UUID(as_uuid=True), nullable=False, comment="Reference to the user (auth.users). No FK constraint in model.")

    flow_type = Column(Text, nullable=False, comment="Type of flow: 'inflow' or 'outflow'. Check constraint enforced at DB level.")
    amount = Column(Numeric(12, 2), nullable=False, comment="Amount of the transaction.")
    description = Column(Text, nullable=True, comment="Description of the transaction (e.g., source/destination).")
    flow_date = Column(Date, nullable=False, comment="Date the cashflow occurred.")
    category = Column(Text, nullable=True, comment="Category of the cashflow (e.g., investment, salary, expense).")

    background_color_code = Column(String(7), nullable=True, comment="Background color code for UI, e.g., #RRGGBB.")
    font_color_code = Column(String(7), nullable=True, comment="Font color code for UI, e.g., #RRGGBB.")
    note = Column(Text, nullable=True, comment="Additional notes for the transaction.")

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False, comment="Timestamp when the record was created.")
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.")
