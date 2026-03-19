import os
import logging
import requests
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# app/service/mailer_service.py
class MailerService:
    """Service for sending emails using Mailgun API"""

    def __init__(self):
        """Initialize the mailer service with Mailgun configuration"""
        self.api_key = os.getenv("MAILGUN_API_KEY")
        self.domain = os.getenv("MAILGUN_DOMAIN")
        self.api_url = f"https://api.mailgun.net/v3/{self.domain}/messages"
        self.default_from_email = os.getenv("MAILGUN_FROM_EMAIL", f"Future Me <noreply@{self.domain}>")
        
        if not self.api_key or not self.domain:
            logger.warning("Mailgun API key or domain not set. Email sending will not work.")

    def send_email(
        self, 
        to_email: str, 
        subject: str, 
        content: str, 
        attachment_urls: Optional[List[str]] = None,
        attachment_files: Optional[List[Path]] = None,
        from_email: Optional[str] = None
    ) -> dict:
        """
        Send an email using Mailgun
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            content: Email body (HTML supported)
            attachment_urls: Optional list of URLs to files to attach
            attachment_files: Optional list of local file paths to attach
            from_email: Optional custom sender email (overrides default)
            
        Returns:
            Response from Mailgun API
        """
        if not self.api_key or not self.domain:
            logger.error("Cannot send email: Mailgun API key or domain not set")
            return {"error": "Mailgun configuration missing"}
        
        # Use custom from_email if provided, otherwise use default
        sender_email = from_email or self.default_from_email
        
        try:
            data = {
                "from": sender_email,
                "to": to_email,
                "subject": subject,
                "html": content
            }
            
            files = []
            
            # Process attachment URLs if provided
            if attachment_urls and isinstance(attachment_urls, list):
                for url in attachment_urls:
                    try:
                        # Download the file from the URL
                        response = requests.get(url)
                        if response.status_code == 200:
                            # Get filename from URL
                            filename = url.split('/')[-1]
                            
                            # Add file to the list of attachments
                            files.append(
                                ("attachment", (filename, response.content))
                            )
                        else:
                            logger.warning(f"Failed to download attachment from URL: {url}")
                    except Exception as e:
                        logger.error(f"Error processing attachment URL: {url} - {str(e)}")
            
            # Process local attachment files if provided
            if attachment_files and isinstance(attachment_files, list):
                for file_path in attachment_files:
                    try:
                        with open(file_path, "rb") as f:
                            filename = os.path.basename(file_path)
                            files.append(
                                ("attachment", (filename, f.read()))
                            )
                    except Exception as e:
                        logger.error(f"Error processing attachment file: {file_path} - {str(e)}")
            
            # Send the request to Mailgun
            response = requests.post(
                self.api_url,
                auth=("api", self.api_key),
                data=data,
                files=files
            )
            
            if response.status_code == 200:
                logger.info(f"Email sent successfully to {to_email}")
                return response.json()
            else:
                logger.error(f"Failed to send email: {response.text}")
                return {"error": response.text}
                
        except Exception as e:
            error_msg = f"Error sending email: {str(e)}"
            logger.exception(error_msg)
            return {"error": error_msg}

    def is_configured(self) -> bool:
        """Check if the service is properly configured"""
        return bool(self.api_key) and bool(self.domain)


# Test guard for the mailer service
if __name__ == "__main__":
    # Setup logging for testing
    logging.basicConfig(level=logging.INFO)
    
    # Create the mailer service
    mailer = MailerService()
    
    # Check if configured
    if not mailer.is_configured():
        print("Mailer service is not properly configured. Please check your .env file.")
        print("Required variables: MAILGUN_API_KEY, MAILGUN_DOMAIN")
        exit(1)
    
    # Test email parameters
    test_email = os.getenv("TEST_EMAIL", input("Enter recipient email for testing: "))
    
    # Send a test email
    response = mailer.send_email(
        to_email=test_email,
        subject="Test Email from CEO Dashboard",
        content="<h1>Test Email</h1><p>This is a test email from the CEO Dashboard application.</p>",
        # Optional: Add test attachment URL
        # attachment_urls=["https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRb4exV9WQP6s0td53Hn4dyOwjgxszkc-_OKw&s"]
    )
    
    # Print the response
    print("Response:", response)
    
    if "error" in response:
        print("Test failed!")
    else:
        print("Test email sent successfully!")
