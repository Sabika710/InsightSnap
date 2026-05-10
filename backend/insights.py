import os
from groq import Groq
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv 
from sqlalchemy.future import select 
from database import AsyncSessionLocal
from models import Screenshot

# 2. Load the .env file
load_dotenv() 

router = APIRouter()

class InsightRequest(BaseModel):
    prompt: str

# 3. Retrieve the key securely
GROQ_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_KEY)

def analyze_productivity(activity_logs):
    chat_completion = client.chat.completions.create(
        messages=[{"role": "user", "content": f"Analyze this data: {activity_logs}"}],
        model="llama-3.1-8b-instant",
    )
    return chat_completion.choices[0].message.content

@router.post('/api/manager/insights')
async def get_insights(request_data: InsightRequest):
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(Screenshot).order_by(Screenshot.captured_at.desc()).limit(20)
            result = await session.execute(stmt)
            raw_logs = result.scalars().all()
            
            formatted_logs = [
                f"App: {log.app_name} | Window: {log.window_title} | Score: {log.productivity_score}" 
                for log in raw_logs
            ]
            
            ai_context = f"Recent team activity: {formatted_logs}. "
            full_prompt = ai_context + request_data.prompt
            
            # 3. CALL LLM
            response = analyze_productivity(full_prompt)
            return {"reply": response}
            
        except Exception as e:
            print(f"Error fetching logs: {e}")
            raise HTTPException(status_code=500, detail="Payload optimization required")