from langgraph.graph import StateGraph, END
from subgraph_state import SubgraphState
from langchain_core.messages import HumanMessage, AIMessage
from datetime import datetime
from langgraph.checkpoint.memory import MemorySaver

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from nodes.clarification import ask_for_clarification

class DummyRetriever:
    def get_context(self, question, filters, top_k):
        return {"documents": [], "context": f"Контекст за Risk/Weather (Филтри: {filters})", "sources": []}
retriever = DummyRetriever()

from core.llm import llm

def get_coordinates(region: str):
    # Връща координатите на България/София по подразбиране, докато се върже Geocoding API
    return 42.6977, 23.3219

def weather_and_risk_retrieve(state: SubgraphState):
    """Извлича weather + risk data"""
    farm_profile = state.get("farm_profile", {})
    region = farm_profile.get("region", "България")
    culture = state.get("culture") or farm_profile.get("main_culture")
    
    # 1. Academy RAG
    filters = {"course": "risk", "topic": ["weather", "disease", "drought"]}
    rag_data = retriever.get_context(state.get("question", ""), filters=filters, top_k=10)
    
    # 2. Реални weather данни (Open-Meteo)
    weather_context = ""
    try:
        lat, lon = get_coordinates(region)
        response = requests.get(
            f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
            "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max"
            "&forecast_days=7"
        )
        data = response.json()
        
        weather_context = f"""
        Прогноза за {region} (следващите 7 дни):
        - Температури: {data['daily']['temperature_2m_max'][0]}°C / {data['daily']['temperature_2m_min'][0]}°C
        - Вероятност за валеж: {data['daily']['precipitation_probability_max'][0]}%
        """
    except Exception as e:
        print(f"Грешка при извличане на метеорологични данни: {e}")
        weather_context = "Не успях да взема актуални метеорологични данни."

    combined_context = rag_data.get("context", "") + "\n\n" + weather_context
    
    return {
        "context": combined_context,
        "documents": rag_data.get("documents", []),
        "sources": rag_data.get("sources", []),
        "metadata": {"agent": "risk_weather"}
    }

def risk_analyze(state: SubgraphState):
    """Анализ на рисковете и препоръки"""
    prompt = f"""
    Ти си Risk & Weather Agent в AgriNexus — много консервативен и практичен.

    Култура: {state.get('culture')}
    Регион: {state.get('region')}
    Въпрос: {state.get('question', '')}

    Контекст:
    {state.get('context', '')}

    Задачи:
    - Оцени риска (нисък / среден / висок)
    - Дай конкретни препоръки за действие
    - Посочи критични дати (ако има)
    - Включи потенциални болести или проблеми
    - Бъди честен за несигурностите
    """

    response = llm.invoke([HumanMessage(content=prompt)])
    
    return {
        "answer": response.content,
        "messages": [AIMessage(content=response.content)],
        "metadata": {
            "agent": "risk_weather",
            "risk_level": "medium",  # може да се парсва от LLM
            "timestamp": datetime.now().isoformat()
        }
    }

def build_risk_weather_subgraph():
    workflow = StateGraph(SubgraphState)
    
    workflow.add_node("retrieve", weather_and_risk_retrieve)
    workflow.add_node("analyze", risk_analyze)
    workflow.add_node("clarify", ask_for_clarification)
    
    workflow.set_entry_point("retrieve")
    workflow.add_edge("retrieve", "analyze")
    
    workflow.add_conditional_edges(
        "analyze",
        lambda state: "clarify" if state.get("needs_clarification", False) else END,
        {
            "clarify": "clarify",
            END: END
        }
    )
    
    workflow.add_edge("clarify", "retrieve")
    
    # За локални тестове използваме MemorySaver, после сменяме на PostgresSaver
    checkpointer = MemorySaver()
    
    return workflow.compile(checkpointer=checkpointer)
