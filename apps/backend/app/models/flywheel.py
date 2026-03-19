import uuid
from sqlalchemy import Column, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database.database import Base

class Flywheel(Base):
    """
    SQLAlchemy model for the 'flywheel' table.
    Represents a business or product flywheel linked to a specific user.
    """
    __tablename__ = "flywheel"

    # Change id type to UUID and add default generator
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, generated UUID.")
    user_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(Text, nullable=False, comment="Name of the flywheel.")
    description = Column(Text, nullable=True, comment="Description of the flywheel.")
    edges = Column(JSONB, nullable=False, comment='''Edges defining the flywheel structure (e.g., nodes and connections).
    Sample value:
    [
      { "id": "e1", "text": "Make Money" },
      { "id": "e2", "text": "Hire GM to run Business (Automate)" },
      { "id": "e3", "text": "Travel / Business trip / Join Events" },
      { "id": "e4", "text": "Find more Biz Opportunities / Meet more people" },
      { "id": "e5", "text": "Build more Brands / Invest in more Projects / Properties / Holiday" }
    ]
    ''')
    # Rename image_url to image_path
    image_path = Column(Text, nullable=True, comment="Optional path or URL for an image representing the flywheel.")

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False, comment="Timestamp when the record was created.")
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.")

    # Note: Add relationships if needed in the future.
    # user = relationship("User")
