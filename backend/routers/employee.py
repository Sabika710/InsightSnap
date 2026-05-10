from importlib.resources import path
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User, Screenshot
from schemas import (
    UserCard, ScreenshotOut, MonitoringToggle, HeartbeatResponse,
    ScreenshotResponse, ActivityRequest, ActivityResponse
)
from routers import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["employee"])

@router.get("/heartbeat")
async def heartbeat(current_user: User = Depends(get_current_user)):
    return {
        "status": "ok",
        "is_active_monitoring": current_user.is_active_monitoring
    }

def user_to_card(user: User, screenshots: list[Screenshot]) -> dict:
    """Converts user model and screenshot list into the UserCard schema format."""
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role.value,
        "is_active_monitoring": user.is_active_monitoring,
        "created_at": user.created_at,
        "last_seen": user.last_seen,
        "latest_screenshots": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "file_path": s.file_path,
                "window_title": s.window_title,
                "app_name": s.app_name,
                "productivity_score": s.productivity_score,
                "captured_at": s.captured_at,
            }
            for s in screenshots
        ],
    }

@router.get("/me", response_model=UserCard)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        # CRITICAL FIX: Only select screenshots that have an actual file_path.
        # This prevents "Empty Spaces" in your frontend grid.
        result = await db.execute(
            select(Screenshot)
            .where(Screenshot.user_id == current_user.id)
            .where(Screenshot.file_path != "") 
            .where(Screenshot.file_path.isnot(None))
            .order_by(Screenshot.captured_at.desc(), Screenshot.id.desc())
            .limit(30) # Increased to 30 so "View All" shows a real history
        )
        screenshots = result.scalars().all()
        return user_to_card(current_user, screenshots)
    except Exception:
        logger.exception("Get me error")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/screenshot", response_model=ScreenshotResponse)
async def upload_screenshot(
    file: UploadFile = File(...),
    window_title: str = Form(default=""),
    productivity_score: float = Form(default=0.0), # Default to 0 so frontend knows it's "Analyzing"
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        # Ensure directory exists
        os.makedirs("static/screenshots", exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        clean_filename = file.filename.replace(" ", "_")
        generated_filename = f"{current_user.id}_{timestamp}_{clean_filename}"
        save_path = f"static/screenshots/{generated_filename}"

        # Save binary file
        content = await file.read()
        with open(save_path, "wb") as buffer:
            buffer.write(content)

        # Logic Fix: If it's VS Code or a known IDE, ensure a high base score
        app_name = _extract_app_name(window_title)
        final_score = productivity_score
        if app_name and any(ide in app_name.lower() for ide in ["visual studio", "code", "pycharm", "cursor"]):
            final_score = max(final_score, 85.0)

        shot = Screenshot(
            user_id=current_user.id,
            file_path=save_path,  
            window_title=window_title or "Work Session",
            app_name=app_name,
            productivity_score=max(0.0, min(100.0, final_score)),
            captured_at=datetime.now(timezone.utc),
        )
        db.add(shot)

        # Update last screenshot reference for the user
        current_user.last_seen = datetime.now(timezone.utc)
        db.add(current_user)

        await db.commit()
        return ScreenshotResponse(status="ok", path=save_path)

    except Exception:
        logger.exception("Screenshot upload error")
        raise HTTPException(status_code=500, detail="Internal server error")
    
@router.patch("/me/monitoring")

async def toggle_monitoring(
    data: dict,  
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        new_state = data.get("is_active_monitoring")
        if new_state is None:
            raise HTTPException(status_code=400, detail="Missing monitoring state")
            
        current_user.is_active_monitoring = new_state
        current_user.last_seen = datetime.now(timezone.utc)
        
        db.add(current_user)
        await db.commit()
        await db.refresh(current_user)

        result = await db.execute(
            select(Screenshot)
            .where(Screenshot.user_id == current_user.id)
            .where(Screenshot.file_path != "")
            .where(Screenshot.file_path.isnot(None))
            .order_by(Screenshot.captured_at.desc())
            .limit(30)
        )
        screenshots = result.scalars().all()

        # 3. Use your existing helper to return the correct format
        return user_to_card(current_user, screenshots)

    except Exception:
        logger.exception("Toggle monitoring error")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

def _extract_app_name(title: str) -> str | None:
    if not title:
        return "System"
    
    parts = title.replace(" — ", " - ").replace(" – ", " - ").split(" - ")
    if len(parts) > 1:
        name = parts[-1].strip()
    else:
        name = title.strip()
        
    return name[:40] if name else "Unknown"
