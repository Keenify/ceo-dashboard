#!/usr/bin/env python3
"""
RAG System Initialization Script
Run this to populate initial embeddings for Weekly Design System.
"""

import requests
import json
import time

# Configuration
BACKEND_URL = "http://localhost:8000"
TEST_USER_ID = "77f6e692-32fd-4ad1-a69d-787f5395a5bc"  # For testing only

def check_backend():
    """Check if backend is running."""
    try:
        print("Checking backend connection...")
        response = requests.get(f"{BACKEND_URL}/rag/weekly-design/health", timeout=5)
        if response.status_code == 200:
            health = response.json()
            print("Backend is running!")
            print(f"   Database: {health.get('database_connection', 'Unknown')}")
            print(f"   LLM: {health.get('llm_connection', 'Unknown')}")
            return True
        else:
            print(f"Backend health check failed: {response.status_code}")
            return False
    except:
        print("Cannot connect to backend!")
        print("   Please start backend: cd ceo-backend && ./run.bat")
        return False

def get_all_users_from_rag_endpoint():
    """Get all users by calling the RAG refresh-all endpoint."""
    try:
        print("Attempting to refresh embeddings for all users...")
        response = requests.post(f"{BACKEND_URL}/rag/weekly-design/refresh-all", timeout=300)
        
        if response.status_code == 200:
            result = response.json()
            print("SUCCESS: Bulk refresh completed!")
            return True, result
        else:
            print(f"Bulk refresh endpoint not available: {response.status_code}")
            return False, None
    except Exception as e:
        print(f"Bulk refresh not available: {e}")
        return False, None

def get_fallback_users():
    """Get a list of known user IDs to try."""
    # Common test users and known user IDs
    fallback_users = [
        TEST_USER_ID,
        # Add more known user IDs here if you have them
    ]
    
    print(f"Using fallback approach with {len(fallback_users)} known users")
    return fallback_users

def generate_embeddings_for_user(user_id):
    """Generate embeddings for a specific user."""
    try:
        payload = {"user_id": user_id}
        
        response = requests.post(
            f"{BACKEND_URL}/rag/weekly-design/refresh",
            json=payload,
            timeout=120  # Longer timeout for processing
        )
        
        if response.status_code == 200:
            result = response.json()
            stats = result.get('stats', {})
            embeddings_count = stats.get('embeddings_created', 0)
            designs_count = stats.get('processed', 0)
            time_ms = result.get('processing_time_ms', 0)
            
            print(f"  SUCCESS: {embeddings_count} embeddings from {designs_count} designs ({time_ms}ms)")
            return True, embeddings_count, designs_count
        else:
            try:
                error = response.json()
                error_msg = error.get('detail', 'Unknown error')
            except:
                error_msg = response.text
            print(f"  FAILED: {response.status_code} - {error_msg}")
            return False, 0, 0
    except Exception as e:
        print(f"  FAILED: {e}")
        return False, 0, 0

def generate_embeddings_for_all():
    """Generate embeddings for all users with weekly design data."""
    print("\nGenerating embeddings for ALL users automatically...")
    
    try:
        print("Calling refresh-all endpoint...")
        response = requests.post(f"{BACKEND_URL}/rag/weekly-design/refresh-all", timeout=300)
        
        if response.status_code == 200:
            result = response.json()
            print("SUCCESS: All users processed!")
            print(f"   {result.get('message', 'Done')}")
            print(f"   Processing time: {result.get('processing_time_ms', 0)}ms")
            
            stats = result.get('stats', {})
            if stats:
                print("   Detailed stats:")
                for key, value in stats.items():
                    print(f"     {key}: {value}")
            
            return True
            
        else:
            print(f"FAILED: {response.status_code}")
            try:
                error = response.json()
                print(f"   Error: {error.get('detail', 'Unknown error')}")
            except:
                print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"FAILED: Request failed: {e}")
        return False

def test_chat():
    """Test chat functionality."""
    print(f"\nTesting chat...")
    
    test_question = "What are my goals this week?"
    
    try:
        payload = {
            "user_id": TEST_USER_ID,
            "question": test_question
        }
        
        response = requests.post(
            f"{BACKEND_URL}/rag/weekly-design/chat",
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("SUCCESS: Chat is working!")
            print(f"   Q: {test_question}")
            print(f"   A: {result.get('response', '')[:100]}...")
            print(f"   Sources: {result.get('retrieved_count', 0)}")
            return True
        else:
            print(f"FAILED: Chat failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"FAILED: Chat test failed: {e}")
        return False

def main():
    print("RAG System Initialization - ALL USERS")
    print("=" * 50)
    
    # Step 1: Check backend
    if not check_backend():
        return
    
    # Step 2: Generate embeddings for ALL users
    if not generate_embeddings_for_all():
        print("\nFAILED: No embeddings were generated")
        return
    
    # Step 3: Test chat with test user
    if not test_chat():
        print("\nWARNING: Chat test failed, but embeddings were created")
        print("You can still test the frontend manually")
    
    print("\nSUCCESS: RAG System is ready for ALL USERS!")
    print("- Embeddings populated for all users with weekly design data")
    print("- Chat functionality should work for all users")
    print("- Frontend should now work for any authenticated user")
    print("\nNext steps:")
    print("1. Open frontend: http://localhost:3000")
    print("2. Login as any user with weekly design data")
    print("3. Click chat button in header")
    print("4. Ask: 'What are my goals this week?'")
    print("\nTo check results in Supabase:")
    print("SELECT module_type, user_id, COUNT(*) FROM dashboard_embeddings GROUP BY module_type, user_id;")

if __name__ == "__main__":
    main()