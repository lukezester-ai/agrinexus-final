from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from langchain_core.messages import HumanMessage

from .main_agent_graph import graph

router = APIRouter(prefix="/orchestrator", tags=["Orchestrator"])

class FarmContext(BaseModel):
    name: Optional[str] = None
    hectares: Optional[int] = None
    crop: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    locale: str = "bg"
    farmContext: Optional[List[FarmContext]] = []

@router.post("/chat")
async def orchestrator_chat(request: ChatRequest):
    # Construct farm context string
    farm_ctx_str = ""
    if request.farmContext:
        fields = [f"{f.hectares or '?'}ha {f.crop or ''} ({f.name or ''})" for f in request.farmContext]
        farm_ctx_str = ", ".join(fields)

    initial_state = {
        "messages": [HumanMessage(content=request.message)],
        "farm_context": farm_ctx_str
    }
    
    try:
        # We use invoke which runs the LangGraph synchronously and returns the final state
        result = graph.invoke(initial_state)
        
        # Get the final AI message
        final_message = result["messages"][-1].content
        handled_by = result.get("handled_by", "Оркестратор")
        
        return {
            "response": final_message,
            "handledBy": handled_by,
            "lastRoute": handled_by.lower()
        }
    except Exception as e:
        return {
            "error": str(e),
            "handledBy": "error",
            "lastRoute": "error"
        }

class BriefingRequest(BaseModel):
    location: str = "Плевен"
    commodity: str = "wheat"
    farmContext: Optional[List[FarmContext]] = []

@router.post("/briefing")
async def daily_briefing(request: BriefingRequest):
    """Генерира сутрешен брифинг чрез координиране на 3 агента: Weather, Market и Agronomy."""
    try:
        # 1. Ask Weather Agent
        w_state = {"messages": [HumanMessage(content=f"Какво е времето в {request.location} днес? Отговори кратко.")], "farm_context": ""}
        w_res = graph.invoke(w_state)
        weather_info = w_res["messages"][-1].content

        # 2. Ask Market Agent
        m_state = {"messages": [HumanMessage(content=f"Каква е цената на {request.commodity} днес? Отговори кратко.")], "farm_context": ""}
        m_res = graph.invoke(m_state)
        market_info = m_res["messages"][-1].content

        # 3. Ask Agronomy Agent to summarize
        farm_ctx_str = ""
        if request.farmContext:
            fields = [f"{f.hectares or '?'}ha {f.crop or ''}" for f in request.farmContext]
            farm_ctx_str = ", ".join(fields)

        prompt = f"""
        Ти си Главен Агроном (Agronomy Agent). Подготви сутрешен брифинг за фермера.
        Ето данните от другите агенти:
        - Време ({request.location}): {weather_info}
        - Пазари ({request.commodity}): {market_info}
        
        Направи кратко и стегнато резюме (до 3-4 изречения общо). 
        Включи 1 изречение за времето, 1 за пазара и 1-2 изречения конкретен агрономически съвет (напр. дали е подходящо за пръскане, предвид вятъра/влажността, или дали да продава предвид цената).
        """
        
        a_state = {
            "messages": [HumanMessage(content=prompt)],
            "farm_context": farm_ctx_str
        }
        # Force it to go to agronomy agent directly by bypassing orchestrator, or just let orchestrator route it.
        # Orchestrator will route it to Agronomy because the prompt mentions "Агроном".
        a_res = graph.invoke(a_state)
        final_briefing = a_res["messages"][-1].content

        return {
            "briefing": final_briefing,
            "handledBy": "Briefing System (Weather + Market + Agronomy)"
        }
    except Exception as e:
        return {"error": str(e)}
