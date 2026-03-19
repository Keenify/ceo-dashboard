import logging
import json
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.database import AsyncSessionLocal
from app.crud.feedback_entries import CRUDFeedback
from app.models.feedback_entries import FeedbackEntry
from app.service.taiga_sync_service import TaigaSyncService

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/taiga")
async def handle_taiga_webhook(request: Request):
    """
    Handle incoming webhook from Taiga for user story updates.
    
    Simplified version without signature verification for development.
    When Taiga user stories are updated, this endpoint processes the changes
    and updates the corresponding feedback entries in the database.
    """
    try:
        # ENHANCED DEBUG: Log request details before parsing
        logger.info(f"=== WEBHOOK REQUEST DEBUG START ===")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Request URL: {request.url}")
        logger.info(f"Request headers: {dict(request.headers)}")
        
        # Get raw body for debugging
        raw_body = await request.body()
        logger.info(f"Raw body length: {len(raw_body)}")
        logger.info(f"Raw body (first 500 chars): {raw_body[:500]}")
        
        # Parse webhook payload (re-create request since body was consumed)
        request._body = raw_body
        payload = await request.json()
        action = payload.get("action")  # "create", "change", "delete"
        data = payload.get("data", {})
        
        # ENHANCED DEBUG: Log action analysis
        logger.info(f"=== ACTION ANALYSIS ===")
        logger.info(f"Parsed action value: '{action}' (type: {type(action)})")
        logger.info(f"Action == 'delete': {action == 'delete'}")
        logger.info(f"Action in ['delete', 'deleted', 'remove', 'destroy']: {action in ['delete', 'deleted', 'remove', 'destroy']}")
        logger.info(f"Available actions to test: ['delete', 'deleted', 'remove', 'destroy']")
        
        # DEBUG: Log full payload structure
        logger.info(f"=== WEBHOOK DEBUG START ===")
        logger.info(f"Full payload: {json.dumps(payload, indent=2)}")
        logger.info(f"Payload type: {payload.get('type')}")
        logger.info(f"Action: {payload.get('action')}")
        logger.info(f"Data keys: {list(data.keys()) if data else 'No data'}")

        # DEBUG: Log status extraction attempts
        status_extra_info = data.get("status_extra_info", {})
        logger.info(f"status_extra_info: {status_extra_info}")
        if status_extra_info:
            logger.info(f"status_extra_info keys: {list(status_extra_info.keys())}")
            logger.info(f"status name: '{status_extra_info.get('name', 'NOT_FOUND')}'")

        # Try alternative status fields
        logger.info(f"data.status: {data.get('status')}")
        logger.info(f"data.status_name: {data.get('status_name')}")
        logger.info(f"=== WEBHOOK DEBUG END ===")
        
        # Only process user story updates
        if payload.get("type") != "userstory":
            logger.info(f"Webhook ignored: Not a user story (type: {payload.get('type')})")
            return {"status": "ignored", "reason": "Not a user story webhook"}
        
        story_id = data.get("id")
        
        if not story_id:
            logger.warning("Webhook missing story ID")
            return {"status": "error", "reason": "Missing story ID"}
        
        # Handle deletion action (support multiple possible action values)
        deletion_actions = ["delete", "deleted", "remove", "destroy"]
        if action in deletion_actions:
            logger.info(f"=== DELETION HANDLER START ===")
            logger.info(f"Matched deletion action: '{action}'")
            logger.info(f"Story ID for deletion: {story_id}")
            logger.info(f"Story ID type: {type(story_id)}")
            
            async with AsyncSessionLocal() as db:
                crud_feedback = CRUDFeedback(db=db)
                logger.info(f"Searching for feedback with taiga_story_id: {story_id}")
                
                feedback = await crud_feedback.get_by_taiga_story_id(story_id)
                logger.info(f"Database query result: {feedback}")
                
                if feedback:
                    logger.info(f"Found feedback to delete: ID={feedback.id}, Title='{feedback.title}'")
                    
                    delete_result = await crud_feedback.delete(feedback_id=feedback.id)
                    logger.info(f"Delete operation result: {delete_result}")
                    
                    if delete_result:
                        logger.info(f"Successfully deleted feedback {feedback.id} due to Taiga story #{story_id} deletion")
                        return {"status": "deleted", "feedback_id": str(feedback.id), "story_id": story_id}
                    else:
                        logger.error(f"Delete operation returned False for feedback {feedback.id}")
                        return {"status": "delete_failed", "feedback_id": str(feedback.id), "story_id": story_id}
                else:
                    logger.warning(f"No feedback found with taiga_story_id: {story_id}")
                    
                    # Additional debug: Check for any feedback entries with taiga_story_id
                    result = await crud_feedback.db.execute(
                        select(FeedbackEntry).where(FeedbackEntry.taiga_story_id.isnot(None))
                    )
                    synced_feedback = result.scalars().all()
                    logger.info(f"Total synced feedback entries in database: {len(synced_feedback)}")
                    for fb in synced_feedback[:5]:  # Log first 5 entries for comparison
                        logger.info(f"Existing synced feedback: taiga_story_id={fb.taiga_story_id}, id={fb.id}, title='{fb.title}'")
                    
                    return {"status": "not_found", "story_id": story_id}
            
            logger.info(f"=== DELETION HANDLER END ===")
        
        story_status = data.get("status", {}).get("name", "")
        logger.info(f"Webhook received: Story #{story_id} -> {story_status} (action: {action})")
        
        # Update feedback entry in database
        async with AsyncSessionLocal() as db:
            crud_feedback = CRUDFeedback(db=db)
            
            # Find feedback by taiga_story_id
            feedback = await crud_feedback.get_by_taiga_story_id(story_id)
            if not feedback:
                logger.warning(f"No feedback found for Taiga story #{story_id}")
                return {"status": "not_found", "story_id": story_id}
            
            # Map Taiga status to internal status
            sync_service = TaigaSyncService()
            internal_status = sync_service._map_taiga_status_to_internal(story_status)
            
            # Update feedback status (fix method call)
            await crud_feedback.update_status(feedback_id=feedback.id, status=internal_status)
            logger.info(f"Updated feedback {feedback.id}: {story_status} -> {internal_status}")
        
        return {
            "status": "processed", 
            "feedback_id": str(feedback.id),
            "story_id": story_id,
            "new_status": internal_status
        }
        
    except Exception as e:
        logger.exception(f"Webhook processing error: {str(e)}")
        raise HTTPException(500, f"Webhook processing failed: {str(e)}")