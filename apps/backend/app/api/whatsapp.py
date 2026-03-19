from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Form, status
from fastapi.responses import PlainTextResponse
import logging

from app.service.whatsapp_ai_manager import WhatsAppAIManager
from app.service.whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/webhook", response_class=PlainTextResponse)
async def whatsapp_webhook(
    request: Request,
    MessageSid: str = Form(...),
    From: str = Form(...),
    To: str = Form(...),
    Body: str = Form(default=""),
    NumMedia: str = Form(default="0"),
    MediaUrl0: str = Form(default=""),
    MediaContentType0: str = Form(default=""),
    AccountSid: str = Form(...),
    MessagingServiceSid: str = Form(default=""),
    ApiVersion: str = Form(default=""),
    SmsSid: str = Form(default=""),
    SmsStatus: str = Form(default=""),
    NumSegments: str = Form(default="1"),
    ReferralNumMedia: str = Form(default="0"),
    MessageStatus: str = Form(default=""),
    WaId: str = Form(default=""),
    SmsMessageSid: str = Form(default=""),
    ProfileName: str = Form(default=""),
    ButtonText: str = Form(default=""),
    ButtonPayload: str = Form(default="")
) -> PlainTextResponse:
    """Handle incoming WhatsApp messages from Twilio webhook"""
    try:
        # Log the incoming webhook
        logger.info(f"Received WhatsApp webhook from {From}: {Body[:100]}...")
        
        # Prepare webhook data
        webhook_data = {
            "MessageSid": MessageSid,
            "From": From,
            "To": To,
            "Body": Body,
            "NumMedia": NumMedia,
            "MediaUrl0": MediaUrl0,
            "MediaContentType0": MediaContentType0,
            "AccountSid": AccountSid,
            "MessagingServiceSid": MessagingServiceSid,
            "ApiVersion": ApiVersion,
            "SmsSid": SmsSid,
            "SmsStatus": SmsStatus,
            "NumSegments": NumSegments,
            "ReferralNumMedia": ReferralNumMedia,
            "MessageStatus": MessageStatus,
            "WaId": WaId,
            "SmsMessageSid": SmsMessageSid,
            "ProfileName": ProfileName,
            "ButtonText": ButtonText,
            "ButtonPayload": ButtonPayload
        }
        
        # Use manager to process the message
        manager = WhatsAppAIManager()
        result = await manager.process_incoming_message(webhook_data)
        
        if not result.get("success"):
            logger.error(f"Failed to process message: {result}")
            return PlainTextResponse("Error processing message", status_code=500)
        
        # Log success
        logger.info(f"Successfully processed WhatsApp message from {From}")
        
        # Return empty response as required by Twilio
        return PlainTextResponse("", status_code=200)
        
    except Exception as e:
        logger.exception(f"Unexpected error in WhatsApp webhook: {str(e)}")
        return PlainTextResponse("Internal server error", status_code=500)

@router.get("/status")
async def whatsapp_status() -> Dict[str, Any]:
    """Get the status of the WhatsApp service and related AI services"""
    try:
        manager = WhatsAppAIManager()
        
        return {
            "service_name": "WhatsApp Service",
            "configured": manager.is_configured(),
            "webhook_url": "/whatsapp/webhook",
            "status": "ready" if manager.is_configured() else "not_configured"
        }
        
    except Exception as e:
        logger.exception(f"Error getting WhatsApp status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting status: {str(e)}"
        )

@router.post("/send-message")
async def send_message(
    to_number: str,
    message: str
) -> Dict[str, Any]:
    """Send a WhatsApp message manually"""
    try:
        # Use WhatsApp service directly for manual sending
        whatsapp_service = WhatsAppService()
        
        if not whatsapp_service.is_configured():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="WhatsApp service is not properly configured"
            )
        
        # Send the message
        result = whatsapp_service.send_whatsapp_message(to_number, message)
        
        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to send message: {result['error']}"
            )
        
        return {
            "success": True,
            "message": "Message sent successfully",
            "result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error sending WhatsApp message: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/test-ai-response")
async def test_ai_response(
    message: str,
    phone_number: str = "+1234567890"
) -> Dict[str, Any]:
    """Test AI response generation"""
    try:
        # Create test webhook data
        webhook_data = {
            "From": phone_number,
            "Body": message,
            "MessageSid": "test_message_sid",
            "To": "+1234567890",
            "AccountSid": "test_account_sid"
        }
        
        # Use manager to process the message
        manager = WhatsAppAIManager()
        result = await manager.process_incoming_message(webhook_data)
        
        return {
            "success": True,
            "user_message": message,
            "phone_number": phone_number,
            "result": result
        }
        
    except Exception as e:
        logger.exception(f"Error testing AI response: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        ) 