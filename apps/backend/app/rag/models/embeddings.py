import uuid
from sqlalchemy import Column, DateTime, String, Text, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database.database import Base

# Use pgvector for vector storage
try:
    from pgvector.sqlalchemy import Vector
    VECTOR_AVAILABLE = True
except ImportError:
    # Fallback for development without pgvector
    from sqlalchemy import Text as Vector
    VECTOR_AVAILABLE = False

class DashboardEmbedding(Base):
    """
    SQLAlchemy model for the unified 'dashboard_embeddings' table.
    Stores vector embeddings for all dashboard modules (Weekly Design, Annual Calendar, OPPP).
    
    Module Types:
    - weekly_design: Weekly Design System data
    - annual_calendar: Annual Calendar Plans data  
    - oppp: One Page Personal Plan data
    
    Component Types (examples):
    - time_blocks: User's scheduled time blocks
    - checklists: Daily checklists and habits
    - next_goals: Goals to achieve next
    - personal_goals: Personal development goals
    - events: Calendar events
    - timeframe_goals: OPPP timeframe-based goals
    """
    __tablename__ = "dashboard_embeddings"
    __table_args__ = (
        CheckConstraint(
            "module_type IN ('weekly_design', 'annual_calendar', 'oppp')",
            name='check_module_type'
        ),
        {'schema': 'public'}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('auth.users.id'), nullable=False)
    
    # Module identification
    module_type = Column(String(50), nullable=False)  # 'weekly_design', 'annual_calendar', 'oppp'
    source_id = Column(UUID(as_uuid=True), nullable=False)  # References original record ID
    
    # Content and embedding data
    component_type = Column(String(100), nullable=False)  # Component within the module
    content = Column(Text, nullable=False)  # Transformed text content for embedding
    embedding = Column(Vector(3072), nullable=False)  # OpenAI text-embedding-3-large has 3072 dimensions
    embedding_metadata = Column(JSONB, nullable=False, server_default='{}')  # Additional context
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<DashboardEmbedding(id={self.id}, user_id={self.user_id}, module_type={self.module_type}, component_type={self.component_type})>"

# Backward compatibility alias for existing code
WeeklyDesignEmbedding = DashboardEmbedding