from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database.database import get_db
from app.schemas.manifestation import (
    ManifestationCreate, ManifestationUpdate, ManifestationResponse
)
from app.crud.manifestation import CRUDManifestation

router = APIRouter()

# --- Manifestation Endpoints ---
@router.post("/", response_model=ManifestationResponse, status_code=status.HTTP_201_CREATED)
async def create_manifestation(
    *,
    db: AsyncSession = Depends(get_db),
    manifestation_in: ManifestationCreate
) -> ManifestationResponse:
    """Create a new manifestation."""
    crud = CRUDManifestation(db)
    try:
        manifestation = await crud.create(obj_in=manifestation_in)
        return ManifestationResponse.model_validate(manifestation)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/export/pdf")
async def export_manifestation_pdf(
    user_id: UUID,
    category: str = "personal",
    db: AsyncSession = Depends(get_db),
):
    """Export manifestation as a formatted PDF."""
    crud = CRUDManifestation(db)
    manifestations = await crud.get_multi_by_user(
        user_id=user_id, category=category, limit=1
    )
    if not manifestations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No manifestation data found for this category",
        )

    m = manifestations[0]
    data = ManifestationResponse.model_validate(m).model_dump()
    from app.service.manifestation_pdf_service import generate_manifestation_pdf
    pdf_buffer = generate_manifestation_pdf(data, category)

    year = data.get("year", "")
    filename = f"manifestation_{category}_{year}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{manifestation_id}", response_model=ManifestationResponse)
async def get_manifestation(
    *,
    db: AsyncSession = Depends(get_db),
    manifestation_id: UUID,
    user_id: UUID
) -> ManifestationResponse:
    """Get a manifestation by ID."""
    crud = CRUDManifestation(db)
    manifestation = await crud.get(id=manifestation_id, user_id=user_id)
    if not manifestation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manifestation not found"
        )
    return ManifestationResponse.model_validate(manifestation)

@router.get("/", response_model=List[ManifestationResponse])
async def get_manifestations(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    category: str | None = None,
    skip: int = 0,
    limit: int = 100
) -> List[ManifestationResponse]:
    """Get all manifestations for a user, optionally filtered by category."""
    crud = CRUDManifestation(db)
    manifestations = await crud.get_multi_by_user(user_id=user_id, category=category, skip=skip, limit=limit)
    return [ManifestationResponse.model_validate(m) for m in manifestations]

@router.put("/{manifestation_id}", response_model=ManifestationResponse)
async def update_manifestation(
    *,
    db: AsyncSession = Depends(get_db),
    manifestation_id: UUID,
    user_id: UUID,
    manifestation_in: ManifestationUpdate
) -> ManifestationResponse:
    """Update a manifestation."""
    crud = CRUDManifestation(db)
    manifestation = await crud.get(id=manifestation_id, user_id=user_id)
    if not manifestation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manifestation not found"
        )
    try:
        updated = await crud.update(db_obj=manifestation, obj_in=manifestation_in)
        return ManifestationResponse.model_validate(updated)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{manifestation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_manifestation(
    *,
    db: AsyncSession = Depends(get_db),
    manifestation_id: UUID,
    user_id: UUID
) -> None:
    """Delete a manifestation."""
    crud = CRUDManifestation(db)
    manifestation = await crud.get(id=manifestation_id, user_id=user_id)
    if not manifestation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manifestation not found"
        )
    await crud.remove(id=manifestation_id, user_id=user_id)
