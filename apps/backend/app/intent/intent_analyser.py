"""
Intent Analyser for Natural Language Processing
Uses OpenAI to understand user intentions across all platforms and domains
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

try:
    import openai
except ImportError:
    openai = None

logger = logging.getLogger(__name__)

class IntentAnalyser:
    """
    Natural Language Intent Analyser using OpenAI
    Understands user intentions for habit tracking and other domains
    """
    
    def __init__(self):
        """Initialize the Intent Analyser with OpenAI configuration"""
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("OpenAI API key not found. Intent analysis will not work.")
            self.configured = False
            return
        
        if openai is None:
            logger.error("OpenAI library not installed. Run: pip install openai")
            self.configured = False
            return
        
        # Configure for OpenAI v1.x
        self.configured = True
        
        # Model configuration
        self.model = "gpt-3.5-turbo"  # or "gpt-4" if available
        self.max_tokens = 300
        self.temperature = 0.1  # Low temperature for consistent intent detection
        
        logger.info("Intent Analyser initialized successfully")
    
    def is_configured(self) -> bool:
        """Check if the intent analyser is properly configured"""
        return self.configured
    
    async def analyze_intent(self, message: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Analyze user message to understand intent using OpenAI
        
        Args:
            message: User's message to analyze
            context: Optional context (user habits, platform, etc.)
            
        Returns:
            Dict containing intent, entities, confidence, and suggested actions
        """
        if not self.configured:
            logger.error("Intent analyser not configured. Please set OPENAI_API_KEY.")
            return self._fallback_intent_analysis(message)
        
        try:
            # Prepare context for better analysis
            user_habits = context.get("user_habits", []) if context else []
            platform = context.get("platform", "whatsapp") if context else "whatsapp"
            
            # Create the prompt for OpenAI
            prompt = self._create_intent_prompt(message, user_habits, platform)
            
            # Call OpenAI API
            response = await self._call_openai_api(prompt)
            
            if response:
                return self._parse_openai_response(response, message)
            else:
                return self._fallback_intent_analysis(message)
                
        except Exception as e:
            logger.error(f"Error analyzing intent: {str(e)}")
            return self._fallback_intent_analysis(message)
    
    def _create_intent_prompt(self, message: str, user_habits: List[str], platform: str) -> str:
        """Create a structured prompt for OpenAI intent analysis"""
        
        habits_context = ""
        if user_habits:
            habits_context = f"\nUser's current habits: {', '.join(user_habits)}"
        
        prompt = f"""
You are an AI assistant for a habit tracking application. Analyze the user's message and return a JSON response with their intent.

User message: "{message}"
Platform: {platform}{habits_context}

Analyze the intent and return a JSON object with these fields:
{{
    "intent": "one of: create_habit, log_habit_completion, log_habit_skip, show_progress, show_habits, get_analytics, help, greeting, unknown",
    "confidence": "float between 0.0 and 1.0",
    "entities": {{
        "habit_name": "extracted habit name if mentioned",
        "habit_type": "build/break/track if creating habit",
        "habit_description": "description if creating habit", 
        "status": "completed/skipped if logging",
        "date": "date if mentioned (YYYY-MM-DD format)",
        "time_period": "days/weeks if asking for progress",
        "action": "specific action the user wants"
    }},
    "suggested_mcp_tool": "best MCP tool to handle this request",
    "user_guidance": "helpful response if intent is unclear"
}}

Intent definitions:
- create_habit: User wants to create/add a new habit
- log_habit_completion: User completed a habit (I did, I finished, I completed, etc.)
- log_habit_skip: User skipped a habit (I skipped, I missed, etc.) 
- show_progress: User wants to see their progress/entries/tracking
- show_habits: User wants to list their habits
- get_analytics: User wants analysis/reports/statistics
- help: User needs help or commands
- greeting: General greeting/hello
- unknown: Cannot determine intent

Only return valid JSON. Be precise with entity extraction.
"""
        return prompt
    
    async def _call_openai_api(self, prompt: str) -> Optional[str]:
        """Call OpenAI API with the intent analysis prompt"""
        try:
            # Check if openai is available
            if openai is None:
                logger.error("OpenAI library not available")
                return None
                
            # Use OpenAI v1.x API (current version)
            client = openai.OpenAI(api_key=self.api_key)
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a precise intent analysis AI. Always return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature
            )
            
            # Handle potential None content
            content = response.choices[0].message.content
            return content.strip() if content else None
                
        except Exception as e:
            logger.error(f"OpenAI API call failed: {str(e)}")
            return None
    
    def _parse_openai_response(self, response: str, original_message: str) -> Dict[str, Any]:
        """Parse OpenAI response and return structured intent data"""
        try:
            # Clean the response (remove code blocks if present)
            cleaned_response = response.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()
            
            # Parse JSON
            intent_data = json.loads(cleaned_response)
            
            # Validate required fields
            required_fields = ["intent", "confidence", "entities"]
            for field in required_fields:
                if field not in intent_data:
                    logger.warning(f"Missing required field '{field}' in OpenAI response")
                    return self._fallback_intent_analysis(original_message)
            
            # Add metadata
            intent_data["analysis_method"] = "openai"
            intent_data["original_message"] = original_message
            intent_data["timestamp"] = datetime.now().isoformat()
            
            # Ensure confidence is a float
            try:
                intent_data["confidence"] = float(intent_data["confidence"])
            except (ValueError, TypeError):
                intent_data["confidence"] = 0.5
            
            # Clean up entities (remove None values)
            entities = intent_data.get("entities", {})
            intent_data["entities"] = {k: v for k, v in entities.items() if v is not None and v != ""}
            
            logger.info(f"OpenAI intent analysis: {intent_data['intent']} (confidence: {intent_data['confidence']})")
            return intent_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI JSON response: {str(e)}")
            logger.debug(f"Raw response: {response}")
            return self._fallback_intent_analysis(original_message)
        except Exception as e:
            logger.error(f"Error parsing OpenAI response: {str(e)}")
            return self._fallback_intent_analysis(original_message)
    
    def _fallback_intent_analysis(self, message: str) -> Dict[str, Any]:
        """Fallback intent analysis when OpenAI is not available"""
        logger.warning("Using fallback intent analysis (basic keyword matching)")
        
        message_lower = message.lower().strip()
        
        # Basic keyword-based fallback
        if any(word in message_lower for word in ["create", "add", "new habit", "start tracking"]):
            intent = "create_habit"
            confidence = 0.6
        elif any(word in message_lower for word in ["completed", "finished", "did", "done"]):
            intent = "log_habit_completion" 
            confidence = 0.6
        elif any(word in message_lower for word in ["skipped", "missed", "didn't"]):
            intent = "log_habit_skip"
            confidence = 0.6
        elif any(word in message_lower for word in ["progress", "entries", "tracking"]):
            intent = "show_progress"
            confidence = 0.6
        elif any(word in message_lower for word in ["habits", "list", "show my"]):
            intent = "show_habits" 
            confidence = 0.6
        elif any(word in message_lower for word in ["analysis", "analytics", "report", "stats"]):
            intent = "get_analytics"
            confidence = 0.6
        elif any(word in message_lower for word in ["help", "commands", "what can"]):
            intent = "help"
            confidence = 0.7
        elif any(word in message_lower for word in ["hello", "hi", "good morning"]):
            intent = "greeting"
            confidence = 0.7
        else:
            intent = "unknown"
            confidence = 0.3
        
        return {
            "intent": intent,
            "confidence": confidence,
            "entities": {},
            "analysis_method": "fallback",
            "original_message": message,
            "timestamp": datetime.now().isoformat(),
            "suggested_mcp_tool": self._get_suggested_tool(intent),
            "user_guidance": "Please be more specific about what you'd like to do with your habits."
        }
    
    def _get_suggested_tool(self, intent: str) -> str:
        """Map intent to suggested MCP tool"""
        tool_mapping = {
            "create_habit": "create_habit",
            "log_habit_completion": "update_habit_entries",
            "log_habit_skip": "update_habit_entries", 
            "show_progress": "get_formatted_habit_entries",
            "show_habits": "get_user_habits_by_phone",
            "get_analytics": "analyze_habit_performance",
            "help": "help_message",
            "greeting": "default_response",
            "unknown": "default_response"
        }
        return tool_mapping.get(intent, "default_response")


# Global instance for easy import
intent_analyser = IntentAnalyser()


# Comprehensive CLI testing interface
async def run_comprehensive_intent_analyser_test_cases():
    """
    Run comprehensive test cases for Intent Analyser 
    70+ test cases covering all intent analysis scenarios with OpenAI and fallback
    """
    print("🧠 **COMPREHENSIVE INTENT ANALYSER TEST CASES - 70+ AI Analysis Tests**")
    print("=" * 80)
    
    analyser = IntentAnalyser()
    
    # Check configuration status
    if analyser.is_configured():
        print("✅ **OpenAI Configuration:** Configured with API key")
        print(f"🤖 **Model:** {analyser.model}")
        print(f"🌡️ **Temperature:** {analyser.temperature}")
    else:
        print("⚠️ **OpenAI Configuration:** Not configured - using fallback analysis")
    
    # Define comprehensive test cases covering all intent scenarios
    test_cases = [
        {
            "category": "🎯 Habit Creation Intents (12 cases)",
            "cases": [
                {"message": "I want to create a new habit", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "create_habit", "description": "Generic habit creation request"},
                {"message": "Create habit: Morning Reading - Read for 30 minutes every morning - build", "context": {"user_habits": [], "platform": "whatsapp"}, "expected_intent": "create_habit", "description": "Structured habit creation with full details"},
                {"message": "add a new exercise routine", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "create_habit", "description": "Add new exercise habit"},
                {"message": "I'd like to start tracking my water intake", "context": {"user_habits": ["Exercise", "Reading"], "platform": "whatsapp"}, "expected_intent": "create_habit", "description": "Start tracking type habit"},
                {"message": "help me build a meditation habit", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "create_habit", "description": "Build habit request with help"},
                {"message": "new habit for journaling", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "create_habit", "description": "Short creation request"},
                {"message": "I want to quit smoking", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "create_habit", "description": "Break habit creation"},
                {"message": "start a workout routine", "context": {"user_habits": [], "platform": "whatsapp"}, "expected_intent": "create_habit", "description": "Start routine habit"},
                {"message": "track my sleep schedule", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "create_habit", "description": "Sleep tracking habit"},
                {"message": "create morning routine habit", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "create_habit", "description": "Morning routine creation"},
                {"message": "I want to build a healthy eating habit", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "create_habit", "description": "Healthy eating habit creation"},
                {"message": "add daily vitamin taking", "context": {"user_habits": ["Exercise", "Reading"], "platform": "whatsapp"}, "expected_intent": "create_habit", "description": "Daily vitamin habit"}
            ]
        },
        {
            "category": "✅ Habit Completion Logging (15 cases)",
            "cases": [
                {"message": "I completed my workout today", "context": {"user_habits": ["Workout", "Reading"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Standard completion logging"},
                {"message": "I did my morning reading", "context": {"user_habits": ["Reading", "Exercise"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Did completion variant"},
                {"message": "finished my meditation session", "context": {"user_habits": ["Meditation"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Finished completion variant"},
                {"message": "I accomplished my daily walk", "context": {"user_habits": ["Walking"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Accomplished completion"},
                {"message": "done with exercise for today", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Done completion variant"},
                {"message": "workout complete", "context": {"user_habits": ["Workout"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Brief completion message"},
                {"message": "I just finished my journaling", "context": {"user_habits": ["Journaling"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Just finished variant"},
                {"message": "completed my daily water goal", "context": {"user_habits": ["Water Intake"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Goal completion"},
                {"message": "I achieved my reading target today", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Achievement completion"},
                {"message": "exercise done for the day", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Done for day variant"},
                {"message": "I have completed my morning routine", "context": {"user_habits": ["Morning Routine"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Formal completion"},
                {"message": "successfully did my meditation", "context": {"user_habits": ["Meditation"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Successfully completed"},
                {"message": "I managed to complete my workout", "context": {"user_habits": ["Workout"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Managed to complete"},
                {"message": "got my vitamins done", "context": {"user_habits": ["Vitamins"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Got done variant"},
                {"message": "checked off my daily reading", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "log_habit_completion", "description": "Checked off completion"}
            ]
        },
        {
            "category": "❌ Habit Skip/Miss Logging (10 cases)",
            "cases": [
                {"message": "I skipped my workout today", "context": {"user_habits": ["Workout"], "platform": "whatsapp"}, "expected_intent": "log_habit_skip", "description": "Standard skip logging"},
                {"message": "I missed my morning reading", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "log_habit_skip", "description": "Missed habit variant"},
                {"message": "didn't do my meditation today", "context": {"user_habits": ["Meditation"], "platform": "whatsapp"}, "expected_intent": "log_habit_skip", "description": "Didn't do variant"},
                {"message": "I failed to complete my exercise", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "log_habit_skip", "description": "Failed to complete"},
                {"message": "couldn't manage my daily walk", "context": {"user_habits": ["Walking"], "platform": "whatsapp"}, "expected_intent": "log_habit_skip", "description": "Couldn't manage variant"},
                {"message": "I forgot my vitamins today", "context": {"user_habits": ["Vitamins"], "platform": "whatsapp"}, "expected_intent": "log_habit_skip", "description": "Forgot habit"},
                {"message": "missed my journaling session", "context": {"user_habits": ["Journaling"], "platform": "whatsapp"}, "expected_intent": "log_habit_skip", "description": "Missed session"},
                {"message": "I wasn't able to do my workout", "context": {"user_habits": ["Workout"], "platform": "whatsapp"}, "expected_intent": "log_habit_skip", "description": "Wasn't able to do"},
                {"message": "skipped meditation due to busy schedule", "context": {"user_habits": ["Meditation"], "platform": "whatsapp"}, "expected_intent": "log_habit_skip", "description": "Skip with reason"},
                {"message": "no time for reading today", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "log_habit_skip", "description": "No time variant"}
            ]
        },
        {
            "category": "📊 Progress & Tracking Display (12 cases)",
            "cases": [
                {"message": "show my progress", "context": {"user_habits": ["Exercise", "Reading"], "platform": "whatsapp"}, "expected_intent": "show_progress", "description": "Basic progress request"},
                {"message": "how am I doing?", "context": {"user_habits": ["Exercise", "Reading", "Meditation"], "platform": "whatsapp"}, "expected_intent": "show_progress", "description": "Performance inquiry"},
                {"message": "display my habit entries", "context": {"user_habits": ["Workout"], "platform": "whatsapp"}, "expected_intent": "show_progress", "description": "Entries display request"},
                {"message": "what's my tracking looking like?", "context": {"user_habits": ["Reading", "Exercise"], "platform": "whatsapp"}, "expected_intent": "show_progress", "description": "Tracking status inquiry"},
                {"message": "show my habit tracking for this week", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "show_progress", "description": "Weekly tracking request"},
                {"message": "can I see my progress for the last month?", "context": {"user_habits": ["Reading", "Meditation"], "platform": "whatsapp"}, "expected_intent": "show_progress", "description": "Monthly progress request"},
                {"message": "get my habit entries", "context": {"user_habits": ["Exercise", "Reading"], "platform": "whatsapp"}, "expected_intent": "show_progress", "description": "Get entries command"},
                {"message": "how did I do yesterday?", "context": {"user_habits": ["Workout"], "platform": "whatsapp"}, "expected_intent": "show_progress", "description": "Yesterday's performance"},
                {"message": "check my habit status", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "show_progress", "description": "Status check request"},
                {"message": "view my tracking data", "context": {"user_habits": ["Exercise", "Meditation"], "platform": "whatsapp"}, "expected_intent": "show_progress", "description": "View tracking data"},
                {"message": "show me my habit completion rates", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "show_progress", "description": "Completion rates request"},
                {"message": "what are my streaks?", "context": {"user_habits": ["Exercise", "Reading"], "platform": "whatsapp"}, "expected_intent": "show_progress", "description": "Streaks inquiry"}
            ]
        },
        {
            "category": "📋 Habit List Display (8 cases)",
            "cases": [
                {"message": "show my habits", "context": {"user_habits": ["Exercise", "Reading"], "platform": "whatsapp"}, "expected_intent": "show_habits", "description": "Basic habit list request"},
                {"message": "list all my habits", "context": {"user_habits": ["Exercise", "Reading", "Meditation"], "platform": "whatsapp"}, "expected_intent": "show_habits", "description": "List all habits"},
                {"message": "what habits do I have?", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "show_habits", "description": "What habits inquiry"},
                {"message": "display my current habits", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "show_habits", "description": "Current habits display"},
                {"message": "get my habit list", "context": {"user_habits": ["Exercise", "Reading"], "platform": "whatsapp"}, "expected_intent": "show_habits", "description": "Get habit list command"},
                {"message": "what am I tracking?", "context": {"user_habits": ["Water Intake", "Exercise"], "platform": "whatsapp"}, "expected_intent": "show_habits", "description": "What tracking inquiry"},
                {"message": "show me all my active habits", "context": {"user_habits": ["Reading", "Meditation"], "platform": "whatsapp"}, "expected_intent": "show_habits", "description": "Active habits request"},
                {"message": "habit overview", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "show_habits", "description": "Habit overview request"}
            ]
        },
        {
            "category": "📈 Analytics & Reports (8 cases)",
            "cases": [
                {"message": "generate analysis report", "context": {"user_habits": ["Exercise", "Reading"], "platform": "whatsapp"}, "expected_intent": "get_analytics", "description": "Analysis report request"},
                {"message": "show me statistics", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "get_analytics", "description": "Statistics request"},
                {"message": "I want habit analytics", "context": {"user_habits": ["Reading", "Meditation"], "platform": "whatsapp"}, "expected_intent": "get_analytics", "description": "Analytics request"},
                {"message": "performance analysis please", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "get_analytics", "description": "Performance analysis"},
                {"message": "give me a report on my habits", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "get_analytics", "description": "Habit report request"},
                {"message": "analyze my habit performance", "context": {"user_habits": ["Exercise", "Reading"], "platform": "whatsapp"}, "expected_intent": "get_analytics", "description": "Performance analysis request"},
                {"message": "what are my completion stats?", "context": {"user_habits": ["Meditation"], "platform": "whatsapp"}, "expected_intent": "get_analytics", "description": "Completion statistics"},
                {"message": "monthly habit report", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "get_analytics", "description": "Monthly report request"}
            ]
        },
        {
            "category": "❓ Help & Support (6 cases)",
            "cases": [
                {"message": "help", "context": {"user_habits": [], "platform": "whatsapp"}, "expected_intent": "help", "description": "Basic help request"},
                {"message": "what can you do?", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "help", "description": "Capabilities inquiry"},
                {"message": "show me commands", "context": {"user_habits": [], "platform": "whatsapp"}, "expected_intent": "help", "description": "Commands request"},
                {"message": "I need help with habits", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "help", "description": "Help with habits"},
                {"message": "how do I use this?", "context": {"user_habits": [], "platform": "whatsapp"}, "expected_intent": "help", "description": "Usage help"},
                {"message": "what are the available options?", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "help", "description": "Available options inquiry"}
            ]
        },
        {
            "category": "👋 Greetings & Social (5 cases)",
            "cases": [
                {"message": "hello", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "greeting", "description": "Basic greeting"},
                {"message": "good morning", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "greeting", "description": "Morning greeting"},
                {"message": "hi there", "context": {"user_habits": [], "platform": "whatsapp"}, "expected_intent": "greeting", "description": "Casual greeting"},
                {"message": "hey", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "greeting", "description": "Informal greeting"},
                {"message": "good evening", "context": {"user_habits": ["Meditation"], "platform": "whatsapp"}, "expected_intent": "greeting", "description": "Evening greeting"}
            ]
        },
        {
            "category": "❓ Unknown & Edge Cases (8 cases)",
            "cases": [
                {"message": "random unclear message", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "unknown", "description": "Unclear message"},
                {"message": "asdfghj", "context": {"user_habits": [], "platform": "whatsapp"}, "expected_intent": "unknown", "description": "Gibberish text"},
                {"message": "weather forecast", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "unknown", "description": "Off-topic request"},
                {"message": "1234567890", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "unknown", "description": "Numbers only"},
                {"message": "😀😀😀", "context": {"user_habits": [], "platform": "whatsapp"}, "expected_intent": "unknown", "description": "Emojis only"},
                {"message": "", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "unknown", "description": "Empty message"},
                {"message": "what is the capital of France?", "context": {"user_habits": ["Reading"], "platform": "whatsapp"}, "expected_intent": "unknown", "description": "Unrelated question"},
                {"message": "buy groceries", "context": {"user_habits": ["Exercise"], "platform": "whatsapp"}, "expected_intent": "unknown", "description": "Non-habit related task"}
            ]
        }
    ]
    
    # Calculate total test cases
    total_cases = sum(len(cat['cases']) for cat in test_cases)
    
    print(f"📊 **Total Test Cases:** {total_cases}")
    print(f"🧪 **Testing Method:** {'OpenAI + Fallback' if analyser.is_configured() else 'Fallback Only'}")
    print("🎯 **Each test shows: Message → Context → Expected → Actual → Confidence → Status**")
    print()
    
    # Track test results
    test_results = {"total": 0, "passed": 0, "failed": 0, "errors": [], "openai_used": 0, "fallback_used": 0}
    
    # Run test cases and show results
    for category_data in test_cases:
        category = category_data["category"]
        cases = category_data["cases"]
        
        print(f"\n{category}")
        print("=" * 70)
        
        for i, test_case in enumerate(cases, 1):
            message = test_case["message"]
            context = test_case["context"]
            expected_intent = test_case["expected_intent"]
            description = test_case["description"]
            
            print(f"\n{i:2d}. **{description}**")
            print(f"    💬 MESSAGE:   '{message}'")
            print(f"    🔧 CONTEXT:   {context}")
            print(f"    🎯 EXPECTED:  {expected_intent}")
            
            # Actually run the intent analysis
            try:
                print(f"    🧪 ANALYZING...")
                
                result = await analyser.analyze_intent(message, context)
                
                test_results["total"] += 1
                actual_intent = result.get("intent", "unknown")
                confidence = result.get("confidence", 0.0)
                analysis_method = result.get("analysis_method", "unknown")
                
                # Track analysis method usage
                if analysis_method == "openai":
                    test_results["openai_used"] += 1
                elif analysis_method == "fallback":
                    test_results["fallback_used"] += 1
                
                print(f"    📤 ACTUAL:    {actual_intent}")
                print(f"    📊 CONFIDENCE: {confidence:.2f}")
                print(f"    🔍 METHOD:    {analysis_method}")
                
                # Check if intent matches
                if actual_intent == expected_intent:
                    print(f"    ✅ STATUS:    SUCCESS - Intent correctly identified")
                    test_results["passed"] += 1
                else:
                    print(f"    ❌ STATUS:    FAILED - Expected {expected_intent}, got {actual_intent}")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"'{message}' → Expected: {expected_intent}, Got: {actual_intent}")
                
                # Show entities if any
                entities = result.get("entities", {})
                if entities:
                    print(f"    🏷️ ENTITIES:  {entities}")
                    
            except Exception as e:
                print(f"    📤 ACTUAL:    [EXCEPTION] {str(e)}")
                print(f"    💥 STATUS:    EXCEPTION - {str(e)}")
                test_results["total"] += 1
                test_results["failed"] += 1
                test_results["errors"].append(f"'{message}' → EXCEPTION: {str(e)}")
            
            print("-" * 60)
    
    # Comprehensive Summary
    print(f"\n🧠 **COMPREHENSIVE INTENT ANALYSIS TESTING SUMMARY**")
    print("=" * 80)
    success_rate = (test_results["passed"] / test_results["total"]) * 100 if test_results["total"] > 0 else 0
    
    print(f"📊 **Test Results:**")
    print(f"   🧪 Total Test Cases: {test_results['total']}")
    print(f"   ✅ Passed: {test_results['passed']}")
    print(f"   ❌ Failed: {test_results['failed']}")
    print(f"   📈 Success Rate: {success_rate:.1f}%")
    
    print(f"\n🔍 **Analysis Methods Used:**")
    print(f"   🤖 OpenAI API: {test_results['openai_used']} cases")
    print(f"   🔄 Fallback: {test_results['fallback_used']} cases")
    
    if test_results["errors"]:
        print(f"\n❌ **Errors Encountered ({len(test_results['errors'])}):**")
        for i, error in enumerate(test_results["errors"][:10], 1):  # Show first 10 errors
            print(f"   {i:2d}. {error}")
        if len(test_results["errors"]) > 10:
            print(f"   ... and {len(test_results['errors']) - 10} more errors")
    
    print(f"\n🚀 **Next Steps:**")
    print(f"   1. Fix any failed intent classifications")
    print(f"   2. Test integration: python -m app.service.whatsapp_ai_manager test_cases")
    print(f"   3. Test MCP tools: python -m app.mcp.habit_tools test_comprehensive")
    print(f"   4. Verify end-to-end WhatsApp flow")
    print(f"   5. Validate OpenAI API response parsing")
    
    return test_results


async def test_intent_analyser():
    """Basic test function for backward compatibility"""
    print("🧠 Running Basic Intent Analyser Tests")
    print("💡 For comprehensive testing, use: run_comprehensive_intent_analyser_test_cases()")
    print("-" * 50)
    
    return await run_comprehensive_intent_analyser_test_cases()


if __name__ == "__main__":
    import asyncio
    asyncio.run(run_comprehensive_intent_analyser_test_cases()) 