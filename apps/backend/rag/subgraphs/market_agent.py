from langgraph.graph import StateGraph, END
from subgraph_state import SubgraphState

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.llm import llm

def market_retrieve(state: SubgraphState):
    # Използва Yahoo Finance + Academy RAG
    market_context = "Актуална пазарна информация (Плейсхолдър)"
    return {"context": market_context}

def market_generate(state: SubgraphState):
    prompt = f"""
    Ти си Market Intelligence Agent.
    Контекст: {state.get("context", "")}
    """
    response = llm.invoke(prompt)
    return {"answer": response.content, "sources": []}

def build_market_subgraph():
    workflow = StateGraph(SubgraphState)
    workflow.add_node("retrieve", market_retrieve)
    workflow.add_node("generate", market_generate)
    
    workflow.set_entry_point("retrieve")
    workflow.add_edge("retrieve", "generate")
    workflow.add_edge("generate", END)
    
    return workflow.compile()
