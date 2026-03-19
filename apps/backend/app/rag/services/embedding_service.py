import os
import asyncio
from typing import List, Dict, Any, Optional
import logging
from uuid import UUID

# Handle optional OpenAI import
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    AsyncOpenAI = None
    OPENAI_AVAILABLE = False

logger = logging.getLogger(__name__)

class EmbeddingService:
    """
    Service for generating embeddings using OpenAI's text-embedding-3-large model.
    Handles batch processing and rate limiting for efficient API usage.
    """
    
    def __init__(self):
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI package not installed. Install with: pip install openai")
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = "text-embedding-3-large"  # 3072 dimensions, high quality
        self.batch_size = 100  # OpenAI's batch limit
        
        logger.info(f"EmbeddingService initialized with model: {self.model}")
    
    async def create_embedding(self, text: str) -> List[float]:
        """
        Create a single embedding for the given text.
        
        Args:
            text: Text to embed
            
        Returns:
            List of floats representing the embedding vector
        """
        embeddings = await self.create_embeddings_batch([text])
        return embeddings[0]
    
    async def create_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Create embeddings for multiple texts in batches to optimize API calls.
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embedding vectors (each vector is a list of floats)
        """
        if not texts:
            return []
        
        all_embeddings = []
        
        # Process in batches to respect API limits
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            
            try:
                logger.debug(f"Processing embedding batch {i//self.batch_size + 1}, size: {len(batch)}")
                
                response = await self.client.embeddings.create(
                    model=self.model,
                    input=batch
                )
                
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
                
                logger.debug(f"Generated {len(batch_embeddings)} embeddings")
                
                # Add small delay between batches to be respectful
                if i + self.batch_size < len(texts):
                    await asyncio.sleep(0.1)
                    
            except Exception as e:
                logger.error(f"Failed to generate embeddings for batch {i//self.batch_size + 1}: {e}")
                raise
        
        logger.info(f"Successfully generated {len(all_embeddings)} embeddings")
        return all_embeddings
    
    async def create_embeddings_with_metadata(
        self, 
        documents: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Create embeddings for documents with metadata.
        
        Args:
            documents: List of dicts with 'content' and 'metadata' keys
            
        Returns:
            List of dicts with 'content', 'embedding', and 'metadata' keys
        """
        texts = [doc['content'] for doc in documents]
        embeddings = await self.create_embeddings_batch(texts)
        
        result = []
        for i, doc in enumerate(documents):
            result.append({
                'content': doc['content'],
                'embedding': embeddings[i],
                'metadata': doc.get('metadata', {})
            })
        
        return result
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings for this model."""
        return 3072  # text-embedding-3-large dimension
    
    def get_model_name(self) -> str:
        """Get the embedding model name."""
        return self.model