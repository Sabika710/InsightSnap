import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from auth import get_password_hash as hash_password
from database import get_db
from models import User, Screenshot, RoleEnum
from schemas import (
    UserCard, MonitoringToggle, ChartsResponse,
    ScoreTimelinePoint, AppUsageItem, HourlyAvgItem, CurrentScoreItem, 
    UserCreateSchema, UserOut
)
from routers import require_manager
from routers.employee import user_to_card

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/manager", tags=["manager"])


@router.get("/team", response_model=list[UserCard])
async def get_team(
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(User).where(User.role == RoleEnum.employee)
        )
        employees = result.scalars().all()

        cards = []
        for emp in employees:
            shot_result = await db.execute(
                select(Screenshot)
                .where(Screenshot.user_id == emp.id)
                .order_by(Screenshot.captured_at.desc(), Screenshot.id.desc()) # Add .id.desc()
                .limit(3)
            )
            screenshots = shot_result.scalars().all()
            cards.append(user_to_card(emp, screenshots))
        return cards
    except Exception:
        logger.exception("Get team error")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.patch("/users/{user_id}/monitoring", response_model=UserCard)
async def toggle_employee_monitoring(
    user_id: int,
    body: MonitoringToggle,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(User).where(User.id == user_id))
        employee = result.scalar_one_or_none()
        if not employee:
            raise HTTPException(status_code=404, detail="User not found")
        employee.is_active_monitoring = body.is_active_monitoring
        db.add(employee)
        await db.commit()
        await db.refresh(employee)
        shot_result = await db.execute(
            select(Screenshot)
            .where(Screenshot.user_id == employee.id)
            .order_by(Screenshot.captured_at.desc(), Screenshot.id.desc()) # Add .id.desc()
            .limit(3)
        )
        screenshots = shot_result.scalars().all()
        return user_to_card(employee, screenshots)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Toggle employee monitoring error")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/charts", response_model=ChartsResponse)
async def get_charts(
    hours: int = Query(default=8, ge=1, le=48),
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    try:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)

        # Load all employees
        emp_result = await db.execute(
            select(User).where(User.role == RoleEnum.employee)
        )
        employees = emp_result.scalars().all()
        emp_map = {e.id: e.full_name for e in employees}

        # Load screenshots in time range
        shot_result = await db.execute(
            select(Screenshot)
            .where(
                Screenshot.user_id.in_(list(emp_map.keys())),
                Screenshot.captured_at >= since,
                Screenshot.productivity_score.isnot(None),
            )
            .order_by(Screenshot.captured_at.asc())
        )
        shots = shot_result.scalars().all()

        # Score timeline — 15-min buckets
        timeline_buckets: dict[tuple, list[float]] = defaultdict(list)
        for s in shots:
            slot_dt = s.captured_at.replace(
                minute=(s.captured_at.minute // 15) * 15, second=0, microsecond=0
            )
            slot_str = slot_dt.strftime("%H:%M")
            timeline_buckets[(slot_str, s.user_id)].append(s.productivity_score)

        score_timeline = [
            ScoreTimelinePoint(
                slot=slot,
                user_id=uid,
                full_name=emp_map.get(uid, "Unknown"),
                avg_score=round(sum(scores) / len(scores), 1),
            )
            for (slot, uid), scores in sorted(timeline_buckets.items())
        ]

        # App usage — top 10
        app_buckets: dict[str, list[float]] = defaultdict(list)
        for s in shots:
            if s.app_name:
                app_buckets[s.app_name].append(s.productivity_score)

        app_usage = sorted(
            [
                AppUsageItem(
                    app_name=app,
                    count=len(scores),
                    avg_score=round(sum(scores) / len(scores), 1),
                )
                for app, scores in app_buckets.items()
            ],
            key=lambda x: x.count,
            reverse=True,
        )[:10]

        # Hourly avg
        hourly_buckets: dict[int, list[float]] = defaultdict(list)
        for s in shots:
            hourly_buckets[s.captured_at.hour].append(s.productivity_score)

        hourly_avg = [
            HourlyAvgItem(
                hour=hour,
                avg_score=round(sum(scores) / len(scores), 1),
            )
            for hour, scores in sorted(hourly_buckets.items())
        ]

        # Current scores — latest per employee
        current_scores = []
        for emp in employees:
            latest = await db.execute(
                select(Screenshot)
                .where(Screenshot.user_id == emp.id, Screenshot.productivity_score.isnot(None))
                .order_by(Screenshot.captured_at.desc())
                .limit(1)
            )
            latest_shot = latest.scalar_one_or_none()
            current_scores.append(
                CurrentScoreItem(
                    user_id=emp.id,
                    full_name=emp.full_name,
                    score=latest_shot.productivity_score if latest_shot else None,
                    window_title=latest_shot.window_title if latest_shot else None,
                )
            )

        return ChartsResponse(
            score_timeline=score_timeline,
            app_usage=app_usage,
            hourly_avg=hourly_avg,
            current_scores=current_scores,
        )
    except Exception:
        logger.exception("Charts error")
        raise HTTPException(status_code=500, detail="Internal server error")
    
@router.post("/users", response_model=UserOut)
async def create_employee(
    data: UserCreateSchema, 
    current_user: User = Depends(require_manager), 
    db: AsyncSession = Depends(get_db)
):
    # Match your RoleEnum precisely
    if current_user.role != RoleEnum.manager:
        raise HTTPException(status_code=403, detail="Not authorized")

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_emp = User(
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password), 
        role=RoleEnum.employee, 
        is_active_monitoring=False
    )
    db.add(new_emp)
    await db.commit()
    await db.refresh(new_emp)
    return new_emp

@router.delete("/users/{user_id}")
async def remove_employee(
    user_id: int, 
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db)
):
    emp = await db.get(User, user_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    await db.delete(emp)
    await db.commit()
    return {"status": "success", "message": f"User {user_id} removed"}