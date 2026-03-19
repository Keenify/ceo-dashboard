from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime

class OAuthCode(BaseModel):
    code: str = Field(..., description="Authorization code received from Google OAuth flow")
    redirect_uri: Optional[str] = Field(None, description="Redirect URI used in the OAuth flow")

class UserGoogleTokenBase(BaseModel):
    access_token: Optional[str] = Field(None, description="Google OAuth access token.")
    refresh_token: Optional[str] = Field(None, description="Google OAuth refresh token for obtaining new access tokens.")
    expires_at: Optional[datetime] = Field(None, description="Timestamp when the access token expires.")

    model_config = ConfigDict(extra='forbid')  # Forbid unspecified fields

class UserGoogleTokenCreate(UserGoogleTokenBase):
    user_id: UUID = Field(..., description="ID of the user who owns these Google tokens.")

class UserGoogleTokenUpdate(UserGoogleTokenBase):
    model_config = ConfigDict(extra='forbid')

class UserGoogleTokenResponse(UserGoogleTokenBase):
    user_id: UUID = Field(..., description="ID of the user who owns these Google tokens.")

    model_config = ConfigDict(from_attributes=True)  # Enable ORM mode 