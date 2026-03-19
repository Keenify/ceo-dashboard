import os
import logging
import requests
import base64
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class WhatsAppService:
    """Service for sending and receiving WhatsApp messages using Twilio API"""

    def __init__(self):
        """Initialize the WhatsApp service with Twilio configuration"""
        self.account_sid = os.getenv("twilio_account_sid") or os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("twilio_auth_token") or os.getenv("TWILIO_AUTH_TOKEN")
        self.from_number = os.getenv("twilio_whatsapp_number", "+14155238886")
        
        # Add whatsapp: prefix if not present
        if not self.from_number.startswith("whatsapp:"):
            self.from_number = f"whatsapp:{self.from_number}"
        
        if not self.account_sid or not self.auth_token:
            logger.warning("Twilio credentials not set. WhatsApp sending will not work.")
            return
        
        # Create authorization header for Twilio API
        auth_string = f"{self.account_sid}:{self.auth_token}"
        auth_bytes = auth_string.encode('ascii')
        auth_base64 = base64.b64encode(auth_bytes).decode('ascii')
        self.auth_header = f"Basic {auth_base64}"
        
        self.api_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"

    def send_whatsapp_message(self, to_number: str, message: str) -> dict:
        """
        Send a WhatsApp message using Twilio API
        
        Args:
            to_number: Recipient phone number (with or without whatsapp: prefix)
            message: Message content
            
        Returns:
            Response from Twilio API
        """
        if not self.account_sid or not self.auth_token:
            logger.error("Cannot send WhatsApp message: Twilio credentials not set")
            return {"error": "Twilio configuration missing"}
        
        try:
            # Ensure the number has whatsapp: prefix
            if not to_number.startswith("whatsapp:"):
                to_number = f"whatsapp:{to_number}"
            
            # Prepare the request
            headers = {
                "Authorization": self.auth_header,
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            data = {
                "Body": message,
                "From": self.from_number,
                "To": to_number
            }
            
            # Send the request
            response = requests.post(self.api_url, headers=headers, data=data)
            
            if response.status_code == 201:
                response_data = response.json()
                logger.info(f"WhatsApp message sent successfully to {to_number}")
                return response_data
            else:
                logger.error(f"Failed to send WhatsApp message to {to_number}: {response.text}")
                return {"error": response.text, "status_code": response.status_code}
                
        except Exception as e:
            error_msg = f"Error sending WhatsApp message to {to_number}: {str(e)}"
            logger.exception(error_msg)
            return {"error": error_msg}

    def process_incoming_message(self, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process incoming WhatsApp message from Twilio webhook
        
        Args:
            webhook_data: Webhook data from Twilio
            
        Returns:
            Dictionary containing processed message data
        """
        try:
            # Extract message details
            message_sid = webhook_data.get("MessageSid")
            from_number = webhook_data.get("From")
            to_number = webhook_data.get("To")
            message_body = webhook_data.get("Body", "")
            num_media = int(webhook_data.get("NumMedia", 0))
            
            # Process message
            processed_data = {
                "message_sid": message_sid,
                "from_number": from_number,
                "to_number": to_number,
                "message_body": message_body,
                "num_media": num_media,
                "timestamp": datetime.now().isoformat(),
                "processed": True
            }
            
            logger.info(f"Processed incoming message from {from_number}: {message_body[:100]}...")
            return processed_data
            
        except Exception as e:
            error_msg = f"Error processing incoming message: {str(e)}"
            logger.exception(error_msg)
            return {"error": error_msg, "processed": False}

    def send_reply(self, to_number: str, reply_message: str) -> Dict[str, Any]:
        """
        Send a reply message to WhatsApp
        
        Args:
            to_number: Recipient phone number
            reply_message: Reply message content
            
        Returns:
            Dictionary containing send result
        """
        try:
            # Send reply using existing send method
            reply_result = self.send_whatsapp_message(to_number, reply_message)
            
            return {
                "reply_sent": "error" not in reply_result,
                "reply_result": reply_result,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            error_msg = f"Error sending reply to {to_number}: {str(e)}"
            logger.exception(error_msg)
            return {"error": error_msg, "reply_sent": False}

    def is_configured(self) -> bool:
        """Check if the WhatsApp service is properly configured"""
        return bool(self.account_sid) and bool(self.auth_token)


# Test guard for the WhatsApp service
if __name__ == "__main__":
    # Setup logging for testing
    logging.basicConfig(level=logging.INFO)
    
    # Create the WhatsApp service
    whatsapp_service = WhatsAppService()
    
    # Check if configured
    if not whatsapp_service.is_configured():
        print("❌ WhatsApp service is not properly configured. Please check your .env file.")
        print("Required variables: twilio_account_sid, twilio_auth_token, twilio_whatsapp_number")
        exit(1)
    
    print("✅ WhatsApp service is properly configured!")
    
    # Test parameters
    test_phone = os.getenv("TEST_PHONE_NUMBER", input("Enter test phone number (e.g., +60123456789): "))
    test_message = "🔄 Test message from WhatsApp Service\n\nThis is a test to verify the service is working correctly! 🚀"
    
    # Send test message
    print(f"📱 Sending test message to {test_phone}...")
    response = whatsapp_service.send_whatsapp_message(test_phone, test_message)
    
    # Print the response
    print("📋 Response:", response)
    
    if "error" in response:
        print("❌ Test failed!")
    else:
        print("✅ Test message sent successfully!")
        print(f"📧 Message SID: {response.get('sid', 'N/A')}")
    
    # Test incoming message processing
    print("\n📨 Testing incoming message processing...")
    sample_webhook_data = {
        "MessageSid": "SM1234567890",
        "From": "whatsapp:+60123456789",
        "To": "whatsapp:+14155238886",
        "Body": "Test incoming message",
        "NumMedia": "0"
    }
    
    processed = whatsapp_service.process_incoming_message(sample_webhook_data)
    print(f"Processed message: {processed}")
    
    # Test reply functionality
    print("\n💬 Testing reply functionality...")
    reply_result = whatsapp_service.send_reply(test_phone, "✅ This is a test reply message!")
    print(f"Reply result: {reply_result}")

