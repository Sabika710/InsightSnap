import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User
from schemas import LoginRequest, LoginResponse
from auth import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_HOURS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(User).where(User.email == request.email))
        user = result.scalar_one_or_none()
        if not user or not verify_password(request.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        token = create_access_token(
            {"sub": str(user.id)},
            expires_delta=timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
        )
        return LoginResponse(
            access_token=token,
            token_type="bearer",
            user_id=user.id,
            full_name=user.full_name,
            role=user.role.value,
            is_active_monitoring=user.is_active_monitoring,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Login error")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/logout")
async def logout():
    return {"status": "logged out"}