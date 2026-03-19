import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.sql import func

# Handle optional LlamaIndex imports
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    AsyncOpenAI = None
    OPENAI_AVAILABLE = False

from app.rag.models.embeddings import DashboardEmbedding
from app.rag.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

class WeeklyDesignQueryEngine:
    """
    Query engine for Weekly Design RAG system.
    Performs similarity search and generates contextual responses.
    """
    
    def __init__(self):
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI package not installed")
        
        self.embedding_service = EmbeddingService()
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        self.llm_client = AsyncOpenAI(api_key=api_key)
        self.llm_model = "gpt-4o-mini"  # Fast and cost-effective
        
        logger.info("WeeklyDesignQueryEngine initialized")
    
    async def query(
        self, 
        question: str, 
        user_id: UUID, 
        db: AsyncSession,
        top_k: int = 5,
        similarity_threshold: float = 0.7
    ) -> Dict[str, Any]:
        """
        Query the weekly design data and generate a response.
        
        Args:
            question: User's question
            user_id: User UUID for data isolation
            db: Database session
            top_k: Number of top results to retrieve
            similarity_threshold: Minimum similarity score to consider
            
        Returns:
            Dict with response and metadata
        """
        try:
            # 1. Generate query embedding
            query_embedding = await self.embedding_service.create_embedding(question)
            
            # 2. Perform similarity search
            retrieved_docs = await self._similarity_search(
                query_embedding, user_id, db, top_k, similarity_threshold
            )
            
            if not retrieved_docs:
                return {
                    "response": "I couldn't find any relevant information in your weekly design data. Have you created any weekly plans yet?",
                    "sources": [],
                    "retrieved_count": 0
                }
            
            # 3. Generate contextual response
            response = await self._generate_response(question, retrieved_docs)
            
            # 4. Format sources for transparency
            sources = self._format_sources(retrieved_docs)
            
            logger.info(f"Query processed for user {user_id}: retrieved {len(retrieved_docs)} documents")
            
            return {
                "response": response,
                "sources": sources,
                "retrieved_count": len(retrieved_docs)
            }
            
        except Exception as e:
            logger.error(f"Query failed for user {user_id}: {e}")
            raise
    
    async def _similarity_search(
        self,
        query_embedding: List[float],
        user_id: UUID,
        db: AsyncSession,
        top_k: int,
        similarity_threshold: float
    ) -> List[Tuple[DashboardEmbedding, float]]:
        """
        Perform vector similarity search using pgvector.
        
        Args:
            query_embedding: Query vector
            user_id: User UUID for filtering
            db: Database session
            top_k: Number of results to return
            similarity_threshold: Minimum similarity score
            
        Returns:
            List of tuples (embedding_record, similarity_score)
        """
        try:
            # Convert embedding to pgvector format
            embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
            
            # SQL query with cosine similarity - filter by user_id and weekly_design module
            query = text("""
                SELECT *, 
                       (1 - (embedding <=> CAST(:query_embedding AS vector))) as similarity
                FROM dashboard_embeddings 
                WHERE user_id = :user_id
                  AND module_type = 'weekly_design'
                  AND (1 - (embedding <=> CAST(:query_embedding AS vector))) >= :similarity_threshold
                ORDER BY embedding <=> CAST(:query_embedding AS vector)
                LIMIT :top_k
            """)
            
            result = await db.execute(query, {
                "query_embedding": embedding_str,
                "user_id": user_id,
                "similarity_threshold": similarity_threshold,
                "top_k": top_k
            })
            
            rows = result.fetchall()
            
            # Convert to embedding objects with similarity scores
            retrieved_docs = []
            for row in rows:
                # Create DashboardEmbedding object from row data
                embedding = DashboardEmbedding(
                    id=row.id,
                    user_id=row.user_id,
                    module_type=row.module_type,
                    source_id=row.source_id,
                    component_type=row.component_type,
                    content=row.content,
                    embedding=row.embedding,
                    embedding_metadata=row.embedding_metadata,
                    created_at=row.created_at,
                    updated_at=row.updated_at
                )
                
                retrieved_docs.append((embedding, row.similarity))
            
            logger.debug(f"Retrieved {len(retrieved_docs)} documents with similarity >= {similarity_threshold}")
            return retrieved_docs
            
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            raise
    
    async def _generate_response(
        self, 
        question: str, 
        retrieved_docs: List[Tuple[DashboardEmbedding, float]]
    ) -> str:
        """
        Generate a contextual response using retrieved documents.
        
        Args:
            question: Original user question
            retrieved_docs: List of (embedding, similarity_score) tuples
            
        Returns:
            Generated response string
        """
        # Build context from retrieved documents
        context_parts = []
        for embedding, similarity in retrieved_docs:
            week_date = embedding.embedding_metadata.get("week_start_date", "Unknown date")
            component = embedding.component_type.replace("_", " ").title()
            
            context_parts.append(f"[{component} - Week of {week_date}] {embedding.content}")
        
        context = "\n\n".join(context_parts)
        
        # Create a focused prompt for weekly design responses
        system_prompt = """You are a personal productivity assistant specializing in weekly planning and time management. 

Based on the user's weekly design data provided below, answer their question in a helpful, practical way. Focus on:
- Specific time blocks and schedules when relevant
- Goals and planning information
- Actionable insights and suggestions
- Weekly productivity patterns

Be conversational but informative. If the question can't be fully answered with the provided data, acknowledge what you can see and suggest what might help.

Weekly Design Data:
{context}

User Question: {question}

Provide a helpful response:"""
        
        try:
            response = await self.llm_client.chat.completions.create(
                model=self.llm_model,
                messages=[
                    {
                        "role": "system", 
                        "content": system_prompt.format(context=context, question=question)
                    }
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"LLM response generation failed: {e}")
            return "I found relevant information but couldn't generate a proper response. Please try rephrasing your question."
    
    def _format_sources(
        self, 
        retrieved_docs: List[Tuple[DashboardEmbedding, float]]
    ) -> List[Dict[str, Any]]:
        """
        Format retrieved documents as source references.
        
        Args:
            retrieved_docs: List of (embedding, similarity_score) tuples
            
        Returns:
            List of source dictionaries
        """
        sources = []
        for embedding, similarity in retrieved_docs:
            sources.append({
                "component_type": embedding.component_type,
                "week_start_date": embedding.embedding_metadata.get("week_start_date"),
                "similarity_score": round(similarity, 3),
                "content_preview": embedding.content[:100] + "..." if len(embedding.content) > 100 else embedding.content
            })
        
        return sources
    
    async def test_connection(self, db: AsyncSession) -> Dict[str, Any]:
        """
        Test the query engine setup and database connection.
        
        Args:
            db: Database session
            
        Returns:
            Test results dictionary
        """
        try:
            # Test embedding generation
            test_embedding = await self.embedding_service.create_embedding("test query")
            embedding_test = len(test_embedding) == 3072
            
            # Test database connection
            query = select(func.count(DashboardEmbedding.id))
            result = await db.execute(query)
            embedding_count = result.scalar()
            
            # Test LLM connection
            try:
                test_response = await self.llm_client.chat.completions.create(
                    model=self.llm_model,
                    messages=[{"role": "user", "content": "Hello"}],
                    max_tokens=10
                )
                llm_test = bool(test_response.choices[0].message.content)
            except:
                llm_test = False
            
            return {
                "embedding_service": embedding_test,
                "database_connection": True,
                "llm_connection": llm_test,
                "total_embeddings": embedding_count,
                "embedding_dimension": len(test_embedding)
            }
            
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return {"error": str(e)}