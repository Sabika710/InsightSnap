import enum
from datetime import datetime
from sqlalchemy import (
    Integer, String, Boolean, Float, DateTime, ForeignKey, Enum,
    Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from database import Base


class RoleEnum(str, enum.Enum):
    employee = "employee"
    manager = "manager"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum), nullable=False, default=RoleEnum.employee)
    is_active_monitoring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    screenshots: Mapped[list["Screenshot"]] = relationship(
        "Screenshot",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Screenshot.captured_at.desc()",
    )

    def latest_screenshots(self, n: int = 3) -> list["Screenshot"]:
        return self.screenshots[:n]


class Screenshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    window_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    app_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    productivity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    user: Mapped["User"] = relationship("User", back_populates="screenshots")


# Composite and extra indexes
Index("ix_snapshots_user_captured", Screenshot.user_id, Screenshot.captured_at.desc())
Index("ix_snapshots_app_name", Screenshot.app_name)
Index("ix_users_role", User.role)