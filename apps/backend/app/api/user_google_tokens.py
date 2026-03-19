from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Dict
from uuid import UUID

from app.database.database import get_db
from app.schemas.user_google_tokens import OAuthCode
from app.service.google_token_service import GoogleTokenService

# Simple placeholder for auth - we'll implement proper JWT validation later
async def validate_user_access(user_id: UUID) -> UUID:
    """
    Placeholder for authentication middleware.
    In a real app, this would validate JWT tokens.
    """
    return user_id

router = APIRouter()

@router.post("/google/oauth/exchange", response_model=Dict[str, Any])
async def exchange_code(
    *,
    db: AsyncSession = Depends(get_db),
    data: OAuthCode,
    user_id: UUID = Query(..., description="User ID for token storage"),
    authorized_user_id: UUID = Depends(validate_user_access)
) -> Dict[str, Any]:
    """
    Exchange Google OAuth authorization code for tokens and store them.
    """
    if user_id != authorized_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resource"
        )
    
    try:
        service = GoogleTokenService(db)
        return await service.exchange_oauth_code(data, user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.delete("/google/disconnect", response_model=Dict[str, Any])
async def disconnect_google(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(..., description="User ID for token deletion"),
    authorized_user_id: UUID = Depends(validate_user_access)
) -> Dict[str, Any]:
    """
    Disconnect Google integration by removing stored tokens.
    """
    if user_id != authorized_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resource"
        )
    
    try:
        service = GoogleTokenService(db)
        return await service.disconnect_google(user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/google/status", response_model=Dict[str, Any])
async def get_google_connection_status(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(..., description="User ID to check connection status"),
    authorized_user_id: UUID = Depends(validate_user_access)
) -> Dict[str, Any]:
    """
    Check if the user has connected their Google account and if the tokens are valid.
    """
    if user_id != authorized_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resource"
        )
    
    try:
        service = GoogleTokenService(db)
        return await service.get_connection_status(user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/google/token", response_model=Dict[str, Any])
async def get_google_token(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(..., description="User ID to get token for"),
    authorized_user_id: UUID = Depends(validate_user_access)
) -> Dict[str, Any]:
    """
    Get the Google access token for a user. The frontend can use this token
    to make API calls to Google Calendar directly.
    """
    if user_id != authorized_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resource"
        )
    
    try:
        service = GoogleTokenService(db)
        return await service.get_token(user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) 