from typing import TypedDict, Annotated, List, Optional
from operator import add
from langchain_core.messages import BaseMessage, HumanMessage
from langgraph.graph import StateGraph, END, START
from langgraph.checkpoint.memory import MemorySaver

# Импортваме subgraphs и router
from subgraphs.crop_expert import build_crop_expert_subgraph
from subgraphs.market_intelligence import build_market_intelligence_subgraph
from subgraphs.risk_weather import build_risk_weather_subgraph
from router import llm_router

crop_subgraph = build_crop_expert_subgraph()
market_subgraph = build_market_intelligence_subgraph()
risk_weather_subgraph = build_risk_weather_subgraph()

class TutorState(TypedDict):
    user_id: str
    messages: Annotated[List[BaseMessage], add]
    question: str
    context: str
    answer: str
    sources: List[dict]
    culture: Optional[str]
    region: Optional[str]
    farm_profile: dict

def rewrite_query(state: TutorState):
    return {"question": state.get("question", "")}

def general_retrieve(state: TutorState):
    return {"context": "Общ контекст за основния поток"}

def general_generate(state: TutorState):
    return {"answer": "Отговор от основния (General) агент", "sources": []}

def enter_subgraph(state: TutorState, subgraph, thread_id: str):
    """Влиза в subgraph с multi-turn поддръжка"""
    user_id = state.get("user_id", "default_user")
    config = {
        "configurable": {
            "thread_id": f"{user_id}_{thread_id}"   # уникален thread за всеки subgraph и user
        }
    }
    
    subgraph_input = {
        "question": state.get("question", ""),
        "messages": state.get("messages", [])[-6:],
        "farm_profile": state.get("farm_profile", {}),
        "culture": state.get("farm_profile", {}).get("main_culture"),
        "region": state.get("farm_profile", {}).get("region")
    }
    
    result = subgraph.invoke(subgraph_input, config)
    
    # Връщаме отговора от subgraph-а към основния state
    return {"answer": result.get("answer"), "sources": result.get("sources")}

def build_main_graph():
    workflow = StateGraph(TutorState)
    
    workflow.add_node("rewrite", rewrite_query)
    workflow.add_node("general_retrieve", general_retrieve)
    workflow.add_node("general_generate", general_generate)
    
    # Subgraphs nodes
    workflow.add_node("market_intelligence", 
        lambda state: enter_subgraph(state, market_subgraph, thread_id="market")
    )
    workflow.add_node("crop_expert", 
        lambda state: enter_subgraph(state, crop_subgraph, thread_id="crop")
    )
    workflow.add_node("risk_weather", 
        lambda state: enter_subgraph(state, risk_weather_subgraph, thread_id="risk_weather")
    )
    
    workflow.set_entry_point("rewrite")
    workflow.add_edge("rewrite", "general_retrieve")
    workflow.add_edge("general_retrieve", "general_generate")
    
    # LLM-based Conditional Router
    workflow.add_conditional_edges(
        "general_generate",
        llm_router,
        {
            "market_intelligence": "market_intelligence",
            "crop_expert": "crop_expert",
            "risk_weather": "risk_weather",
            "general": END
        }
    )
    
    # Край след изпълнение на подграф
    workflow.add_edge("market_intelligence", END)
    workflow.add_edge("crop_expert", END)
    workflow.add_edge("risk_weather", END)
    
    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)

main_tutor_graph = build_main_graph()

def update_farm_profile(state: TutorState, new_info: dict):
    """Обновяване на профила по време на чат"""
    current_profile = state.get("farm_profile", {})
    current_profile.update(new_info)
    state["farm_profile"] = current_profile
    return state
