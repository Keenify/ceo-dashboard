import os
import asyncio
import warnings
from typing import Optional, Dict, Any
from dotenv import load_dotenv
import asyncpg
from datetime import datetime

# Load environment variables
load_dotenv()

# Suppress bcrypt warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

# Simple password hashing function that handles bcrypt issues gracefully
def hash_password(password: str) -> str:
    """Hash password using bcrypt with error handling"""
    try:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.hash(password)
    except Exception as e:
        # Fallback to a simpler bcrypt approach if passlib fails
        try:
            import bcrypt
            salt = bcrypt.gensalt()
            return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        except Exception as e2:
            raise Exception(f"Password hashing failed: {e2}")

class PlankaUserManager:
    """Service class for managing Planka users"""
    
    def __init__(self):
        # Database connection
        self.planka_db_url = os.getenv("PLANKA_DATABASE_URL", "postgresql://postgres@localhost:5433/planka")
        
        # User settings
        self.default_password = os.getenv("PLANKA_DEFAULT_USER_PASSWORD", "P@55w0rd")
        
        # Admin settings
        self.admin_username = os.getenv("PLANKA_ADMIN_USERNAME", "admin")
        self.admin_password = os.getenv("PLANKA_ADMIN_PASSWORD", "admin123")
        
        print(f"[PLANKA] Database URL: {self.planka_db_url}")
        print(f"[PLANKA] Default Password: {self.default_password}")
        print(f"[PLANKA] Admin Username: {self.admin_username}")
        
        if not self.planka_db_url:
            raise ValueError("[PLANKA] PLANKA_DATABASE_URL is not set")
    
    async def get_connection(self) -> asyncpg.Connection:
        """Get connection to Planka PostgreSQL database"""
        try:
            print(f"🔄 Connecting to database...")
            conn = await asyncio.wait_for(
                asyncpg.connect(self.planka_db_url), 
                timeout=10.0
            )
            print("✅ Database connection established")
            return conn
        except asyncio.TimeoutError:
            raise Exception("⏱️ Database connection timeout after 10 seconds")
        except Exception as e:
            raise Exception(f"❌ Failed to connect to database: {e}")
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        return hash_password(password)
    
    async def check_user_exists(self, email: str) -> Optional[Dict[str, Any]]:
        """Check if user exists in Planka database"""
        conn = None
        try:
            conn = await self.get_connection()
            
            query = """
                SELECT id, email, username, name, role, created_at, updated_at
                FROM user_account 
                WHERE email = $1
            """
            row = await conn.fetchrow(query, email)
            
            if row:
                return dict(row)
            return None
            
        except Exception as e:
            raise Exception(f"Error checking user existence: {e}")
        finally:
            if conn:
                await conn.close()
    
    async def create_user(self, email: str, username: str = None, name: str = None, role: str = "projectOwner") -> Dict[str, Any]:
        """Create a new user in Planka database"""
        conn = None
        try:
            conn = await self.get_connection()
            
            # Generate username from email if not provided
            if not username:
                username = email.split('@')[0]
            
            # Generate name from email if not provided  
            if not name:
                name = email.split('@')[0].replace('.', ' ').title()
            
            # Hash the default password
            hashed_password = self.hash_password(self.default_password)
            
            # Current timestamp
            now = datetime.now()
            
            # Insert user with all required fields based on schema (using correct Planka defaults)
            insert_query = """
                INSERT INTO user_account (
                    email, password, role, name, username,
                    subscribe_to_own_cards, subscribe_to_card_when_commenting,
                    turn_off_recent_card_highlighting, enable_favorites_by_default,
                    default_editor_mode, default_home_view, default_projects_order,
                    is_sso_user, is_deactivated, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING id, email, username, name, role, created_at, updated_at
            """
            
            row = await conn.fetchrow(
                insert_query,
                email,                          # email
                hashed_password,                # password
                role,                           # role
                name,                           # name
                username,                       # username
                False,                          # subscribe_to_own_cards (was True)
                True,                           # subscribe_to_card_when_commenting
                False,                          # turn_off_recent_card_highlighting
                False,                          # enable_favorites_by_default (was True)
                'wysiwyg',                      # default_editor_mode (was 'rich')
                'groupedProjects',              # default_home_view (was 'projects')
                'byDefault',                    # default_projects_order (was 'name')
                False,                          # is_sso_user
                False,                          # is_deactivated
                now,                            # created_at
                now                             # updated_at
            )
            
            result = dict(row)
            result['password_used'] = self.default_password  # Include password for reference
            
            print(f"✅ User created successfully:")
            print(f"   📧 Email: {result['email']}")
            print(f"   👤 Username: {result['username']}")
            print(f"   🎭 Name: {result['name']}")
            print(f"   🔑 Role: {result['role']}")
            print(f"   🆔 ID: {result['id']}")
            print(f"   🔐 Password: {self.default_password}")
            
            return result
            
        except Exception as e:
            raise Exception(f"Error creating user: {e}")
        finally:
            if conn:
                await conn.close()
    
    async def onboard_user(self, user_email: str, username: str = None, name: str = None, role: str = "projectOwner") -> Dict[str, Any]:
        """Main onboarding function - checks if user exists, creates if not"""
        try:
            print(f"🚀 Onboarding user: {user_email}")
            
            # Check if user exists
            existing_user = await self.check_user_exists(user_email)
            
            if existing_user:
                print(f"ℹ️ User already exists")
                return {
                    "status": "user_exists",
                    "message": f"User {user_email} already exists in Planka",
                    "user": existing_user
                }
            
            # Create new user
            new_user = await self.create_user(user_email, username, name, role)
            
            return {
                "status": "user_created",
                "message": f"User {user_email} successfully created in Planka",
                "user": new_user
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to onboard user {user_email}: {str(e)}"
            }

# Initialize the service
planka_user_manager = PlankaUserManager()

async def main():
    """Main function for testing user creation"""
    print("🚀 Testing Planka User Creation")
    print("=" * 50)
    
    # Test connection
    try:
        manager = PlankaUserManager()
        conn = await manager.get_connection()
        print("✅ Database connection test passed")
        await conn.close()
    except Exception as e:
        print(f"❌ Database connection test failed: {e}")
        return
    
    # Test user creation
    test_email = "testuser@example.com"
    
    print(f"\n🧪 Testing user creation for: {test_email}")
    result = await manager.onboard_user(test_email)
    
    if result["status"] == "user_created":
        print(f"✅ SUCCESS: {result['message']}")
        user = result["user"]
        print(f"🔗 Login with: {user['email']} / {user['password_used']}")
        print(f"🔍 Verify in database:")
        print(f"   docker exec -it planka-postgres-1 psql -U postgres -d planka -c \"SELECT email, username, name, role FROM user_account WHERE email = '{test_email}';\"")
    elif result["status"] == "user_exists":
        print(f"ℹ️ ALREADY EXISTS: {result['message']}")
    else:
        print(f"❌ ERROR: {result['message']}")

if __name__ == "__main__":
    asyncio.run(main())
