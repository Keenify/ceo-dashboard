import os
import logging
from typing import List, Dict, Any, Optional, Union
from datetime import date, datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.service.mailer_service import MailerService
from app.models.habits import Habit, HabitEntry, HabitStreak
from app.crud.habits import CRUDHabit, CRUDHabitEntry, CRUDHabitStreak, CRUDHabitBuddy

logger = logging.getLogger(__name__)

class HabitBuddiesEmailManager:
    """Service for sending accountability emails to habit buddies"""

    def __init__(self):
        """Initialize the email manager with mailer service"""
        self.mailer = MailerService()

    async def send_accountability_email(
        self, 
        db: AsyncSession, 
        user_id: UUID, 
        buddy_email: str,
        days_back: int = 7,
        censor_habits: bool = False
    ) -> dict:
        """
        Send accountability email to a buddy with comprehensive habit data
        
        Args:
            db: Database session
            user_id: ID of the user whose habits to report
            buddy_email: Email address of the accountability buddy
            days_back: Number of days to include in the report (default: 7)
            censor_habits: Whether to censor habit names in the email (default: False)
            
        Returns:
            Response from email service
        """
        try:
            # Get habit data
            habit_data = await self._get_habit_data(db, user_id, days_back)
            
            # Generate email content with censoring option
            email_content = self._generate_email_html(habit_data, days_back, censor_habits)
            
            # Create subject line
            subject = f"🎯 Habit Accountability Report - {habit_data['date_range']['end_date']}"
            
            # Send email
            response = self.mailer.send_email(
                to_email=buddy_email,
                subject=subject,
                content=email_content,
                from_email="Habit Tracker <noreply@mail.autolabkit.com>"
            )
            
            logger.info(f"Accountability email sent to {buddy_email} for user {user_id} (censored: {censor_habits})")
            return response
            
        except Exception as e:
            error_msg = f"Error sending accountability email: {str(e)}"
            logger.exception(error_msg)
            return {"error": error_msg}

    async def _get_habit_data(self, db: AsyncSession, user_id: UUID, days_back: int) -> Dict[str, Any]:
        """Get comprehensive habit data for the email report"""
        
        # Calculate date range
        end_date = date.today()
        start_date = end_date - timedelta(days=days_back - 1)
        
        # Get all habits for the user
        crud_habit = CRUDHabit(db)
        crud_entry = CRUDHabitEntry(db)
        crud_streak = CRUDHabitStreak(db)
        
        habits = await crud_habit.get_multi_by_user(user_id=user_id)
        
        # Generate date range for the report
        date_range = []
        current_date = start_date
        while current_date <= end_date:
            date_range.append(current_date)
            current_date += timedelta(days=1)
        
        # Get entries and streaks for each habit
        habit_details: List[Dict[str, Any]] = []
        total_score_by_date: Dict[str, int] = {}
        
        for habit in habits:
            # Get entries for this habit in the date range
            entries = await crud_entry.get_multi_by_habit(
                habit_id=habit.id,
                start_date=start_date,
                end_date=end_date
            )
            
            # Get streak data
            streak_data = await crud_streak.get(habit_id=habit.id)
            
            # Organize entries by date
            entries_by_date: Dict[str, Dict[str, Any]] = {}
            for entry in entries:
                entry_date = entry.entry_date
                if isinstance(entry_date, datetime):
                    entry_date = entry_date.date()
                entries_by_date[entry_date.isoformat()] = {
                    "status": entry.status,
                    "value": entry.value,
                    "note": entry.note
                }
            
            # Calculate daily scores for this habit
            for report_date in date_range:
                date_str: str = report_date.isoformat()
                if date_str not in total_score_by_date:
                    total_score_by_date[date_str] = 0
                
                entry: Optional[Dict[str, Any]] = entries_by_date.get(date_str)
                if entry is not None:
                    entry_status: str = entry.get("status", "")
                    if entry_status == "completed":
                        if habit.habit_type in ["build", "track"]:
                            total_score_by_date[date_str] += 1
                        elif habit.habit_type == "break":
                            total_score_by_date[date_str] -= 1
            
            habit_details.append({
                "id": str(habit.id),
                "name": habit.name,
                "description": habit.description,
                "habit_type": habit.habit_type,
                "color_code": habit.color_code,
                "entries": entries_by_date,
                "streak": {
                    "current_streak": streak_data.current_streak if streak_data else 0,
                    "longest_streak": streak_data.longest_streak if streak_data else 0,
                    "total_streak": streak_data.total_streak if streak_data else 0,
                } if streak_data else {
                    "current_streak": 0,
                    "longest_streak": 0,
                    "total_streak": 0
                }
            })
        
        return {
            "user_id": str(user_id),
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "dates": [d.isoformat() for d in date_range]
            },
            "habits": habit_details,
            "daily_scores": total_score_by_date,
            "summary": self._calculate_summary(habit_details, date_range)
        }

    def _calculate_summary(self, habits: List[Dict[str, Any]], date_range: List[date]) -> Dict[str, Any]:
        """Calculate summary statistics for the report"""
        total_habits: int = len(habits)
        total_possible_completions: int = total_habits * len(date_range)
        total_completions: int = 0
        
        habit_type_counts: Dict[str, int] = {"build": 0, "break": 0, "track": 0}
        active_streaks: int = 0
        
        for habit in habits:
            habit_type: str = habit.get("habit_type", "")
            if habit_type in habit_type_counts:
                habit_type_counts[habit_type] += 1
            
            # Count completions
            entries: Dict[str, Any] = habit.get("entries", {})
            for entry in entries.values():
                entry_status: str = entry.get("status", "")
                if entry_status == "completed":
                    total_completions += 1
            
            # Count active streaks
            streak_data: Dict[str, Any] = habit.get("streak", {})
            current_streak: int = streak_data.get("current_streak", 0)
            if current_streak > 0:
                active_streaks += 1
        
        completion_rate: float = (total_completions / total_possible_completions * 100) if total_possible_completions > 0 else 0.0
        
        return {
            "total_habits": total_habits,
            "habit_types": habit_type_counts,
            "total_completions": total_completions,
            "total_possible": total_possible_completions,
            "completion_rate": round(completion_rate, 1),
            "active_streaks": active_streaks
        }

    def _generate_email_html(self, habit_data: Dict[str, Any], days_back: int, censor_habits: bool) -> str:
        """Generate HTML email content with habit table similar to frontend"""
        
        habits: List[Dict[str, Any]] = habit_data.get("habits", [])
        dates: List[str] = habit_data.get("date_range", {}).get("dates", [])
        daily_scores: Dict[str, int] = habit_data.get("daily_scores", {})
        summary: Dict[str, Any] = habit_data.get("summary", {})
        
        # Helper function to format date
        def format_date_display(date_str: str) -> Dict[str, str]:
            date_obj: date = datetime.fromisoformat(date_str).date()
            months: List[str] = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                     'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
            weekdays: List[str] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
            
            return {
                "month": months[date_obj.month - 1],
                "day": str(date_obj.day),
                "weekday": weekdays[date_obj.weekday()]
            }
        
        # Helper function to get status emoji
        def get_status_emoji(status: str, habit_type: str) -> str:
            if status == "completed":
                if habit_type == "break":
                    return "❌"  # Completed a break habit (good)
                else:
                    return "✅"  # Completed build/track habit
            else:
                return "⚪"  # Not completed or skipped
        
        # Helper function to get score color
        def get_score_color(score: int) -> str:
            if score > 0:
                return "background-color: #22c55e; color: white;"  # Green
            elif score < 0:
                return "background-color: #ef4444; color: white;"  # Red
            else:
                return "background-color: #e5e7eb; color: #374151;"  # Gray
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Habit Accountability Report</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 800px;
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
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                .summary {{
                    padding: 25px;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                }}
                .summary h2 {{
                    margin: 0 0 15px 0;
                    color: #1e293b;
                    font-size: 20px;
                }}
                .stats-grid {{
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 15px;
                    margin-top: 15px;
                }}
                .stat-card {{
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                    border: 1px solid #e2e8f0;
                }}
                .stat-value {{
                    font-size: 24px;
                    font-weight: 700;
                    color: #3b82f6;
                }}
                .stat-label {{
                    font-size: 12px;
                    color: #64748b;
                    margin-top: 5px;
                }}
                .table-container {{
                    padding: 25px;
                    overflow-x: auto;
                }}
                .habit-table {{
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }}
                .habit-table th {{
                    background: #f1f5f9;
                    padding: 12px 8px;
                    text-align: center;
                    font-weight: 600;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                }}
                .habit-table td {{
                    padding: 10px 8px;
                    text-align: center;
                    border: 1px solid #e2e8f0;
                }}
                .habit-name {{
                    text-align: left !important;
                    font-weight: 600;
                    max-width: 200px;
                }}
                .habit-type {{
                    font-size: 11px;
                    padding: 2px 6px;
                    border-radius: 12px;
                    color: white;
                    margin-left: 8px;
                }}
                .type-build {{ background-color: #22c55e; }}
                .type-break {{ background-color: #ef4444; }}
                .type-track {{ background-color: #3b82f6; }}
                .date-header {{
                    min-width: 45px;
                }}
                .date-month {{
                    font-size: 9px;
                    color: #64748b;
                }}
                .date-day {{
                    font-size: 14px;
                    font-weight: 600;
                }}
                .date-weekday {{
                    font-size: 9px;
                    color: #64748b;
                }}
                .weekend {{
                    background-color: #fef3c7 !important;
                }}
                .today {{
                    background-color: #dbeafe !important;
                }}
                .score-cell {{
                    font-weight: 700;
                    border-radius: 20px;
                    padding: 5px 10px;
                    min-width: 30px;
                }}
                .streak-cell {{
                    font-weight: 600;
                    color: #3b82f6;
                }}
                .footer {{
                    padding: 25px;
                    background: #f8fafc;
                    text-align: center;
                    color: #64748b;
                    font-size: 14px;
                }}
                .emoji {{
                    font-size: 18px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎯 Habit Accountability Report</h1>
                    <p>{habit_data['date_range']['start_date']} to {habit_data['date_range']['end_date']} ({days_back} days)</p>
                </div>
                
                <div class="summary">
                    <h2>📊 Summary</h2>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">{summary['total_habits']}</div>
                            <div class="stat-label">Total Habits</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">{summary['completion_rate']}%</div>
                            <div class="stat-label">Completion Rate</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">{summary['active_streaks']}</div>
                            <div class="stat-label">Active Streaks</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">{summary['total_completions']}</div>
                            <div class="stat-label">Total Completions</div>
                        </div>
                    </div>
                </div>
                
                <div class="table-container">
                    <table class="habit-table">
                        <thead>
                            <tr>
                                <th class="habit-name">Habits</th>
        """
        
        # Add date headers
        today = date.today()
        for date_str in dates:
            date_obj = datetime.fromisoformat(date_str).date()
            date_display = format_date_display(date_str)
            is_weekend = date_obj.weekday() >= 5  # Saturday = 5, Sunday = 6
            is_today = date_obj == today
            
            weekend_class = "weekend" if is_weekend else ""
            today_class = "today" if is_today else ""
            
            html_content += f"""
                                <th class="date-header {weekend_class} {today_class}">
                                    <div class="date-month">{date_display['month']}</div>
                                    <div class="date-day">{date_display['day']}</div>
                                    <div class="date-weekday">{date_display['weekday']}</div>
                                </th>
            """
        
        html_content += """
                                <th>Current<br>Streak</th>
                                <th>Longest<br>Streak</th>
                                <th>Total<br>Streak</th>
                            </tr>
                        </thead>
                        <tbody>
        """
        
        # Add habit rows
        for habit in habits:
            habit_name: str = habit.get('name', 'Unknown Habit')
            habit_type: str = habit.get('habit_type', 'build')
            habit_entries: Dict[str, Any] = habit.get('entries', {})
            habit_streak: Dict[str, Any] = habit.get('streak', {})
            
            if censor_habits:
                habit_name = "*" * len(habit_name)
            
            html_content += f"""
                            <tr>
                                <td class="habit-name">
                                    {habit_name}
                                    <span class="habit-type type-{habit_type}">{habit_type.upper()}</span>
                                </td>
            """
            
            # Add entry cells for each date
            for date_str in dates:
                entry: Dict[str, Any] = habit_entries.get(date_str, {})
                status: str = entry.get('status', 'not_completed')
                value: str = entry.get('value', '')
                emoji: str = get_status_emoji(status, habit_type)
                
                # Add value display if it exists
                value_display: str = f"<br><small>{value}</small>" if value and value.strip() else ""
                
                html_content += f"""
                                <td>
                                    <span class="emoji">{emoji}</span>{value_display}
                                </td>
                """
            
            # Add streak cells
            current_streak: int = habit_streak.get('current_streak', 0)
            longest_streak: int = habit_streak.get('longest_streak', 0)
            total_streak: int = habit_streak.get('total_streak', 0)
            
            html_content += f"""
                                <td class="streak-cell">{current_streak}</td>
                                <td class="streak-cell">{longest_streak}</td>
                                <td class="streak-cell">{total_streak}</td>
                            </tr>
            """
        
        # Add daily score row
        html_content += """
                            <tr style="border-top: 2px solid #e2e8f0;">
                                <td class="habit-name"><strong>Daily Score</strong></td>
        """
        
        for date_str in dates:
            score = daily_scores.get(date_str, 0)
            score_style = get_score_color(score)
            
            html_content += f"""
                                <td>
                                    <span class="score-cell" style="{score_style}">{score}</span>
                                </td>
            """
        
        html_content += """
                                <td></td>
                                <td></td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="footer">
                    <p>💪 Keep up the great work! Your accountability buddy is cheering you on!</p>
                    <p><small>Generated by CEO Dashboard Habit Tracker</small></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html_content

    def is_configured(self) -> bool:
        """Check if the email service is properly configured"""
        return self.mailer.is_configured()


# Test guard for the habit buddies email manager
if __name__ == "__main__":
    import asyncio
    from dotenv import load_dotenv
    from app.database.database import AsyncSessionLocal
    
    # Setup logging for testing
    logging.basicConfig(level=logging.INFO)
    load_dotenv()
    
    async def test_accountability_email():
        """Test sending an accountability email"""
        
        # Get test parameters
        test_user_id_str = os.getenv("TEST_USER_ID")
        test_email = os.getenv("TEST_EMAIL")
        
        if not test_user_id_str:
            print("Error: TEST_USER_ID environment variable not set")
            return
        
        if not test_email:
            test_email = input("Enter recipient email for testing: ")
        
        try:
            user_id = UUID(test_user_id_str)
        except ValueError:
            print(f"Error: Invalid UUID format for TEST_USER_ID: {test_user_id_str}")
            return
        
        # Create email manager
        email_manager = HabitBuddiesEmailManager()
        
        # Check if configured
        if not email_manager.is_configured():
            print("Email service is not properly configured. Please check your .env file.")
            print("Required variables: MAILGUN_API_KEY, MAILGUN_DOMAIN")
            return
        
        # Send test email
        async with AsyncSessionLocal() as session:
            try:
                print(f"Sending accountability email to {test_email} for user {user_id}...")
                
                response = await email_manager.send_accountability_email(
                    db=session,
                    user_id=user_id,
                    buddy_email=test_email,
                    days_back=7,
                    censor_habits=False
                )
                
                print("Response:", response)
                
                if "error" in response:
                    print("Test failed!")
                else:
                    print("Accountability email sent successfully!")
                    
            except Exception as e:
                print(f"Error during test: {e}")
    
    # Run the test
    asyncio.run(test_accountability_email())
