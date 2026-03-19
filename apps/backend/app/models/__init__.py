from app.database.database import Base # Import Base first

# Import all models here to ensure they are registered with Base's metadata
from .auth_users import User
from .journal_entries import JournalEntry
from .journal_questions import JournalQuestion
from .journal_templates import JournalTemplate

# AI Journaling models
from .ai_journal_sessions import AIJournalSession
from .ai_journal_messages import AIJournalMessage
from .ai_journal_analyses import AIJournalAnalysis
from .ai_journal_artworks import AIJournalArtwork
from .ai_journal_emotions import AIJournalEmotion

# Todo models
from .todo_tabs import TodoTab
from .todo_lists import TodoList
from .todos import Todo

# Credit card and payment models
from .credit_card_instructions import CreditCardInstructions
from .payment_reminders import PaymentReminder
from .user_settings import UserSettings

# Annual calendar plans model
from .annual_calendar_plans import AnnualCalendarPlan

# Annual calendar plans notepads model
from .annual_calendar_plans_notepads import UserNotepad

# Additional models
from .bucket_list_items import BucketListItems
from .weekly_design_system import WeeklyDesignSystem
from .weekly_ryhthms import WeeklyRhythm
from .travel_transactions import TravelTransaction
from .user_google_tokens import UserGoogleToken
from .user_modules import UserModules
from .networth_entries import NetworthEntry
from .manifestation import Manifestation
from .mindmaps import Mindmap
from .habits import Habit
from .ikigai import Ikigai
from .flywheel import Flywheel
from .future_letters import FutureLetter
from .five_percent_reviews import FivePercentReview
from .cashflow import Cashflow

# Voice recordings model
from .voice_recordings import VoiceRecording

# AI Journal User Emotion Stats model
from .ai_journal_user_emotion_stats import AIJournalUserEmotionStat

# Social posts model
from .social_posts import SocialPost

# Productivity tracker models
from .productivity_tracker import ProductivityLegend, ProductivityTracker

# Notable events model
from .notable_events import NotableEvent

# Freelance projects model
from .freelance_projects import FreelanceProject

# If you have a User model, import it too
# from .users import User