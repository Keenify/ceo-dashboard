from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.crud.journal_questions import CRUDJournalQuestion
from app.schemas.journal_questions import (
    JournalQuestion,
    JournalQuestionCreate,
    JournalQuestionUpdate,
    JournalQuestionsReorderBulk
)
from app.database.database import get_db

router = APIRouter()

@router.post("/templates/{template_id}/questions", response_model=JournalQuestion, status_code=status.HTTP_201_CREATED)
async def create_question_for_template(
    *,
    db: AsyncSession = Depends(get_db),
    template_id: UUID,
    question_in: JournalQuestionCreate
):
    """Create a new question for a template."""
    # Ensure the question is linked to the correct template
    question_in.template_id = template_id
    
    crud = CRUDJournalQuestion(db=db)
    question = await crud.create(question_in=question_in)
    return question

@router.get("/templates/{template_id}/questions", response_model=List[JournalQuestion])
async def get_template_questions(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get all questions for a template, ordered by position."""
    crud = CRUDJournalQuestion(db=db)
    questions = await crud.get_multi_by_template(template_id=template_id)
    
    # Add cache-busting headers to ensure fresh data
    from fastapi.responses import JSONResponse
    
    # Convert SQLAlchemy models to dict manually
    questions_dict = [
        {
            "id": q.id,
            "content": q.content,
            "template_id": str(q.template_id) if q.template_id else None,
            "position": q.position,
            "created_at": q.created_at.isoformat() if q.created_at else None,
            "updated_at": q.updated_at.isoformat() if q.updated_at else None
        }
        for q in questions
    ]
    
    return JSONResponse(
        content=questions_dict,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@router.get("/questions/{question_id}", response_model=JournalQuestion)
async def get_question(
    question_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific question by ID."""
    crud = CRUDJournalQuestion(db=db)
    question = await crud.get(question_id=question_id)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    return question

@router.put("/questions/{question_id}", response_model=JournalQuestion)
async def update_question(
    *,
    db: AsyncSession = Depends(get_db),
    question_id: int,
    question_in: JournalQuestionUpdate
):
    """Update a question."""
    crud = CRUDJournalQuestion(db=db)
    question = await crud.update(question_id=question_id, question_in=question_in)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    return question

@router.delete("/questions/{question_id}", response_model=JournalQuestion)
async def delete_question(
    *,
    db: AsyncSession = Depends(get_db),
    question_id: int
):
    """Delete a question."""
    crud = CRUDJournalQuestion(db=db)
    question = await crud.remove(question_id=question_id)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    return question

@router.put("/templates/{template_id}/questions/reorder", response_model=List[JournalQuestion])
async def reorder_template_questions(
    *,
    db: AsyncSession = Depends(get_db),
    template_id: UUID,
    reorder_data: JournalQuestionsReorderBulk
):
    """Reorder questions within a template."""
    crud = CRUDJournalQuestion(db=db)
    questions = await crud.reorder_questions(template_id=template_id, reorder_data=reorder_data)
    return questions

@router.get("/global-questions", response_model=List[JournalQuestion])
async def get_global_questions(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get global questions (not associated with any template)."""
    crud = CRUDJournalQuestion(db=db)
    questions = await crud.get_multi_global(skip=skip, limit=limit)
    return questions 