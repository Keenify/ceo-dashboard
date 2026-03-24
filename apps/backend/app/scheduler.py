import sys
import os
# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
from uuid import UUID
from app.database.database import AsyncSessionLocal
from app.crud.todos import CRUDTodo
from app.crud.habits import CRUDHabitBuddy, CRUDHabit, CRUDHabitEntry
from app.crud.user_settings import CRUDUserSettings
from app.service.future_letters_email_manager import FutureLettersEmailManager
from app.service.habit_buddies_email_manager import HabitBuddiesEmailManager
from app.service.payment_reminders_email_manager import PaymentRemindersEmailManager
from app.service.whatsapp_service import WhatsAppService
from app.service.taiga_sync_service import TaigaSyncService
import asyncio
import logging
from datetime import datetime, date, timedelta

logging.basicConfig(level=logging.INFO)

# Reduce APScheduler logging verbosity to eliminate job execution spam
logging.getLogger('apscheduler.scheduler').setLevel(logging.WARNING)
logging.getLogger('apscheduler.executors.default').setLevel(logging.WARNING)

scheduler = AsyncIOScheduler()

async def move_incomplete_tasks():
    sg_tz = pytz.timezone('Asia/Singapore')
    today_sg = datetime.now(sg_tz).date()
    async with AsyncSessionLocal() as session:
        crud_todo = CRUDTodo(db=session)
        moved = await crud_todo.move_incomplete_task_to_today(today=today_sg)
        logging.info(f"[Scheduler] Moved {moved} tasks to {today_sg} (Singapore date).")

async def process_future_letters():
    """Process and send future letters scheduled for today (runs at 6 AM)"""
    try:
        logging.info("[Scheduler] Starting to process future letters...")
        
        # Create a database session
        async with AsyncSessionLocal() as session:
            # Create the manager with our session
            manager = FutureLettersEmailManager(db=session)
            
            # Process today's letters
            result = await manager.process_todays_letters()
            
            # Log the result
            if result["success"]:
                logging.info(f"[Scheduler] Successfully processed future letters. Processed: {result['processed']}, Sent: {result['sent']}, Failed: {result['failed']}")
            else:
                logging.error(f"[Scheduler] Failed to process future letters: {result.get('error', 'Unknown error')}")
                
            # Log details of any failed letters
            if result.get("failed", 0) > 0 and "letters" in result:
                for letter in result["letters"]:
                    if letter.get("status") == "failed":
                        logging.error(f"[Scheduler] Letter {letter['id']} to {letter['recipient']} failed: {letter.get('error', 'Unknown error')}")
    
    except Exception as e:
        logging.exception(f"[Scheduler] Error processing future letters: {str(e)}")

async def send_payment_reminders():
    """
    Send payment reminder emails for credit cards (runs at 8 AM Singapore time daily).
    
    How "days_before_due" works:
    1. When reminders are created, scheduled_date = due_date - days_before_due
    2. Scheduler runs daily and gets reminders where scheduled_date = today
    3. Sends emails for those reminders
    
    Example:
    - Card due on 15th, user wants 3 days notice
    - Reminder created with scheduled_date = 12th  
    - On 12th, scheduler runs and sends the email
    """
    try:
        logging.info("[Scheduler] Starting payment reminders job (8:00 AM Singapore time)")
        
        async with AsyncSessionLocal() as session:
            # Create the payment reminders manager (uses MailerService internally)
            manager = PaymentRemindersEmailManager()
            
            # Check if email service is configured
            if not manager.is_configured():
                logging.error("[Scheduler] Email service (Mailgun) not configured. Cannot send payment reminders.")
                logging.error("[Scheduler] Please set MAILGUN_API_KEY, MAILGUN_DOMAIN, and MAILGUN_FROM_EMAIL in .env")
                return
            
            # Process reminders scheduled for today
            # Note: The "days_before_due" logic is handled when reminders are created,
            # not here in the scheduler. The scheduler just processes reminders
            # where scheduled_date = today.
            result = await manager.send_payment_reminders(db=session)
            
            # Log comprehensive results
            if result["success"]:
                logging.info(f"[Scheduler] Payment reminders completed successfully:")
                logging.info(f"  - Reminders processed: {result['processed']}")
                logging.info(f"  - Emails sent: {result['sent']}")
                logging.info(f"  - Emails failed: {result['failed']}")
                logging.info(f"  - Users processed: {result.get('users_processed', 0)}")
                
                # Log details for each user
                for detail in result.get("details", []):
                    if detail["status"] == "sent":
                        logging.info(f"  ✅ Sent to {detail['email']} for {detail.get('cards_count', 0)} cards")
                    else:
                        logging.error(f"  ❌ Failed to send to {detail['email']}: {detail.get('error', 'Unknown error')}")
                        
                # Log reminder if no reminders were processed
                if result['processed'] == 0:
                    logging.info("  💡 No reminders scheduled for today. This is normal if:")
                    logging.info("     - No users have enabled payment reminders")
                    logging.info("     - All scheduled reminders were already sent")
                    logging.info("     - No credit cards have due dates approaching")
            else:
                logging.error(f"[Scheduler] Payment reminders job failed: {result.get('error', 'Unknown error')}")
    
    except Exception as e:
        logging.exception(f"[Scheduler] Critical error in payment reminders job: {str(e)}")


async def send_morning_accountability_emails():
    """Send morning accountability emails to all habit buddies (runs at 7:59 AM)"""
    try:
        logging.info("[Scheduler] Starting to send morning accountability emails...")
        
        async with AsyncSessionLocal() as session:
            # Get all habit buddies
            crud_buddy = CRUDHabitBuddy(session)
            all_buddies = await crud_buddy.get_multi(skip=0, limit=1000)  # Get up to 1000 buddies
            
            if not all_buddies:
                logging.info("[Scheduler] No habit buddies found to send emails to.")
                return
            
            # Create email manager
            email_manager = HabitBuddiesEmailManager()
            
            # Check if email service is configured
            if not email_manager.is_configured():
                logging.error("[Scheduler] Email service not configured. Cannot send accountability emails.")
                return
            
            # Send emails to each buddy
            sent_count = 0
            failed_count = 0
            
            for buddy in all_buddies:
                try:
                    logging.info(f"[Scheduler] Sending morning accountability email to {buddy.buddy_email} for user {buddy.user_id}")
                    
                    response = await email_manager.send_accountability_email(
                        db=session,
                        user_id=buddy.user_id,
                        buddy_email=buddy.buddy_email,
                        days_back=7,  # Last 7 days
                        censor_habits=buddy.censor_habits  # Pass the censoring preference
                    )
                    
                    if "error" in response:
                        logging.error(f"[Scheduler] Failed to send email to {buddy.buddy_email}: {response['error']}")
                        failed_count += 1
                    else:
                        logging.info(f"[Scheduler] Successfully sent email to {buddy.buddy_email}")
                        sent_count += 1
                        
                except Exception as e:
                    logging.exception(f"[Scheduler] Error sending email to {buddy.buddy_email}: {str(e)}")
                    failed_count += 1
            
            logging.info(f"[Scheduler] Morning accountability emails completed. Sent: {sent_count}, Failed: {failed_count}")
            return {"sent": sent_count, "failed": failed_count}
    
    except Exception as e:
        logging.exception(f"[Scheduler] Error in morning accountability email job: {str(e)}")
        return {"sent": 0, "failed": 0}

async def send_evening_accountability_emails():
    """Send evening accountability emails to all habit buddies (runs at 11:59 PM)"""
    try:
        logging.info("[Scheduler] Starting to send evening accountability emails...")
        
        async with AsyncSessionLocal() as session:
            # Get all habit buddies
            crud_buddy = CRUDHabitBuddy(session)
            all_buddies = await crud_buddy.get_multi(skip=0, limit=1000)  # Get up to 1000 buddies
            
            if not all_buddies:
                logging.info("[Scheduler] No habit buddies found to send emails to.")
                return
            
            # Create email manager
            email_manager = HabitBuddiesEmailManager()
            
            # Check if email service is configured
            if not email_manager.is_configured():
                logging.error("[Scheduler] Email service not configured. Cannot send accountability emails.")
                return
            
            # Send emails to each buddy
            sent_count = 0
            failed_count = 0
            
            for buddy in all_buddies:
                try:
                    logging.info(f"[Scheduler] Sending evening accountability email to {buddy.buddy_email} for user {buddy.user_id}")
                    
                    response = await email_manager.send_accountability_email(
                        db=session,
                        user_id=buddy.user_id,
                        buddy_email=buddy.buddy_email,
                        days_back=7,  # Last 7 days for evening update
                        censor_habits=buddy.censor_habits  # Pass the censoring preference
                    )
                    
                    if "error" in response:
                        logging.error(f"[Scheduler] Failed to send email to {buddy.buddy_email}: {response['error']}")
                        failed_count += 1
                    else:
                        logging.info(f"[Scheduler] Successfully sent email to {buddy.buddy_email}")
                        sent_count += 1
                        
                except Exception as e:
                    logging.exception(f"[Scheduler] Error sending email to {buddy.buddy_email}: {str(e)}")
                    failed_count += 1
            
            logging.info(f"[Scheduler] Evening accountability emails completed. Sent: {sent_count}, Failed: {failed_count}")
            return {"sent": sent_count, "failed": failed_count}
    
    except Exception as e:
        logging.exception(f"[Scheduler] Error in evening accountability email job: {str(e)}")
        return {"sent": 0, "failed": 0}

async def send_morning_whatsapp_habit_reminders():
    """Send personalized morning WhatsApp habit reminders to users with phone numbers (runs at 7:59 AM)"""
    try:
        logging.info("[Scheduler] Starting to send morning WhatsApp habit reminders...")
        
        session = AsyncSessionLocal()
        try:
            # Get all users with phone numbers
            crud_settings = CRUDUserSettings(session)
            users_with_phones = await crud_settings.get_users_with_phone_numbers()
            
            if not users_with_phones:
                logging.info("[Scheduler] No users with phone numbers found.")
                return
            
            # Create WhatsApp service
            whatsapp_service = WhatsAppService()
            
            # Check if WhatsApp service is configured
            if not whatsapp_service.is_configured():
                logging.error("[Scheduler] WhatsApp service not configured. Cannot send reminders.")
                return
            
            # Create habit CRUD instance
            crud_habit = CRUDHabit(session)
            
            # Send personalized habit reminders
            sent_count = 0
            failed_count = 0
            
            for user_settings in users_with_phones:
                try:
                    # Get user habits
                    user_habits = await crud_habit.get_multi_by_user(user_id=user_settings.user_id)
                    
                    # Extract user name from email (before @ symbol) or use "there"
                    user_name = "there"
                    if user_settings.email_address:
                        email_parts = user_settings.email_address.split("@")
                        if len(email_parts) > 0 and email_parts[0]:
                            user_name = email_parts[0].capitalize()
                    
                    # Create personalized message
                    current_time = datetime.now(pytz.timezone('Asia/Singapore'))
                    time_str = current_time.strftime("%I:%M %p")  # e.g., "07:59 AM"
                    
                    if user_habits:
                        # List habit names
                        habit_names = [habit.name for habit in user_habits[:5]]  # Limit to first 5 habits
                        habits_text = ", ".join(habit_names[:-1]) + f" and {habit_names[-1]}" if len(habit_names) > 1 else habit_names[0]
                        
                        message = f"🌅 Hello {user_name}! It is already {time_str} Singapore time!\n\n"
                        message += f"💪 Time to do your habit{'s' if len(user_habits) > 1 else ''}: {habits_text}\n\n"
                        message += f"🔥 Remember: Consistency beats perfection! Don't let your streak break!\n"
                        message += f"✅ You've got this! Start strong and finish stronger! 💯"
                    else:
                        message = f"🌅 Hello {user_name}! It is already {time_str} Singapore time!\n\n"
                        message += f"💪 Time to start your day strong! Consider setting up some habits to track your progress.\n\n"
                        message += f"🎯 Every great journey begins with a single step! 💯"
                    
                    # Send WhatsApp message
                    logging.info(f"[Scheduler] Sending morning habit reminder to {user_settings.phone_number} for user {user_settings.user_id}")
                    
                    result = whatsapp_service.send_whatsapp_message(
                        to_number=str(user_settings.phone_number),
                        message=message
                    )
                    
                    if "error" in result:
                        logging.error(f"[Scheduler] Failed to send WhatsApp to {user_settings.phone_number}: {result['error']}")
                        failed_count += 1
                    else:
                        logging.info(f"[Scheduler] Successfully sent WhatsApp habit reminder to {user_settings.phone_number}")
                        sent_count += 1
                        
                except Exception as e:
                    logging.exception(f"[Scheduler] Error sending WhatsApp to {user_settings.phone_number}: {str(e)}")
                    failed_count += 1
            
            logging.info(f"[Scheduler] Morning WhatsApp habit reminders completed. Sent: {sent_count}, Failed: {failed_count}")
            return {"sent": sent_count, "failed": failed_count}
        
        finally:
            await session.close()
    
    except Exception as e:
        logging.exception(f"[Scheduler] Error in morning WhatsApp habit reminders job: {str(e)}")
        return {"sent": 0, "failed": 0}

async def send_evening_whatsapp_habit_reminders():
    """Send personalized evening WhatsApp habit reminders to users with phone numbers (runs at 11:59 PM)"""
    try:
        logging.info("[Scheduler] Starting to send evening WhatsApp habit reminders...")
        
        session = AsyncSessionLocal()
        try:
            # Get all users with phone numbers
            crud_settings = CRUDUserSettings(session)
            users_with_phones = await crud_settings.get_users_with_phone_numbers()
            
            if not users_with_phones:
                logging.info("[Scheduler] No users with phone numbers found.")
                return
            
            # Create WhatsApp service
            whatsapp_service = WhatsAppService()
            
            # Check if WhatsApp service is configured
            if not whatsapp_service.is_configured():
                logging.error("[Scheduler] WhatsApp service not configured. Cannot send reminders.")
                return
            
            # Create habit CRUD instance
            crud_habit = CRUDHabit(session)
            
            # Send personalized evening habit reminders
            sent_count = 0
            failed_count = 0
            
            for user_settings in users_with_phones:
                try:
                    # Get user habits
                    user_habits = await crud_habit.get_multi_by_user(user_id=user_settings.user_id)
                    
                    # Extract user name from email (before @ symbol) or use "there"
                    user_name = "there"
                    if user_settings.email_address:
                        email_parts = user_settings.email_address.split("@")
                        if len(email_parts) > 0 and email_parts[0]:
                            user_name = email_parts[0].capitalize()
                    
                    # Create personalized message
                    current_time = datetime.now(pytz.timezone('Asia/Singapore'))
                    time_str = current_time.strftime("%I:%M %p")  # e.g., "11:59 PM"
                    
                    if user_habits:
                        # List habit names
                        habit_names = [habit.name for habit in user_habits[:5]]  # Limit to first 5 habits
                        habits_text = ", ".join(habit_names[:-1]) + f" and {habit_names[-1]}" if len(habit_names) > 1 else habit_names[0]
                        
                        message = f"🌙 Hello {user_name}! It's {time_str} Singapore time - evening check-in!\n\n"
                        message += f"💭 How did your habit{'s' if len(user_habits) > 1 else ''} go today: {habits_text}?\n\n"
                        message += f"🔥 If you missed any, tomorrow is a fresh start! Don't break the chain!\n"
                        message += f"😴 Rest well and prepare for another amazing day! 🌟"
                    else:
                        message = f"🌙 Hello {user_name}! It's {time_str} Singapore time - evening check-in!\n\n"
                        message += f"💭 How was your day? Consider setting up habits to track your personal growth.\n\n"
                        message += f"😴 Rest well and prepare for tomorrow's possibilities! 🌟"
                    
                    # Send WhatsApp message
                    logging.info(f"[Scheduler] Sending evening habit reminder to {user_settings.phone_number} for user {user_settings.user_id}")
                    
                    result = whatsapp_service.send_whatsapp_message(
                        to_number=str(user_settings.phone_number),
                        message=message
                    )
                    
                    if "error" in result:
                        logging.error(f"[Scheduler] Failed to send WhatsApp to {user_settings.phone_number}: {result['error']}")
                        failed_count += 1
                    else:
                        logging.info(f"[Scheduler] Successfully sent WhatsApp habit reminder to {user_settings.phone_number}")
                        sent_count += 1
                        
                except Exception as e:
                    logging.exception(f"[Scheduler] Error sending WhatsApp to {user_settings.phone_number}: {str(e)}")
                    failed_count += 1
            
            logging.info(f"[Scheduler] Evening WhatsApp habit reminders completed. Sent: {sent_count}, Failed: {failed_count}")
            return {"sent": sent_count, "failed": failed_count}
        
        finally:
            await session.close()
    
    except Exception as e:
        logging.exception(f"[Scheduler] Error in evening WhatsApp habit reminders job: {str(e)}")
        return {"sent": 0, "failed": 0}



# Schedule the job to run every day at 00:05 AM Singapore time
scheduler.add_job(
    move_incomplete_tasks,
    CronTrigger(hour=0, minute=5, timezone=pytz.timezone('Asia/Singapore')),
    name="Move yesterday's incomplete todos to today"
)

# Schedule future letters to be sent at 6:00 AM Singapore time
scheduler.add_job(
    process_future_letters,
    CronTrigger(hour=6, minute=0, timezone=pytz.timezone('Asia/Singapore')),
    name="Send future letters scheduled for today"
)

# Schedule morning accountability emails at 7:59 AM Singapore time
scheduler.add_job(
    send_morning_accountability_emails,
    CronTrigger(hour=7, minute=59, timezone=pytz.timezone('Asia/Singapore')),
    name="Send morning accountability emails"
)

# Schedule morning WhatsApp habit reminders at 7:59 AM Singapore time
scheduler.add_job(
    send_morning_whatsapp_habit_reminders,
    CronTrigger(hour=7, minute=59, timezone=pytz.timezone('Asia/Singapore')),
    name="Send morning WhatsApp habit reminders"
)

# Schedule evening accountability emails at 11:59 PM Singapore time
scheduler.add_job(
    send_evening_accountability_emails,
    CronTrigger(hour=23, minute=59, timezone=pytz.timezone('Asia/Singapore')),
    name="Send evening accountability emails"
)

# Schedule evening WhatsApp habit reminders at 11:59 PM Singapore time
scheduler.add_job(
    send_evening_whatsapp_habit_reminders,
    CronTrigger(hour=23, minute=59, timezone=pytz.timezone('Asia/Singapore')),
    name="Send evening WhatsApp habit reminders"
)

# Schedule payment reminders at 8:00 AM Singapore time
scheduler.add_job(
    send_payment_reminders,
    CronTrigger(hour=8, minute=0, timezone=pytz.timezone('Asia/Singapore')),
    name="Send payment reminder emails for credit cards"
)

async def sync_feedback_to_taiga():
    """Sync pending feedback entries to Taiga (runs every 2 minutes)"""
    try:
        logging.info("[Scheduler] Starting feedback sync to Taiga...")
        
        # Create Taiga sync service
        try:
            sync_service = TaigaSyncService()
        except ValueError:
            return {"processed": 0, "succeeded": 0, "failed": 0, "errors": []}  # Taiga env vars not configured, skip silently
        
        # Process all pending feedback
        result = await sync_service.process_pending_feedback()
        
        # Log comprehensive results
        if result["processed"] > 0:
            logging.info(f"[Scheduler] Feedback sync completed:")
            logging.info(f"  - Feedback processed: {result['processed']}")
            logging.info(f"  - Successfully synced: {result['succeeded']}")
            logging.info(f"  - Failed to sync: {result['failed']}")
            
            # Log any errors
            if result["errors"]:
                for error in result["errors"]:
                    logging.error(f"  ❌ {error}")
                    
            if result["succeeded"] > 0:
                logging.info(f"  {result['succeeded']} feedback entries synced to Taiga successfully")
        else:
            logging.info("  No pending feedback to sync")
            
        return result
        
    except Exception as e:
        logging.exception(f"[Scheduler] Critical error in feedback sync job: {str(e)}")
        return {"processed": 0, "succeeded": 0, "failed": 0, "errors": [str(e)]}

async def check_taiga_deleted_stories():
    """Check for deleted Taiga stories and clean up database (runs every 5 seconds)"""
    try:
        # Create Taiga sync service (with quiet logging)
        try:
            sync_service = TaigaSyncService(quiet_mode=True)
        except ValueError:
            return  # Taiga env vars not configured, skip silently
        
        # Check for deleted stories
        result = await sync_service.check_deleted_stories()
        
        # Only log if there were deletions or errors (avoid spam every 5 seconds)
        if result["deleted"] > 0:
            logging.info(f"[Deletion Check] Deleted {result['deleted']} feedback entries due to Taiga story deletion")
        elif len(result["errors"]) > 0:
            logging.warning(f"[Deletion Check] {len(result['errors'])} errors occurred during deletion check")
            for error in result["errors"][:3]:  # Log first 3 errors only
                logging.error(f"  ❌ {error}")
            
        return result
        
    except Exception as e:
        logging.exception(f"[Deletion Check] Critical error: {str(e)}")
        return {"checked": 0, "deleted": 0, "errors": [str(e)]}

async def refresh_weekly_design_embeddings():
    """Refresh RAG embeddings for all users' weekly designs (runs every 6 hours)"""
    try:
        logging.info("[Scheduler] Starting to refresh weekly design embeddings...")

        # Initialize RAG manager
        from app.rag.services.modules.weekly_design_manager import WeeklyDesignRAGManager
        rag_manager = WeeklyDesignRAGManager()
        
        # Refresh embeddings for all users
        result = await rag_manager.refresh_all_users_embeddings()
        
        logging.info(f"[Scheduler] Weekly design embeddings refresh completed. "
                    f"Processed: {result['users_processed']}/{result['total_users']} users, "
                    f"Total embeddings: {result['total_embeddings']}")
        
        return result
        
    except Exception as e:
        logging.exception(f"[Scheduler] Error in weekly design embeddings refresh: {str(e)}")
        return {"users_processed": 0, "total_users": 0, "total_embeddings": 0, "error": str(e)}

# Schedule feedback sync to run every 2 minutes
scheduler.add_job(
    sync_feedback_to_taiga,
    'interval',
    minutes=2,
    name="Sync feedback to Taiga every 2 minutes"
)

# Schedule deletion check to run every 60 seconds
scheduler.add_job(
    check_taiga_deleted_stories,
    'interval',
    seconds=60,
    id='check_taiga_deleted_stories',
    replace_existing=True,
    max_instances=1,
    name="Check for deleted Taiga stories every 60 seconds"
)

# Schedule weekly design RAG embeddings refresh to run every 6 hours
scheduler.add_job(
    refresh_weekly_design_embeddings,
    'interval',
    hours=6,
    id='refresh_weekly_design_embeddings',
    name="Refresh weekly design RAG embeddings every 6 hours",
    timezone=pytz.timezone('Asia/Singapore'),
    misfire_grace_time=600
)

def start_scheduler():
    logging.info("Starting APScheduler...")
    scheduler.start()

async def test_whatsapp_habit_reminders():
    """Test function to manually trigger WhatsApp habit reminders"""
    print("🧪 Testing separate reminder system...")
    
    try:
        print("📧 Testing morning accountability emails...")
        email_result = await send_morning_accountability_emails()
        print(f"✅ Morning emails: {email_result.get('sent', 0)} sent, {email_result.get('failed', 0)} failed")
        
        print("\n📱 Testing morning WhatsApp reminders...")
        whatsapp_result = await send_morning_whatsapp_habit_reminders()
        print(f"✅ Morning WhatsApp: {whatsapp_result.get('sent', 0)} sent, {whatsapp_result.get('failed', 0)} failed")
        
        print("\n📧 Testing evening accountability emails...")
        email_result = await send_evening_accountability_emails()
        print(f"✅ Evening emails: {email_result.get('sent', 0)} sent, {email_result.get('failed', 0)} failed")
        
        print("\n📱 Testing evening WhatsApp reminders...")
        whatsapp_result = await send_evening_whatsapp_habit_reminders()
        print(f"✅ Evening WhatsApp: {whatsapp_result.get('sent', 0)} sent, {whatsapp_result.get('failed', 0)} failed")
        
        print("\n🎉 All tests completed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        logging.exception("Test failed with exception")

# If you want to run this as a standalone script
if __name__ == "__main__":
    import time
    import sys
    
    print("🚀 Separate Habit Reminder Scheduler")
    print("⏰ Current Singapore time:", datetime.now(pytz.timezone('Asia/Singapore')).strftime("%Y-%m-%d %H:%M:%S"))
    print("\nChoose an option:")
    print("1. Test database connection and data structure")
    print("2. Test separate reminders immediately")
