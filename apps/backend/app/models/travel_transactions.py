import uuid
from sqlalchemy import Column, Date, DateTime, Text, Numeric, Computed, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database.database import Base

class TravelTransaction(Base):
    """
    SQLAlchemy model for the 'travel_transactions' table.
    Represents a single travel-related financial transaction, allowing input
    either via local currency + exchange rate or directly in SGD.
    """
    __tablename__ = "travel_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, generated UUID.")
    user_id = Column(UUID(as_uuid=True), nullable=False, comment="Reference to the user (auth.users).") # ForeignKey("auth.users.id", ondelete="CASCADE") - Add if using relationships

    booking_date = Column(Date, nullable=True, comment="Date the travel item was booked.")
    payment_date = Column(Date, nullable=False, comment="Date the payment was made.")
    description = Column(Text, nullable=True, comment="Optional description of the transaction.")
    item = Column(Text, nullable=False, comment="Specific item purchased (e.g., flight, hotel, meal).")
    city = Column(Text, nullable=False, comment="City where the transaction occurred.")
    country = Column(Text, nullable=False, comment="Country where the transaction occurred.")
    local_currency = Column(Text, nullable=True, comment="Currency code of the local currency (e.g., EUR, USD). NULL if amount_sgd provided directly.")
    amount_local_currency = Column(Numeric(12, 2), nullable=True, comment="Amount of the transaction in local currency. NULL if amount_sgd provided directly.")
    exchange_rate_to_sgd = Column(Numeric(12, 6), nullable=True, comment="Exchange rate used to convert the local currency amount to SGD. NULL if amount_sgd provided directly.")

    # Amount in SGD. Can be provided directly or calculated from local currency fields.
    amount_sgd = Column(Numeric(12, 2), nullable=True, comment="Amount of the transaction in SGD.")

    trip_name = Column(Text, nullable=True, comment="Name of the trip this transaction belongs to.")
    category = Column(Text, nullable=False, comment="Category of the transaction (e.g., 'expense', 'income'). Check constraint enforced at DB level.")

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False, comment="Timestamp when the record was created.")
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.")

    # Note: If defining relationships (e.g., to a User model), add them below.
    # user = relationship("User")
