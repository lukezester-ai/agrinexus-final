from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from langchain_core.messages import HumanMessage

from main_agent_graph import graph

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
