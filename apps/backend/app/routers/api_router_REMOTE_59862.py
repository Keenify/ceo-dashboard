from fastapi import APIRouter

# Import the specific API routers
from app.api import journal_entries, journal_templates, journal_questions, todo_tabs, todo_lists, todos, habits, module_status
from app.api import weekly_ryhthms, manifestation, flywheel, travel_transactions, cashflow
# Import the new networth_entries router
from app.api import networth_entries
# Import the credit_card_instructions router
from app.api import credit_card_instructions
# Import the five_percent_reviews router
from app.api import five_percent_reviews
# Import the future_letters router
from app.api import future_letters
# Import the user_google_tokens router
from app.api import user_google_tokens
# Import the weekly_design_system router
from app.api import weekly_design_system
# Import the bucket_list_items router
from app.api import bucket_list_items
# Import the ikigai router
from app.api import ikigai
# Import the payment_reminders router
from app.api import payment_reminders
# Import the user_settings router
from app.api import user_settings
# Import the stripe router
from app.api import stripe
# Import the user_modules router
from app.api import user_modules
# Import the planka_onboarding router
from app.api import planka_onboarding
# Import the mindmaps router
from app.api import mindmaps

# Create the main API router
api_router = APIRouter()

# Include journal-related routers
api_router.include_router(journal_entries.router, prefix="/journal-entries", tags=["Journal Entries"])
api_router.include_router(journal_templates.router, prefix="/journal-templates", tags=["Journal Templates"])
api_router.include_router(journal_questions.router, prefix="/journal-questions", tags=["Journal Questions"])

# Include other routers
api_router.include_router(todo_tabs.router, prefix="/todo-tabs", tags=["Todo Tabs"])
api_router.include_router(todo_lists.router, prefix="/todo-lists", tags=["Todo Lists"])
api_router.include_router(todos.router, prefix="/todos", tags=["Todos"])
api_router.include_router(habits.router, prefix="/habits", tags=["Habits"])
api_router.include_router(weekly_ryhthms.router, prefix="/weekly-rhythms", tags=["Weekly Rhythms"])
api_router.include_router(manifestation.router, prefix="/manifestation", tags=["Manifestation"])
api_router.include_router(module_status.router, prefix="/module-status", tags=["Module Status"])
api_router.include_router(flywheel.router, prefix="/flywheels", tags=["Flywheels"])
api_router.include_router(travel_transactions.router, prefix="/travel-transactions", tags=["Travel Transactions"])
api_router.include_router(cashflow.router, prefix="/cashflows", tags=["Cashflow"])

# Include the new networth_entries router
api_router.include_router(networth_entries.router, prefix="/networth-entries", tags=["Networth Entries"])

# Include the credit_card_instructions router
api_router.include_router(credit_card_instructions.router, prefix="/credit-card-instructions", tags=["Credit Card Instructions"])

# Include the five_percent_reviews router
api_router.include_router(five_percent_reviews.router, prefix="/five-percent-reviews", tags=["Five Percent Reviews"])

# Include the future_letters router
api_router.include_router(future_letters.router, prefix="/future-letters", tags=["Future Letters"])

# Include the user_google_tokens router
api_router.include_router(user_google_tokens.router, prefix="/user-google-tokens", tags=["User Google Tokens"])

# Include the weekly design system router
api_router.include_router(weekly_design_system.router, prefix="/weekly-design-system", tags=["Weekly Design System"])

# Include the bucket list items router
api_router.include_router(bucket_list_items.router, prefix="/bucket-list-items", tags=["Bucket List Items"])

# Include the ikigai router
api_router.include_router(ikigai.router, prefix="/ikigai", tags=["Ikigai"])

# Include the payment_reminders router
api_router.include_router(payment_reminders.router, prefix="/payment-reminders", tags=["Payment Reminders"])

# Include the user_settings router
api_router.include_router(user_settings.router, prefix="/user-settings", tags=["User Settings"])

# Include the stripe router
api_router.include_router(stripe.router, prefix="/stripe", tags=["Stripe"])

# Include the user_modules router
api_router.include_router(user_modules.router, prefix="/user-modules", tags=["User Modules"])

# Include the planka_onboarding router
api_router.include_router(planka_onboarding.router, prefix="/planka", tags=["Planka Onboarding"])

# Include the mindmaps router
api_router.include_router(mindmaps.router, prefix="/mindmaps", tags=["Mindmaps"])

# Add other routers here in the future, e.g.:
# from app.api import users
# api_router.include_router(users.router, prefix="/users", tags=["Users"])
