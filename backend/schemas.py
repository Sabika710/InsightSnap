from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional


class ScreenshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    file_path: str
    window_title: Optional[str] = None
    app_name: Optional[str] = None
    productivity_score: Optional[float] = None
    captured_at: datetime


class UserCard(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    role: str
    is_active_monitoring: bool
    created_at: datetime
    last_seen: Optional[datetime] = None
    latest_screenshots: list[ScreenshotOut] = []


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    full_name: str
    role: str
    is_active_monitoring: bool


class MonitoringToggle(BaseModel):
    is_active_monitoring: bool


class HeartbeatResponse(BaseModel):
    user_id: int
    is_active_monitoring: bool
    server_time: datetime


class ScreenshotResponse(BaseModel):
    status: str
    path: str


class ActivityRequest(BaseModel):
    window_title: str
    productivity_score: float


class ActivityResponse(BaseModel):
    status: str
    score: float


# Chart data schemas
class ScoreTimelinePoint(BaseModel):
    slot: str
    user_id: int
    full_name: str
    avg_score: float


class AppUsageItem(BaseModel):
    app_name: str
    count: int
    avg_score: float


class HourlyAvgItem(BaseModel):
    hour: int
    avg_score: float


class CurrentScoreItem(BaseModel):
    user_id: int
    full_name: str
    score: Optional[float]
    window_title: Optional[str]


class ChartsResponse(BaseModel):
    score_timeline: list[ScoreTimelinePoint]
    app_usage: list[AppUsageItem]
    hourly_avg: list[HourlyAvgItem]
    current_scores: list[CurrentScoreItem]

class UserCreateSchema(BaseModel):
    full_name: str
    email: EmailStr  
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    full_name: str
    email: str
    role: str
    is_active_monitoring: bool