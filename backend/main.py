import logging
import os
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import get_db, init_db
from fastapi import Depends, FastAPI
from sqlalchemy.ext.asyncio import AsyncSession


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)



@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("static/screenshots", exist_ok=True) 
    await init_db()
    logger.info("SnapSync backend started")
    yield
    # Shutdown
    logger.info("SnapSync backend shutting down")


app = FastAPI(
    title="SnapSync Enterprise API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

# Static files for screenshots
app.mount("/static", StaticFiles(directory="static"), name="static")

# Routers
from routers.auth import router as auth_router
from routers.employee import router as employee_router  
from routers.manager import router as manager_router
import insights

app.include_router(auth_router)
app.include_router(employee_router, prefix="/api")        # ← Only /api, no /employee
app.include_router(manager_router)
app.include_router(insights.router)

@app.get("/")
async def root():
    return {"name": "SnapSync Enterprise API", "version": "2.0.0", "docs": "/docs"}



@app.get("/startup-check") 
async def startup_check():
    return {"status": "online"}

@app.router.on_startup.append
async def startup_event():
    print("SnapSync backend started")