from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any

from app.service.planka_user_manager import planka_user_manager

router = APIRouter()

# Pydantic schemas
class PlankaUserOnboardRequest(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = "projectOwner"

class PlankaUserResponse(BaseModel):
    status: str
    message: str
    user: Optional[Dict[str, Any]] = None

@router.post("/onboard-planka-user", response_model=PlankaUserResponse)
async def onboard_planka_user(request: PlankaUserOnboardRequest):
    """
    Onboard a user to Planka - create user if doesn't exist
    
    This is the main endpoint for creating Planka users with the format:
    POST /api/planka/onboard-planka-user
    """
    try:
        result = await planka_user_manager.onboard_user(
            user_email=request.email,
            username=request.username,
            name=request.name,
            role=request.role
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
        
        return PlankaUserResponse(
            status=result["status"],
            message=result["message"],
            user=result.get("user")
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to onboard Planka user: {str(e)}"
        ) 