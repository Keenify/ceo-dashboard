import os
import logging
from typing import List, Dict, Any, Optional, TYPE_CHECKING
from datetime import date, datetime, timedelta
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.models.payment_reminders import PaymentReminder
    from app.models.credit_card_instructions import CreditCardInstructions
else:
    # Import at runtime to avoid type checker confusion
    from app.models.payment_reminders import PaymentReminder
    from app.models.credit_card_instructions import CreditCardInstructions

from app.service.mailer_service import MailerService
from app.crud.payment_reminders import CRUDPaymentReminder
from app.crud.credit_card_instructions import CRUDCreditCardInstructions

logger = logging.getLogger(__name__)

class PaymentRemindersEmailManager:
    """Service for sending payment reminder emails via MailerService"""

    def __init__(self):
        """Initialize the email manager with mailer service"""
        self.mailer = MailerService()
        logger.info("[PaymentReminders] Email manager initialized with MailerService")

    async def send_payment_reminders(
        self, 
        db: AsyncSession,
        target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Send payment reminder emails for all reminders scheduled for the target date.
        
        This method processes reminders where scheduled_date = target_date.
        The scheduled_date is calculated when creating reminders as: due_date - days_before_due
        
        Args:
            db: Database session
            target_date: Date to check for scheduled reminders (defaults to today)
            
        Returns:
            Summary of sent reminders with detailed statistics
        """
        if target_date is None:
            target_date = date.today()
            
        try:
            logger.info(f"[PaymentReminders] Processing reminders scheduled for {target_date}")
            
            # Check if email service is configured
            if not self.mailer.is_configured():
                error_msg = "Email service not configured. Cannot send payment reminders."
                logger.error(f"[PaymentReminders] {error_msg}")
                return {
                    "success": False,
                    "processed": 0,
                    "sent": 0,
                    "failed": 0,
                    "error": error_msg
                }
            
            # Get reminders scheduled for today (where scheduled_date = target_date)
            crud_reminder = CRUDPaymentReminder(db)
            reminders_due = await crud_reminder.get_due_today(target_date=target_date)
            
            if not reminders_due:
                logger.info(f"[PaymentReminders] No reminders scheduled for {target_date}")
                return {
                    "success": True,
                    "processed": 0,
                    "sent": 0,
                    "failed": 0,
                    "users_processed": 0,
                    "message": f"No reminders scheduled for {target_date}"
                }
            
            logger.info(f"[PaymentReminders] Found {len(reminders_due)} reminders scheduled for processing")
            
            # Group reminders by user and email for efficient sending
            user_reminders = self._group_reminders_by_user(reminders_due)
            
            stats = {
                "success": True,
                "processed": len(reminders_due),
                "sent": 0,
                "failed": 0,
                "users_processed": len(user_reminders),
                "details": []
            }
            
            # Send emails for each user
            for user_id, user_data in user_reminders.items():
                try:
                    # Get card details for each reminder
                    card_details = await self._get_card_details_with_due_dates(db, user_data["reminders"])
                    
                    # Generate and send email using MailerService
                    result = await self._send_user_reminder_email(
                        db=db,
                        user_id=user_id,
                        reminders=user_data["reminders"],
                        card_details=card_details,
                        email=user_data["email"]
                    )
                    
                    if result["success"]:
                        stats["sent"] += result["sent_count"]
                        stats["details"].append({
                            "user_id": str(user_id),
                            "email": user_data["email"],
                            "status": "sent",
                            "cards_count": len(card_details),
                            "reminder_ids": [str(r.id) for r in user_data["reminders"]]
                        })
                        logger.info(f"[PaymentReminders] Successfully sent email to {user_data['email']} for {len(card_details)} cards")
                    else:
                        stats["failed"] += result["failed_count"]
                        stats["details"].append({
                            "user_id": str(user_id),
                            "email": user_data["email"],
                            "status": "failed",
                            "error": result.get("error", "Unknown error"),
                            "reminder_ids": [str(r.id) for r in user_data["reminders"]]
                        })
                        logger.error(f"[PaymentReminders] Failed to send email to {user_data['email']}: {result.get('error')}")
                    
                except Exception as e:
                    logger.exception(f"[PaymentReminders] Error processing user {user_id}: {str(e)}")
                    stats["failed"] += len(user_data["reminders"])
                    stats["details"].append({
                        "user_id": str(user_id),
                        "email": user_data["email"],
                        "status": "failed",
                        "error": str(e),
                        "reminder_ids": [str(r.id) for r in user_data["reminders"]]
                    })
            
            logger.info(f"[PaymentReminders] Processing completed: {stats['sent']} sent, {stats['failed']} failed, {stats['users_processed']} users processed")
            return stats
            
        except Exception as e:
            logger.exception(f"[PaymentReminders] Error processing reminders: {str(e)}")
            return {
                "success": False,
                "processed": 0,
                "sent": 0,
                "failed": 0,
                "error": str(e)
            }

    def _group_reminders_by_user(self, reminders: "List[PaymentReminder]") -> Dict[UUID, Dict[str, Any]]:
        """Group reminders by user ID and email address for batch sending"""
        user_groups = {}
        
        for reminder in reminders:
            user_id = reminder.user_id
            email = reminder.email
            
            if user_id not in user_groups:
                user_groups[user_id] = {
                    "email": email,
                    "reminders": []
                }
            
            user_groups[user_id]["reminders"].append(reminder)
        
        logger.info(f"[PaymentReminders] Grouped {len(reminders)} reminders into {len(user_groups)} user groups")
        return user_groups

    async def _get_card_details_with_due_dates(
        self, 
        db: AsyncSession, 
        reminders: "List[PaymentReminder]"
    ) -> List[Dict[str, Any]]:
        """
        Get credit card details with calculated due dates and urgency levels.
        This method calculates the actual due dates and days remaining.
        """
        crud_card = CRUDCreditCardInstructions(db)
        card_details = []
        
        for reminder in reminders:
            try:
                card = await crud_card.get(id=reminder.card_id, user_id=reminder.user_id)
                if card:
                    # Calculate actual due date for this month/next month
                    today = date.today()
                    due_date = self._calculate_next_due_date(today, card.payment_day)
                    days_until_due = (due_date - today).days
                    
                    # Determine urgency based on days remaining (not days_before_due from reminder)
                    urgency = self._determine_urgency(days_until_due)
                    
                    card_details.append({
                        "reminder_id": str(reminder.id),
                        "card_id": str(card.id),
                        "card_name": card.card_name,
                        "payment_day": card.payment_day,
                        "description": card.description or "Monthly payment",
                        "instruction": card.instruction,
                        "is_paid": card.is_paid,
                        "due_date": due_date,
                        "days_until_due": days_until_due,
                        "urgency": urgency,
                        "days_before_due_setting": reminder.days_before_due,  # Original setting
                        "scheduled_date": reminder.scheduled_date  # When reminder was scheduled
                    })
                    
                    logger.debug(f"[PaymentReminders] Card {card.card_name}: due {due_date}, {days_until_due} days remaining, urgency: {urgency}")
                else:
                    logger.warning(f"[PaymentReminders] Card not found for reminder {reminder.id}")
            except Exception as e:
                logger.error(f"[PaymentReminders] Error getting card details for reminder {reminder.id}: {str(e)}")
        
        # Sort by urgency (most urgent first), then by days until due
        card_details.sort(key=lambda x: (x["urgency"] != "urgent", x["days_until_due"]))
        logger.info(f"[PaymentReminders] Retrieved details for {len(card_details)} cards")
        return card_details

    def _calculate_next_due_date(self, today: date, payment_day: int) -> date:
        """Calculate the next due date for a card based on payment day"""
        try:
            # Try current month first
            due_date = date(today.year, today.month, payment_day)
            
            # If due date has passed this month, use next month
            if due_date <= today:
                if today.month == 12:
                    due_date = date(today.year + 1, 1, payment_day)
                else:
                    due_date = date(today.year, today.month + 1, payment_day)
            
            return due_date
        except ValueError:
            # Handle cases where payment_day doesn't exist in the month (e.g., Feb 30)
            # Fall back to last day of the month
            if today.month == 12:
                next_month = date(today.year + 1, 1, 1)
            else:
                next_month = date(today.year, today.month + 1, 1)
            
            # Get last day of next month
            last_day = (next_month - timedelta(days=1)).day
            return date(next_month.year, next_month.month, min(payment_day, last_day))

    def _determine_urgency(self, days_until_due: int) -> str:
        """Determine urgency level based on days until due"""
        if days_until_due <= 1:
            return "urgent"
        elif days_until_due <= 3:
            return "due-soon"
        else:
            return "normal"

    async def _send_user_reminder_email(
        self,
        db: AsyncSession,
        user_id: UUID,
        reminders: "List[PaymentReminder]",
        card_details: List[Dict[str, Any]],
        email: str
    ) -> Dict[str, Any]:
        """Send payment reminder email to a specific user using MailerService"""
        try:
            # Filter only unpaid cards
            unpaid_cards = [card for card in card_details if not card["is_paid"]]
            
            if not unpaid_cards:
                logger.info(f"[PaymentReminders] All cards paid for user {user_id}, marking reminders as cancelled")
                # Mark reminders as cancelled since cards are paid
                crud_reminder = CRUDPaymentReminder(db)
                for reminder in reminders:
                    await crud_reminder.update(
                        db_obj=reminder, 
                        obj_in={"status": "cancelled"}
                    )
                return {"success": True, "sent_count": 0, "failed_count": 0, "message": "All cards paid"}
            
            # Generate email content using our template
            email_content = self._generate_email_html(unpaid_cards)
            subject = self._generate_email_subject(unpaid_cards)
            
            # Send email via MailerService
            logger.info(f"[PaymentReminders] Sending email to {email} with subject: {subject}")
            response = self.mailer.send_email(
                to_email=email,
                subject=subject,
                content=email_content,
                from_email="Personal Finance <noreply@mail.autolabkit.com>"
            )
            
            # Update reminder statuses based on email result
            crud_reminder = CRUDPaymentReminder(db)
            
            if "error" not in response:
                # Email sent successfully - mark as sent
                sent_count = 0
                for reminder in reminders:
                    await crud_reminder.mark_as_sent(reminder_id=reminder.id, user_id=user_id)
                    sent_count += 1
                
                logger.info(f"[PaymentReminders] Email sent successfully to {email} for {len(unpaid_cards)} cards")
                return {"success": True, "sent_count": sent_count, "failed_count": 0}
            else:
                # Email failed - mark as failed
                error_message = response.get("error", "Unknown email error")
                failed_count = 0
                for reminder in reminders:
                    await crud_reminder.mark_as_failed(
                        reminder_id=reminder.id, 
                        user_id=user_id
                    )
                    failed_count += 1
                
                logger.error(f"[PaymentReminders] Failed to send email to {email}: {error_message}")
                return {"success": False, "sent_count": 0, "failed_count": failed_count, "error": error_message}
                
        except Exception as e:
            error_msg = f"Error sending reminder email to user {user_id}: {str(e)}"
            logger.exception(error_msg)
            return {"success": False, "sent_count": 0, "failed_count": len(reminders), "error": error_msg}

    def _generate_email_subject(self, cards: List[Dict[str, Any]]) -> str:
        """Generate email subject based on the cards and urgency"""
        if len(cards) == 1:
            card = cards[0]
            days = card["days_until_due"]
            if days <= 0:
                return f"🚨 {card['card_name']} payment due today!"
            elif days == 1:
                return f"🚨 {card['card_name']} payment due tomorrow!"
            else:
                return f"💳 {card['card_name']} payment reminder - {days} days remaining"
        else:
            urgent_count = len([c for c in cards if c["urgency"] == "urgent"])
            if urgent_count > 0:
                return f"🚨 {urgent_count} urgent credit card payment{'s' if urgent_count > 1 else ''} due!"
            else:
                return f"💳 {len(cards)} credit card payment reminders"

    def _generate_email_html(self, cards: List[Dict[str, Any]]) -> str:
        """Generate HTML email content based on the payment reminder template"""
        
        # Helper function to format date
        def format_date(due_date: date) -> str:
            return due_date.strftime("%B %d, %Y")
        
        # Count urgent vs regular cards
        urgent_cards = [c for c in cards if c["urgency"] == "urgent"]
        total_cards = len(cards)
        
        # Create urgency banner message
        if len(urgent_cards) > 0:
            urgency_message = f"⚠️ You have {len(urgent_cards)} credit card payment{'s' if len(urgent_cards) > 1 else ''} due in the next 1 day"
        else:
            urgency_message = f"⚠️ You have {total_cards} credit card payment{'s' if total_cards > 1 else ''} due in the next 3 days"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Credit Card Payment Reminder</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9fafb;
                }}
                .container {{
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }}
                .header {{
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                }}
                .header h1 {{
                    margin: 0;
                    font-size: 28px;
                    font-weight: 700;
                }}
                .header p {{
                    margin: 10px 0 0 0;
                    opacity: 0.9;
                    font-size: 16px;
                }}
                .urgency-banner {{
                    background: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 15px 20px;
                    margin: 20px;
                    border-radius: 8px;
                }}
                .urgency-text {{
                    color: #92400e;
                    font-weight: 600;
                    font-size: 16px;
                }}
                .cards-section {{
                    padding: 25px;
                }}
                .section-title {{
                    font-size: 20px;
                    font-weight: 700;
                    color: #1e293b;
                    margin: 0 0 20px 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }}
                .card-item {{
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 15px;
                    position: relative;
                }}
                .card-item.due-soon {{
                    border-left: 4px solid #ef4444;
                    background: #fef2f2;
                }}
                .card-item.urgent {{
                    border-left: 4px solid #dc2626;
                    background: #fef2f2;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
                }}
                .card-header {{
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }}
                .card-name {{
                    font-size: 18px;
                    font-weight: 700;
                    color: #1e293b;
                }}
                .card-status {{
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    background: #fef2f2;
                    color: #dc2626;
                    border: 1px solid #fecaca;
                }}
                .due-info {{
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 10px;
                }}
                .due-date {{
                    font-size: 16px;
                    font-weight: 600;
                    color: #ef4444;
                }}
                .days-remaining {{
                    background: #fef3c7;
                    color: #92400e;
                    padding: 4px 8px;
                    border-radius: 16px;
                    font-size: 12px;
                    font-weight: 600;
                }}
                .days-remaining.urgent {{
                    background: #fecaca;
                    color: #dc2626;
                }}
                .card-description {{
                    color: #64748b;
                    font-size: 14px;
                    margin-bottom: 15px;
                }}
                .summary-box {{
                    background: #dbeafe;
                    border: 1px solid #93c5fd;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 20px;
                    text-align: center;
                }}
                .summary-text {{
                    color: #1e40af;
                    font-weight: 600;
                }}
                .footer {{
                    padding: 25px;
                    background: #f8fafc;
                    text-align: center;
                    color: #64748b;
                    font-size: 14px;
                    border-top: 1px solid #e2e8f0;
                }}
                .footer a {{
                    color: #3b82f6;
                    text-decoration: none;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>💳 Credit Card Payment Reminder</h1>
                    <p>You have upcoming payment deadlines</p>
                </div>
                
                <div class="urgency-banner">
                    <div class="urgency-text">
                        {urgency_message}
                    </div>
                </div>
                
                <div class="cards-section">
                    <h2 class="section-title">
                        📅 Upcoming Payments
                    </h2>
        """
        
        # Add card items
        for card in cards:
            urgency_class = card["urgency"]
            days_text = "today" if card["days_until_due"] == 0 else f"{card['days_until_due']} day{'s' if card['days_until_due'] > 1 else ''} remaining"
            days_class = "urgent" if card["urgency"] == "urgent" else ""
            
            description_text = card["description"] if card["description"] else "Monthly payment"
            
            html_content += f"""
                    <div class="card-item {urgency_class}">
                        <div class="card-header">
                            <div class="card-name">{card['card_name']}</div>
                            <div class="card-status">Unpaid</div>
                        </div>
                        <div class="due-info">
                            <div class="due-date">Due: {format_date(card['due_date'])}</div>
                            <div class="days-remaining {days_class}">{days_text}</div>
                        </div>
                        <div class="card-description">
                            {description_text}
                        </div>
                    </div>
            """
        
        # Add footer
        html_content += """
                </div>
                
                <div class="summary-box">
                    <div class="summary-text">
                        💡 Tip: Set up automatic payments to never miss a due date again!
                    </div>
                </div>
                
                <div class="footer">
                    <p>
                        This reminder was sent because you have payment reminders enabled.<br>
                        <a href="#">Update reminder preferences</a> | 
                        <a href="#">Manage credit cards</a> | 
                        <a href="#">Personal Finance</a>
                    </p>
                    <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
                        Personal Finance - Keep your finances on track<br>
                        You're receiving this because you have payment reminders enabled.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html_content

    def is_configured(self) -> bool:
        """Check if the email service is properly configured"""
        is_configured = self.mailer.is_configured()
        logger.info(f"[PaymentReminders] Email service configured: {is_configured}")
        return is_configured

    async def create_reminders_for_card(
        self,
        db: AsyncSession,
        user_id: UUID,
        card_id: UUID,
        email: str,
        days_before_due: int = 3
    ) -> Dict[str, Any]:
        """
        Create payment reminders for a specific card.
        This method calculates when reminders should be sent based on days_before_due.
        
        Args:
            db: Database session
            user_id: User ID
            card_id: Credit card ID
            email: Email address for reminders
            days_before_due: How many days before due date to send reminder
            
        Returns:
            Result of reminder creation
        """
        try:
            # Get card details
            crud_card = CRUDCreditCardInstructions(db)
            card = await crud_card.get(id=card_id, user_id=user_id)
            
            if not card:
                return {"success": False, "error": "Card not found"}
            
            # Calculate next due date
            today = date.today()
            due_date = self._calculate_next_due_date(today, card.payment_day)
            
            # Calculate when to send reminder: due_date - days_before_due
            scheduled_date = due_date - timedelta(days=days_before_due)
            
            # Don't create reminders for past dates
            if scheduled_date < today:
                # Calculate for next month instead
                if due_date.month == 12:
                    next_due = date(due_date.year + 1, 1, card.payment_day)
                else:
                    next_due = date(due_date.year, due_date.month + 1, card.payment_day)
                scheduled_date = next_due - timedelta(days=days_before_due)
            
            # Create reminder
            crud_reminder = CRUDPaymentReminder(db)
            from app.schemas.payment_reminders import PaymentReminderCreate
            
            reminder_data = PaymentReminderCreate(
                user_id=user_id,
                card_id=card_id,
                scheduled_date=scheduled_date,
                email=email,
                days_before_due=days_before_due
            )
            
            reminder = await crud_reminder.create(obj_in=reminder_data)
            
            logger.info(f"[PaymentReminders] Created reminder for card {card.card_name}, scheduled for {scheduled_date} ({days_before_due} days before {due_date})")
            
            return {
                "success": True,
                "reminder_id": str(reminder.id),
                "scheduled_date": scheduled_date,
                "due_date": due_date,
                "days_before_due": days_before_due
            }
            
        except Exception as e:
            logger.exception(f"[PaymentReminders] Error creating reminder for card {card_id}: {str(e)}")
            return {"success": False, "error": str(e)}

    async def send_test_email(
        self,
        db: AsyncSession,
        user_id: UUID,
        email: str,
        reminder_days_before: int = 3
    ) -> Dict[str, Any]:
        """
        Send test email with user's actual cards using production email generation logic.
        This ensures test emails look exactly like real reminder emails.
        """
        try:
            logger.info(f"[PaymentReminders] Sending test email to {email} for user {user_id}")
            
            # Check if email service is configured
            if not self.mailer.is_configured():
                error_msg = "Email service not configured. Cannot send test email."
                logger.error(f"[PaymentReminders] {error_msg}")
                return {"success": False, "error": error_msg}
            
            # Get user's actual credit cards
            from app.crud.credit_card_instructions import CRUDCreditCardInstructions
            crud_card = CRUDCreditCardInstructions(db)
            all_cards = await crud_card.get_multi_by_user(user_id=user_id)
            
            if not all_cards:
                return {"success": False, "error": "No credit cards found for user"}
            
            # Filter unpaid cards only
            unpaid_cards = [card for card in all_cards if not card.is_paid]
            
            if not unpaid_cards:
                return {"success": False, "error": "No unpaid credit cards found. Please add cards or mark existing ones as unpaid."}
            
            # Transform cards to same format used in production emails
            card_details = []
            today = date.today()
            
            for card in unpaid_cards:
                # Calculate due date and urgency (same logic as production)
                due_date = self._calculate_next_due_date(today, card.payment_day)
                days_until_due = (due_date - today).days
                urgency = self._determine_urgency(days_until_due)
                
                card_details.append({
                    "reminder_id": f"test-{card.id}",
                    "card_id": str(card.id),
                    "card_name": card.card_name,
                    "payment_day": card.payment_day,
                    "description": card.description or "Monthly payment",
                    "instruction": card.instruction or "Pay as per your schedule",
                    "is_paid": card.is_paid,
                    "due_date": due_date,
                    "days_until_due": days_until_due,
                    "urgency": urgency,
                    "days_before_due_setting": reminder_days_before,
                    "scheduled_date": today
                })
            
            # Generate email using SAME logic as production
            email_content = self._generate_email_html(card_details)
            subject = f"[TEST] {self._generate_email_subject(card_details)}"
            
            # Send email via MailerService
            logger.info(f"[PaymentReminders] Sending test email with subject: {subject}")
            response = self.mailer.send_email(
                to_email=email,
                subject=subject,
                content=email_content,
                from_email="Personal Finance <noreply@mail.autolabkit.com>"
            )
            
            if "error" not in response:
                logger.info(f"[PaymentReminders] Test email sent successfully to {email}")
                return {
                    "success": True,
                    "message": "Test email sent successfully",
                    "cards_included": len(card_details),
                    "subject": subject
                }
            else:
                error_message = response.get("error", "Unknown email error")
                logger.error(f"[PaymentReminders] Failed to send test email: {error_message}")
                return {"success": False, "error": error_message}
                
        except Exception as e:
            error_msg = f"Error sending test email: {str(e)}"
            logger.exception(error_msg)
            return {"success": False, "error": error_msg}

    async def create_consolidated_reminders(
        self,
        db: AsyncSession,
        user_id: UUID,
        email: str,
        reminder_days_before: int = 3
    ) -> Dict[str, Any]:
        """
        Create consolidated monthly reminders for all user's unpaid cards.
        Finds the earliest reminder date and schedules all cards for that date.
        """
        try:
            logger.info(f"[PaymentReminders] Creating consolidated reminders for user {user_id}")
            
            # Get user's unpaid credit cards
            from app.crud.credit_card_instructions import CRUDCreditCardInstructions
            crud_card = CRUDCreditCardInstructions(db)
            all_cards = await crud_card.get_multi_by_user(user_id=user_id)
            
            if not all_cards:
                return {"success": False, "error": "No credit cards found for user"}
            
            # Filter unpaid cards only
            unpaid_cards = [card for card in all_cards if not card.is_paid]
            
            if not unpaid_cards:
                return {"success": False, "error": "No unpaid credit cards found"}
            
            # Calculate reminder dates for all cards and find earliest
            today = date.today()
            earliest_reminder_date = None
            card_due_dates = {}
            
            for card in unpaid_cards:
                # Calculate next due date
                due_date = self._calculate_next_due_date(today, card.payment_day)
                
                # Calculate reminder date (due_date - days_before_due)
                reminder_date = due_date - timedelta(days=reminder_days_before)
                
                # If reminder date is in the past, move to next month
                if reminder_date <= today:
                    if due_date.month == 12:
                        next_due = date(due_date.year + 1, 1, card.payment_day)
                    else:
                        next_due = date(due_date.year, due_date.month + 1, card.payment_day)
                    reminder_date = next_due - timedelta(days=reminder_days_before)
                    due_date = next_due
                
                card_due_dates[card.id] = {"due_date": due_date, "reminder_date": reminder_date}
                
                # Track earliest reminder date
                if earliest_reminder_date is None or reminder_date < earliest_reminder_date:
                    earliest_reminder_date = reminder_date
                
                logger.debug(f"[PaymentReminders] {card.card_name}: due {due_date}, remind {reminder_date}")
            
            if earliest_reminder_date is None or earliest_reminder_date <= today:
                return {"success": False, "error": "No valid future reminder dates found"}
            
            logger.info(f"[PaymentReminders] Earliest reminder date: {earliest_reminder_date}")
            
            # Create reminders for all cards scheduled on the earliest date
            crud_reminder = CRUDPaymentReminder(db)
            reminders_created = 0
            failed_cards = []
            
            for card in unpaid_cards:
                try:
                    # Calculate days before due for this specific card
                    card_due_date = card_due_dates[card.id]["due_date"]
                    days_diff = (card_due_date - earliest_reminder_date).days
                    effective_days_before = max(0, days_diff)
                    
                    # Create reminder using consolidated date
                    from app.schemas.payment_reminders import PaymentReminderCreate
                    reminder_data = PaymentReminderCreate(
                        user_id=user_id,
                        card_id=card.id,
                        scheduled_date=earliest_reminder_date,
                        email=email,
                        days_before_due=effective_days_before
                    )
                    
                    reminder = await crud_reminder.create(obj_in=reminder_data)
                    reminders_created += 1
                    logger.info(f"[PaymentReminders] Created consolidated reminder for {card.card_name}")
                    
                except Exception as e:
                    failed_cards.append(card.card_name)
                    logger.error(f"[PaymentReminders] Failed to create reminder for {card.card_name}: {str(e)}")
            
            if reminders_created > 0:
                card_names = [card.card_name for card in unpaid_cards]
                message = f"Scheduled consolidated monthly reminder for {reminders_created} cards: {', '.join(card_names)}. You'll receive one email on {earliest_reminder_date.strftime('%B %d, %Y')} with all upcoming payments."
                
                if failed_cards:
                    message += f" Failed to schedule: {', '.join(failed_cards)}."
                
                logger.info(f"[PaymentReminders] Successfully created {reminders_created} consolidated reminders")
                return {
                    "success": True,
                    "reminders_created": reminders_created,
                    "scheduled_date": earliest_reminder_date,
                    "cards_included": len(unpaid_cards),
                    "message": message
                }
            else:
                return {"success": False, "error": "Failed to create any reminders"}
                
        except Exception as e:
            error_msg = f"Error creating consolidated reminders: {str(e)}"
            logger.exception(error_msg)
            return {"success": False, "error": error_msg}