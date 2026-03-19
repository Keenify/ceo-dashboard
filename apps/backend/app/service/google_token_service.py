import os
import logging
import requests
from datetime import datetime, timedelta
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user_google_tokens import CRUDUserGoogleToken
from app.schemas.user_google_tokens import OAuthCode, UserGoogleTokenCreate, UserGoogleTokenUpdate

# Set up logger
logger = logging.getLogger(__name__)

class GoogleTokenService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.crud = CRUDUserGoogleToken(db)
        self.client_id = os.getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID")
        self.client_secret = os.getenv("NEXT_PUBLIC_GOOGLE_CLIENT_SECRET")
        
        if not self.client_id or not self.client_secret:
            logger.error("Google OAuth credentials not configured on server")
            raise ValueError("Google OAuth credentials not configured")

    async def exchange_oauth_code(self, data: OAuthCode, user_id: UUID) -> dict:
        """
        Exchange Google OAuth authorization code for tokens and store them.
        """
        try:
            logger.info(f"Starting OAuth exchange for user {user_id}")
            
            # Set redirect URI
            redirect_uri = data.redirect_uri or f"{os.getenv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')}/google/oauth/callback"
            logger.info(f"Using redirect URI: {redirect_uri}")
            
            # Exchange code for tokens
            token_endpoint = "https://oauth2.googleapis.com/token"
            logger.info(f"Sending token request to Google with code length: {len(data.code)}")
            
            # Debug: Log request parameters (excluding sensitive data)
            request_params = {
                "code": f"{data.code[:5]}...{data.code[-5:]}",  # Show only start and end 
                "client_id": f"{self.client_id[:5]}...",
                "client_secret": "***REDACTED***",
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
            logger.info(f"Request parameters: {request_params}")
            
            try:
                token_response = requests.post(
                    token_endpoint,
                    data={
                        "code": data.code,
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "redirect_uri": redirect_uri,
                        "grant_type": "authorization_code",
                    },
                    timeout=10  # Add a timeout to prevent hanging requests
                )
                
                try:
                    token_data = token_response.json()
                except Exception as e:
                    logger.error(f"Error parsing JSON response: {str(e)}")
                    logger.error(f"Raw response: {token_response.text}")
                    token_data = {}
                
                if not token_response.ok:
                    error_detail = token_data.get("error_description") or token_data.get("error") or "Unknown error from Google"
                    logger.error(f"Google OAuth error (HTTP {token_response.status_code}): {error_detail}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to exchange code: {error_detail}"
                    )
                    
                logger.info("Successfully received tokens from Google")
                # Log response (excluding sensitive data)
                safe_response = {
                    "access_token": "***REDACTED***",
                    "token_type": token_data.get("token_type"),
                    "expires_in": token_data.get("expires_in"),
                    "has_refresh_token": "refresh_token" in token_data
                }
                logger.info(f"Response data: {safe_response}")
                
            except requests.RequestException as e:
                logger.error(f"Request to Google failed: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to communicate with Google: {str(e)}"
                )
            
            # Calculate expiry time
            expires_in = token_data.get("expires_in", 3600)  # Default to 1 hour if not provided
            expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            # Create or update token in database
            token_obj = UserGoogleTokenCreate(
                user_id=user_id,
                access_token=token_data["access_token"],
                refresh_token=token_data.get("refresh_token"),  # Might not be present if user already granted access
                expires_at=expires_at
            )
            
            logger.info(f"Saving token to database for user {user_id}")
            await self.crud.create(obj_in=token_obj)
            
            return {"success": True, "message": "Google Calendar connected successfully"}
            
        except HTTPException:
            # Re-raise HTTP exceptions
            raise
        except Exception as e:
            logger.exception(f"Unexpected error in Google OAuth exchange: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process OAuth exchange: {str(e)}"
            )

    async def disconnect_google(self, user_id: UUID) -> dict:
        """
        Disconnect Google integration by removing stored tokens.
        """
        try:
            logger.info(f"Disconnecting Google for user {user_id}")
            
            # Remove token from database
            token = await self.crud.remove(user_id=user_id)
            
            # If token exists, also revoke it with Google
            if token and token.access_token:
                try:
                    # Best effort to revoke the token
                    logger.info("Attempting to revoke token with Google")
                    requests.post(
                        "https://oauth2.googleapis.com/revoke",
                        params={"token": token.access_token},
                        timeout=5
                    )
                except Exception as e:
                    # Ignore errors from token revocation - the important part is removing from our DB
                    logger.warning(f"Failed to revoke token with Google, but token removed from DB: {str(e)}")
                    pass
            
            return {"success": True, "message": "Google Calendar disconnected successfully"}
            
        except Exception as e:
            logger.exception(f"Error disconnecting Google: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to disconnect Google Calendar: {str(e)}"
            )

    async def get_connection_status(self, user_id: UUID) -> dict:
        """
        Check if the user has connected their Google account and if the tokens are valid.
        """
        try:
            logger.info(f"Checking Google connection status for user {user_id}")
            
            # Get token from database
            token = await self.crud.get(user_id=user_id)
            
            if not token or not token.access_token:
                logger.info(f"No valid Google token found for user {user_id}")
                return {"connected": False, "valid": False}
            
            # Check if token is expired
            is_expired = await self.crud.is_token_expired(token=token)
            logger.info(f"Token for user {user_id}: expired={is_expired}")
            
            return {
                "connected": True,
                "expired": is_expired,
                "valid": not is_expired,
                "expires_at": token.expires_at
            }
            
        except Exception as e:
            logger.exception(f"Error checking Google connection status: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to check Google connection status: {str(e)}"
            )

    async def get_token(self, user_id: UUID) -> dict:
        """
        Get the Google access token for a user. The frontend can use this token
        to make API calls to Google Calendar directly.
        """
        try:
            logger.info(f"Getting Google token for user {user_id}")
            
            # Get token from database
            token = await self.crud.get(user_id=user_id)
            
            if not token or not token.access_token:
                logger.info(f"No valid Google token found for user {user_id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No Google token found for this user. Please connect Google Calendar first."
                )
            
            # Check if token is expired
            is_expired = await self.crud.is_token_expired(token=token)
            
            if is_expired:
                if token.refresh_token:
                    # Refresh the token
                    logger.info(f"Refreshing expired token for user {user_id}")
                    
                    try:
                        # Exchange refresh token for a new access token
                        token_endpoint = "https://oauth2.googleapis.com/token"
                        token_response = requests.post(
                            token_endpoint,
                            data={
                                "client_id": self.client_id,
                                "client_secret": self.client_secret,
                                "refresh_token": token.refresh_token,
                                "grant_type": "refresh_token",
                            },
                            timeout=10
                        )
                        
                        token_data = token_response.json()
                        
                        if not token_response.ok:
                            error_detail = token_data.get("error_description") or token_data.get("error") or "Unknown error from Google"
                            logger.error(f"Google OAuth refresh error: {error_detail}")
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Failed to refresh token: {error_detail}"
                            )
                        
                        # Calculate new expiry time
                        expires_in = token_data.get("expires_in", 3600)  # Default to 1 hour
                        expires_at = datetime.now() + timedelta(seconds=expires_in)
                        
                        # Update token in database
                        token_obj = UserGoogleTokenUpdate(
                            access_token=token_data["access_token"],
                            expires_at=expires_at
                        )
                        
                        updated_token = await self.crud.update(db_obj=token, obj_in=token_obj)
                        
                        return {
                            "access_token": updated_token.access_token,
                            "expires_at": updated_token.expires_at
                        }
                        
                    except Exception as e:
                        logger.error(f"Error refreshing token: {str(e)}")
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to refresh token: {str(e)}"
                        )
                else:
                    # No refresh token available
                    logger.warning(f"Token expired for user {user_id} and no refresh token available")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Google Calendar token is expired. Please reconnect your Google account."
                    )
            
            return {
                "access_token": token.access_token,
                "expires_at": token.expires_at
            }
            
        except HTTPException:
            # Re-raise HTTP exceptions
            raise
        except Exception as e:
            logger.exception(f"Error getting Google token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get Google token: {str(e)}"
            ) 