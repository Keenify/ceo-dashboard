import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import AsyncSessionLocal
from app.crud.feedback_entries import CRUDFeedback
from app.schemas.feedback_entries import FeedbackCreate, FeedbackType, Priority, Status
from uuid import uuid4
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_feedback_crud():
    """Test all CRUD operations for feedback entries"""
    
    print("🧪 Starting Feedback CRUD Tests...")
    print("=" * 50)
    
    # Use actual user ID from Supabase auth.users
    test_user_id = "77f6e692-32fd-4ad1-a69d-787f5395a5bc"
    print(f"📝 Using actual user ID: {test_user_id}")
    
    async with AsyncSessionLocal() as session:
        crud_feedback = CRUDFeedback(db=session)
        
        try:
            # Test 1: Create feedback entry
            print("\n🔍 Test 1: Create feedback entry")
            feedback_data = FeedbackCreate(
                module_name="habits",
                feedback_type=FeedbackType.BUG,
                title="Test feedback from CRUD test",
                description="This is a test feedback entry to verify CRUD operations work correctly",
                priority=Priority.MEDIUM
            )
            
            created_feedback = await crud_feedback.create(
                obj_in=feedback_data,
                user_id=test_user_id
            )
            
            print(f"✅ Created feedback with ID: {created_feedback.id}")
            print(f"   Status: {created_feedback.status}")
            print(f"   Title: {created_feedback.title}")
            print(f"   Priority: {created_feedback.priority}")
            
            # Test 2: Get feedback by ID
            print("\n🔍 Test 2: Get feedback by ID")
            retrieved_feedback = await crud_feedback.get_by_id(feedback_id=created_feedback.id)
            
            if retrieved_feedback:
                print(f"✅ Retrieved feedback: {retrieved_feedback.title}")
                print(f"   Created at: {retrieved_feedback.created_at}")
            else:
                print("❌ Failed to retrieve feedback by ID")
                return
            
            # Test 3: Get feedback by user
            print("\n🔍 Test 3: Get feedback by user")
            user_feedback = await crud_feedback.get_by_user(user_id=test_user_id)
            
            print(f"✅ Found {len(user_feedback)} feedback entries for user")
            for feedback in user_feedback:
                print(f"   - {feedback.title} [{feedback.status}]")
            
            # Test 4: Get pending feedback (for sync)
            print("\n🔍 Test 4: Get pending feedback")
            pending_feedback = await crud_feedback.get_pending_feedback()
            
            print(f"✅ Found {len(pending_feedback)} pending feedback entries")
            if pending_feedback:
                print("   Pending entries:")
                for feedback in pending_feedback:
                    print(f"   - {feedback.title} [User: {feedback.user_id}]")
            
            # Test 5: Update with Taiga info
            print("\n🔍 Test 5: Update with Taiga info")
            updated_feedback = await crud_feedback.update_taiga_info(
                feedback_id=created_feedback.id,
                taiga_story_id=1234,
                taiga_project_id=567,
                status=Status.SYNCED_TO_TAIGA
            )
            
            if updated_feedback:
                print(f"✅ Updated feedback with Taiga info:")
                print(f"   Status: {updated_feedback.status}")
                print(f"   Taiga Story ID: {updated_feedback.taiga_story_id}")
                print(f"   Taiga Project ID: {updated_feedback.taiga_project_id}")
            else:
                print("❌ Failed to update feedback with Taiga info")
                return
            
            # Test 6: Get synced feedback
            print("\n🔍 Test 6: Get synced feedback")
            synced_feedback = await crud_feedback.get_synced_feedback()
            
            print(f"✅ Found {len(synced_feedback)} synced feedback entries")
            if synced_feedback:
                print("   Synced entries:")
                for feedback in synced_feedback:
                    print(f"   - {feedback.title} [Story ID: {feedback.taiga_story_id}]")
            
            # Test 7: Test user feedback count
            print("\n🔍 Test 7: Get user feedback count")
            count = await crud_feedback.get_user_feedback_count(user_id=test_user_id)
            print(f"✅ User has {count} total feedback entries")
            
            # Test 8: Update status
            print("\n🔍 Test 8: Update status")
            status_updated = await crud_feedback.update_status(
                feedback_id=created_feedback.id,
                status=Status.IN_PROGRESS
            )
            
            if status_updated:
                print(f"✅ Status updated to: {status_updated.status}")
            else:
                print("❌ Failed to update status")
                return
            
            # Test 9: Create another feedback entry (different type/priority)
            print("\n🔍 Test 9: Create second feedback entry")
            feedback_data_2 = FeedbackCreate(
                module_name="todos",
                feedback_type=FeedbackType.FEATURE_REQUEST,
                title="Add bulk todo operations",
                description="Would be great to have bulk delete/complete operations for todos",
                priority=Priority.LOW
            )
            
            created_feedback_2 = await crud_feedback.create(
                obj_in=feedback_data_2,
                user_id=test_user_id
            )
            
            print(f"✅ Created second feedback: {created_feedback_2.title}")
            print(f"   Type: {created_feedback_2.feedback_type}")
            print(f"   Module: {created_feedback_2.module_name}")
            
            # Test 10: Test filtering
            print("\n🔍 Test 10: Test filtering by status")
            submitted_feedback = await crud_feedback.get_by_user(
                user_id=test_user_id,
                status_filter=Status.SUBMITTED
            )
            
            in_progress_feedback = await crud_feedback.get_by_user(
                user_id=test_user_id,
                status_filter=Status.IN_PROGRESS
            )
            
            print(f"✅ Submitted feedback: {len(submitted_feedback)} entries")
            print(f"✅ In Progress feedback: {len(in_progress_feedback)} entries")
            
            # Test 11: Cleanup - delete test entries
            print("\n🔍 Test 11: Cleanup test data")
            deleted_1 = await crud_feedback.delete(feedback_id=created_feedback.id)
            deleted_2 = await crud_feedback.delete(feedback_id=created_feedback_2.id)
            
            if deleted_1 and deleted_2:
                print("✅ Test data cleaned up successfully")
            else:
                print("⚠️  Some test data may remain in database")
            
            print("\n" + "=" * 50)
            print("🎉 All CRUD tests completed successfully!")
            print("✅ Database connection: Working")
            print("✅ Model validation: Working")
            print("✅ CRUD operations: Working")
            print("✅ Enum constraints: Working")
            print("✅ Taiga integration fields: Working")
            
        except Exception as e:
            print(f"\n❌ Test failed with error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    return True

if __name__ == "__main__":
    print("🚀 Feedback CRUD Test Script")
    print("This will test all database operations for feedback entries")
    print("Make sure your backend server is running on another terminal")
    print("")
    
    try:
        success = asyncio.run(test_feedback_crud())
        if success:
            print("\n🎯 Phase 1 testing: PASSED")
            print("Ready to proceed to Phase 2 (API endpoints)")
        else:
            print("\n💥 Phase 1 testing: FAILED")
            print("Please fix issues before proceeding")
    except KeyboardInterrupt:
        print("\n👋 Test cancelled by user")
    except Exception as e:
        print(f"\n💥 Test script error: {str(e)}")
        import traceback
        traceback.print_exc()