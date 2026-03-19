import uuid
from sqlalchemy import Column, DateTime, Text, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database.database import Base

class UserModules(Base):
    """
    SQLAlchemy model for the 'user_modules' table.
    Represents a user's subscription to a specific module/product.
    """
    __tablename__ = "user_modules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, generated UUID.")
    user_id = Column(UUID(as_uuid=True), nullable=False, comment="Reference to the user (auth.users). FK constraint enforced at DB level.")

    stripe_customer_id = Column(Text, nullable=False, comment="Stripe Customer ID associated with the user.")
    stripe_subscription_item_id = Column(Text, nullable=False, comment="Stripe Subscription Item ID for this module.")
    product_id = Column(Text, nullable=False, comment="Stripe Product ID for the module.")
    price_id = Column(Text, nullable=False, comment="Stripe Price ID for the module subscription.")

    status = Column(Text, nullable=False, comment="Subscription status: 'active', 'cancelled', or 'paused'. Check constraint enforced at DB level.")
    start_date = Column(DateTime(timezone=True), nullable=False, comment="Timestamp when the subscription started.")
    end_date = Column(DateTime(timezone=True), nullable=True, comment="Timestamp when the subscription ends (nullable for ongoing subscriptions).")

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.")
