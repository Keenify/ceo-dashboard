from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.crud.journal_templates import CRUDJournalTemplate
from app.schemas.journal_templates import (
    JournalTemplate, 
    JournalTemplateCreate, 
    JournalTemplateUpdate, 
    JournalTemplateDuplicate,
    JournalTemplateWithQuestions
)
from app.database.database import get_db

router = APIRouter()

@router.post("/", response_model=JournalTemplate, status_code=status.HTTP_201_CREATED)
async def create_template(
    *, 
    db: AsyncSession = Depends(get_db),
    template_in: JournalTemplateCreate
):
    """Create a new journal template."""
    crud = CRUDJournalTemplate(db=db)
    template = await crud.create(template_in=template_in)
    return template

@router.get("/{template_id}", response_model=JournalTemplate)
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a template by ID."""
    crud = CRUDJournalTemplate(db=db)
    template = await crud.get(template_id=template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    return template

@router.get("/{template_id}/with-questions", response_model=JournalTemplateWithQuestions)
async def get_template_with_questions(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a template with its questions ordered by position."""
    crud = CRUDJournalTemplate(db=db)
    template = await crud.get_with_questions(template_id=template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    # Add cache-busting headers to ensure fresh data
    from fastapi.responses import JSONResponse
    import json
    
    # Convert SQLAlchemy model to dict manually
    template_dict = {
        "id": str(template.id),
        "user_id": str(template.user_id) if template.user_id else None,
        "name": template.name,
        "description": template.description,
        "is_default": template.is_default,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None,
        "questions": [
            {
                "id": q.id,
                "content": q.content,
                "template_id": str(q.template_id) if q.template_id else None,
                "position": q.position,
                "created_at": q.created_at.isoformat() if q.created_at else None,
                "updated_at": q.updated_at.isoformat() if q.updated_at else None
            }
            for q in template.questions
        ] if template.questions else []
    }
    
    return JSONResponse(
        content=template_dict,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@router.get("/user/{user_id}", response_model=List[JournalTemplate])
async def get_user_templates(
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get all templates for a specific user."""
    crud = CRUDJournalTemplate(db=db)
    templates = await crud.get_multi_by_user(user_id=user_id, skip=skip, limit=limit)
    return templates

@router.get("/user/{user_id}/with-defaults", response_model=List[JournalTemplate])
async def get_user_and_default_templates(
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get both user's templates and default templates."""
    crud = CRUDJournalTemplate(db=db)
    templates = await crud.get_user_and_default_templates(user_id=user_id, skip=skip, limit=limit)
    return templates

@router.get("/defaults/", response_model=List[JournalTemplate])
async def get_default_templates(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get all default templates."""
    crud = CRUDJournalTemplate(db=db)
    templates = await crud.get_default_templates(skip=skip, limit=limit)
    return templates

@router.put("/{template_id}", response_model=JournalTemplate)
async def update_template(
    *,
    db: AsyncSession = Depends(get_db),
    template_id: UUID,
    template_in: JournalTemplateUpdate
):
    """Update a template."""
    crud = CRUDJournalTemplate(db=db)
    template = await crud.update(template_id=template_id, template_in=template_in)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    return template

@router.delete("/{template_id}", response_model=JournalTemplate)
async def delete_template(
    *,
    db: AsyncSession = Depends(get_db),
    template_id: UUID
):
    """Delete a template."""
    crud = CRUDJournalTemplate(db=db)
    template = await crud.remove(template_id=template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    return template

@router.post("/{template_id}/duplicate", response_model=JournalTemplateWithQuestions, status_code=status.HTTP_201_CREATED)
async def duplicate_template(
    *,
    db: AsyncSession = Depends(get_db),
    template_id: UUID,
    user_id: UUID,
    duplicate_data: JournalTemplateDuplicate
):
    """Duplicate a template with its questions for a specific user."""
    crud = CRUDJournalTemplate(db=db)
    new_template = await crud.duplicate_template(
        source_template_id=template_id,
        user_id=user_id,
        duplicate_data=duplicate_data
    )
    return new_template