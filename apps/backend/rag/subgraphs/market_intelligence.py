from langgraph.graph import StateGraph, END
from subgraph_state import SubgraphState
from langchain_core.messages import HumanMessage, AIMessage
import yfinance as yf
from datetime import datetime

# Плейсхолдъри за retriever и llm
class DummyRetriever:
    def get_context(self, question, filters, top_k):
        return {"documents": [], "context": f"Контекст за Market Intelligence (Филтри: {filters})", "sources": []}
retriever = DummyRetriever()

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.llm import llm

def market_data_retrieve(state: SubgraphState):
    """Извлича пазарни данни + RAG"""
    farm_profile = state.get("farm_profile", {})
    culture = state.get("culture") or farm_profile.get("main_culture")
    
    # 1. Academy RAG
    filters = {"course": "market", "topic": "sales"}
    rag_data = retriever.get_context(state.get("question", ""), filters=filters, top_k=8)
    
    # 2. Реални пазарни данни (Yahoo Finance)
    market_context = ""
    if culture:
        tickers = {
            "пшеница": "ZW=F",      # Wheat futures
            "царевица": "ZC=F",
            "слънчоглед": "SOYB=F"  # approximate
        }
        ticker = tickers.get(culture.lower(), None)
        if ticker:
            try:
                data = yf.Ticker(ticker).history(period="30d")
                if not data.empty:
                    current_price = data['Close'].iloc[-1]
                    trend = "↑" if current_price > data['Close'].iloc[-5] else "↓"
                    market_context = f"Текуща цена на {culture} ({ticker}): {current_price:.2f} (тренд: {trend})"
            except Exception as e:
                print(f"Грешка при извличане на yfinance данни за {ticker}: {e}")
                pass
    
    combined_context = rag_data.get("context", "") + "\n\n" + market_context
    
    return {
        "context": combined_context,
        "documents": rag_data.get("documents", []),
        "sources": rag_data.get("sources", [])
    }


def market_analyze(state: SubgraphState):
    """Анализ и препоръки за продажба"""
    prompt = f"""
    Ти си Market Intelligence Agent в AgriNexus.
    Анализирай ситуацията и дай **практични** препоръки за продажба.

    Култура: {state.get('culture')}
    Въпрос: {state.get('question', '')}
    
    Контекст:
    {state.get('context', '')}
    
    Изисквания:
    - Бъди честен и консервативен в препоръките
    - Посочи оптимален прозорец за продажба
    - Дай обосновка (ценообразуване, сезон, тенденции)
    - Добави рискове
    """
    
    response = llm.invoke([HumanMessage(content=prompt)])
    
    return {
        "answer": response.content,
        "messages": [AIMessage(content=response.content)],
        "metadata": {"agent": "market_intelligence", "timestamp": datetime.now().isoformat()}
    }


def build_market_intelligence_subgraph():
    workflow = StateGraph(SubgraphState)
    
    workflow.add_node("retrieve", market_data_retrieve)
    workflow.add_node("analyze", market_analyze)
    
    workflow.set_entry_point("retrieve")
    workflow.add_edge("retrieve", "analyze")
    workflow.add_edge("analyze", END)
    
    return workflow.compile()
