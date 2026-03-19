import json
import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.database.database import AsyncSessionLocal
from app.models.weekly_design_system import WeeklyDesignSystem
from app.rag.models.embeddings import DashboardEmbedding
from app.rag.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

class WeeklyDesignRAGManager:
    """
    Manages RAG operations for Weekly Design System data.
    Handles data transformation, embedding generation, and storage.
    """
    
    def __init__(self):
        self.embedding_service = EmbeddingService()
        
    async def transform_weekly_design_to_documents(
        self, 
        weekly_design: WeeklyDesignSystem
    ) -> List[Dict[str, Any]]:
        """
        Transform a weekly design JSONB structure into searchable text documents.
        Creates 4 component-based documents: time_blocks, checklists, next_goals, personal_goals
        
        Args:
            weekly_design: WeeklyDesignSystem model instance
            
        Returns:
            List of document dictionaries with content and metadata
        """
        documents = []
        week_str = weekly_design.week_start_date.strftime("%Y-%m-%d")
        base_metadata = {
            "weekly_design_id": str(weekly_design.id),
            "user_id": str(weekly_design.user_id),
            "week_start_date": week_str,
            "created_at": weekly_design.created_at.isoformat() if weekly_design.created_at else None
        }
        
        # 1. Transform time_blocks
        time_blocks_content = self._transform_time_blocks(weekly_design.time_blocks, week_str)
        if time_blocks_content:
            documents.append({
                "content": time_blocks_content,
                "component_type": "time_blocks",
                "metadata": {**base_metadata, "component_type": "time_blocks"}
            })
        
        # 2. Transform daily_checklists  
        checklists_content = self._transform_checklists(weekly_design.daily_checklists, week_str)
        if checklists_content:
            documents.append({
                "content": checklists_content,
                "component_type": "checklists",
                "metadata": {**base_metadata, "component_type": "checklists"}
            })
        
        # 3. Transform next_goals
        next_goals_content = self._transform_goals(weekly_design.next_goals, week_str, "Next goals")
        if next_goals_content:
            documents.append({
                "content": next_goals_content,
                "component_type": "next_goals", 
                "metadata": {**base_metadata, "component_type": "next_goals"}
            })
        
        # 4. Transform personal_goals
        personal_goals_content = self._transform_goals(weekly_design.personal_goals, week_str, "Personal goals")
        if personal_goals_content:
            documents.append({
                "content": personal_goals_content,
                "component_type": "personal_goals",
                "metadata": {**base_metadata, "component_type": "personal_goals"}
            })
        
        logger.debug(f"Transformed weekly design {weekly_design.id} into {len(documents)} documents")
        return documents
    
    def _transform_time_blocks(self, time_blocks: Any, week_str: str) -> str:
        """Transform time_blocks JSONB into readable text."""
        if not time_blocks:
            return ""
        
        content_parts = [f"Time blocks for week starting {week_str}:"]
        
        # Handle both dict and list formats
        if isinstance(time_blocks, dict):
            for day, blocks in time_blocks.items():
                if not blocks:
                    continue
                
                day_parts = []
                if isinstance(blocks, dict):
                    for time_range, activity in blocks.items():
                        if activity and activity.strip():
                            day_parts.append(f"{time_range} {activity}")
                elif isinstance(blocks, list):
                    for item in blocks:
                        if item and str(item).strip():
                            day_parts.append(str(item))
                
                if day_parts:
                    content_parts.append(f"{day}: {', '.join(day_parts)}")
        elif isinstance(time_blocks, list):
            # Handle list format
            for item in time_blocks:
                if item and str(item).strip():
                    content_parts.append(str(item))
        
        return " ".join(content_parts)
    
    def _transform_checklists(self, daily_checklists: Any, week_str: str) -> str:
        """Transform daily_checklists JSONB into readable text.""" 
        if not daily_checklists:
            return ""
        
        content_parts = [f"Daily checklists for week starting {week_str}:"]
        
        # Handle both dict and list formats
        if isinstance(daily_checklists, dict):
            for day, checklist in daily_checklists.items():
                if not checklist:
                    continue
                
                if isinstance(checklist, list):
                    items = [item for item in checklist if item and str(item).strip()]
                    if items:
                        content_parts.append(f"{day}: {', '.join(map(str, items))}")
                elif isinstance(checklist, dict):
                    # Handle dict format checklist
                    items = []
                    for key, value in checklist.items():
                        if value and str(value).strip():
                            items.append(f"{key}: {value}")
                    if items:
                        content_parts.append(f"{day}: {', '.join(items)}")
        elif isinstance(daily_checklists, list):
            # Handle list format
            for item in daily_checklists:
                if item and str(item).strip():
                    content_parts.append(str(item))
        
        return " ".join(content_parts)
    
    def _transform_goals(self, goals: Any, week_str: str, goal_type: str) -> str:
        """Transform goals list into readable text."""
        if not goals:
            return ""
        
        content_parts = [f"{goal_type} for week starting {week_str}:"]
        
        goal_texts = []
        
        # Handle different goal formats
        if isinstance(goals, list):
            for goal in goals:
                if isinstance(goal, dict):
                    # Extract goal text from various possible structures
                    goal_text = goal.get("goal") or goal.get("text") or goal.get("description")
                    if goal_text and goal_text.strip():
                        goal_texts.append(goal_text.strip())
                elif isinstance(goal, str) and goal.strip():
                    goal_texts.append(goal.strip())
        elif isinstance(goals, dict):
            # Handle dict format (extract values)
            for key, value in goals.items():
                if value and str(value).strip():
                    goal_texts.append(f"{key}: {value}")
        elif isinstance(goals, str) and goals.strip():
            # Handle single string
            goal_texts.append(goals.strip())
        
        if goal_texts:
            content_parts.extend(goal_texts)
        
        return " ".join(content_parts)
    
    async def refresh_user_embeddings(self, user_id: UUID, db: AsyncSession) -> Dict[str, Any]:
        """
        Refresh embeddings for a specific user's weekly designs.
        
        Args:
            user_id: User UUID
            db: Database session
            
        Returns:
            Dict with processing statistics
        """
        try:
            # Fetch all weekly designs for user
            query = select(WeeklyDesignSystem).where(WeeklyDesignSystem.user_id == user_id)
            result = await db.execute(query)
            weekly_designs = result.scalars().all()
            
            if not weekly_designs:
                logger.info(f"No weekly designs found for user {user_id}")
                return {"processed": 0, "created": 0, "updated": 0}
            
            # Delete existing embeddings for this user (weekly_design module only)
            delete_query = delete(DashboardEmbedding).where(
                (DashboardEmbedding.user_id == user_id) & 
                (DashboardEmbedding.module_type == 'weekly_design')
            )
            await db.execute(delete_query)
            
            total_documents = 0
            total_created = 0
            
            # Process each weekly design
            for weekly_design in weekly_designs:
                documents = await self.transform_weekly_design_to_documents(weekly_design)
                
                if not documents:
                    continue
                
                # Generate embeddings
                embedded_documents = await self.embedding_service.create_embeddings_with_metadata(documents)
                
                # Store embeddings
                for doc in embedded_documents:
                    embedding_record = DashboardEmbedding(
                        user_id=user_id,
                        module_type='weekly_design',
                        source_id=weekly_design.id,
                        component_type=doc["metadata"]["component_type"],
                        content=doc["content"],
                        embedding=doc["embedding"],
                        embedding_metadata=doc["metadata"]
                    )
                    db.add(embedding_record)
                    total_created += 1
                
                total_documents += len(documents)
            
            await db.commit()
            
            logger.info(f"Refreshed embeddings for user {user_id}: {total_documents} documents, {total_created} embeddings created")
            
            return {
                "processed": len(weekly_designs),
                "documents_created": total_documents,
                "embeddings_created": total_created
            }
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to refresh embeddings for user {user_id}: {e}")
            raise
    
    async def refresh_all_users_embeddings(self) -> Dict[str, Any]:
        """
        Refresh embeddings for all users with weekly designs.
        This method is called by the scheduler.
        
        Returns:
            Dict with processing statistics
        """
        try:
            async with AsyncSessionLocal() as db:
                # Get all unique user_ids with weekly designs
                query = select(WeeklyDesignSystem.user_id).distinct()
                result = await db.execute(query)
                user_ids = result.scalars().all()
                
                if not user_ids:
                    logger.info("No users with weekly designs found")
                    return {"users_processed": 0, "total_embeddings": 0}
                
                total_embeddings = 0
                successful_users = 0
                
                for user_id in user_ids:
                    try:
                        result = await self.refresh_user_embeddings(user_id, db)
                        total_embeddings += result.get("embeddings_created", 0)
                        successful_users += 1
                        
                    except Exception as e:
                        logger.error(f"Failed to refresh embeddings for user {user_id}: {e}")
                        continue
                
                logger.info(f"Bulk refresh complete: {successful_users}/{len(user_ids)} users processed, {total_embeddings} total embeddings")
                
                return {
                    "users_processed": successful_users,
                    "total_users": len(user_ids),
                    "total_embeddings": total_embeddings
                }
                
        except Exception as e:
            logger.error(f"Failed to refresh embeddings for all users: {e}")
            raise