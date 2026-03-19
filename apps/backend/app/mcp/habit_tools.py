"""
MCP Server for Habit Tools
Exposes user habits functionality through MCP protocol

Note: Some type: ignore comments are used to suppress linter warnings
for SQLAlchemy async context managers and model field types that work
correctly at runtime but confuse static type checkers.
"""

import sys
import os
# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import asyncio
import json
import re
import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import date, datetime, timedelta

from app.database.database import AsyncSessionLocal
from app.crud.habits import CRUDHabit, CRUDHabitEntry, CRUDHabitStreak
from app.crud.user_settings import CRUDUserSettings
from app.schemas.habits import HabitResponse, HabitCreate, HabitEntryCreate, HabitEntryUpdate, HabitType

# Configure logging
log_file_path = os.path.join(os.path.dirname(__file__), 'app.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file_path),
        logging.StreamHandler()  # Also log to console
    ]
)
logger = logging.getLogger(__name__)

# Log program start
logger.info("Habit Tools MCP Server starting up")


class ErrorMessages:
    """User-friendly error messages with guidance"""
    
    # Phone number errors
    PHONE_REQUIRED = "Phone number is required. Please enter your phone number."
    PHONE_NOT_FOUND = "Phone number not found. Please enter a valid phone number registered in the system."
    PHONE_INVALID_FORMAT = "Invalid phone number format. Please enter with country code (e.g., +60123456789)."
    
    # User ID errors
    USER_ID_REQUIRED = "User ID is required. Please contact support for assistance."
    USER_ID_INVALID = "Invalid user account. Please contact support for assistance."
    USER_NOT_FOUND = "User account not found. Please contact support for assistance."
    
    # Habit creation errors
    HABIT_NAME_REQUIRED = "Habit name is required. Please enter a name for your habit."
    HABIT_NAME_TOO_LONG = "Habit name is too long. Please use 50 characters or less."
    HABIT_DESCRIPTION_REQUIRED = "Habit description is required. Please describe your habit."
    HABIT_TYPE_INVALID = "Invalid habit type. Please choose: 'build' (positive habit), 'break' (habit to stop), or 'track' (measurement)."
    HABIT_ALREADY_EXISTS = "This habit already exists. Please choose a different name or update the existing habit."
    HABIT_NOT_FOUND = "Habit not found. Please check the habit name and try again."
    
    # Date errors
    DATE_REQUIRED = "Date is required. Please enter date in YYYY-MM-DD format (e.g., 2025-07-08)."
    DATE_INVALID_FORMAT = "Invalid date format. Please enter date as YYYY-MM-DD (e.g., 2025-07-08)."
    DATE_FUTURE = "Date cannot be in the future. Please enter today's date or earlier."
    DATE_RANGE_INVALID = "Invalid date range. End date must be after start date."
    
    # Entry errors
    ENTRY_DATA_REQUIRED = "Entry data is required. Please provide habit name, date, and status."
    ENTRY_STATUS_INVALID = "Invalid status. Please choose: 'completed' or 'skipped'."
    ENTRY_VALUE_INVALID = "Invalid value. Please enter a number."
    
    # Message errors
    MESSAGE_REQUIRED = "Message is required. Please enter your message."
    MESSAGE_TOO_LONG = "Message is too long. Please keep it under 500 characters."
    
    # General errors
    DATABASE_ERROR = "System error occurred. Please try again later or contact support."
    NETWORK_ERROR = "Network error occurred. Please check your connection and try again."
    UNKNOWN_ERROR = "An unexpected error occurred. Please try again or contact support."


class ValidationMixin:
    """Mixin class with validation methods"""
    
    def validate_phone_number(self, phone_number: str) -> Dict[str, Any]:
        """Validate phone number with user-friendly messages"""
        if not phone_number:
            return {"valid": False, "error": ErrorMessages.PHONE_REQUIRED}
        
        if not phone_number.strip():
            return {"valid": False, "error": ErrorMessages.PHONE_REQUIRED}
        
        # Basic phone format validation
        clean_phone = phone_number.replace("whatsapp:", "").strip()
        if len(clean_phone) < 8:
            return {"valid": False, "error": ErrorMessages.PHONE_INVALID_FORMAT}
        
        return {"valid": True}
    
    def validate_user_id(self, user_id: str) -> Dict[str, Any]:
        """Validate user ID with user-friendly messages"""
        if not user_id:
            return {"valid": False, "error": ErrorMessages.USER_ID_REQUIRED}
        
        try:
            UUID(user_id)
            return {"valid": True}
        except ValueError:
            return {"valid": False, "error": ErrorMessages.USER_ID_INVALID}
    
    def validate_habit_name(self, name: str) -> Dict[str, Any]:
        """Validate habit name with user-friendly messages"""
        if not name:
            return {"valid": False, "error": ErrorMessages.HABIT_NAME_REQUIRED}
        
        if not name.strip():
            return {"valid": False, "error": ErrorMessages.HABIT_NAME_REQUIRED}
        
        if len(name.strip()) > 50:
            return {"valid": False, "error": ErrorMessages.HABIT_NAME_TOO_LONG}
        
        return {"valid": True}
    
    def validate_habit_description(self, description: str) -> Dict[str, Any]:
        """Validate habit description with user-friendly messages"""
        if not description:
            return {"valid": False, "error": ErrorMessages.HABIT_DESCRIPTION_REQUIRED}
        
        if not description.strip():
            return {"valid": False, "error": ErrorMessages.HABIT_DESCRIPTION_REQUIRED}
        
        return {"valid": True}
    
    def validate_habit_type(self, habit_type: str) -> Dict[str, Any]:
        """Validate habit type with user-friendly messages"""
        valid_types = ["build", "break", "track"]
        if habit_type not in valid_types:
            return {"valid": False, "error": ErrorMessages.HABIT_TYPE_INVALID}
        
        return {"valid": True}
    
    def validate_date(self, date_str: str, field_name: str = "date") -> Dict[str, Any]:
        """Validate date with user-friendly messages"""
        if not date_str:
            return {"valid": False, "error": ErrorMessages.DATE_REQUIRED}
        
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
            
            # Check if date is in the future (optional validation)
            today = datetime.now().date()
            if date_obj > today:
                return {"valid": False, "error": ErrorMessages.DATE_FUTURE}
            
            return {"valid": True, "date": date_obj}
        except ValueError:
            return {"valid": False, "error": ErrorMessages.DATE_INVALID_FORMAT}
    
    def validate_entry_status(self, status: str) -> Dict[str, Any]:
        """Validate entry status with user-friendly messages"""
        valid_statuses = ["completed", "skipped"]  # Only allow valid database statuses
        if status not in valid_statuses:
            return {"valid": False, "error": "Invalid status. Please choose: 'completed' or 'skipped'."}
        
        return {"valid": True}
    
    def validate_message(self, message: str) -> Dict[str, Any]:
        """Validate user message with user-friendly messages"""
        if not message:
            return {"valid": False, "error": ErrorMessages.MESSAGE_REQUIRED}
        
        if not message.strip():
            return {"valid": False, "error": ErrorMessages.MESSAGE_REQUIRED}
        
        if len(message) > 500:
            return {"valid": False, "error": ErrorMessages.MESSAGE_TOO_LONG}
        
        return {"valid": True}


class HabitMCPServer(ValidationMixin):
    """MCP Server for Habit Tools with Enhanced Validation"""
    
    def __init__(self):
        self.tools = [
            {
                "name": "get_user_habits",
                "description": "Get all habits for a specific user",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "user_id": {
                            "type": "string",
                            "description": "UUID of the user"
                        },
                        "skip": {
                            "type": "integer",
                            "description": "Number of records to skip (default: 0)",
                            "default": 0
                        },
                        "limit": {
                            "type": "integer", 
                            "description": "Maximum number of records to return (default: 100)",
                            "default": 100
                        }
                    },
                    "required": ["user_id"]
                }
            },
            {
                "name": "get_habit_by_id",
                "description": "Get a specific habit by ID for a user",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "habit_id": {
                            "type": "string",
                            "description": "UUID of the habit"
                        },
                        "user_id": {
                            "type": "string",
                            "description": "UUID of the user"
                        }
                    },
                    "required": ["habit_id", "user_id"]
                }
            },
            {
                "name": "get_habit_entries",
                "description": "Get habit entries for a specific habit",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "habit_id": {
                            "type": "string",
                            "description": "UUID of the habit"
                        },
                        "skip": {
                            "type": "integer",
                            "description": "Number of records to skip (default: 0)",
                            "default": 0
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of records to return (default: 100)",
                            "default": 100
                        },
                        "start_date": {
                            "type": "string",
                            "description": "Start date filter (YYYY-MM-DD format)",
                            "format": "date"
                        },
                        "end_date": {
                            "type": "string",
                            "description": "End date filter (YYYY-MM-DD format)",
                            "format": "date"
                        }
                    },
                    "required": ["habit_id"]
                }
            },
            {
                "name": "get_habit_streak",
                "description": "Get streak information for a specific habit",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "habit_id": {
                            "type": "string",
                            "description": "UUID of the habit"
                        }
                    },
                    "required": ["habit_id"]
                }
            },
            {
                "name": "get_user_habits_by_phone",
                "description": "Get all habits for a user by their phone number",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "phone_number": {
                            "type": "string",
                            "description": "Phone number of the user (with or without country code)"
                        },
                        "skip": {
                            "type": "integer",
                            "description": "Number of records to skip (default: 0)",
                            "default": 0
                        },
                        "limit": {
                            "type": "integer", 
                            "description": "Maximum number of records to return (default: 100)",
                            "default": 100
                        }
                    },
                    "required": ["phone_number"]
                }
            },
            {
                "name": "create_habit",
                "description": "Create a new habit for a user",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "user_id": {
                            "type": "string",
                            "description": "UUID of the user"
                        },
                        "name": {
                            "type": "string",
                            "description": "Name of the habit"
                        },
                        "description": {
                            "type": "string",
                            "description": "Description of the habit"
                        },
                        "habit_type": {
                            "type": "string",
                            "description": "Type of habit: 'build', 'break', or 'track'",
                            "enum": ["build", "break", "track"]
                        },
                        "color_code": {
                            "type": "string",
                            "description": "Color code for the habit (default: #3B82F6)",
                            "default": "#3B82F6"
                        }
                    },
                    "required": ["user_id", "name", "description", "habit_type"]
                }
            },
            {
                "name": "check_habit_exists",
                "description": "Check if a habit with given name exists for a user",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "user_id": {
                            "type": "string",
                            "description": "UUID of the user"
                        },
                        "habit_name": {
                            "type": "string",
                            "description": "Name of the habit to check"
                        }
                    },
                    "required": ["user_id", "habit_name"]
                }
            },
            {
                "name": "analyze_habit_performance",
                "description": "Analyze habit performance with detailed entries and summary statistics",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "user_id": {
                            "type": "string",
                            "description": "UUID of the user"
                        },
                        "habit_names": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of habit names to analyze (empty list for all habits)"
                        },
                        "start_date": {
                            "type": "string",
                            "description": "Start date in YYYY-MM-DD format"
                        },
                        "end_date": {
                            "type": "string",
                            "description": "End date in YYYY-MM-DD format"
                        }
                    },
                    "required": ["user_id", "habit_names", "start_date", "end_date"]
                }
            },
            {
                "name": "analyze_user_intent",
                "description": "Analyze user message to understand intent and choose appropriate tool",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "user_id": {
                            "type": "string",
                            "description": "UUID of the user"
                        },
                        "message": {
                            "type": "string",
                            "description": "User's message to analyze"
                        },
                        "current_habits": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of user's current habit names"
                        }
                    },
                    "required": ["user_id", "message", "current_habits"]
                }
            },
            {
                "name": "get_habit_entries_by_user",
                "description": "Get all habit entries for a user within a date range",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "user_id": {
                            "type": "string",
                            "description": "UUID of the user"
                        },
                        "start_date": {
                            "type": "string",
                            "description": "Start date in YYYY-MM-DD format"
                        },
                        "end_date": {
                            "type": "string",
                            "description": "End date in YYYY-MM-DD format"
                        },
                        "habit_names": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of habit names to filter (empty list for all habits)"
                        }
                    },
                    "required": ["user_id", "start_date", "end_date"]
                }
            },
            {
                "name": "update_habit_entries",
                "description": "Update or create habit entries for a user",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "user_id": {
                            "type": "string",
                            "description": "UUID of the user"
                        },
                        "entries": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "habit_name": {"type": "string"},
                                    "entry_date": {"type": "string", "description": "YYYY-MM-DD format"},
                                    "status": {"type": "string", "enum": ["completed", "skipped"]},
                                    "note": {"type": "string"},
                                    "value": {"type": "number"}
                                },
                                "required": ["habit_name", "entry_date", "status"]
                            },
                            "description": "List of habit entries to update/create"
                        }
                    },
                    "required": ["user_id", "entries"]
                }
            },
            {
                "name": "get_formatted_habit_entries",
                "description": "Get beautifully formatted habit entries with progress tracking by phone number",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "phone_number": {
                            "type": "string",
                            "description": "Phone number of the user (with or without country code)"
                        },
                        "days": {
                            "type": "integer",
                            "description": "Number of days to look back (default: 7)",
                            "default": 7
                        },
                        "habit_names": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of specific habit names to show (empty list for all habits)"
                        }
                    },
                    "required": ["phone_number"]
                }
            }
        ]

    def _serialize_habit(self, habit) -> Dict[str, Any]:
        """Serialize habit object to dictionary"""
        return {
            "id": str(habit.id),
            "user_id": str(habit.user_id),
            "name": habit.name,
            "description": habit.description,
            "habit_type": habit.habit_type,
            "color_code": habit.color_code,
            "sort_order": habit.sort_order,
            "created_at": habit.created_at.isoformat() if habit.created_at else None
        }

    def _serialize_habit_entry(self, entry) -> Dict[str, Any]:
        """Serialize habit entry object to dictionary"""
        return {
            "id": str(entry.id),
            "habit_id": str(entry.habit_id),
            "entry_date": entry.entry_date.isoformat() if entry.entry_date else None,
            "status": entry.status,
            "note": entry.note,
            "value": entry.value,
            "created_at": entry.created_at.isoformat() if entry.created_at else None
        }

    def _serialize_habit_streak(self, streak) -> Dict[str, Any]:
        """Serialize habit streak object to dictionary"""
        return {
            "habit_id": str(streak.habit_id),
            "current_streak": streak.current_streak,
            "longest_streak": streak.longest_streak,
            "total_streak": streak.total_streak,
            "last_entry_date": streak.last_entry_date.isoformat() if streak.last_entry_date else None,
            "last_value": streak.last_value
        }

    async def get_user_habits(self, user_id: str, skip: int = 0, limit: int = 100) -> Dict[str, Any]:
        """Get all habits for a specific user"""
        logger.info(f"Getting habits for user: {user_id}, skip: {skip}, limit: {limit}")
        
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            logger.error(f"Invalid user_id format: {user_id}")
            return {"success": False, "error": "Invalid user_id format. Must be a valid UUID."}
        
        async with AsyncSessionLocal() as session:  # type: ignore
            try:
                crud = CRUDHabit(session)
                habits = await crud.get_multi_by_user(
                    user_id=user_uuid,
                    skip=skip,
                    limit=limit
                )
                
                # Convert to dict format for JSON serialization
                habits_data = [self._serialize_habit(habit) for habit in habits]
                
                logger.info(f"Successfully retrieved {len(habits_data)} habits for user {user_id}")
                return {
                    "success": True,
                    "data": habits_data,
                    "count": len(habits_data)
                }
                
            except Exception as e:
                logger.error(f"Database error in get_user_habits: {str(e)}")
                return {"success": False, "error": f"Database error: {str(e)}"}

    async def get_habit_by_id(self, habit_id: str, user_id: str) -> Dict[str, Any]:
        """Get a specific habit by ID for a user"""
        logger.info(f"Getting habit by ID: {habit_id} for user: {user_id}")
        
        try:
            habit_uuid = UUID(habit_id)
            user_uuid = UUID(user_id)
        except ValueError:
            logger.error(f"Invalid UUID format - habit_id: {habit_id}, user_id: {user_id}")
            return {"success": False, "error": "Invalid UUID format for habit_id or user_id."}
        
        async with AsyncSessionLocal() as session:  # type: ignore
            try:
                crud = CRUDHabit(session)
                habit = await crud.get(id=habit_uuid, user_id=user_uuid)
                
                if not habit:
                    logger.warning(f"Habit not found: {habit_id} for user: {user_id}")
                    return {"success": False, "error": "Habit not found"}
                
                habit_dict = self._serialize_habit(habit)
                
                logger.info(f"Successfully retrieved habit: {habit.name} for user: {user_id}")
                return {
                    "success": True,
                    "data": habit_dict
                }
                
            except Exception as e:
                logger.error(f"Database error in get_habit_by_id: {str(e)}")
                return {"success": False, "error": f"Database error: {str(e)}"}

    async def get_habit_entries(self, habit_id: str, skip: int = 0, limit: int = 100, 
                               start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
        """Get habit entries for a specific habit"""
        try:
            habit_uuid = UUID(habit_id)
        except ValueError:
            return {"success": False, "error": "Invalid habit_id format. Must be a valid UUID."}
        
        # Parse date filters if provided
        start_date_obj = None
        end_date_obj = None
        
        try:
            if start_date:
                start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            if end_date:
                end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return {"success": False, "error": "Invalid date format. Use YYYY-MM-DD format."}
        
        async with AsyncSessionLocal() as db:  # type: ignore
            try:
                crud = CRUDHabitEntry(db)
                entries = await crud.get_multi_by_habit(
                    habit_id=habit_uuid,
                    skip=skip,
                    limit=limit,
                    start_date=start_date_obj,
                    end_date=end_date_obj
                )
                
                # Convert to dict format for JSON serialization
                entries_data = [self._serialize_habit_entry(entry) for entry in entries]
                
                return {
                    "success": True,
                    "data": entries_data,
                    "count": len(entries_data)
                }
                
            except Exception as e:
                return {"success": False, "error": f"Database error: {str(e)}"}

    async def get_habit_streak(self, habit_id: str) -> Dict[str, Any]:
        """Get streak information for a specific habit"""
        try:
            habit_uuid = UUID(habit_id)
        except ValueError:
            return {"success": False, "error": "Invalid habit_id format. Must be a valid UUID."}
        
        async with AsyncSessionLocal() as db:  # type: ignore
            try:
                crud = CRUDHabitStreak(db)
                streak = await crud.get(habit_id=habit_uuid)
                
                if not streak:
                    return {"success": False, "error": "Habit streak not found"}
                
                streak_dict = self._serialize_habit_streak(streak)
                
                return {
                    "success": True,
                    "data": streak_dict
                }
                
            except Exception as e:
                return {"success": False, "error": f"Database error: {str(e)}"}

    async def get_user_habits_by_phone(self, phone_number: str, skip: int = 0, limit: int = 100) -> Dict[str, Any]:
        """Get habits for a user by their phone number with enhanced validation"""
        
        logger.info(f"Getting habits by phone number: {phone_number}")
        
        # Validate phone number using enhanced validation
        phone_validation = self.validate_phone_number(phone_number)
        if not phone_validation["valid"]:
            logger.error(f"Phone number validation failed: {phone_validation['error']}")
            return {
                "success": False, 
                "error": phone_validation["error"],
                "action_required": "Please enter a valid phone number and try again."
            }
        
        try:
            # Normalize phone number - try both with and without + prefix
            clean_phone = phone_number.replace("whatsapp:", "").strip()
            phone_variants = [
                clean_phone,
                f"+{clean_phone}" if not clean_phone.startswith("+") else clean_phone,
                clean_phone[1:] if clean_phone.startswith("+") else clean_phone
            ]
            phone_variants = list(dict.fromkeys(phone_variants))  # Remove duplicates
            
            async with AsyncSessionLocal() as db:  # type: ignore
                try:
                    # Find user by phone number
                    settings_crud = CRUDUserSettings(db)
                    users_with_phones = await settings_crud.get_users_with_phone_numbers()
                    
                    user_uuid = None
                    for user_settings in users_with_phones:
                        if user_settings.phone_number in phone_variants:
                            user_uuid = user_settings.user_id
                            break
                    
                    if user_uuid is None:
                        return {
                            "success": False,
                            "error": ErrorMessages.PHONE_NOT_FOUND,
                            "action_required": "Please check your phone number or contact support to register your account.",
                            "phone_tried": phone_number
                        }
                    
                    # Get habits for this user
                    crud = CRUDHabit(db)
                    habits = await crud.get_multi_by_user(
                        user_id=user_uuid,  # type: ignore
                        skip=skip,
                        limit=limit
                    )
                    
                    # Convert to dict format for JSON serialization
                    habits_data = [self._serialize_habit(habit) for habit in habits]
                    
                    return {
                        "success": True,
                        "data": habits_data,
                        "count": len(habits_data),
                        "user_id": str(user_uuid),
                        "phone_number": phone_number,
                        "message": f"Found {len(habits_data)} habits for your account."
                    }
                    
                except Exception as e:
                    logger.exception(f"Database error in get_user_habits_by_phone: {str(e)}")
                    return {
                        "success": False,
                        "error": ErrorMessages.DATABASE_ERROR,
                        "action_required": "Please try again in a moment. If the problem persists, contact support."
                    }
                    
        except Exception as e:
            logger.exception(f"Error in get_user_habits_by_phone: {str(e)}")
            return {
                "success": False,
                "error": ErrorMessages.UNKNOWN_ERROR,
                "action_required": "Please try again or contact support for assistance."
            }

    async def create_habit(self, user_id: str, name: str, description: str, habit_type: str, color_code: str = "#3B82F6") -> Dict[str, Any]:
        """Create a new habit for a user with enhanced validation"""
        logger.info(f"Creating habit for user: {user_id}, name: {name}, type: {habit_type}")
        
        # Validate all inputs using enhanced validation
        user_validation = self.validate_user_id(user_id)
        if not user_validation["valid"]:
            logger.error(f"User validation failed for user_id: {user_id}")
            return {
                "success": False,
                "error": user_validation["error"],
                "action_required": "Please contact support for assistance with your account."
            }
        
        name_validation = self.validate_habit_name(name)
        if not name_validation["valid"]:
            logger.error(f"Habit name validation failed: {name}")
            return {
                "success": False,
                "error": name_validation["error"],
                "action_required": "Please enter a valid habit name and try again."
            }
        
        description_validation = self.validate_habit_description(description)
        if not description_validation["valid"]:
            logger.error(f"Habit description validation failed for user: {user_id}")
            return {
                "success": False,
                "error": description_validation["error"],
                "action_required": "Please provide a description for your habit."
            }
        
        type_validation = self.validate_habit_type(habit_type)
        if not type_validation["valid"]:
            logger.error(f"Habit type validation failed: {habit_type}")
            return {
                "success": False,
                "error": type_validation["error"],
                "action_required": "Please choose a valid habit type: 'build', 'break', or 'track'."
            }
        
        try:
            user_uuid = UUID(user_id)
            
            async with AsyncSessionLocal() as session:  # type: ignore
                try:
                    crud = CRUDHabit(session)
                    
                    # Check if habit with same name already exists for this user
                    existing_habits = await crud.get_multi_by_user(user_id=user_uuid)
                    for habit in existing_habits:
                        if habit.name.lower() == name.lower():
                            logger.warning(f"Habit '{name}' already exists for user: {user_id}")
                            return {
                                "success": False,
                                "error": ErrorMessages.HABIT_ALREADY_EXISTS,
                                "action_required": f"You already have a habit called '{name}'. Please choose a different name or update the existing habit.",
                                "existing_habit_id": str(habit.id)
                            }
                    
                    # Create the habit - cast habit_type to the correct type  
                    from app.schemas.habits import HabitType
                    habit_create = HabitCreate(
                        user_id=user_uuid,
                        name=name.strip(),
                        description=description.strip(),
                        habit_type=habit_type,  # type: ignore  # Pydantic validates this
                        color_code=color_code,
                        sort_order=0  # Add default sort_order
                    )
                    
                    new_habit = await crud.create(obj_in=habit_create)
                    
                    logger.info(f"Successfully created habit '{name}' for user: {user_id}")
                    return {
                        "success": True,
                        "data": self._serialize_habit(new_habit),
                        "message": f"🎉 Habit '{name}' created successfully! You can now start tracking your progress.",
                        "next_steps": "You can now log your daily progress for this habit."
                    }
                    
                except Exception as e:
                    logger.exception(f"Database error in create_habit: {str(e)}")
                    return {
                        "success": False,
                        "error": ErrorMessages.DATABASE_ERROR,
                        "action_required": "Please try again in a moment. If the problem persists, contact support."
                    }
                
        except Exception as e:
            logger.exception(f"Error in create_habit: {str(e)}")
            return {
                "success": False,
                "error": ErrorMessages.UNKNOWN_ERROR,
                "action_required": "Please try again or contact support for assistance."
            }

    async def check_habit_exists(self, user_id: str, habit_name: str) -> Dict[str, Any]:
        """Check if a habit with given name exists for a user"""
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            return {"success": False, "error": "Invalid user_id format. Must be a valid UUID."}
        
        async with AsyncSessionLocal() as session:  # type: ignore
            try:
                crud = CRUDHabit(session)
                user_habits = await crud.get_multi_by_user(user_id=user_uuid)
                
                # Check if habit exists (case-insensitive)
                for habit in user_habits:
                    if str(habit.name).lower() == habit_name.lower():
                        return {
                            "success": True,
                            "exists": True,
                            "habit": self._serialize_habit(habit)
                        }
                
                return {
                    "success": True,
                    "exists": False,
                    "message": f"Habit '{habit_name}' does not exist for this user."
                }
                
            except Exception as e:
                return {"success": False, "error": f"Database error: {str(e)}"}

    async def get_habit_entries_by_user(self, user_id: str, start_date: str, end_date: str, habit_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """Get all habit entries for a user within a date range (enhanced for analytics)"""
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            return {"success": False, "error": "Invalid user_id format. Must be a valid UUID."}
        
        # Parse dates
        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return {"success": False, "error": "Invalid date format. Use YYYY-MM-DD format."}
        
        async with AsyncSessionLocal() as session:  # type: ignore
            try:
                # Get user habits
                habit_crud = CRUDHabit(session)
                user_habits = await habit_crud.get_multi_by_user(user_id=user_uuid)
                
                if not user_habits:
                    return {"success": True, "data": [], "message": "No habits found for this user."}
                
                # Filter habits if specific names are requested
                target_habits = user_habits
                if habit_names:
                    target_habits = []
                    for habit in user_habits:
                        if habit.name.lower() in [name.lower() for name in habit_names]:
                            target_habits.append(habit)
                
                # Get entries for all target habits
                entry_crud = CRUDHabitEntry(session)
                all_entries = []
                
                for habit in target_habits:
                    entries = await entry_crud.get_multi_by_habit(
                        habit_id=habit.id,  # type: ignore
                        start_date=start_date_obj,
                        end_date=end_date_obj
                    )
                    
                    # Add habit info to each entry
                    for entry in entries:
                        entry_data = self._serialize_habit_entry(entry)
                        entry_data["habit_name"] = habit.name
                        entry_data["habit_type"] = habit.habit_type
                        all_entries.append(entry_data)
                
                return {
                    "success": True,
                    "data": all_entries,
                    "habits_count": len(target_habits),
                    "entries_count": len(all_entries),
                    "date_range": {
                        "start_date": start_date,
                        "end_date": end_date
                    }
                }
                
            except Exception as e:
                return {"success": False, "error": f"Database error: {str(e)}"}

    async def update_habit_entries(self, user_id: str, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Update or create habit entries for a user with enhanced validation and error handling"""
        logger.info(f"Updating {len(entries)} habit entries for user: {user_id}")
        
        # Validate user_id using enhanced validation
        user_validation = self.validate_user_id(user_id)
        if not user_validation["valid"]:
            logger.error(f"User validation failed in update_habit_entries: {user_validation['error']}")
            return {
                "success": False,
                "error": user_validation["error"],
                "action_required": "Please contact support for assistance with your account."
            }
        
        if not entries or not isinstance(entries, list):
            return {
                "success": False,
                "error": ErrorMessages.ENTRY_DATA_REQUIRED,
                "action_required": "Please provide a list of habit entries to update."
            }
        
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            return {"success": False, "error": ErrorMessages.USER_ID_INVALID}
        
        updated_count = 0
        created_count = 0
        processed_entries = []
        
        async with AsyncSessionLocal() as session:  # type: ignore
            try:
                entry_crud = CRUDHabitEntry(session)
                habit_crud = CRUDHabit(session)
                
                # Get user habits once to avoid repeated queries
                user_habits = await habit_crud.get_multi_by_user(user_id=user_uuid)
                habits_by_name = {h.name.lower(): h for h in user_habits}
                
                for i, entry_data in enumerate(entries):
                    try:
                        # Validate entry data
                        habit_name = entry_data.get("habit_name")
                        entry_date_str = entry_data.get("entry_date")
                        status = entry_data.get("status")
                        note = entry_data.get("note", "")
                        value = entry_data.get("value")
                        
                        if not habit_name or not entry_date_str or status is None:
                            return {
                                "success": False,
                                "error": f"Entry {i+1}: {ErrorMessages.ENTRY_DATA_REQUIRED}",
                                "action_required": "Please provide habit_name, entry_date, and status for all entries."
                            }
                        
                        # Validate habit name
                        name_validation = self.validate_habit_name(habit_name)
                        if not name_validation["valid"]:
                            return {
                                "success": False,
                                "error": f"Entry {i+1}: {name_validation['error']}",
                                "action_required": "Please provide a valid habit name."
                            }
                        
                        # Validate date
                        date_validation = self.validate_date(entry_date_str)
                        if not date_validation["valid"]:
                            return {
                                "success": False,
                                "error": f"Entry {i+1}: {date_validation['error']}",
                                "action_required": "Please use YYYY-MM-DD date format."
                            }
                        entry_date = date_validation["date"]
                        
                        # Validate status
                        status_validation = self.validate_entry_status(status)
                        if not status_validation["valid"]:
                            return {
                                "success": False,
                                "error": f"Entry {i+1}: {status_validation['error']}",
                                "action_required": "Please use 'completed' or 'skipped' status."
                            }
                        
                        # Convert value to string if provided (database expects string)
                        processed_value = None
                        if value is not None:
                            try:
                                # Validate it's a valid number by converting to float first
                                float_value = float(value)
                                # Then convert back to string for database storage
                                processed_value = str(float_value)
                            except (ValueError, TypeError):
                                return {
                                    "success": False,
                                    "error": f"Entry {i+1}: {ErrorMessages.ENTRY_VALUE_INVALID} Received: {value}",
                                    "action_required": "Please provide a valid numeric value."
                                }
                        
                        # Find the habit by name
                        habit = habits_by_name.get(habit_name.lower())
                        if not habit:
                            return {
                                "success": False,
                                "error": f"Entry {i+1}: Habit '{habit_name}' not found for user.",
                                "action_required": f"Please check the habit name. Available habits: {', '.join([str(h.name) for h in user_habits])}"
                            }
                        
                        # Check if entry exists for this date
                        existing_entries = await entry_crud.get_multi_by_habit(
                            habit_id=habit.id,  # type: ignore
                            start_date=entry_date,
                            end_date=entry_date
                        )
                        
                        if existing_entries:
                            # Update existing entry
                            existing_entry = existing_entries[0]
                            entry_update = HabitEntryUpdate(
                                status=status,
                                note=note if note else None,
                                value=processed_value
                            )
                            updated_entry = await entry_crud.update(db_obj=existing_entry, obj_in=entry_update)
                            updated_count += 1
                            processed_entries.append({
                                "action": "updated",
                                "habit_name": habit_name,
                                "entry_date": str(entry_date),
                                "status": status,
                                "entry_id": str(updated_entry.id)
                            })
                            logger.info(f"Updated entry {updated_entry.id} for habit '{habit_name}' on {entry_date}")
                        else:
                            # Create new entry
                            entry_create = HabitEntryCreate(
                                habit_id=habit.id,  # type: ignore
                                entry_date=entry_date,
                                status=status,
                                note=note if note else None,
                                value=processed_value
                            )
                            new_entry = await entry_crud.create(obj_in=entry_create)
                            created_count += 1
                            processed_entries.append({
                                "action": "created",
                                "habit_name": habit_name,
                                "entry_date": str(entry_date),
                                "status": status,
                                "entry_id": str(new_entry.id)
                            })
                            logger.info(f"Created entry {new_entry.id} for habit '{habit_name}' on {entry_date}")
                    
                    except Exception as entry_error:
                        logger.error(f"Error processing entry {i+1}: {str(entry_error)}")
                        return {
                            "success": False,
                            "error": f"Entry {i+1}: Error processing entry - {str(entry_error)}",
                            "action_required": "Please check the entry data and try again."
                        }
                
                logger.info(f"Successfully processed {len(entries)} entries: {created_count} created, {updated_count} updated")
                return {
                    "success": True,
                    "message": f"Successfully processed {len(entries)} habit entries.",
                    "summary": {
                        "total_processed": len(entries),
                        "created": created_count,
                        "updated": updated_count,
                        "entries": processed_entries
                    }
                }
                
            except Exception as e:
                logger.exception(f"Database error in update_habit_entries: {str(e)}")
                return {
                    "success": False,
                    "error": ErrorMessages.DATABASE_ERROR,
                    "action_required": "Please try again in a moment. If the problem persists, contact support.",
                    "technical_details": str(e)
                }

    async def analyze_habit_performance(self, user_id: str, habit_names: List[str], start_date: str, end_date: str) -> Dict[str, Any]:
        """Analyze habit performance with detailed entries and summary statistics"""
        logger.info(f"Analyzing habit performance for user {user_id}, habits: {habit_names}, period: {start_date} to {end_date}")
        
        try:
            # Call get_habit_entries_by_user to get all the data
            entries_result = await self.get_habit_entries_by_user(user_id, start_date, end_date, habit_names)
            
            if not entries_result.get("success"):
                logger.error(f"Failed to get habit entries for analysis: {entries_result.get('error')}")
                return entries_result
            
            entries = entries_result.get("data", [])
            
            # Parse dates for calculations
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
            total_days = (end_date_obj - start_date_obj).days + 1
            
            # Calculate statistics
            completed_entries = [e for e in entries if e.get("status") == "completed"]
            skipped_entries = [e for e in entries if e.get("status") == "skipped"]
            
            # Get unique habits
            unique_habits = list(set(e.get("habit_name") for e in entries))
            total_possible_entries = total_days * len(unique_habits) if unique_habits else 0
            
            # Calculate percentages
            completion_percentage = round((len(completed_entries) / total_possible_entries) * 100) if total_possible_entries > 0 else 0
            skip_percentage = round((len(skipped_entries) / total_possible_entries) * 100) if total_possible_entries > 0 else 0
            
            # Format entries by date
            response_lines = []
            response_lines.append(f"📊 **Habit Performance Analysis ({start_date} to {end_date})**\n")
            
            # Group entries by date
            entries_by_date = {}
            for entry in entries:
                entry_date = entry.get("entry_date")
                if entry_date not in entries_by_date:
                    entries_by_date[entry_date] = []
                entries_by_date[entry_date].append(entry)
            
            # Sort dates and display entries
            for entry_date in sorted(entries_by_date.keys()):
                day_entries = entries_by_date[entry_date]
                for entry in day_entries:
                    habit_name = entry.get("habit_name")
                    status = entry.get("status")
                    
                    if status == "completed":
                        response_lines.append(f"{entry_date}   {habit_name} completed✅")
                    elif status == "skipped":
                        response_lines.append(f"{entry_date}   {habit_name} skipped⏭️")
                    else:
                        response_lines.append(f"{entry_date}   {habit_name} not recorded⏳")
            
            # Add the required 2 summary lines
            month_name = start_date_obj.strftime("%B")
            response_lines.append(f"\ntotal of {total_days} days, in {month_name}, you have {completion_percentage}% completed.")
            response_lines.append(f"                                               {skip_percentage}% skipped.")
            
            return {
                "success": True,
                "data": {
                    "analysis": "\n".join(response_lines),
                    "raw_entries": entries,
                    "summary": {
                        "total_days": total_days,
                        "total_habits": len(unique_habits),
                        "total_possible_entries": total_possible_entries,
                        "completed_entries": len(completed_entries),
                        "skipped_entries": len(skipped_entries),
                        "completion_percentage": completion_percentage,
                        "skip_percentage": skip_percentage,
                        "month": month_name
                    },
                    "habits_analyzed": unique_habits,
                    "date_range": {
                        "start_date": start_date,
                        "end_date": end_date
                    }
                }
            }
            
        except Exception as e:
            logger.exception(f"Error analyzing habit performance: {str(e)}")
            return {"success": False, "error": str(e)}

    async def analyze_user_intent(self, user_id: str, message: str, current_habits: List[str]) -> Dict[str, Any]:
        """Analyze user message to understand intent using OpenAI natural language processing"""
        
        # Validate inputs using enhanced validation
        user_validation = self.validate_user_id(user_id)
        if not user_validation["valid"]:
            return {
                "success": False,
                "error": user_validation["error"],
                "action_required": "Please contact support for assistance with your account."
            }
        
        message_validation = self.validate_message(message)
        if not message_validation["valid"]:
            return {
                "success": False,
                "error": message_validation["error"],
                "action_required": "Please enter a valid message and try again."
            }
        
        try:
            # Import intent analyser
            from app.intent.intent_analyser import intent_analyser
            
            # Prepare context for OpenAI analysis
            context = {
                "user_habits": current_habits,
                "platform": "mcp_tools",
                "user_id": user_id
            }
            
            # Use OpenAI-based intent analysis
            intent_result = await intent_analyser.analyze_intent(message, context)
            
            # Convert OpenAI intent format to MCP format for backward compatibility
            mcp_intent_data = self._convert_openai_to_mcp_format(intent_result, current_habits)
            
            logger.info(f"OpenAI Intent Analysis: {intent_result['intent']} (confidence: {intent_result['confidence']})")
            
            return {
                "success": True,
                "data": mcp_intent_data,
                "openai_analysis": intent_result  # Include raw OpenAI result for debugging
            }
            
        except ImportError as e:
            logger.error(f"Intent analyser not available: {str(e)}")
            return {
                "success": False,
                "error": "Intent analysis service not available",
                "action_required": "Please ensure OpenAI integration is properly configured."
            }
        except Exception as e:
            logger.exception(f"Error analyzing user intent with OpenAI: {str(e)}")
            return {
                "success": False,
                "error": f"Intent analysis failed: {str(e)}",
                "action_required": "Please try again or be more specific with your request."
            }
    
    def _convert_openai_to_mcp_format(self, openai_result: Dict[str, Any], current_habits: List[str]) -> Dict[str, Any]:
        """Convert OpenAI intent result to MCP-compatible format"""
        
        openai_intent = openai_result.get("intent", "unknown")
        entities = openai_result.get("entities", {})
        confidence = openai_result.get("confidence", 0.5)
        
        # Map OpenAI intents to MCP intents and actions
        intent_mapping = {
            "create_habit": {
                    "intent": "habit_creation",
                    "action": "create_habit",
                "suggested_tools": ["check_habit_exists", "create_habit"]
            },
            "log_habit_completion": {
                "intent": "update_entries",
                "action": "update_habit_entries", 
                "suggested_tools": ["update_habit_entries"]
            },
            "log_habit_skip": {
                "intent": "update_entries",
                "action": "update_habit_entries",
                "suggested_tools": ["update_habit_entries"]
            },
            "show_progress": {
                    "intent": "get_habit_entries",
                    "action": "get_formatted_habit_entries",
                "suggested_tools": ["get_formatted_habit_entries"]
            },
            "show_habits": {
                    "intent": "get_habits",
                    "action": "get_user_habits",
                "suggested_tools": ["get_user_habits"]
            },
            "get_analytics": {
                "intent": "performance_analysis",
                "action": "analyze_habit_performance",
                "suggested_tools": ["analyze_habit_performance"]
            },
            "help": {
                "intent": "help",
                "action": "help_message",
                "suggested_tools": ["help_message"]
            },
            "greeting": {
                    "intent": "greeting",
                    "action": "greeting",
                "suggested_tools": ["get_formatted_habit_entries"]
            },
            "unknown": {
                "intent": "unknown",
                "action": "none",
                "suggested_tools": ["get_formatted_habit_entries"]
            }
        }
        
        mapping = intent_mapping.get(openai_intent, intent_mapping["unknown"])
        
        # Enhanced entities processing
        processed_entities = {}
        
        # Handle habit names - extract from OpenAI or find in current habits
        habit_name = entities.get("habit_name", "")
        if habit_name:
            # Find matching habit (case-insensitive)
            for habit in current_habits:
                if habit.lower() in habit_name.lower() or habit_name.lower() in habit.lower():
                    processed_entities["habit_name"] = habit
                    break
            if "habit_name" not in processed_entities:
                processed_entities["habit_name"] = habit_name
        
        # Handle time periods and dates
        if entities.get("time_period"):
            try:
                # Extract number of days from time period
                time_period = entities["time_period"].lower()
                if "week" in time_period:
                    processed_entities["days"] = 7
                elif "month" in time_period:
                    processed_entities["days"] = 30
                elif "day" in time_period:
                    # Try to extract number
                    import re
                    numbers = re.findall(r'\d+', time_period)
                    processed_entities["days"] = int(numbers[0]) if numbers else 1
            except:
                processed_entities["days"] = 7  # default
        
        # Handle dates
        if entities.get("date"):
            processed_entities["date"] = entities["date"]
        
        # Handle habit creation specifics
        if openai_intent == "create_habit":
            processed_entities.update({
                "habit_type": entities.get("habit_type", "build"),
                "habit_description": entities.get("habit_description", ""),
                "requires_validation": True
            })
        
        # Handle logging specifics
        if openai_intent in ["log_habit_completion", "log_habit_skip"]:
            processed_entities.update({
                "status": entities.get("status", "completed" if openai_intent == "log_habit_completion" else "skipped"),
                "requires_parsing": True
            })
        
        # Create user guidance
        user_guidance = openai_result.get("user_guidance", "")
        if not user_guidance:
            if openai_intent == "unknown":
                user_guidance = "I can help you with your habits! Try saying:\n• 'Show my progress' - to see your habit entries\n• 'I want to create a new habit' - to add a new habit\n• 'How am I doing?' - to see your performance"
            elif openai_intent == "create_habit":
                user_guidance = "I'll help you create a new habit. Please provide the habit name, description, and type (build/break/track)."
            elif openai_intent in ["log_habit_completion", "log_habit_skip"]:
                user_guidance = "I'll log your habit progress. Make sure to mention the specific habit name."
        
        return {
            "intent": mapping["intent"],
            "confidence": confidence,
            "action": mapping["action"],
            "suggested_tools": mapping["suggested_tools"],
            "entities": processed_entities,
            "user_guidance": user_guidance,
            "analysis_method": openai_result.get("analysis_method", "openai"),
            "openai_intent": openai_intent  # Keep original for debugging
        }

    async def get_formatted_habit_entries(self, phone_number: str, days: int = 7, habit_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """Get beautifully formatted habit entries with progress tracking by phone number"""
        
        logger.info(f"Getting formatted habit entries for phone: {phone_number}, days: {days}, habits: {habit_names}")
        
        # Validate phone number
        phone_validation = self.validate_phone_number(phone_number)
        if not phone_validation["valid"]:
            logger.error(f"Phone number validation failed for formatted entries: {phone_validation['error']}")
            return {
                "success": False, 
                "error": phone_validation["error"],
                "action_required": "Please enter a valid phone number and try again."
            }
        
        try:
            # Find user by phone number (same logic as get_user_habits_by_phone)
            clean_phone = phone_number.replace("whatsapp:", "").strip()
            phone_variants = [
                clean_phone,
                f"+{clean_phone}" if not clean_phone.startswith("+") else clean_phone,
                clean_phone[1:] if clean_phone.startswith("+") else clean_phone
            ]
            phone_variants = list(dict.fromkeys(phone_variants))  # Remove duplicates
            
            async with AsyncSessionLocal() as db:  # type: ignore
                try:
                    # Find user by phone number
                    settings_crud = CRUDUserSettings(db)
                    users_with_phones = await settings_crud.get_users_with_phone_numbers()
                    
                    user_uuid = None
                    for user_settings in users_with_phones:
                        if user_settings.phone_number in phone_variants:
                            user_uuid = user_settings.user_id
                            break
                    
                    if user_uuid is None:
                        return {
                            "success": False,
                            "error": ErrorMessages.PHONE_NOT_FOUND,
                            "action_required": "Please check your phone number or contact support to register your account."
                        }
                    
                    # Calculate date range
                    end_date = datetime.now().date()
                    start_date = end_date - timedelta(days=days-1)
                    
                    # Get user habits
                    habit_crud = CRUDHabit(db)
                    user_habits = await habit_crud.get_multi_by_user(user_id=user_uuid)  # type: ignore
                    
                    if not user_habits:
                        return {
                            "success": True,
                            "formatted_display": "📝 No habits found for your account.\n\nTo get started, try saying: 'I want to create a new habit'",
                            "data": {
                                "habits_count": 0,
                                "entries_count": 0,
                                "date_range": f"{start_date} to {end_date}"
                            }
                        }
                    
                    # Filter habits if specific names requested
                    target_habits = user_habits
                    if habit_names:
                        target_habits = []
                        for habit in user_habits:
                            if habit.name.lower() in [name.lower() for name in habit_names]:
                                target_habits.append(habit)
                    
                    if not target_habits:
                        available_habits = [h.name for h in user_habits]
                        return {
                            "success": True,
                            "formatted_display": f"❌ No habits found with the specified names.\n\n📋 Your available habits:\n{chr(10).join([f'• {name}' for name in available_habits])}",
                            "data": {
                                "available_habits": available_habits,
                                "requested_habits": habit_names or []
                            }
                        }
                    
                    # Get entries and streaks for each habit
                    entry_crud = CRUDHabitEntry(db)
                    streak_crud = CRUDHabitStreak(db)
                    
                    formatted_lines = []
                    
                    total_entries = 0
                    total_completed = 0
                    
                    # Process each habit with clean format matching reference image
                    for habit in target_habits:
                        # Get entries for this habit
                        habit_entries = await entry_crud.get_multi_by_habit(
                            habit_id=habit.id,  # type: ignore
                            start_date=start_date,
                            end_date=end_date
                        )
                        
                        # Get streak info
                        streak = await streak_crud.get(habit_id=habit.id)  # type: ignore
                        current_streak = streak.current_streak if streak else 0
                        
                        # Create date->entry mapping
                        entries_by_date = {entry.entry_date: entry for entry in habit_entries}
                        
                        # Generate status indicators matching reference image format
                        current_date = start_date
                        habit_completed = 0
                        habit_total = 0
                        status_indicators = []
                        
                        while current_date <= end_date:
                            habit_total += 1
                            total_entries += 1
                            
                            if current_date in entries_by_date:
                                entry = entries_by_date[current_date]
                                status = entry.status
                                
                                if status == "completed":
                                    status_indicators.append("✅")
                                    habit_completed += 1
                                    total_completed += 1
                                elif status == "skipped":
                                    status_indicators.append("⏭")
                                else:
                                    status_indicators.append("❌")
                            else:
                                # No entry for this date - show X for missed days
                                status_indicators.append("❌")
                            
                            current_date += timedelta(days=1)
                        
                        # Fill remaining slots with X to make 8 total (matching reference)
                        while len(status_indicators) < 8:
                            status_indicators.append("❌")
                            
                        # Take only first 8 indicators to match reference format
                        status_indicators = status_indicators[:8]
                        
                        # Calculate completion rate
                        habit_completion_rate = round((habit_completed / habit_total) * 100) if habit_total > 0 else 0
                        
                        # Format habit line exactly like reference image
                        formatted_lines.append({
                            "name": habit.name,
                            "status_indicators": status_indicators,
                            "completion_rate": habit_completion_rate,
                            "streak": current_streak
                        })
                    
                    # Build formatted display optimized for WhatsApp (no monospace font)
                    display_lines = []
                    display_lines.append(f"📊 **Habit Entries ({start_date} to {end_date})**")
                    display_lines.append("")  # Empty line for spacing
                    
                    for habit_data in formatted_lines:
                        # Use a more WhatsApp-friendly format without trying to align columns
                        habit_name = f"**{habit_data['name']}**"
                        status_line = ''.join(habit_data['status_indicators'])
                        percentage_str = f"{habit_data['completion_rate']}%"
                        streak_str = f"{habit_data['streak']}🔥"
                        
                        # Format each line with clear separators instead of alignment
                        display_lines.append(f"{habit_name}")
                        display_lines.append(f"   {status_line} | {percentage_str} • {streak_str}")
                        display_lines.append("")  # Add spacing between habits
                    
                    # Add overall summary with clean formatting
                    display_lines.append("")  # Empty line for spacing
                    overall_completion = round((total_completed / total_entries) * 100) if total_entries > 0 else 0
                    display_lines.append(f"**📈 Overall Progress**: {overall_completion}% completion rate")
                    display_lines.append(f"**📅 Period**: {days} days | ✅ {total_completed}/{total_entries}")
                    
                    return {
                        "success": True,
                        "formatted_display": "\n".join(display_lines),
                        "data": {
                            "user_id": str(user_uuid),
                            "phone_number": phone_number,
                            "habits_analyzed": [h.name for h in target_habits],
                            "date_range": {
                                "start_date": str(start_date),
                                "end_date": str(end_date),
                                "days": days
                            },
                            "summary": {
                                "total_entries": total_entries,
                                "completed_entries": total_completed,
                                "completion_percentage": overall_completion,
                                "habits_count": len(target_habits)
                            }
                        }
                    }
                    
                except Exception as e:
                    logger.exception(f"Database error in get_formatted_habit_entries: {str(e)}")
                    return {
                        "success": False,
                        "error": ErrorMessages.DATABASE_ERROR,
                        "action_required": "Please try again in a moment. If the problem persists, contact support."
                    }
                    
        except Exception as e:
            logger.exception(f"Error in get_formatted_habit_entries: {str(e)}")
            return {
                "success": False,
                "error": ErrorMessages.UNKNOWN_ERROR,
                "action_required": "Please try again or contact support for assistance."
            }

    async def call_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool by name with parameters"""
        logger.info(f"Calling tool: {tool_name} with parameters: {parameters}")
        
        try:
            if tool_name == "get_user_habits":
                return await self.get_user_habits(
                    user_id=parameters["user_id"],
                    skip=parameters.get("skip", 0),
                    limit=parameters.get("limit", 100)
                )
            elif tool_name == "get_habit_by_id":
                return await self.get_habit_by_id(
                    habit_id=parameters["habit_id"],
                    user_id=parameters["user_id"]
                )
            elif tool_name == "get_habit_entries":
                return await self.get_habit_entries(
                    habit_id=parameters["habit_id"],
                    skip=parameters.get("skip", 0),
                    limit=parameters.get("limit", 100),
                    start_date=parameters.get("start_date"),
                    end_date=parameters.get("end_date")
                )
            elif tool_name == "get_habit_streak":
                return await self.get_habit_streak(
                    habit_id=parameters["habit_id"]
                )
            elif tool_name == "get_user_habits_by_phone":
                return await self.get_user_habits_by_phone(
                    phone_number=parameters["phone_number"],
                    skip=parameters.get("skip", 0),
                    limit=parameters.get("limit", 100)
                )
            elif tool_name == "create_habit":
                return await self.create_habit(
                    user_id=parameters["user_id"],
                    name=parameters["name"],
                    description=parameters["description"],
                    habit_type=parameters["habit_type"],
                    color_code=parameters.get("color_code", "#3B82F6")
                )
            elif tool_name == "check_habit_exists":
                return await self.check_habit_exists(
                    user_id=parameters["user_id"],
                    habit_name=parameters["habit_name"]
                )
            elif tool_name == "analyze_habit_performance":
                return await self.analyze_habit_performance(
                    user_id=parameters["user_id"],
                    habit_names=parameters["habit_names"],
                    start_date=parameters["start_date"],
                    end_date=parameters["end_date"]
                )
            elif tool_name == "analyze_user_intent":
                return await self.analyze_user_intent(
                    user_id=parameters["user_id"],
                    message=parameters["message"],
                    current_habits=parameters["current_habits"]
                )
            elif tool_name == "get_habit_entries_by_user":
                return await self.get_habit_entries_by_user(
                    user_id=parameters["user_id"],
                    start_date=parameters["start_date"],
                    end_date=parameters["end_date"],
                    habit_names=parameters.get("habit_names")
                )
            elif tool_name == "update_habit_entries":
                return await self.update_habit_entries(
                    user_id=parameters["user_id"],
                    entries=parameters["entries"]
                )
            elif tool_name == "get_formatted_habit_entries":
                return await self.get_formatted_habit_entries(
                    phone_number=parameters["phone_number"],
                    days=parameters.get("days", 7),
                    habit_names=parameters.get("habit_names")
                )
            else:
                logger.error(f"Unknown tool requested: {tool_name}")
                return {"success": False, "error": f"Unknown tool: {tool_name}"}
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {str(e)}")
            return {"success": False, "error": f"Error executing tool {tool_name}: {str(e)}"}

    def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools"""
        return self.tools


# Create a global instance
logger.info("Creating global HabitMCPServer instance")
habit_mcp_server = HabitMCPServer()
logger.info("HabitMCPServer instance created successfully")


async def run_comprehensive_habit_tools_test_cases():
    """
    Run comprehensive test cases for habit tools with clear input/output examples
    70+ test cases covering all MCP functionality
    """
    print("🧪 **COMPREHENSIVE HABIT TOOLS TEST CASES - 70+ MCP Function Tests**")
    print("=" * 80)
    
    habit_server = HabitMCPServer()
    test_user_id = "12345678-1234-1234-1234-123456789012"
    test_phone = "+60123963698"
    
    # Define comprehensive test cases for all MCP functions (shortened version for space)
    test_cases = [
        {
            "category": "👤 User & Phone Management (8 cases)",
            "cases": [
                {"function": "get_user_habits_by_phone", "params": {"phone_number": test_phone}, "description": "Get user habits by phone number", "expected": "User habits list with user_id and habit data"},
                {"function": "get_user_habits_by_phone", "params": {"phone_number": test_phone, "limit": 5}, "description": "Get limited user habits by phone", "expected": "Maximum 5 habits returned"},
                {"function": "get_user_habits_by_phone", "params": {"phone_number": "+1234567890"}, "description": "Get habits for non-existent phone", "expected": "Phone number not found error"},
                {"function": "get_user_habits", "params": {"user_id": test_user_id}, "description": "Get all user habits by user ID", "expected": "Complete habits list for user"},
                {"function": "get_user_habits", "params": {"user_id": test_user_id, "limit": 3}, "description": "Get limited user habits by ID", "expected": "Maximum 3 habits returned"},
                {"function": "get_user_habits", "params": {"user_id": "invalid-user-id"}, "description": "Get habits for invalid user ID", "expected": "Invalid user ID error"},
                {"function": "get_user_habits_by_phone", "params": {"phone_number": "invalid-phone"}, "description": "Invalid phone number format", "expected": "Invalid phone number format error"},
                {"function": "get_user_habits_by_phone", "params": {"phone_number": ""}, "description": "Empty phone number", "expected": "Phone number required error"}
            ]
        },
        {
            "category": "🎯 Habit Creation & Management (12 cases)",
            "cases": [
                {"function": "create_habit", "params": {"user_id": test_user_id, "name": "Test Reading", "description": "Read for 30 minutes daily", "habit_type": "build"}, "description": "Create build habit", "expected": "Success with habit creation confirmation"},
                {"function": "create_habit", "params": {"user_id": test_user_id, "name": "Test Exercise", "description": "Daily workout routine", "habit_type": "build", "color_code": "#FF5733"}, "description": "Create habit with custom color", "expected": "Success with custom color applied"},
                {"function": "create_habit", "params": {"user_id": test_user_id, "name": "Quit Smoking", "description": "Stop smoking cigarettes", "habit_type": "break"}, "description": "Create break habit", "expected": "Success with break habit confirmation"},
                {"function": "create_habit", "params": {"user_id": test_user_id, "name": "Water Intake", "description": "Track daily water consumption", "habit_type": "track"}, "description": "Create tracking habit", "expected": "Success with tracking habit confirmation"},
                {"function": "create_habit", "params": {"user_id": test_user_id, "name": "", "description": "Empty name test", "habit_type": "build"}, "description": "Create habit with empty name", "expected": "Habit name required error"},
                {"function": "create_habit", "params": {"user_id": test_user_id, "name": "Test Habit", "description": "", "habit_type": "build"}, "description": "Create habit with empty description", "expected": "Habit description required error"},
                {"function": "create_habit", "params": {"user_id": test_user_id, "name": "Invalid Type Habit", "description": "Test invalid type", "habit_type": "invalid"}, "description": "Create habit with invalid type", "expected": "Invalid habit type error"},
                {"function": "create_habit", "params": {"user_id": "", "name": "Test Habit", "description": "Test description", "habit_type": "build"}, "description": "Create habit with empty user ID", "expected": "User ID required error"},
                {"function": "check_habit_exists", "params": {"user_id": test_user_id, "habit_name": "Exercise"}, "description": "Check if habit exists", "expected": "Habit existence confirmation"},
                {"function": "check_habit_exists", "params": {"user_id": test_user_id, "habit_name": "Non-existent Habit"}, "description": "Check non-existent habit", "expected": "Habit not found result"},
                {"function": "get_habit_by_id", "params": {"habit_id": "test-habit-id", "user_id": test_user_id}, "description": "Get habit by ID", "expected": "Habit details or not found error"},
                {"function": "create_habit", "params": {"user_id": test_user_id, "name": "A" * 100, "description": "Test long name", "habit_type": "build"}, "description": "Create habit with very long name", "expected": "Habit name too long error"}
            ]
        },
        {
            "category": "📊 Analytics & Performance (10 cases)",
            "cases": [
                {"function": "analyze_habit_performance", "params": {"user_id": test_user_id, "habit_names": [], "start_date": "2024-01-01", "end_date": "2024-01-31"}, "description": "Analyze all habits performance", "expected": "Comprehensive performance analysis"},
                {"function": "analyze_habit_performance", "params": {"user_id": test_user_id, "habit_names": ["Exercise", "Reading"], "start_date": "2024-01-01", "end_date": "2024-01-31"}, "description": "Analyze specific habits performance", "expected": "Performance analysis for specified habits"},
                {"function": "analyze_habit_performance", "params": {"user_id": test_user_id, "habit_names": [], "start_date": "2024-01-01", "end_date": "2024-01-07"}, "description": "Weekly performance analysis", "expected": "7-day performance insights"},
                {"function": "analyze_habit_performance", "params": {"user_id": test_user_id, "habit_names": [], "start_date": "2024-01-31", "end_date": "2024-01-01"}, "description": "Performance with invalid date range", "expected": "Invalid date range error"},
                {"function": "analyze_habit_performance", "params": {"user_id": "", "habit_names": [], "start_date": "2024-01-01", "end_date": "2024-01-31"}, "description": "Analyze with empty user ID", "expected": "User ID required error"},
                {"function": "analyze_habit_performance", "params": {"user_id": test_user_id, "habit_names": [], "start_date": "", "end_date": "2024-01-31"}, "description": "Analyze with empty start date", "expected": "Date required error"},
                {"function": "analyze_habit_performance", "params": {"user_id": test_user_id, "habit_names": [], "start_date": "2024-01-01", "end_date": ""}, "description": "Analyze with empty end date", "expected": "Date required error"},
                {"function": "analyze_habit_performance", "params": {"user_id": test_user_id, "habit_names": ["Non-existent Habit"], "start_date": "2024-01-01", "end_date": "2024-01-31"}, "description": "Analyze non-existent habit", "expected": "Analysis with empty results for missing habit"},
                {"function": "analyze_habit_performance", "params": {"user_id": test_user_id, "habit_names": [], "start_date": "invalid-date", "end_date": "2024-01-31"}, "description": "Analyze with invalid start date", "expected": "Invalid date format error"},
                {"function": "analyze_habit_performance", "params": {"user_id": test_user_id, "habit_names": [], "start_date": "2024-01-01", "end_date": "invalid-date"}, "description": "Analyze with invalid end date", "expected": "Invalid date format error"}
            ]
        },
        {
            "category": "🧠 Intent Analysis (8 cases)",
            "cases": [
                {"function": "analyze_user_intent", "params": {"user_id": test_user_id, "message": "show my progress", "current_habits": ["Exercise", "Reading", "Meditation"]}, "description": "Analyze progress request intent", "expected": "Intent: get_habit_entries with confidence score"},
                {"function": "analyze_user_intent", "params": {"user_id": test_user_id, "message": "I completed exercise today", "current_habits": ["Exercise", "Reading"]}, "description": "Analyze completion logging intent", "expected": "Intent: update_entries with habit extraction"},
                {"function": "analyze_user_intent", "params": {"user_id": test_user_id, "message": "I want to create a new reading habit", "current_habits": ["Exercise"]}, "description": "Analyze habit creation intent", "expected": "Intent: habit_creation with entity extraction"},
                {"function": "analyze_user_intent", "params": {"user_id": test_user_id, "message": "generate analysis report", "current_habits": ["Exercise", "Reading"]}, "description": "Analyze analytics request intent", "expected": "Intent: performance_analysis with action"},
                {"function": "analyze_user_intent", "params": {"user_id": test_user_id, "message": "random unclear message", "current_habits": ["Exercise"]}, "description": "Analyze unclear intent", "expected": "Intent: unknown with low confidence"},
                {"function": "analyze_user_intent", "params": {"user_id": "", "message": "show my habits", "current_habits": ["Exercise"]}, "description": "Analyze intent with empty user ID", "expected": "User ID required error"},
                {"function": "analyze_user_intent", "params": {"user_id": test_user_id, "message": "", "current_habits": ["Exercise"]}, "description": "Analyze intent with empty message", "expected": "Message required error"},
                {"function": "analyze_user_intent", "params": {"user_id": test_user_id, "message": "help", "current_habits": []}, "description": "Analyze help request with no habits", "expected": "Intent: help with guidance for new users"}
            ]
        },
        {
            "category": "📱 Formatted Display (12 cases)",
            "cases": [
                {"function": "get_formatted_habit_entries", "params": {"phone_number": test_phone, "days": 7}, "description": "Get formatted entries for 7 days", "expected": "Beautiful formatted habit display"},
                {"function": "get_formatted_habit_entries", "params": {"phone_number": test_phone, "days": 30}, "description": "Get formatted entries for 30 days", "expected": "Monthly formatted habit display"},
                {"function": "get_formatted_habit_entries", "params": {"phone_number": test_phone, "days": 1}, "description": "Get formatted entries for today", "expected": "Today's formatted habit display"},
                {"function": "get_formatted_habit_entries", "params": {"phone_number": test_phone, "days": 7, "habit_names": ["Exercise", "Reading"]}, "description": "Get formatted entries for specific habits", "expected": "Formatted display for specified habits only"},
                {"function": "get_formatted_habit_entries", "params": {"phone_number": "+1234567890", "days": 7}, "description": "Get formatted entries for unknown phone", "expected": "Phone number not found error"},
                {"function": "get_formatted_habit_entries", "params": {"phone_number": "", "days": 7}, "description": "Get formatted entries with empty phone", "expected": "Phone number required error"},
                {"function": "get_formatted_habit_entries", "params": {"phone_number": "invalid-phone", "days": 7}, "description": "Get formatted entries with invalid phone", "expected": "Invalid phone number format error"},
                {"function": "get_formatted_habit_entries", "params": {"phone_number": test_phone, "days": 0}, "description": "Get formatted entries for 0 days", "expected": "No entries or appropriate message"},
                {"function": "get_formatted_habit_entries", "params": {"phone_number": test_phone, "days": -5}, "description": "Get formatted entries for negative days", "expected": "Invalid days value handling"},
                {"function": "get_formatted_habit_entries", "params": {"phone_number": test_phone, "days": 365}, "description": "Get formatted entries for full year", "expected": "Large dataset formatted appropriately"},
                {"function": "get_formatted_habit_entries", "params": {"phone_number": test_phone, "days": 7, "habit_names": ["Non-existent Habit"]}, "description": "Get formatted entries for non-existent habit", "expected": "Empty or no results for missing habit"},
                {"function": "get_formatted_habit_entries", "params": {"phone_number": test_phone, "days": 7, "habit_names": []}, "description": "Get formatted entries with empty habit names", "expected": "All habits formatted display"}
            ]
        },
        {
            "category": "🔧 Tool Management (7 cases)",
            "cases": [
                {"function": "list_tools", "params": {}, "description": "List all available MCP tools", "expected": "Complete list of available tools with descriptions"},
                {"function": "call_tool", "params": {"tool_name": "get_user_habits_by_phone", "parameters": {"phone_number": test_phone}}, "description": "Call tool via tool manager", "expected": "Tool execution result"},
                {"function": "call_tool", "params": {"tool_name": "invalid_tool", "parameters": {}}, "description": "Call non-existent tool", "expected": "Tool not found error"},
                {"function": "call_tool", "params": {"tool_name": "get_user_habits_by_phone", "parameters": {"invalid_param": "value"}}, "description": "Call tool with invalid parameters", "expected": "Parameter validation error"},
                {"function": "call_tool", "params": {"tool_name": "", "parameters": {}}, "description": "Call tool with empty name", "expected": "Tool name required error"},
                {"function": "call_tool", "params": {"tool_name": "create_habit", "parameters": {"user_id": test_user_id, "name": "Tool Test Habit", "description": "Created via tool manager", "habit_type": "build"}}, "description": "Create habit via tool manager", "expected": "Successful habit creation"},
                {"function": "call_tool", "params": {"tool_name": "analyze_user_intent", "parameters": {"user_id": test_user_id, "message": "show my progress", "current_habits": ["Exercise"]}}, "description": "Analyze intent via tool manager", "expected": "Intent analysis result"}
            ]
        }
    ]
    
    # Calculate total test cases
    total_cases = sum(len(cat['cases']) for cat in test_cases)
    
    print(f"📊 **Total Test Cases:** {total_cases}")
    print(f"👤 **Test User ID:** {test_user_id}")
    print(f"📱 **Test Phone:** {test_phone}")
    print("🎯 **Each test shows: Function → Parameters → Expected → Actual Result → Status**")
    print()
    
    # Track test results
    test_results = {"total": 0, "passed": 0, "failed": 0, "errors": []}
    
    # Run test cases and show results
    for category_data in test_cases:
        category = category_data["category"]
        cases = category_data["cases"]
        
        print(f"\n{category}")
        print("=" * 70)
        
        for i, test_case in enumerate(cases, 1):
            function_name = test_case["function"]
            params = test_case["params"]
            description = test_case["description"]
            expected = test_case["expected"]
            
            print(f"\n{i:2d}. **{description}**")
            print(f"    🔧 FUNCTION:  {function_name}")
            print(f"    📥 PARAMS:    {params}")
            print(f"    🎯 EXPECTED:  {expected}")
            
            # Actually run the test
            try:
                print(f"    🧪 TESTING...")
                
                # Get the function and call it
                if hasattr(habit_server, function_name):
                    func = getattr(habit_server, function_name)
                    result = await func(**params)
                else:
                    result = {"success": False, "error": f"Function {function_name} not found"}
                
                test_results["total"] += 1
                
                if result.get("success", False):
                    # Truncate output for display
                    display_result = str(result).replace('\n', ' ')[:100] + "..." if len(str(result)) > 100 else str(result)
                    print(f"    📤 RESULT:    {display_result}")
                    print(f"    ✅ STATUS:    SUCCESS")
                    test_results["passed"] += 1
                else:
                    error_msg = result.get("error", "Unknown error")
                    print(f"    📤 RESULT:    [ERROR] {error_msg}")
                    print(f"    ❌ STATUS:    FAILED - {error_msg}")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"{function_name}: {error_msg}")
                    
            except Exception as e:
                print(f"    📤 RESULT:    [EXCEPTION] {str(e)}")
                print(f"    💥 STATUS:    EXCEPTION - {str(e)}")
                test_results["total"] += 1
                test_results["failed"] += 1
                test_results["errors"].append(f"{function_name}: {str(e)}")
            
            print("-" * 60)
    
    # Comprehensive Summary
    print(f"\n🎯 **COMPREHENSIVE MCP TESTING SUMMARY**")
    print("=" * 80)
    success_rate = (test_results["passed"] / test_results["total"]) * 100 if test_results["total"] > 0 else 0
    
    print(f"📊 **Test Results:**")
    print(f"   🧪 Total Test Cases: {test_results['total']}")
    print(f"   ✅ Passed: {test_results['passed']}")
    print(f"   ❌ Failed: {test_results['failed']}")
    print(f"   📈 Success Rate: {success_rate:.1f}%")
    
    if test_results["errors"]:
        print(f"\n❌ **Errors Encountered ({len(test_results['errors'])}):**")
        for i, error in enumerate(test_results["errors"][:10], 1):  # Show first 10 errors
            print(f"   {i:2d}. {error}")
        if len(test_results["errors"]) > 10:
            print(f"   ... and {len(test_results['errors']) - 10} more errors")
    
    print(f"\n🚀 **Next Steps:**")
    print(f"   1. Fix any failed tests by checking database and validation")
    print(f"   2. Test integration with WhatsApp AI Manager")
    print(f"   3. Compare results: python -m app.service.whatsapp_ai_manager test_cases")
    print(f"   4. Verify intent analysis consistency")
    print(f"   5. Run performance benchmarks with large datasets")
    
    return test_results


# CLI interface for testing
async def main():
    """Enhanced CLI interface for testing the MCP server"""
    import sys
    
    logger.info("CLI interface started")
    
    if len(sys.argv) < 2:
        logger.info("No command provided, showing help")
        print("🧪 Habit Tools Testing Interface")
        print("=" * 50)
        print("Usage: python app/mcp/habit_tools.py <command> [args...]")
        print("\n📋 Available Commands:")
        print("  test_all                      - Run comprehensive test suite")
        print("  test_comprehensive            - Run 70+ comprehensive test cases")
        print("  test_phone_flow <phone>       - Test phone → user_id → habits → entries flow")
        print("  test_intent                   - Test OpenAI intent analysis directly")
        print("  list_tools                    - List all available tools")
        print("  get_user_habits <user_id>     - Get all habits for user")
        print("  get_habit <habit_id> <user_id> - Get specific habit")
        print("  get_entries <habit_id>        - Get habit entries")
        print("  get_streak <habit_id>         - Get habit streak information")
        print("  create_habit <user_id> <name> <desc> <type> - Create new habit")
        print("  check_habit_exists <user_id> <habit_name> - Check if habit exists")
        print("  update_entries <user_id> <json> - Update habit entries")
        print("  get_entries_by_user <user_id> <start> <end> - Get all entries for user")
        print("  analytics <user_id> <start> <end> - Get habit analytics")
        print("  analyze_intent <user_id> <message> - Analyze user intent with OpenAI")
        print("  phone_habits <phone>          - Get habits by phone number")
        print("  formatted_entries <phone>     - Get beautifully formatted entries")
        print("\n💡 Examples:")
        print("  python app/mcp/habit_tools.py test_phone_flow +60123963698")
        print("  python app/mcp/habit_tools.py test_all")
        print("  python app/mcp/habit_tools.py get_user_habits 12345678-1234-1234-1234-123456789012")
        print("  python app/mcp/habit_tools.py create_habit 12345678-1234-1234-1234-123456789012 'Swimming' 'Daily swimming for fitness' 'build'")
        print("  python app/mcp/habit_tools.py phone_habits '+60123963698'")
        print("  python app/mcp/habit_tools.py analytics 12345678-1234-1234-1234-123456789012 2025-01-01 2025-01-07")
        print("  python app/mcp/habit_tools.py get_streak 12345678-1234-1234-1234-123456789012")
        print("  python app/mcp/habit_tools.py check_habit_exists 12345678-1234-1234-1234-123456789012 'Reading'")
        print("  python app/mcp/habit_tools.py analyze_intent 12345678-1234-1234-1234-123456789012 'show my progress'")
        return
    
    command = sys.argv[1]
    
    logger.info(f"Executing command: {command}")
    
    # New comprehensive test for phone number flow
    if command == "test_phone_flow":
        if len(sys.argv) < 3:
            logger.error("Phone number required for test_phone_flow command")
            print("❌ Error: phone_number required")
            print("💡 Example: python app/mcp/habit_tools.py test_phone_flow +60123963698")
            return
            
        phone_number = sys.argv[2]
        logger.info(f"Starting test_phone_flow with phone number: {phone_number}")
        
        print("🔄 Testing Complete Phone → User → Habits → Entries Flow")
        print("=" * 60)
        print(f"📱 Testing with phone number: {phone_number}")
        print()
        
        # Step 1: Get user habits by phone number
        logger.info("Step 1: Finding user by phone number")
        print("1️⃣ Step 1: Finding user by phone number...")
        habits_result = await habit_mcp_server.get_user_habits_by_phone(phone_number)
        
        if not habits_result.get("success"):
            logger.error(f"Failed to find user: {habits_result.get('error')}")
            print(f"   ❌ Failed to find user: {habits_result.get('error')}")
            if habits_result.get("action_required"):
                print(f"   💡 {habits_result.get('action_required')}")
            return
        
        user_id = habits_result.get("user_id")
        habits = habits_result.get("data", [])
        logger.info(f"Found user: {user_id} with {len(habits)} habits")
        print(f"   ✅ Found user: {user_id}")
        print(f"   ✅ Found {len(habits)} habits")
        
        if not habits:
            logger.warning("No habits found for this user")
            print("   ⚠️ No habits found for this user. Create some habits first!")
            return
        
        # Display habits
        print("\n   📋 User's Habits:")
        for i, habit in enumerate(habits, 1):
            print(f"      {i}. {habit['name']} ({habit['habit_type']})")
            print(f"         ID: {habit['id']}")
            print(f"         Description: {habit['description']}")
        
        # Step 2: Get habit entries for each habit
        print(f"\n2️⃣ Step 2: Getting habit entries for all habits...")
        from datetime import datetime, timedelta
        
        # Test with last 7 days
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=6)).strftime("%Y-%m-%d")
        
        if not user_id:
            print("   ❌ No user_id available for entries test")
            return
            
        entries_result = await habit_mcp_server.get_habit_entries_by_user(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )
        
        if not entries_result.get("success"):
            print(f"   ❌ Failed to get entries: {entries_result.get('error')}")
            return
        
        entries = entries_result.get("data", [])
        print(f"   ✅ Found {len(entries)} habit entries in last 7 days")
        print(f"   📅 Date range: {start_date} to {end_date}")
        
        # Display recent entries
        if entries:
            print("\n   📊 Recent Habit Entries:")
            for entry in entries[:10]:  # Show first 10
                status_icon = "✅" if entry['status'] == 'completed' else "⏭️" if entry['status'] == 'skipped' else "⏳"
                print(f"      {entry['entry_date']} - {entry['habit_name']} {status_icon}")
                if entry.get('note'):
                    print(f"         💭 {entry['note']}")
        else:
            print("   ℹ️ No entries found in the selected date range")
        
        # Step 3: Test formatted entries
        print(f"\n3️⃣ Step 3: Getting beautifully formatted entries...")
        formatted_result = await habit_mcp_server.get_formatted_habit_entries(
            phone_number=phone_number,
            days=7
        )
        
        if formatted_result.get("success"):
            print("   ✅ Generated formatted display")
            print("\n   🎨 Formatted Output:")
            print("   " + "─" * 50)
            formatted_display = formatted_result.get("formatted_display", "")
            # Show formatted output with indentation
            for line in formatted_display.split('\n'):
                print(f"   {line}")
            print("   " + "─" * 50)
        else:
            print(f"   ❌ Failed to format entries: {formatted_result.get('error')}")
        
        # Step 4: Analytics test
        print(f"\n4️⃣ Step 4: Testing analytics...")
        if not user_id:
            print("   ❌ No user_id available for analytics test")
            return
            
        analytics_result = await habit_mcp_server.analyze_habit_performance(
            user_id=user_id,
            habit_names=[],  # All habits
            start_date=start_date,
            end_date=end_date
        )
        
        if analytics_result.get("success"):
            data = analytics_result.get("data", {})
            summary = data.get("summary", {})
            print("   ✅ Analytics generated successfully")
            print(f"   📊 Completion rate: {summary.get('completion_percentage', 0)}%")
            print(f"   ⏭️ Skip rate: {summary.get('skip_percentage', 0)}%")
            print(f"   📅 Total days analyzed: {summary.get('total_days', 0)}")
        else:
            print(f"   ❌ Analytics failed: {analytics_result.get('error')}")
        
        # Step 5: Test individual habit entries
        print(f"\n5️⃣ Step 5: Testing individual habit entry retrieval...")
        if habits:
            first_habit = habits[0]
            habit_id = first_habit['id']
            habit_name = first_habit['name']
            
            print(f"   🎯 Testing with habit: {habit_name} (ID: {habit_id})")
            
            individual_entries_result = await habit_mcp_server.get_habit_entries(
                habit_id=habit_id,
                start_date=start_date,
                end_date=end_date
            )
            
            if individual_entries_result.get("success"):
                individual_entries = individual_entries_result.get("data", [])
                print(f"   ✅ Found {len(individual_entries)} entries for '{habit_name}'")
                
                # Show recent entries for this habit
                if individual_entries:
                    print(f"   📋 Entries for '{habit_name}':")
                    for entry in individual_entries[:5]:  # Show first 5
                        status_icon = "✅" if entry['status'] == 'completed' else "⏭️" if entry['status'] == 'skipped' else "⏳"
                        print(f"      {entry['entry_date']} {status_icon} {entry['status']}")
                        if entry.get('note'):
                            print(f"         💭 {entry['note']}")
            else:
                print(f"   ❌ Failed to get individual entries: {individual_entries_result.get('error')}")
        
        logger.info("Complete Flow Test Finished successfully")
        print(f"\n🎉 Complete Flow Test Finished!")
        print("=" * 60)
        print(f"✅ Successfully tested: Phone → User → Habits → Entries")
        print(f"📱 Phone: {phone_number}")
        print(f"👤 User ID: {user_id}")
        print(f"🎯 Habits: {len(habits)} found")
        print(f"📊 Entries: {len(entries)} found (last 7 days)")
        return
    
    # Test suite command
    elif command == "test_all":
        logger.info("Starting comprehensive test suite")
        print("🧪 Running Comprehensive Test Suite")
        print("=" * 50)
        
        # Use specific phone number and capture user_id from lookup
        test_phone = "+60123963698"
        test_user_id = None  # Will be captured from phone lookup
        
        logger.info(f"Testing with Phone: {test_phone}")
        print(f"📱 Testing with Phone: {test_phone}")
        print()
        
        # Test 1: List tools
        logger.info("Test 1: List Tools")
        print("1️⃣ Testing: List Tools")
        tools = habit_mcp_server.list_tools()
        logger.info(f"Found {len(tools)} tools available")
        print(f"   ✅ Found {len(tools)} tools available")
        
        # Test 2: Get user habits by phone - This will capture the user_id
        logger.info("Test 2: Get User Habits by Phone")
        print("\n2️⃣ Testing: Get User Habits by Phone")
        result = await habit_mcp_server.get_user_habits_by_phone(test_phone)
        if result.get("success"):
            habits_count = result.get("count", 0)
            test_user_id = result.get("user_id")
            user_habits = result.get("data", [])  # Capture habits for summary
            logger.info(f"Found {habits_count} habits for phone {test_phone}, user_id: {test_user_id}")
            print(f"   ✅ Found {habits_count} habits for phone {test_phone}")
            print(f"   👤 Captured User ID: {test_user_id}")
        else:
            logger.error(f"Error in get_user_habits_by_phone: {result.get('error')}")
            print(f"   ❌ Error: {result.get('error')}")
            print(f"   🚫 Cannot continue without valid user_id from phone lookup")
            if result.get("action_required"):
                print(f"   💡 {result.get('action_required')}")
            return
        
        # Verify we have a valid user_id
        if not test_user_id:
            logger.error("No user_id captured from phone lookup")
            print("   ❌ No user_id captured from phone lookup")
            print("   🚫 Cannot continue test suite without valid user_id")
            return
        
        # Test 3: Create a test habit
        print("\n3️⃣ Testing: Create New Habit")
        create_result = await habit_mcp_server.create_habit(
            test_user_id, 
            "Test Reading", 
            "Daily reading for 30 minutes", 
            "build"
        )
        if create_result.get("success"):
            print("   ✅ Successfully created test habit")
            test_habit_id = create_result["data"]["id"]
            test_habit_name = create_result["data"]["name"]
        else:
            print(f"   ⚠️ Create result: {create_result.get('error', 'Unknown error')}")
            # Try to find an existing habit
            habits_result = await habit_mcp_server.get_user_habits(test_user_id)
            if habits_result.get("success") and habits_result.get("data"):
                test_habit_id = habits_result["data"][0]["id"]
                test_habit_name = habits_result["data"][0]["name"]
                print(f"   ℹ️ Using existing habit ID: {test_habit_id}")
            else:
                print("   ❌ No habits available for testing")
                return
        
        # Test 4: Check habit exists
        print("\n4️⃣ Testing: Check Habit Exists")
        check_result = await habit_mcp_server.check_habit_exists(test_user_id, test_habit_name)
        if check_result.get("success"):
            exists = check_result.get("exists", False)
            print(f"   ✅ Habit '{test_habit_name}' exists: {exists}")
        else:
            print(f"   ❌ Error: {check_result.get('error')}")
        
        # Test 5: Get specific habit
        print("\n5️⃣ Testing: Get Specific Habit")
        habit_result = await habit_mcp_server.get_habit_by_id(test_habit_id, test_user_id)
        if habit_result.get("success"):
            habit_name = habit_result["data"]["name"]
            print(f"   ✅ Retrieved habit: {habit_name}")
        else:
            print(f"   ❌ Error: {habit_result.get('error')}")
            habit_name = test_habit_name  # fallback
        
        # Test 6: Update habit entries
        print("\n6️⃣ Testing: Update Habit Entries")
        from datetime import datetime, timedelta
        today = datetime.now().strftime("%Y-%m-%d")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        day_before_yesterday = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
        
        # Test with multiple entries including edge cases
        test_entries = [
            {
                "habit_name": habit_name if 'habit_name' in locals() else "Test Reading",
                "entry_date": today,
                "status": "completed",
                "note": "Great session today!",
                "value": "1.5"  # Test string number
            },
            {
                "habit_name": habit_name if 'habit_name' in locals() else "Test Reading", 
                "entry_date": yesterday,
                "status": "skipped",
                "note": "Too busy yesterday",
                "value": None  # Test null value
            },
            {
                "habit_name": habit_name if 'habit_name' in locals() else "Test Reading",
                "entry_date": day_before_yesterday,
                "status": "completed",
                "note": "Short session",
                "value": 0.5  # Test float value
            }
        ]
        
        update_result = await habit_mcp_server.update_habit_entries(test_user_id, test_entries)
        if update_result.get("success"):
            summary = update_result.get("summary", {})
            created = summary.get("created", 0)
            updated = summary.get("updated", 0)
            total = summary.get("total_processed", 0)
            print(f"   ✅ Successfully processed {total} habit entries")
            print(f"      📊 Created: {created}, Updated: {updated}")
            
            # Show details of processed entries
            entries = summary.get("entries", [])
            for entry in entries[:3]:  # Show first 3
                action = entry.get("action", "unknown")
                name = entry.get("habit_name", "Unknown")
                date = entry.get("entry_date", "Unknown")
                status = entry.get("status", "Unknown")
                print(f"      • {action.title()}: {name} on {date} - {status}")
        else:
            print(f"   ❌ Error: {update_result.get('error')}")
            if update_result.get("action_required"):
                print(f"   💡 {update_result.get('action_required')}")
        
        # Test edge case: Invalid data
        print("   🧪 Testing edge case: Invalid entry data")
        invalid_entries = [
            {
                "habit_name": "Non-existent Habit",
                "entry_date": today,
                "status": "completed"
            }
        ]
        
        invalid_result = await habit_mcp_server.update_habit_entries(test_user_id, invalid_entries)
        if not invalid_result.get("success"):
            print("   ✅ Correctly rejected invalid habit name")
        else:
            print("   ❌ Should have rejected invalid habit name")
        
        # Test 7: Get habit entries
        print("\n7️⃣ Testing: Get Habit Entries")
        entries_result = await habit_mcp_server.get_habit_entries(test_habit_id)
        if entries_result.get("success"):
            entries_count = entries_result.get("count", 0)
            print(f"   ✅ Retrieved {entries_count} habit entries")
        else:
            print(f"   ❌ Error: {entries_result.get('error')}")
        
        # Test 8: Get habit streak
        print("\n8️⃣ Testing: Get Habit Streak")
        streak_result = await habit_mcp_server.get_habit_streak(test_habit_id)
        if streak_result.get("success"):
            streak_data = streak_result.get("data", {})
            current_streak = streak_data.get("current_streak", 0)
            longest_streak = streak_data.get("longest_streak", 0)
            print(f"   ✅ Habit streak - Current: {current_streak}, Longest: {longest_streak}")
        else:
            print(f"   ❌ Error: {streak_result.get('error')}")
        
        # Test 9: Get habit entries by user
        print("\n9️⃣ Testing: Get Habit Entries by User")
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        
        user_entries_result = await habit_mcp_server.get_habit_entries_by_user(
            test_user_id, start_date, end_date
        )
        if user_entries_result.get("success"):
            entries_count = user_entries_result.get("entries_count", 0)
            habits_count = user_entries_result.get("habits_count", 0)
            print(f"   ✅ Retrieved {entries_count} entries for {habits_count} habits")
        else:
            print(f"   ❌ Error: {user_entries_result.get('error')}")
        
        # Test 10: Analytics
        print("\n🔟 Testing: Habit Analytics")
        analytics_result = await habit_mcp_server.analyze_habit_performance(
            test_user_id, [], start_date, end_date
        )
        if analytics_result.get("success"):
            data = analytics_result.get("data", {})
            summary = data.get("summary", {})
            completion_pct = summary.get('completion_percentage', 0)
            print(f"   ✅ Analytics: {completion_pct}% completion rate")
        else:
            print(f"   ❌ Error: {analytics_result.get('error')}")
        
        # Test 11: Analyze user intent
        print("\n1️⃣1️⃣ Testing: Analyze User Intent")
        # Get current habits for intent analysis
        habits_result = await habit_mcp_server.get_user_habits(test_user_id)
        current_habits = []
        if habits_result.get("success"):
            current_habits = [h["name"] for h in habits_result.get("data", [])]
        
        test_messages = [
            "show my progress",
            "I want to create a new habit",
            "how am I doing with my habits",
            "analyze my performance"
        ]
        
        for i, message in enumerate(test_messages):
            intent_result = await habit_mcp_server.analyze_user_intent(
                test_user_id, message, current_habits
            )
            if intent_result.get("success"):
                intent_data = intent_result.get("data", {})
                intent = intent_data.get("intent", "unknown")
                confidence = intent_data.get("confidence", 0)
                print(f"   ✅ Message '{message}' → Intent: {intent} (confidence: {confidence})")
            else:
                print(f"   ❌ Error analyzing '{message}': {intent_result.get('error')}")
        
        # Test 12: Formatted entries
        print("\n1️⃣2️⃣ Testing: Formatted Habit Entries")
        formatted_result = await habit_mcp_server.get_formatted_habit_entries(test_phone, 7)
        if formatted_result.get("success"):
            print("   ✅ Generated formatted habit display")
            print("   📊 Preview:")
            display = formatted_result.get("formatted_display", "")
            preview_lines = display.split('\n')[:5]  # Show first 5 lines
            for line in preview_lines:
                print(f"      {line}")
            if len(display.split('\n')) > 5:
                print("      ... (truncated)")
        else:
            print(f"   ❌ Error: {formatted_result.get('error')}")
        
        logger.info("Test Suite Complete")
        print(f"\n🎉 Comprehensive Test Suite Complete!")
        print("=" * 50)
        print("✅ All 12 Test Cases Executed:")
        print("   1. List Tools")
        print("   2. Get User Habits by Phone")
        print("   3. Create New Habit")
        print("   4. Check Habit Exists")
        print("   5. Get Specific Habit")
        print("   6. Update Habit Entries")
        print("   7. Get Habit Entries")
        print("   8. Get Habit Streak")
        print("   9. Get Habit Entries by User")
        print("   10. Habit Analytics")
        print("   11. Analyze User Intent")
        print("   12. Formatted Habit Entries")
        print(f"\n📊 Test Summary:")
        print(f"   📱 Phone Number: {test_phone}")
        print(f"   👤 User ID: {test_user_id}")
        print(f"   🎯 Habits: {len(user_habits) if 'user_habits' in locals() else 'N/A'} found")
        print(f"   📅 Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return
    
    # Individual command handlers
    elif command == "list_tools":
        logger.info("Listing available tools")
        print("🔧 Available Tools:")
        print("=" * 30)
        tools = habit_mcp_server.list_tools()
        logger.info(f"Found {len(tools)} tools")
        for i, tool in enumerate(tools, 1):
            print(f"{i:2d}. {tool['name']}")
            print(f"    📝 {tool['description']}")
            print()
    
    elif command == "get_user_habits":
        if len(sys.argv) < 3:
            logger.error("user_id required for get_user_habits command")
            print("❌ Error: user_id required")
            print("💡 Example: python app/mcp/habit_tools.py get_user_habits 12345678-1234-1234-1234-123456789012")
            return
        
        user_id = sys.argv[2]
        logger.info(f"Getting habits for user: {user_id}")
        print(f"🔍 Getting habits for user: {user_id}")
        print("=" * 50)
        
        result = await habit_mcp_server.get_user_habits(user_id)
        if result.get("success"):
            habits = result.get("data", [])
            logger.info(f"Found {len(habits)} habits for user: {user_id}")
            print(f"✅ Found {len(habits)} habits:")
            for habit in habits:
                print(f"  📌 {habit['name']} ({habit['habit_type']})")
                print(f"     {habit['description']}")
                print(f"     ID: {habit['id']}")
                print()
        else:
            logger.error(f"Error getting habits for user {user_id}: {result.get('error')}")
            print(f"❌ Error: {result.get('error')}")
    
    elif command == "phone_habits":
        if len(sys.argv) < 3:
            logger.error("phone_number required for phone_habits command")
            print("❌ Error: phone_number required")
            print("💡 Example: python app/mcp/habit_tools.py phone_habits '+60123963698'")
            return
        
        phone_number = sys.argv[2]
        logger.info(f"Getting habits for phone: {phone_number}")
        print(f"📱 Getting habits for phone: {phone_number}")
        print("=" * 50)
        
        result = await habit_mcp_server.get_user_habits_by_phone(phone_number)
        if result.get("success"):
            habits = result.get("data", [])
            user_id = result.get("user_id")
            logger.info(f"Found {len(habits)} habits for phone {phone_number} (user: {user_id})")
            print(f"✅ Found {len(habits)} habits for user {user_id}:")
            for habit in habits:
                print(f"  📌 {habit['name']} ({habit['habit_type']})")
                print(f"     {habit['description']}")
                print()
        else:
            logger.error(f"Error getting habits for phone {phone_number}: {result.get('error')}")
            print(f"❌ Error: {result.get('error')}")
            if result.get("action_required"):
                print(f"💡 {result.get('action_required')}")
    
    elif command == "get_habit":
        if len(sys.argv) < 4:
            print("❌ Error: habit_id and user_id required")
            print("💡 Example: python app/mcp/habit_tools.py get_habit <habit_id> <user_id>")
            return
        
        habit_id = sys.argv[2]
        user_id = sys.argv[3]
        print(f"🎯 Getting habit: {habit_id}")
        print("=" * 50)
        
        result = await habit_mcp_server.get_habit_by_id(habit_id, user_id)
        if result.get("success"):
            habit = result.get("data")
            if habit:
                print(f"✅ Habit Details:")
                print(f"  📌 Name: {habit['name']}")
                print(f"  📝 Description: {habit['description']}")
                print(f"  🏷️ Type: {habit['habit_type']}")
                print(f"  🎨 Color: {habit['color_code']}")
                print(f"  📅 Created: {habit['created_at']}")
            else:
                print("❌ Error: No habit data returned")
        else:
            print(f"❌ Error: {result.get('error')}")
    
    elif command == "get_entries":
        if len(sys.argv) < 3:
            print("❌ Error: habit_id required")
            print("💡 Example: python app/mcp/habit_tools.py get_entries <habit_id>")
            return
        
        habit_id = sys.argv[2]
        print(f"📊 Getting entries for habit: {habit_id}")
        print("=" * 50)
        
        result = await habit_mcp_server.get_habit_entries(habit_id)
        if result.get("success"):
            entries = result.get("data", [])
            print(f"✅ Found {len(entries)} entries:")
            for entry in entries[:10]:  # Show first 10
                status_icon = "✅" if entry['status'] == 'completed' else "⏭️" if entry['status'] == 'skipped' else "⏳"
                print(f"  {entry['entry_date']} {status_icon} {entry['status']}")
                if entry.get('note'):
                    print(f"    💭 {entry['note']}")
            if len(entries) > 10:
                print(f"    ... and {len(entries) - 10} more entries")
        else:
            print(f"❌ Error: {result.get('error')}")
    
    elif command == "create_habit":
        if len(sys.argv) < 6:
            logger.error("create_habit requires: user_id name description habit_type")
            print("❌ Error: create_habit requires: user_id name description habit_type")
            print("💡 Example: python app/mcp/habit_tools.py create_habit 12345678-1234-1234-1234-123456789012 'Swimming' 'Daily swimming for fitness' 'build'")
            return
        
        user_id = sys.argv[2]
        name = sys.argv[3]
        description = sys.argv[4]
        habit_type = sys.argv[5]
        
        logger.info(f"Creating new habit: {name} ({habit_type}) for user: {user_id}")
        print(f"🆕 Creating new habit:")
        print(f"  👤 User: {user_id}")
        print(f"  📌 Name: {name}")
        print(f"  📝 Description: {description}")
        print(f"  🏷️ Type: {habit_type}")
        print("=" * 50)
        
        result = await habit_mcp_server.create_habit(user_id, name, description, habit_type)
        if result.get("success"):
            habit = result.get("data")
            if habit:
                logger.info(f"Successfully created habit: {name} with ID: {habit['id']}")
                print(f"✅ {result.get('message', 'Habit created successfully!')}")
                print(f"  🆔 New Habit ID: {habit['id']}")
            else:
                logger.info(f"Successfully created habit: {name}")
                print("✅ Habit created successfully!")
        else:
            logger.error(f"Error creating habit {name}: {result.get('error')}")
            print(f"❌ Error: {result.get('error')}")
            if result.get("action_required"):
                print(f"💡 {result.get('action_required')}")
    
    elif command == "analytics":
        if len(sys.argv) < 5:
            logger.error("analytics requires: user_id start_date end_date")
            print("❌ Error: analytics requires: user_id start_date end_date")
            print("💡 Example: python app/mcp/habit_tools.py analytics 12345678-1234-1234-1234-123456789012 2025-01-01 2025-01-07")
            return
        
        user_id = sys.argv[2]
        start_date = sys.argv[3]
        end_date = sys.argv[4]
        
        logger.info(f"Running analytics for user {user_id}, period: {start_date} to {end_date}")
        print(f"📊 Analyzing habit performance:")
        print(f"  👤 User: {user_id}")
        print(f"  📅 Period: {start_date} to {end_date}")
        print("=" * 50)
        
        result = await habit_mcp_server.analyze_habit_performance(user_id, [], start_date, end_date)
        if result.get("success"):
            data = result.get("data", {})
            analysis_text = data.get("analysis", "")
            summary = data.get("summary", {})
            logger.info(f"Analytics completed - completion rate: {summary.get('completion_percentage', 0)}%")
            print(analysis_text)
            print("\n📈 Summary Statistics:")
            print(f"  📊 Completion Rate: {summary.get('completion_percentage', 0)}%")
            print(f"  ⏭️ Skip Rate: {summary.get('skip_percentage', 0)}%")
            print(f"  📅 Total Days: {summary.get('total_days', 0)}")
            print(f"  🎯 Habits Analyzed: {summary.get('total_habits', 0)}")
        else:
            logger.error(f"Analytics failed for user {user_id}: {result.get('error')}")
            print(f"❌ Error: {result.get('error')}")
    
    elif command == "formatted_entries":
        if len(sys.argv) < 3:
            logger.error("phone_number required for formatted_entries command")
            print("❌ Error: phone_number required")
            print("💡 Example: python app/mcp/habit_tools.py formatted_entries '+60123963698'")
            return
        
        phone_number = sys.argv[2]
        days = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else 7
        
        logger.info(f"Getting formatted entries for phone: {phone_number}, days: {days}")
        print(f"🎨 Getting formatted entries:")
        print(f"  📱 Phone: {phone_number}")
        print(f"  📅 Days: {days}")
        print("=" * 50)
        
        result = await habit_mcp_server.get_formatted_habit_entries(phone_number, days)
        if result.get("success"):
            logger.info(f"Successfully generated formatted entries for phone: {phone_number}")
            print(result.get("formatted_display", ""))
        else:
            logger.error(f"Error getting formatted entries for phone {phone_number}: {result.get('error')}")
            print(f"❌ Error: {result.get('error')}")
            if result.get("action_required"):
                print(f"💡 {result.get('action_required')}")
    
    elif command == "get_streak":
        if len(sys.argv) < 3:
            logger.error("habit_id required for get_streak command")
            print("❌ Error: habit_id required")
            print("💡 Example: python app/mcp/habit_tools.py get_streak 12345678-1234-1234-1234-123456789012")
            return
        
        habit_id = sys.argv[2]
        logger.info(f"Getting streak for habit: {habit_id}")
        print(f"🔥 Getting streak for habit: {habit_id}")
        print("=" * 50)
        
        result = await habit_mcp_server.get_habit_streak(habit_id)
        if result.get("success"):
            streak_data = result.get("data", {})
            current_streak = streak_data.get("current_streak", 0)
            longest_streak = streak_data.get("longest_streak", 0)
            total_streak = streak_data.get("total_streak", 0)
            last_entry = streak_data.get("last_entry_date", "N/A")
            logger.info(f"Streak data retrieved - Current: {current_streak}, Longest: {longest_streak}")
            print(f"✅ Habit Streak Information:")
            print(f"  🔥 Current Streak: {current_streak} days")
            print(f"  🏆 Longest Streak: {longest_streak} days")
            print(f"  📊 Total Streak: {total_streak} days")
            print(f"  📅 Last Entry: {last_entry}")
        else:
            logger.error(f"Error getting streak for habit {habit_id}: {result.get('error')}")
            print(f"❌ Error: {result.get('error')}")
    
    elif command == "check_habit_exists":
        if len(sys.argv) < 4:
            logger.error("check_habit_exists requires: user_id habit_name")
            print("❌ Error: check_habit_exists requires: user_id habit_name")
            print("💡 Example: python app/mcp/habit_tools.py check_habit_exists 12345678-1234-1234-1234-123456789012 'Reading'")
            return
        
        user_id = sys.argv[2]
        habit_name = sys.argv[3]
        logger.info(f"Checking if habit '{habit_name}' exists for user: {user_id}")
        print(f"🔍 Checking if habit exists:")
        print(f"  👤 User: {user_id}")
        print(f"  📌 Habit: {habit_name}")
        print("=" * 50)
        
        result = await habit_mcp_server.check_habit_exists(user_id, habit_name)
        if result.get("success"):
            exists = result.get("exists", False)
            logger.info(f"Habit '{habit_name}' exists: {exists}")
            if exists:
                habit_data = result.get("habit", {})
                print(f"✅ Habit '{habit_name}' exists!")
                print(f"  🆔 ID: {habit_data.get('id', 'N/A')}")
                print(f"  📝 Description: {habit_data.get('description', 'N/A')}")
                print(f"  🏷️ Type: {habit_data.get('habit_type', 'N/A')}")
            else:
                print(f"❌ Habit '{habit_name}' does not exist for this user")
        else:
            logger.error(f"Error checking habit existence: {result.get('error')}")
            print(f"❌ Error: {result.get('error')}")
    
    elif command == "get_entries_by_user":
        if len(sys.argv) < 5:
            logger.error("get_entries_by_user requires: user_id start_date end_date")
            print("❌ Error: get_entries_by_user requires: user_id start_date end_date")
            print("💡 Example: python app/mcp/habit_tools.py get_entries_by_user 12345678-1234-1234-1234-123456789012 2025-01-01 2025-01-07")
            return
        
        user_id = sys.argv[2]
        start_date = sys.argv[3]
        end_date = sys.argv[4]
        logger.info(f"Getting entries for user {user_id}, period: {start_date} to {end_date}")
        print(f"📊 Getting habit entries for user:")
        print(f"  👤 User: {user_id}")
        print(f"  📅 Period: {start_date} to {end_date}")
        print("=" * 50)
        
        result = await habit_mcp_server.get_habit_entries_by_user(user_id, start_date, end_date)
        if result.get("success"):
            entries = result.get("data", [])
            entries_count = result.get("entries_count", 0)
            habits_count = result.get("habits_count", 0)
            logger.info(f"Retrieved {entries_count} entries for {habits_count} habits")
            print(f"✅ Found {entries_count} entries for {habits_count} habits:")
            
            # Group entries by habit
            entries_by_habit = {}
            for entry in entries:
                habit_name = entry.get("habit_name", "Unknown")
                if habit_name not in entries_by_habit:
                    entries_by_habit[habit_name] = []
                entries_by_habit[habit_name].append(entry)
            
            for habit_name, habit_entries in entries_by_habit.items():
                print(f"\n  📌 {habit_name}:")
                for entry in habit_entries[:10]:  # Show first 10 entries per habit
                    status_icon = "✅" if entry['status'] == 'completed' else "⏭️" if entry['status'] == 'skipped' else "⏳"
                    print(f"    {entry['entry_date']} {status_icon} {entry['status']}")
                    if entry.get('note'):
                        print(f"      💭 {entry['note']}")
                if len(habit_entries) > 10:
                    print(f"    ... and {len(habit_entries) - 10} more entries")
        else:
            logger.error(f"Error getting user entries: {result.get('error')}")
            print(f"❌ Error: {result.get('error')}")
    
    elif command == "analyze_intent":
        if len(sys.argv) < 4:
            logger.error("analyze_intent requires: user_id message")
            print("❌ Error: analyze_intent requires: user_id message")
            print("💡 Example: python app/mcp/habit_tools.py analyze_intent 12345678-1234-1234-1234-123456789012 'show my progress'")
            return
        
        user_id = sys.argv[2]
        message = sys.argv[3]
        logger.info(f"Analyzing intent for user {user_id}, message: {message}")
        print(f"🧠 Analyzing user intent with OpenAI:")
        print(f"  👤 User: {user_id}")
        print(f"  💬 Message: {message}")
        print("=" * 50)
        
        # Get current habits for intent analysis
        habits_result = await habit_mcp_server.get_user_habits(user_id)
        current_habits = []
        if habits_result.get("success"):
            current_habits = [h["name"] for h in habits_result.get("data", [])]
        
        result = await habit_mcp_server.analyze_user_intent(user_id, message, current_habits)
        if result.get("success"):
            intent_data = result.get("data", {})
            openai_data = result.get("openai_analysis", {})
            
            intent = intent_data.get("intent", "unknown")
            confidence = intent_data.get("confidence", 0)
            action = intent_data.get("action", "none")
            suggested_tools = intent_data.get("suggested_tools", [])
            entities = intent_data.get("entities", {})
            guidance = intent_data.get("user_guidance", "")
            analysis_method = intent_data.get("analysis_method", "unknown")
            
            logger.info(f"Intent analysis completed - Intent: {intent}, Confidence: {confidence}")
            print(f"✅ Intent Analysis Results:")
            print(f"  🤖 Analysis Method: {analysis_method}")
            print(f"  🎯 Intent: {intent}")
            print(f"  📊 Confidence: {confidence:.1f}")
            print(f"  🛠️ Suggested Action: {action}")
            print(f"  🔧 Suggested Tools: {', '.join(suggested_tools)}")
            print(f"  📝 Entities: {entities}")
            if guidance:
                print(f"  💡 User Guidance: {guidance}")
            
            # Show OpenAI-specific data if available
            if openai_data:
                print(f"\n🔍 OpenAI Analysis Details:")
                print(f"  🎯 OpenAI Intent: {openai_data.get('openai_intent', 'N/A')}")
                print(f"  📊 Raw Confidence: {openai_data.get('confidence', 0):.3f}")
                print(f"  🔧 Suggested MCP Tool: {openai_data.get('suggested_mcp_tool', 'N/A')}")
                print(f"  ⏰ Analysis Time: {openai_data.get('timestamp', 'N/A')}")
        else:
            logger.error(f"Error analyzing intent: {result.get('error')}")
            print(f"❌ Error: {result.get('error')}")
    
    elif command == "test_intent":
        print("🧠 Testing OpenAI Intent Analysis")
        print("=" * 50)
        
        # Test intent analyser directly
        try:
            from app.intent.intent_analyser import intent_analyser
            
            if not intent_analyser.is_configured():
                print("⚠️ OpenAI not configured. Please set OPENAI_API_KEY environment variable.")
                print("💡 You can still test with fallback analysis.")
            
            test_messages = [
                "I want to create a new habit for daily exercise",
                "I completed my morning workout today",
                "I skipped meditation yesterday", 
                "Show me my progress for the last week",
                "What are my current habits?",
                "Generate an analysis report of my habits",
                "Help me with commands",
                "Hello, good morning",
                "I want to track my water intake daily"
            ]
            
            # Sample context
            context = {
                "user_habits": ["Exercise", "Reading", "Meditation", "Water Intake"],
                "platform": "cli_test"
            }
            
            for i, message in enumerate(test_messages, 1):
                print(f"\n🧪 Test {i}: '{message}'")
                
                result = await intent_analyser.analyze_intent(message, context)
                
                print(f"  Intent: {result['intent']}")
                print(f"  Confidence: {result['confidence']:.3f}")
                print(f"  Method: {result.get('analysis_method', 'N/A')}")
                print(f"  Entities: {result['entities']}")
                print(f"  Suggested Tool: {result.get('suggested_mcp_tool', 'N/A')}")
                print("-" * 30)
                
        except ImportError:
            print("❌ Intent analyser module not found")
            print("💡 Make sure app/intent/intent_analyser.py exists")
        except Exception as e:
            print(f"❌ Error testing intent analyser: {str(e)}")
    
    elif command == "update_entries":
        if len(sys.argv) < 4:
            logger.error("update_entries requires: user_id entries_json")
            print("❌ Error: update_entries requires: user_id entries_json")
            print("💡 Example: python app/mcp/habit_tools.py update_entries 12345678-1234-1234-1234-123456789012 '[{\"habit_name\":\"Reading\",\"entry_date\":\"2025-01-08\",\"status\":\"completed\"}]'")
            return
        
        user_id = sys.argv[2]
        entries_json = sys.argv[3]
        logger.info(f"Updating entries for user {user_id}")
        print(f"📝 Updating habit entries:")
        print(f"  👤 User: {user_id}")
        print("=" * 50)
        
        try:
            entries = json.loads(entries_json)
            if not isinstance(entries, list):
                print("❌ Error: entries must be a JSON array")
                return
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            print(f"❌ Error: Invalid JSON format - {str(e)}")
            print("💡 Example format: '[{\"habit_name\":\"Reading\",\"entry_date\":\"2025-01-08\",\"status\":\"completed\"}]'")
            return
        
        result = await habit_mcp_server.update_habit_entries(user_id, entries)
        if result.get("success"):
            logger.info(f"Successfully updated {len(entries)} habit entries")
            print(f"✅ Successfully updated {len(entries)} habit entries")
            print(f"  📊 Entries processed: {len(entries)}")
            for entry in entries:
                habit_name = entry.get("habit_name", "Unknown")
                entry_date = entry.get("entry_date", "N/A")
                status = entry.get("status", "N/A")
                print(f"    {entry_date} - {habit_name}: {status}")
        else:
            logger.error(f"Error updating entries: {result.get('error')}")
            print(f"❌ Error: {result.get('error')}")
    
    # Keep the original detailed commands for backwards compatibility
    elif command in ["get_habit_by_id", "get_habit_entries", "get_habit_streak", "get_user_habits_by_phone", "check_habit_exists", "analyze_performance", "get_entries_by_user", "update_entries", "analyze_intent"]:
        print(f"⚠️ Command '{command}' is available but deprecated.")
        print("💡 Please use the newer simplified commands instead:")
        print("   - Use 'get_habit' instead of 'get_habit_by_id'")
        print("   - Use 'get_entries' instead of 'get_habit_entries'")
        print("   - Use 'get_streak' instead of 'get_habit_streak'")
        print("   - Use 'phone_habits' instead of 'get_user_habits_by_phone'")
        print("   - Use 'check_habit_exists' for habit existence checks")
        print("   - Use 'analytics' instead of 'analyze_performance'")
        print("   - Use 'get_entries_by_user' for user entries")
        print("   - Use 'update_entries' for updating entries")
        print("   - Use 'analyze_intent' for intent analysis")
        print("   - Use 'formatted_entries' instead of 'get_formatted_entries'")
    
    else:
        logger.warning(f"Unknown command: {command}")
        print(f"❌ Unknown command: {command}")
        print("\n💡 Available commands:")
        print("   test_all, test_phone_flow, list_tools, get_user_habits, phone_habits")
        print("   get_habit, get_entries, get_streak, create_habit, check_habit_exists")
        print("   update_entries, get_entries_by_user, analytics, analyze_intent, formatted_entries")
        print("\n📚 For help: python app/mcp/habit_tools.py")
    
    logger.info("CLI interface completed")


if __name__ == "__main__":
    logger.info("Starting habit_tools.py main function")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Program interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error in main: {str(e)}")
        raise
    finally:
        logger.info("Habit Tools MCP Server shutting down")
