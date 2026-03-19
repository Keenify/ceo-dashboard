import os
import asyncio
import logging
from typing import Optional, Dict, Any, List
import httpx
from datetime import datetime

from app.database.database import AsyncSessionLocal
from app.crud.feedback_entries import CRUDFeedback
from app.models.feedback_entries import FeedbackEntry
from app.schemas.feedback_entries import Status

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TaigaSyncService:
    def __init__(self, quiet_mode: bool = False):
        self.username = os.getenv("TAIGA_USERNAME")
        self.password = os.getenv("TAIGA_PASSWORD")
        self.project_slug = os.getenv("TAIGA_PROJECT_SLUG")
        self.api_url = os.getenv("TAIGA_API_URL")
        self.quiet_mode = quiet_mode
        
        # Validate required environment variables
        if not all([self.username, self.password, self.project_slug, self.api_url]):
            raise ValueError("Missing required Taiga environment variables")
        
        self.auth_token: Optional[str] = None
        self.project_id: Optional[int] = None
        
        # Only log initialization if not in quiet mode
        if not self.quiet_mode:
            logger.info(f"TaigaSyncService initialized for project: {self.project_slug}")

    async def _authenticate(self) -> bool:
        """Authenticate with Taiga and get auth token"""
        try:
            auth_data = {
                "username": self.username,
                "password": self.password,
                "type": "normal"
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.api_url}/auth",
                    json=auth_data
                )
                
                if response.status_code == 200:
                    auth_response = response.json()
                    self.auth_token = auth_response.get("auth_token")
                    if not self.quiet_mode:
                        logger.info("Successfully authenticated with Taiga")
                    return True
                else:
                    if not self.quiet_mode:
                        logger.error(f"Taiga authentication failed: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error authenticating with Taiga: {str(e)}")
            return False

    async def _get_project_id(self) -> Optional[int]:
        """Get project ID from project slug"""
        if not self.auth_token:
            if not await self._authenticate():
                return None
        
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.api_url}/projects/by_slug?slug={self.project_slug}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    project_data = response.json()
                    self.project_id = project_data.get("id")
                    if not self.quiet_mode:
                        logger.info(f"Found project ID: {self.project_id} for slug: {self.project_slug}")
                    return self.project_id
                else:
                    if not self.quiet_mode:
                        logger.error(f"Failed to get project: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting project ID: {str(e)}")
            return None

    def _format_description(self, feedback: FeedbackEntry) -> str:
        """Format feedback for Taiga user story description"""
        description = f"""**Feedback Type:** {feedback.feedback_type.title()}
**Priority:** {feedback.priority.title()}
**Module:** {feedback.module_name or 'General'}
**User:** {feedback.user_id}
**Submitted:** {feedback.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}

**Description:**
{feedback.description}"""

        # Add screenshots section if screenshots exist
        if feedback.screenshots and len(feedback.screenshots) > 0:
            description += f"\n\n**Screenshots:**\n"
            for i, screenshot_url in enumerate(feedback.screenshots, 1):
                description += f"- [Screenshot {i}]({screenshot_url})\n"
        
        description += f"""

---
*Auto-created from CEO Dashboard feedback system*
*Internal ID: {feedback.id}*
"""
        return description

    def _map_priority(self, priority: str) -> int:
        """Map internal priority to Taiga priority values"""
        priority_mapping = {
            "low": 1,
            "medium": 2,
            "high": 3,
            "critical": 4
        }
        return priority_mapping.get(priority.lower(), 2)

    def _map_taiga_status_to_internal(self, taiga_status_name: str) -> Status:
        """Map Taiga status names to internal status values"""
        # Map exact Taiga column names to internal statuses
        status_mapping = {
            "New": Status.PENDING,
            "Ready": Status.PENDING,
            "In progress": Status.IN_PROGRESS,
            "Ready for test": Status.IN_PROGRESS,
            "Done": Status.COMPLETED,
            "Archived": Status.COMPLETED
        }
        return status_mapping.get(taiga_status_name, Status.PENDING)

    async def create_user_story(self, feedback: FeedbackEntry) -> Optional[Dict[str, Any]]:
        """Create a user story in Taiga from feedback"""
        if not self.project_id:
            if not await self._get_project_id():
                return None

        try:
            headers = {
                "Authorization": f"Bearer {self.auth_token}",
                "Content-Type": "application/json"
            }
            
            # Prepare user story data
            story_data = {
                "project": self.project_id,
                "subject": f"[{feedback.module_name or 'GENERAL'}] {feedback.title}",
                "description": self._format_description(feedback),
                "priority": self._map_priority(feedback.priority),
                "tags": [
                    feedback.module_name or "general",
                    feedback.feedback_type,
                    feedback.priority,
                    "auto-feedback"
                ]
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.api_url}/userstories",
                    headers=headers,
                    json=story_data
                )
                
                if response.status_code == 201:
                    story = response.json()
                    logger.info(f"Created Taiga user story #{story['id']}: {story['subject']}")
                    return story
                else:
                    logger.error(f"Failed to create user story: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error creating user story: {str(e)}")
            return None

    async def get_story_status(self, story_id: int) -> Optional[Dict[str, Any]]:
        """Get user story status from Taiga"""
        if not self.quiet_mode:
            logger.debug(f"🔍 Getting story status for Taiga story #{story_id}")
        
        # Enhanced authentication logging (only in non-quiet mode)
        if not self.auth_token:
            if not self.quiet_mode:
                logger.warning(f"⚠️ No auth token for story #{story_id}, attempting authentication...")
            auth_success = await self._authenticate()
            if not auth_success:
                if not self.quiet_mode:
                    logger.error(f"❌ Authentication failed for story #{story_id} - cannot check status")
                return None
            else:
                if not self.quiet_mode:
                    logger.info(f"✅ Authentication successful for story #{story_id}")
        else:
            if not self.quiet_mode:
                logger.debug(f"🔑 Using existing auth token for story #{story_id}")

        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            api_url = f"{self.api_url}/userstories/{story_id}"
            if not self.quiet_mode:
                logger.debug(f"🌐 Making API request to: {api_url}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(api_url, headers=headers)
                
                # Enhanced response logging (only in non-quiet mode)
                if not self.quiet_mode:
                    logger.debug(f"📡 HTTP {response.status_code} for story #{story_id}")
                
                if response.status_code == 200:
                    response_data = response.json()
                    story_title = response_data.get("subject", "Unknown")[:50]
                    if not self.quiet_mode:
                        logger.debug(f"✅ Story #{story_id} exists: '{story_title}'")
                    return response_data
                elif response.status_code == 404:
                    # Genuine deletion
                    logger.warning(f"🗑️ Story #{story_id} not found (HTTP 404) - genuinely deleted from Taiga")
                    return None
                elif response.status_code == 403:
                    # Permission denied - could be deletion or access issue
                    logger.warning(f"🚫 Story #{story_id} access denied (HTTP 403) - deleted or no permission")
                    logger.info(f"📝 Response body for 403: {response.text[:200]}")
                    return None
                elif response.status_code == 401:
                    # Authentication issue
                    logger.error(f"🔐 Authentication failed for story #{story_id} (HTTP 401) - token expired?")
                    logger.error(f"📝 Response body: {response.text[:200]}")
                    # Don't delete on auth failures - return None but log as auth issue
                    return None
                elif 500 <= response.status_code < 600:
                    # Server error - don't delete on server issues
                    logger.error(f"🔥 Taiga server error {response.status_code} for story #{story_id} - server issue, not deletion")
                    logger.error(f"📝 Response body: {response.text[:200]}")
                    return None
                else:
                    # Other unexpected status codes
                    logger.error(f"❓ Unexpected status {response.status_code} for story #{story_id}")
                    logger.error(f"📝 Response body: {response.text[:200]}")
                    return None
                    
        except httpx.TimeoutException as e:
            logger.error(f"⏰ Timeout checking story #{story_id}: {str(e)} - network issue, not deletion")
            return None
        except httpx.ConnectError as e:
            logger.error(f"🔌 Connection error for story #{story_id}: {str(e)} - network issue, not deletion")
            return None
        except httpx.HTTPStatusError as e:
            logger.error(f"📊 HTTP status error for story #{story_id}: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"💥 Unexpected error checking story #{story_id}: {str(e)}")
            logger.exception(f"Full stack trace for story #{story_id}:")
            return None

    async def sync_single_feedback(self, feedback: FeedbackEntry, db_session) -> bool:
        """Sync a single feedback item to Taiga"""
        try:
            logger.info(f"Syncing feedback: {feedback.title}")
            
            # Create user story in Taiga
            story = await self.create_user_story(feedback)
            
            if story:
                # Update feedback with Taiga info
                crud_feedback = CRUDFeedback(db=db_session)
                
                updated_feedback = await crud_feedback.update_taiga_info(
                    feedback_id=feedback.id,
                    taiga_story_id=story["id"],
                    taiga_project_id=self.project_id,
                    status=Status.PENDING
                )
                
                if updated_feedback:
                    logger.info(f"Feedback synced successfully: {feedback.id} -> Taiga story #{story['id']}")
                    return True
                else:
                    logger.error(f"Failed to update feedback after Taiga sync: {feedback.id}")
                    return False
            else:
                logger.error(f"Failed to create Taiga story for feedback: {feedback.id}")
                return False
                
        except Exception as e:
            logger.error(f"Error syncing feedback {feedback.id}: {str(e)}")
            return False

    async def process_pending_feedback(self) -> Dict[str, Any]:
        """Process all pending feedback entries"""
        logger.info("Starting Taiga sync process...")
        
        results = {
            "processed": 0,
            "succeeded": 0,
            "failed": 0,
            "errors": []
        }
        
        try:
            async with AsyncSessionLocal() as session:
                crud_feedback = CRUDFeedback(db=session)
                
                # Get all pending feedback
                pending_feedback = await crud_feedback.get_pending_feedback()
                
                if not pending_feedback:
                    logger.info("No pending feedback to sync")
                    return results
                
                logger.info(f"Found {len(pending_feedback)} pending feedback entries")
                results["processed"] = len(pending_feedback)
                
                # Ensure we're authenticated before processing batch
                if not await self._authenticate():
                    error_msg = "Failed to authenticate with Taiga"
                    logger.error(f"{error_msg}")
                    results["errors"].append(error_msg)
                    return results
                
                # Process each feedback entry
                for feedback in pending_feedback:
                    try:
                        success = await self.sync_single_feedback(feedback, session)
                        if success:
                            results["succeeded"] += 1
                        else:
                            results["failed"] += 1
                            results["errors"].append(f"Failed to sync feedback {feedback.id}")
                            
                    except Exception as e:
                        results["failed"] += 1
                        error_msg = f"Error processing feedback {feedback.id}: {str(e)}"
                        results["errors"].append(error_msg)
                        logger.error(f"{error_msg}")
                
                logger.info(f"Sync complete: {results['succeeded']} succeeded, {results['failed']} failed")
                return results
                
        except Exception as e:
            error_msg = f"Critical error in sync process: {str(e)}"
            logger.error(f"{error_msg}")
            results["errors"].append(error_msg)
            return results

    async def sync_status_updates(self) -> Dict[str, Any]:
        """Check Taiga for status updates on existing synced feedback"""
        logger.info("Checking for status updates from Taiga...")
        
        results = {
            "checked": 0,
            "updated": 0,
            "errors": []
        }
        
        try:
            async with AsyncSessionLocal() as session:
                crud_feedback = CRUDFeedback(db=session)
                
                # Get all synced feedback that might need status updates
                synced_feedback = await crud_feedback.get_synced_feedback()
                
                if not synced_feedback:
                    logger.info("No synced feedback to check")
                    return results
                
                logger.info(f"Checking {len(synced_feedback)} synced feedback entries")
                results["checked"] = len(synced_feedback)
                
                # Ensure we're authenticated
                if not await self._authenticate():
                    error_msg = "Failed to authenticate with Taiga"
                    results["errors"].append(error_msg)
                    return results
                
                # Check each synced feedback for status updates
                for feedback in synced_feedback:
                    try:
                        story_data = await self.get_story_status(feedback.taiga_story_id)
                        
                        if story_data and "status_extra_info" in story_data:
                            taiga_status = story_data["status_extra_info"]["name"]
                            internal_status = self._map_taiga_status_to_internal(taiga_status)
                            
                            # Update if status changed
                            if feedback.status != internal_status.value:
                                updated = await crud_feedback.update_status(
                                    feedback_id=feedback.id,
                                    status=internal_status
                                )
                                
                                if updated:
                                    results["updated"] += 1
                                    logger.info(f"Updated feedback {feedback.id} status: {feedback.status} -> {internal_status.value}")
                                    
                    except Exception as e:
                        error_msg = f"Error checking feedback {feedback.id}: {str(e)}"
                        results["errors"].append(error_msg)
                        logger.error(f"{error_msg}")
                
                logger.info(f"Status check complete: {results['updated']} updates made")
                return results
                
        except Exception as e:
            error_msg = f"Critical error in status sync: {str(e)}"
            results["errors"].append(error_msg)
            logger.error(f"{error_msg}")
            return results

    async def check_deleted_stories(self) -> Dict[str, Any]:
        """
        Check for deleted Taiga stories by attempting to fetch each synced story.
        If story returns 404/403, it was deleted and should be removed from database.
        """
        results = {
            "checked": 0,
            "deleted": 0,
            "errors": []
        }
        
        try:
            async with AsyncSessionLocal() as session:
                crud_feedback = CRUDFeedback(db=session)
                
                # Get all feedback entries with taiga_story_id (synced to Taiga)
                synced_feedback = await crud_feedback.get_synced_feedback()
                
                if not synced_feedback:
                    # Use debug level to avoid spam in logs every 5 seconds
                    if not self.quiet_mode:
                        logger.debug("No synced feedback to check for deletion")
                    return results
                    
                results["checked"] = len(synced_feedback)
                if not self.quiet_mode:
                    logger.debug(f"Checking {len(synced_feedback)} synced stories for deletion")
                
                # Ensure authentication
                if not await self._authenticate():
                    results["errors"].append("Failed to authenticate with Taiga")
                    return results
                
                # Check each story
                for feedback in synced_feedback:
                    try:
                        if not self.quiet_mode:
                            logger.debug(f"🔍 Checking feedback {feedback.id} -> Taiga story #{feedback.taiga_story_id}")
                        story_data = await self.get_story_status(feedback.taiga_story_id)
                        
                        if story_data is None:
                            # Story doesn't exist or had an error - investigate further
                            logger.warning(f"⚠️ story_data is None for feedback {feedback.id} (story #{feedback.taiga_story_id})")
                            logger.warning(f"📋 Feedback details: title='{feedback.title}', status='{feedback.status}'")
                            
                            # IMPORTANT: Check the logs above this point to see WHY story_data is None
                            # - Is it a genuine 404 (story deleted)?
                            # - Is it an auth failure (401)?
                            # - Is it a server error (5xx)?
                            # - Is it a network timeout?
                            
                            delete_result = await crud_feedback.delete(feedback_id=feedback.id)
                            
                            if delete_result:
                                results["deleted"] += 1
                                logger.error(f"🗑️ DELETED feedback {feedback.id} - Taiga story #{feedback.taiga_story_id}")
                                logger.error(f"📋 DELETED feedback title: '{feedback.title}'")
                                logger.error(f"⚠️ CHECK LOGS ABOVE to see why story_data was None!")
                            else:
                                error_msg = f"Failed to delete feedback {feedback.id}"
                                results["errors"].append(error_msg)
                                logger.error(error_msg)
                        else:
                            # Story exists - no deletion needed
                            if not self.quiet_mode:
                                story_title = story_data.get("subject", "Unknown")[:30]
                                logger.debug(f"✅ Feedback {feedback.id} -> Story exists: '{story_title}'")
                                
                    except Exception as e:
                        error_msg = f"Error checking story {feedback.taiga_story_id}: {str(e)}"
                        results["errors"].append(error_msg)
                        logger.error(error_msg)
                
                # Only log summary if there were deletions or errors
                if results["deleted"] > 0 or len(results["errors"]) > 0:
                    logger.info(f"Deletion check complete: {results['deleted']} deleted, {len(results['errors'])} errors")
                
                return results
                
        except Exception as e:
            error_msg = f"Critical error in deletion check: {str(e)}"
            results["errors"].append(error_msg)
            logger.error(error_msg)
            return results