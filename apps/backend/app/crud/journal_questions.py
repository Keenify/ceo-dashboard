import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from typing import List, Optional
from uuid import UUID, uuid4

from app.database.database import AsyncSessionLocal
from app.models.journal_questions import JournalQuestion
from app.schemas.journal_questions import JournalQuestionCreate, JournalQuestionUpdate, JournalQuestionsReorderBulk, JournalQuestionReorder

class CRUDJournalQuestion:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, question_in: JournalQuestionCreate) -> JournalQuestion:
        """Create a new journal question."""
        try:
            # Auto-assign position if not provided
            if question_in.position is None and question_in.template_id:
                next_position = await self._get_next_position(template_id=question_in.template_id)
                question_data = question_in.model_dump()
                question_data['position'] = next_position
            else:
                question_data = question_in.model_dump()
            
            db_obj = JournalQuestion(**question_data)
            self.db.add(db_obj)
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Question creation failed due to constraint violation"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred while creating the question"
            )

    async def get(self, *, question_id: int) -> Optional[JournalQuestion]:
        """Get a question by ID."""
        result = await self.db.execute(
            select(JournalQuestion).filter(JournalQuestion.id == question_id)
        )
        return result.scalars().first()

    async def get_multi_by_template(self, *, template_id: UUID) -> List[JournalQuestion]:
        """Get all questions for a template, ordered by position."""
        result = await self.db.execute(
            select(JournalQuestion)
            .filter(JournalQuestion.template_id == template_id)
            .order_by(JournalQuestion.position.asc().nulls_last(), JournalQuestion.id.asc())
        )
        return result.scalars().all()

    async def get_multi_global(self, *, skip: int = 0, limit: int = 100) -> List[JournalQuestion]:
        """Get global questions (template_id is null)."""
        result = await self.db.execute(
            select(JournalQuestion)
            .filter(JournalQuestion.template_id.is_(None))
            .order_by(JournalQuestion.id.asc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def update(self, *, question_id: int, question_in: JournalQuestionUpdate) -> Optional[JournalQuestion]:
        """Update a question."""
        try:
            db_obj = await self.get(question_id=question_id)
            if not db_obj:
                return None

            update_data = question_in.model_dump(exclude_unset=True)
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
                detail="Question update failed due to constraint violation"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred while updating the question"
            )

    async def remove(self, *, question_id: int) -> Optional[JournalQuestion]:
        """Delete a question by ID and reorder remaining questions. Prevent deletion if the question belongs to a default template."""
        try:
            db_obj = await self.get(question_id=question_id)
            if not db_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Question not found"
                )

            template_id = db_obj.template_id
            deleted_position = db_obj.position

            # Check if the question belongs to a default template
            if template_id is not None:
                from app.models.journal_templates import JournalTemplate
                result = await self.db.execute(
                    select(JournalTemplate).filter(JournalTemplate.id == template_id)
                )
                template = result.scalars().first()
                if template and getattr(template, "is_default", False):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Cannot delete questions from default templates. Please create a custom template first."
                    )

            # First, delete all related journal entries
            from app.models.journal_entries import JournalEntry
            journal_entries_result = await self.db.execute(
                select(JournalEntry).filter(JournalEntry.question_id == question_id)
            )
            journal_entries = journal_entries_result.scalars().all()
            
            for entry in journal_entries:
                await self.db.delete(entry)

            # Then delete the question
            await self.db.delete(db_obj)
            
            # If the question had a template_id and position, reorder remaining questions
            if template_id and deleted_position is not None:
                await self._reorder_after_deletion(template_id=template_id, deleted_position=deleted_position)
                
            # Commit the transaction after all deletions and reordering
            await self.db.commit()
            
            return db_obj
        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred while deleting the question: {str(e)}"
            )

    async def _reorder_after_deletion(self, *, template_id: UUID, deleted_position: int) -> None:
        """Reorder remaining questions after deletion to ensure continuous numbering."""
        try:
            # Get all remaining questions for this template that have positions > deleted_position
            result = await self.db.execute(
                select(JournalQuestion)
                .filter(
                    JournalQuestion.template_id == template_id,
                    JournalQuestion.position > deleted_position
                )
                .order_by(JournalQuestion.position.asc())
            )
            questions_to_update = result.scalars().all()
            
            # Update positions to fill the gap (shift down by 1)
            for question in questions_to_update:
                question.position -= 1
                self.db.add(question)
            
            # Don't commit here - let the parent method handle the commit
                
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred while reordering questions after deletion"
            )

    async def reorder_questions(self, *, template_id: UUID, reorder_data: JournalQuestionsReorderBulk) -> List[JournalQuestion]:
        """Reorder questions within a template."""
        try:
            # Update positions for each question
            for question_reorder in reorder_data.questions:
                await self.db.execute(
                    update(JournalQuestion)
                    .where(
                        and_(
                            JournalQuestion.id == question_reorder.question_id,
                            JournalQuestion.template_id == template_id
                        )
                    )
                    .values(position=question_reorder.new_position)
                )

            await self.db.commit()
            
            # Return updated questions in order
            return await self.get_multi_by_template(template_id=template_id)

        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred while reordering questions"
            )

    async def _get_next_position(self, *, template_id: UUID) -> int:
        """Get the next position number for a template."""
        result = await self.db.execute(
            select(JournalQuestion.position)
            .filter(JournalQuestion.template_id == template_id)
            .order_by(JournalQuestion.position.desc().nulls_last())
        )
        max_position = result.scalars().first()
        return (max_position or 0) + 1

# Helper function to format question details
def format_question(question: Optional[JournalQuestion]) -> str:
    if not question:
        return "None"
    return (
        f"JournalQuestion(id={question.id}, content='{question.content}', "
        f"template_id={question.template_id}, position={question.position})"
    )

# Main guard for testing CRUD operations
async def main():
    """Tests the CRUD operations for JournalQuestion."""
    print("🧪 Starting CRUDJournalQuestion test...")
    
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
    test_template_id = uuid4()
    timestamp = int(uuid4().hex[:8], 16)  # Use part of UUID as timestamp
    question_ids = []

    async with AsyncSessionLocal() as session:
        crud = CRUDJournalQuestion(db=session)

        # --- Test Create Global Question (no template) ---
        print(f"\n➡️ Testing CREATE global question...")
        global_question_data = JournalQuestionCreate(
            content=f"What am I grateful for today? (Test {timestamp})",
            template_id=None,
            position=1
        )
        try:
            global_question = await crud.create(question_in=global_question_data)
            print(f"✅ CREATE global question successful: {format_question(global_question)}")
            question_ids.append(global_question.id)
        except Exception as e:
            print(f"❌ CREATE global question failed: {e}")

        # --- Test Create Template Questions ---
        print(f"\n➡️ Testing CREATE template questions...")
        template_questions_data = [
            JournalQuestionCreate(
                content=f"How do I feel this morning? (Test {timestamp})",
                template_id=test_template_id,
                position=1
            ),
            JournalQuestionCreate(
                content=f"What are my top 3 priorities today? (Test {timestamp})",
                template_id=test_template_id,
                position=2
            ),
            JournalQuestionCreate(
                content=f"What would make today great? (Test {timestamp})",
                template_id=test_template_id,
                position=3
            )
        ]

        template_questions = []
        for i, question_data in enumerate(template_questions_data):
            try:
                question = await crud.create(question_in=question_data)
                template_questions.append(question)
                question_ids.append(question.id)
                print(f"✅ CREATE template question {i+1} successful: {format_question(question)}")
            except Exception as e:
                print(f"❌ CREATE template question {i+1} failed: {e}")

        # --- Test Get by ID ---
        if question_ids:
            print(f"\n➡️ Testing GET by ID...")
            try:
                question = await crud.get(question_id=question_ids[0])
                print(f"✅ GET by ID successful: {format_question(question)}")
            except Exception as e:
                print(f"❌ GET by ID failed: {e}")

        # --- Test Get Multiple by Template ---
        print(f"\n➡️ Testing GET multiple by template...")
        try:
            template_questions_result = await crud.get_multi_by_template(template_id=test_template_id)
            print(f"✅ GET multiple by template successful: {len(template_questions_result)} questions found")
            for question in template_questions_result:
                print(f"   {format_question(question)}")
        except Exception as e:
            print(f"❌ GET multiple by template failed: {e}")

        # --- Test Get Global Questions ---
        print(f"\n➡️ Testing GET global questions...")
        try:
            global_questions = await crud.get_multi_global(skip=0, limit=5)
            print(f"✅ GET global questions successful: {len(global_questions)} questions found")
            for question in global_questions[:3]:  # Show first 3 only
                print(f"   {format_question(question)}")
            if len(global_questions) > 3:
                print(f"   ... and {len(global_questions) - 3} more")
        except Exception as e:
            print(f"❌ GET global questions failed: {e}")

        # --- Test Update Question ---
        if question_ids:
            print(f"\n➡️ Testing UPDATE question...")
            update_data = JournalQuestionUpdate(
                content="What am I most grateful for today? (Updated)",
                position=5
            )
            try:
                updated_question = await crud.update(question_id=question_ids[0], question_in=update_data)
                print(f"✅ UPDATE question successful: {format_question(updated_question)}")
            except Exception as e:
                print(f"❌ UPDATE question failed: {e}")

        # --- Test Reorder Questions ---
        if len(template_questions) >= 2:
            print(f"\n➡️ Testing REORDER questions...")
            reorder_data = JournalQuestionsReorderBulk(
                questions=[
                    JournalQuestionReorder(question_id=template_questions[0].id, new_position=3),
                    JournalQuestionReorder(question_id=template_questions[1].id, new_position=1),
                    JournalQuestionReorder(question_id=template_questions[2].id, new_position=2)
                ]
            )
            try:
                reordered_questions = await crud.reorder_questions(
                    template_id=test_template_id, 
                    reorder_data=reorder_data
                )
                print(f"✅ REORDER questions successful: {len(reordered_questions)} questions reordered")
                for question in reordered_questions:
                    print(f"   {format_question(question)}")
            except Exception as e:
                print(f"❌ REORDER questions failed: {e}")

        # --- Test Delete Questions ---
        print(f"\n➡️ Testing DELETE questions...")
        for question_id in question_ids:
            try:
                deleted_question = await crud.remove(question_id=question_id)
                print(f"✅ DELETE question successful: {format_question(deleted_question)}")
            except Exception as e:
                print(f"❌ DELETE question {question_id} failed: {e}")

    print("\n🏁 CRUDJournalQuestion test finished.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())