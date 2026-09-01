from fastapi import APIRouter, Depends, HTTPException

from app.agents.health_agent import HealthAgent
from app.api.deps import get_health_agent
from app.core.config import get_settings
from app.schemas.recommendation import AskRequest, AskResponse

router = APIRouter(prefix="/api/v1", tags=["ask"])


@router.post("/ask", response_model=AskResponse)
def ask(body: AskRequest, agent: HealthAgent = Depends(get_health_agent)):
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="Ask SwasthyaGrid is currently unavailable. GEMINI_API_KEY is not configured on the server."
        )
    return agent.ask(body.message)
