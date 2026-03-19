import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from typing import List, Optional
from uuid import UUID, uuid4
import uuid

from app.database.database import AsyncSessionLocal
from app.models.journal_templates import JournalTemplate
from app.models.journal_questions import JournalQuestion
from app.schemas.journal_templates import JournalTemplateCreate, JournalTemplateUpdate, JournalTemplateDuplicate
from app.schemas.journal_questions import JournalQuestionCreate

class CRUDJournalTemplate:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, template_in: JournalTemplateCreate) -> JournalTemplate:
        """Create a new journal template."""
        try:
            template_data = template_in.model_dump()
            db_obj = JournalTemplate(**template_data)
            self.db.add(db_obj)
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Template creation failed due to constraint violation"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred while creating the template"
            )

    async def get(self, *, template_id: UUID) -> Optional[JournalTemplate]:
        """Get a template by ID."""
        result = await self.db.execute(
            select(JournalTemplate).filter(JournalTemplate.id == template_id)
        )
        return result.scalars().first()

    async def get_with_questions(self, *, template_id: UUID) -> Optional[JournalTemplate]:
        """Get a template with its questions ordered by position."""
        result = await self.db.execute(
            select(JournalTemplate)
            .options(selectinload(JournalTemplate.questions))
            .filter(JournalTemplate.id == template_id)
        )
        template = result.scalars().first()
        if template and template.questions:
            # Sort questions by position
            template.questions.sort(key=lambda q: q.position or 999)
        return template

    async def get_multi_by_user(self, *, user_id: UUID, skip: int = 0, limit: int = 100) -> List[JournalTemplate]:
        """Get all templates for a specific user."""
        result = await self.db.execute(
            select(JournalTemplate)
            .filter(JournalTemplate.user_id == user_id)
            .order_by(JournalTemplate.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def get_default_templates(self, *, skip: int = 0, limit: int = 100) -> List[JournalTemplate]:
        """Get all default templates (is_default=True)."""
        result = await self.db.execute(
            select(JournalTemplate)
            .filter(JournalTemplate.is_default == True)
            .order_by(JournalTemplate.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def get_user_and_default_templates(self, *, user_id: UUID, skip: int = 0, limit: int = 100) -> List[JournalTemplate]:
        """Get both user's templates and default templates."""
        result = await self.db.execute(
            select(JournalTemplate)
            .filter(
                (JournalTemplate.user_id == user_id) | 
                (JournalTemplate.is_default == True)
            )
            .order_by(JournalTemplate.is_default.desc(), JournalTemplate.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def update(self, *, template_id: UUID, template_in: JournalTemplateUpdate) -> Optional[JournalTemplate]:
        """Update a template."""
        try:
            # Get existing template
            db_obj = await self.get(template_id=template_id)
            if not db_obj:
                return None

            # Update only provided fields
            update_data = template_in.model_dump(exclude_unset=True)
            if update_data:
                for field, value in update_data.items():
                    setattr(db_obj, field, value)
                
                self.db.add(db_obj)
                await self.db.commit()
                await self.db.refresh(db_obj)
            
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Template update failed due to constraint violation"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred while updating the template"
            )

    async def remove(self, *, template_id: UUID) -> Optional[JournalTemplate]:
        """Delete a template by ID. This will CASCADE delete all related questions and journal entries."""
        try:
            # Get the template first to return it later
            template_to_delete = await self.get(template_id=template_id)
            if not template_to_delete:
                return None
            
            # Delete the template - CASCADE will automatically delete:
            # 1. All questions belonging to this template (ondelete="CASCADE")
            # 2. All journal entries referencing those questions (ondelete="CASCADE")
            delete_template_stmt = (
                delete(JournalTemplate)
                .where(JournalTemplate.id == template_id)
            )
            await self.db.execute(delete_template_stmt)
            
            # Commit the deletion
            await self.db.commit()
            
            return template_to_delete
            
        except Exception as e:
            await self.db.rollback()
            # Log the actual error for debugging
            print(f"Error deleting template {template_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred while deleting the template: {str(e)}"
            )

    async def duplicate_template(self, *, source_template_id: UUID, user_id: UUID, duplicate_data: JournalTemplateDuplicate) -> JournalTemplate:
        """Duplicate a template with its questions for a specific user."""
        try:
            # Get source template with questions
            source_template = await self.get_with_questions(template_id=source_template_id)
            if not source_template:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Source template not found"
                )

            # Create new template
            new_template = JournalTemplate(
                id=uuid.uuid4(),
                user_id=user_id,
                name=duplicate_data.name,
                description=duplicate_data.description,
                is_default=False  # Duplicated templates are never default
            )
            self.db.add(new_template)
            await self.db.flush()  # Get the new template ID

            # Duplicate questions
            if source_template.questions:
                for question in source_template.questions:
                    new_question = JournalQuestion(
                        content=question.content,
                        template_id=new_template.id,
                        position=question.position
                    )
                    self.db.add(new_question)

            await self.db.commit()
            await self.db.refresh(new_template)
            
            # Return template with questions
            return await self.get_with_questions(template_id=new_template.id)

        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred while duplicating the template"
            )

# Helper function to format template details
def format_template(template: Optional[JournalTemplate]) -> str:
    if not template:
        return "None"
    # Don't access relationships to avoid async loading issues
    return (
        f"JournalTemplate(id={template.id}, name='{template.name}', "
        f"description='{template.description}', user_id={template.user_id}, "
        f"is_default={template.is_default})"
    )

# Main guard for testing CRUD operations
async def main():
    """Tests the CRUD operations for JournalTemplate."""
    print("🧪 Starting CRUDJournalTemplate test...")
    
    test_user_id_str = os.getenv("TEST_USER_ID")
    if not test_user_id_str:
        print("❌ Error: TEST_USER_ID environment variable not set.")
        return
    
    try:
        test_user_id = UUID(test_user_id_str)
    except ValueError:
        print(f"❌ Error: Invalid UUID format for TEST_USER_ID: {test_user_id_str}")
        return

    # Test data
    template_ids = []
    timestamp = int(uuid4().hex[:8], 16)  # Use part of UUID as timestamp

    async with AsyncSessionLocal() as session:
        crud = CRUDJournalTemplate(db=session)
        # Import here to avoid circular import
        from app.crud.journal_questions import CRUDJournalQuestion
        question_crud = CRUDJournalQuestion(db=session)

        # --- Test Create User Template ---
        print(f"\n➡️ Testing CREATE user template...")
        user_template_data = JournalTemplateCreate(
            name=f"Morning Routine (Test {timestamp})",
            description="My daily morning reflection template",
            user_id=test_user_id,
            is_default=False
        )
        try:
            user_template = await crud.create(template_in=user_template_data)
            print(f"✅ CREATE user template successful: {format_template(user_template)}")
            template_ids.append(user_template.id)
        except Exception as e:
            print(f"❌ CREATE user template failed: {e}")

        # --- Test Create Default Template ---
        print(f"\n➡️ Testing CREATE default template...")
        default_template_data = JournalTemplateCreate(
            name=f"Daily Reflection (Test {timestamp})",
            description="A default template for daily reflection",
            user_id=None,
            is_default=True
        )
        try:
            default_template = await crud.create(template_in=default_template_data)
            print(f"✅ CREATE default template successful: {format_template(default_template)}")
            template_ids.append(default_template.id)
        except Exception as e:
            print(f"❌ CREATE default template failed: {e}")

        # --- Add Questions to Template ---
        if template_ids:
            template_id = template_ids[0]
            print(f"\n➡️ Adding questions to template {template_id}...")
            questions_data = [
                JournalQuestionCreate(
                    content=f"How do I feel this morning? (Test {timestamp})",
                    template_id=template_id,
                    position=1
                ),
                JournalQuestionCreate(
                    content=f"What are my top 3 priorities today? (Test {timestamp})",
                    template_id=template_id,
                    position=2
                ),
                JournalQuestionCreate(
                    content=f"What would make today great? (Test {timestamp})",
                    template_id=template_id,
                    position=3
                )
            ]
            
            for i, question_data in enumerate(questions_data):
                try:
                    question = await question_crud.create(question_in=question_data)
                    print(f"✅ Added question {i+1} to template: {question.content}")
                except Exception as e:
                    print(f"❌ Failed to add question {i+1}: {e}")

        # --- Test Get by ID ---
        if template_ids:
            print(f"\n➡️ Testing GET template by ID...")
            try:
                template = await crud.get(template_id=template_ids[0])
                print(f"✅ GET by ID successful: {format_template(template)}")
            except Exception as e:
                print(f"❌ GET by ID failed: {e}")

        # --- Test Get with Questions ---
        if template_ids:
            print(f"\n➡️ Testing GET template with questions...")
            try:
                template_with_questions = await crud.get_with_questions(template_id=template_ids[0])
                print(f"✅ GET with questions successful: {format_template(template_with_questions)}")
                if hasattr(template_with_questions, 'questions') and template_with_questions.questions:
                    for question in template_with_questions.questions:
                        print(f"   Question: {question.content} (position: {question.position})")
            except Exception as e:
                print(f"❌ GET with questions failed: {e}")

        # --- Test Get User Templates ---
        print(f"\n➡️ Testing GET user templates...")
        try:
            user_templates = await crud.get_multi_by_user(user_id=test_user_id, skip=0, limit=10)
            print(f"✅ GET user templates successful: {len(user_templates)} templates found")
            for template in user_templates[:3]:  # Show first 3 only
                print(f"   {format_template(template)}")
            if len(user_templates) > 3:
                print(f"   ... and {len(user_templates) - 3} more")
        except Exception as e:
            print(f"❌ GET user templates failed: {e}")

        # --- Test Get Default Templates ---
        print(f"\n➡️ Testing GET default templates...")
        try:
            default_templates = await crud.get_default_templates(skip=0, limit=10)
            print(f"✅ GET default templates successful: {len(default_templates)} templates found")
            for template in default_templates[:3]:  # Show first 3 only
                print(f"   {format_template(template)}")
            if len(default_templates) > 3:
                print(f"   ... and {len(default_templates) - 3} more")
        except Exception as e:
            print(f"❌ GET default templates failed: {e}")

        # --- Test Get User and Default Templates ---
        print(f"\n➡️ Testing GET user and default templates...")
        try:
            all_templates = await crud.get_user_and_default_templates(user_id=test_user_id, skip=0, limit=10)
            print(f"✅ GET user and default templates successful: {len(all_templates)} templates found")
            for template in all_templates[:3]:  # Show first 3 only
                print(f"   {format_template(template)}")
            if len(all_templates) > 3:
                print(f"   ... and {len(all_templates) - 3} more")
        except Exception as e:
            print(f"❌ GET user and default templates failed: {e}")

        # --- Test Update Template ---
        if template_ids:
            print(f"\n➡️ Testing UPDATE template...")
            update_data = JournalTemplateUpdate(
                name=f"Morning Routine (Updated Test {timestamp})",
                description="My updated daily morning reflection template"
            )
            try:
                updated_template = await crud.update(template_id=template_ids[0], template_in=update_data)
                print(f"✅ UPDATE template successful: {format_template(updated_template)}")
            except Exception as e:
                print(f"❌ UPDATE template failed: {e}")

        # --- Test Duplicate Template ---
        if template_ids:
            print(f"\n➡️ Testing DUPLICATE template...")
            duplicate_data = JournalTemplateDuplicate(
                name=f"Duplicated Morning Routine (Test {timestamp})",
                description="A copy of my morning routine template"
            )
            try:
                duplicated_template = await crud.duplicate_template(
                    source_template_id=template_ids[0],
                    user_id=test_user_id,
                    duplicate_data=duplicate_data
                )
                print(f"✅ DUPLICATE template successful: {format_template(duplicated_template)}")
                template_ids.append(duplicated_template.id)
                
                # Show duplicated questions (duplicated_template should have questions loaded)
                if hasattr(duplicated_template, 'questions') and duplicated_template.questions:
                    print("   Duplicated questions:")
                    for question in duplicated_template.questions:
                        print(f"     {question.content} (position: {question.position})")
            except Exception as e:
                print(f"❌ DUPLICATE template failed: {e}")

        # --- Test Delete Templates ---
        print(f"\n➡️ Testing DELETE templates...")
        for template_id in template_ids:
            try:
                deleted_template = await crud.remove(template_id=template_id)
                print(f"✅ DELETE template successful: {format_template(deleted_template)}")
            except Exception as e:
                print(f"❌ DELETE template {template_id} failed: {e}")

    print("\n🏁 CRUDJournalTemplate test finished.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())