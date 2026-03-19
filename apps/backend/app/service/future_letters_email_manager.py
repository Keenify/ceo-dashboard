import os
import logging
import pytz
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, func, select
import asyncio
import uuid
import base64
import hashlib

from app.models.future_letters import FutureLetter
from app.service.mailer_service import MailerService
from app.database.database import get_db

logger = logging.getLogger(__name__)

class FutureLettersEmailManager:
    """Manager for processing and sending future letters"""
    
    def __init__(self, db: Optional[Session | AsyncSession] = None):
        """
        Initialize the email manager
        
        Args:
            db: Optional database session (for testing), can be sync or async
        """
        self.mailer = MailerService()
        self.db = db
        self.encryption_key = os.getenv("EMAIL_CONTENT_ENCRYPTION_KEY")
        if not self.encryption_key:
            logger.warning("EMAIL_CONTENT_ENCRYPTION_KEY not set in environment variables.")
    
    def _decrypt_content(self, encrypted_content: str) -> str:
        """
        Decrypt the encrypted content using the encryption key from CryptoJS AES
        
        Args:
            encrypted_content: The encrypted content to decrypt
            
        Returns:
            str: The decrypted content or the original content if decryption fails
        """
        if not encrypted_content:
            return ""
            
        if not self.encryption_key:
            logger.error("Cannot decrypt content: encryption key is not available")
            return encrypted_content
            
        try:
            # Check if content appears to be encrypted
            # CryptoJS AES encryption typically starts with "U2FsdGVk" (Base64 for "Salted")
            if not encrypted_content.startswith("U2FsdGVk"):
                logger.debug("Content does not appear to be encrypted, returning as is")
                return encrypted_content
                
            # Use PyCryptodomex which is compatible with CryptoJS AES encryption
            try:
                from Cryptodome.Cipher import AES
                from Cryptodome.Util.Padding import unpad
                
                # Decode the base64 content
                ct_bytes = base64.b64decode(encrypted_content)
                
                # Extract salt (first 8 bytes after "Salted__")
                salt = ct_bytes[8:16]
                
                # Derive key and IV from password and salt (CryptoJS compatible)
                key_iv = self._derive_key_iv(self.encryption_key.encode(), salt)
                key = key_iv[:32]  # AES-256 key
                iv = key_iv[32:48]  # 16-byte IV
                
                # Create cipher and decrypt
                cipher = AES.new(key, AES.MODE_CBC, iv)
                padded_data = cipher.decrypt(ct_bytes[16:])  # Ciphertext starts after salt
                
                # Unpad according to PKCS#7
                data = unpad(padded_data, AES.block_size)
                
                # Return as UTF-8 string
                return data.decode('utf-8')
                
            except ImportError:
                logger.error("Cryptodome library not available. Cannot decrypt content.")
                return encrypted_content
                
        except Exception as e:
            logger.exception(f"Failed to decrypt content: {str(e)}")
            return encrypted_content  # Return original on error
            
    def _derive_key_iv(self, password: bytes, salt: bytes) -> bytes:
        """
        Derive key and IV using the CryptoJS compatible KDF
        
        Args:
            password: Password bytes
            salt: Salt bytes
            
        Returns:
            bytes: Combined key and IV material
        """
        # CryptoJS compatible key derivation
        data = b''
        material = b''
        
        # Generate 48 bytes (32 for key, 16 for IV)
        while len(material) < 48:
            data = hashlib.md5(data + password + salt).digest()
            material += data
            
        return material
    
    async def process_todays_letters(self) -> Dict[str, Any]:
        """
        Process all letters scheduled to be sent today
        
        Returns:
            dict: Summary of processed letters
        """
        if not self.mailer.is_configured():
            logger.error("Mailer service is not configured. Cannot process letters.")
            return {
                "success": False,
                "error": "Mailer service not configured",
                "processed": 0,
                "sent": 0,
                "failed": 0
            }
        
        # Check if we have a database session
        if not self.db:
            logger.error("No database session provided")
            return {
                "success": False,
                "error": "No database session",
                "processed": 0,
                "sent": 0,
                "failed": 0
            }
        
        try:
            # Get today's date in Singapore timezone
            sg_tz = pytz.timezone('Asia/Singapore')
            today = datetime.now(sg_tz).date()
            logger.info(f"Processing letters scheduled for {today} (Singapore date)")
            
            # Detect session type and use appropriate query method
            is_async_session = isinstance(self.db, AsyncSession)
            letters_to_send = []
            
            if is_async_session:
                # For AsyncSession, use SQLAlchemy 2.0 style async queries
                query = select(FutureLetter).where(
                    and_(
                        FutureLetter.send_date == today,
                        FutureLetter.send_status == "scheduled"
                    )
                )
                result = await self.db.execute(query)
                letters_to_send = result.scalars().all()
            else:
                # For regular Session, use traditional SQLAlchemy 1.x style
                letters_to_send = self.db.query(FutureLetter).filter(
                    and_(
                        FutureLetter.send_date == today,
                        FutureLetter.send_status == "scheduled"
                    )
                ).all()
            
            logger.info(f"Found {len(letters_to_send)} letters to send today")
            
            # Process statistics
            stats = {
                "success": True,
                "processed": len(letters_to_send),
                "sent": 0,
                "failed": 0,
                "letters": []
            }
            
            # Process each letter
            for letter in letters_to_send:
                try:
                    logger.info(f"Sending letter ID {letter.id} to {letter.recipient_email}")
                    
                    # Decrypt the email content before sending
                    decrypted_content = self._decrypt_content(letter.email_content)
                    
                    # Check if decryption was successful
                    if decrypted_content != letter.email_content:
                        logger.info(f"Successfully decrypted content for letter ID {letter.id}")
                    else:
                        logger.warning(f"Content for letter ID {letter.id} may not have been decrypted properly")
                    
                    # Send the email with decrypted content
                    response = self.mailer.send_email(
                        to_email=letter.recipient_email,
                        subject=letter.email_subject or "A letter from your past self",
                        content=decrypted_content,  # Use decrypted content
                        attachment_urls=letter.attachment_urls if letter.attachment_urls else []
                    )
                    
                    # Check if the email was sent successfully
                    if "error" not in response:
                        # Update the letter status
                        letter.send_status = "sent"
                        stats["sent"] += 1
                        stats["letters"].append({
                            "id": str(letter.id),
                            "status": "sent",
                            "recipient": letter.recipient_email
                        })
                        logger.info(f"Successfully sent letter ID {letter.id}")
                    else:
                        # Update the letter status to failed
                        letter.send_status = "failed"
                        stats["failed"] += 1
                        stats["letters"].append({
                            "id": str(letter.id),
                            "status": "failed",
                            "recipient": letter.recipient_email,
                            "error": response.get("error", "Unknown error")
                        })
                        logger.error(f"Failed to send letter ID {letter.id}: {response.get('error')}")
                    
                    # Commit the status change - handle both async and sync sessions
                    if is_async_session:
                        await self.db.commit()
                    else:
                        self.db.commit()
                    
                except Exception as e:
                    # Handle any exceptions during processing
                    stats["failed"] += 1
                    stats["letters"].append({
                        "id": str(letter.id),
                        "status": "failed",
                        "recipient": letter.recipient_email,
                        "error": str(e)
                    })
                    logger.exception(f"Error processing letter ID {letter.id}: {str(e)}")
                    
                    # Try to update the status - handle both async and sync sessions
                    try:
                        letter.send_status = "failed"
                        if is_async_session:
                            await self.db.commit()
                        else:
                            self.db.commit()
                    except Exception:
                        logger.exception("Failed to update letter status")
                        if is_async_session:
                            await self.db.rollback()
                        else:
                            self.db.rollback()
            
            logger.info(f"Processed {stats['processed']} letters: {stats['sent']} sent, {stats['failed']} failed")
            return stats
            
        except Exception as e:
            logger.exception(f"Error processing letters: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "processed": 0,
                "sent": 0,
                "failed": 0
            }


# Test guard for manual testing
if __name__ == "__main__":
    import sys
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from app.models.future_letters import FutureLetter
    from app.database.database import Base
    
    # Set up logging
    logging.basicConfig(level=logging.INFO)
    
    # Helper function for the async main
    async def main():
        # Use DATABASE_URL from environment
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            print("DATABASE_URL not set in environment. Please provide it.")
            sys.exit(1)
        
        # Create the appropriate engine based on URL
        if database_url.startswith("postgresql+asyncpg://"):
            # Use async engine for asyncpg URLs
            engine = create_async_engine(database_url)
            SessionLocal = sessionmaker(
                class_=AsyncSession,
                expire_on_commit=False,
                autocommit=False,
                autoflush=False,
                bind=engine
            )
            
            # Create an async session
            async with SessionLocal() as db:
                # Create the email manager
                manager = FutureLettersEmailManager(db=db)
                
                # Check if we have a specific letter ID to test
                test_letter_id = None
                if len(sys.argv) > 1:
                    test_letter_id = sys.argv[1]
                    print(f"Testing with specific letter ID: {test_letter_id}")
                    
                    # Get the letter - using async API
                    query = select(FutureLetter).where(FutureLetter.id == uuid.UUID(test_letter_id))
                    result = await db.execute(query)
                    letter = result.scalars().first()
                    
                    if not letter:
                        print(f"Letter with ID {test_letter_id} not found.")
                        sys.exit(1)
                    
                    print(f"Found letter to {letter.recipient_email}, scheduled for {letter.send_date}")
                    
                    # Override the send date to today for testing
                    today = date.today()
                    original_date = letter.send_date
                    letter.send_date = today
                    await db.commit()
                    
                    print(f"Updated send date from {original_date} to {today} for testing")
                
                # Process today's letters
                print("Processing letters scheduled for today...")
                result = await manager.process_todays_letters()
                
                # Print the result
                print(f"Success: {result['success']}")
                print(f"Processed: {result['processed']}")
                print(f"Sent: {result['sent']}")
                print(f"Failed: {result['failed']}")
                
                if result.get('letters'):
                    print("\nLetters processed:")
                    for letter_info in result['letters']:
                        print(f"  - ID: {letter_info['id']}")
                        print(f"    Status: {letter_info['status']}")
                        print(f"    Recipient: {letter_info['recipient']}")
                        if "error" in letter_info:
                            print(f"    Error: {letter_info['error']}")
                
                # If we used a specific test letter, restore its original date
                if test_letter_id:
                    # Get the letter again - using async API
                    query = select(FutureLetter).where(FutureLetter.id == uuid.UUID(test_letter_id))
                    result = await db.execute(query)
                    letter = result.scalars().first()
                    
                    if letter and letter.send_date == today:
                        letter.send_date = original_date
                        await db.commit()
                        print(f"Restored original send date: {original_date}")
        else:
            # For non-async URLs (like SQLite), convert to sync mode
            print("Using synchronous database connection")
            # Make sure to use a synchronous PostgreSQL connection for the script
            if database_url.startswith("postgresql+asyncpg://"):
                database_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
            
            # Connect to the database
            engine = create_engine(database_url)
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            db = SessionLocal()
            
            # Create the email manager
            manager = FutureLettersEmailManager(db=db)
            
            # Check if we have a specific letter ID to test
            test_letter_id = None
            if len(sys.argv) > 1:
                test_letter_id = sys.argv[1]
                print(f"Testing with specific letter ID: {test_letter_id}")
                
                # Get the letter
                letter = db.query(FutureLetter).filter(FutureLetter.id == uuid.UUID(test_letter_id)).first()
                if not letter:
                    print(f"Letter with ID {test_letter_id} not found.")
                    sys.exit(1)
                
                print(f"Found letter to {letter.recipient_email}, scheduled for {letter.send_date}")
                
                # Override the send date to today for testing
                today = date.today()
                original_date = letter.send_date
                letter.send_date = today
                db.commit()
                
                print(f"Updated send date from {original_date} to {today} for testing")
            
            # Process today's letters
            print("Processing letters scheduled for today...")
            result = await manager.process_todays_letters()
            
            # Print the result
            print(f"Success: {result['success']}")
            print(f"Processed: {result['processed']}")
            print(f"Sent: {result['sent']}")
            print(f"Failed: {result['failed']}")
            
            if result.get('letters'):
                print("\nLetters processed:")
                for letter_info in result['letters']:
                    print(f"  - ID: {letter_info['id']}")
                    print(f"    Status: {letter_info['status']}")
                    print(f"    Recipient: {letter_info['recipient']}")
                    if "error" in letter_info:
                        print(f"    Error: {letter_info['error']}")
            
            # If we used a specific test letter, restore its original date
            if test_letter_id:
                letter = db.query(FutureLetter).filter(FutureLetter.id == uuid.UUID(test_letter_id)).first()
                if letter and letter.send_date == today:
                    letter.send_date = original_date
                    db.commit()
                    print(f"Restored original send date: {original_date}")
                    
            # Close the database connection
            db.close()
        
        print("Done!")
    
    # Run the async main function
    asyncio.run(main())
