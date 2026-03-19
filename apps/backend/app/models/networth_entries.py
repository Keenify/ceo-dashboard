import uuid
from sqlalchemy import Column, Date, DateTime, Text, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.sql import func
from app.database.database import Base

class NetworthEntry(Base):
    __tablename__ = "networth_entries"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, generated UUID.")
    user_id = Column(PG_UUID(as_uuid=True), nullable=False, comment="Reference to the user (auth.users). No FK constraint in model.")
    type = Column(Text, nullable=False, comment="Type of net worth: 'personal' or 'business'. Check constraint enforced at DB level.")
    category = Column(Text, nullable=False, comment="Category: 'asset' or 'liability'. Check constraint enforced at DB level.")
    snapshot_date = Column(Date, nullable=False, comment="Date of the net worth snapshot.")
    section = Column(Text, nullable=False, comment="User-defined section for grouping entries (e.g., 'Real Estate', 'Retirement Accounts').")

    name = Column(Text, nullable=True, comment="Specific name of the asset or liability (e.g., 'Primary Residence', '401k - Fidelity').")
    value = Column(Numeric(12, 2), nullable=True, comment="Value of the asset or liability at the snapshot_date.")

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False, comment="Timestamp when the record was created.")
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.")

    # Database CHECK constraints for 'type' and 'category' (e.g., networth_entries_type_check)
    # are defined directly in the database schema and will be enforced there.
    # SQLAlchemy model primarily defines column types, relationships, and Python-side defaults.
