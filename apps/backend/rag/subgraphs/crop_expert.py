from langgraph.graph import StateGraph, END
from subgraph_state import SubgraphState
import sys
import os

# Плейсхолдър за retriever
class DummyRetriever:
    def get_context(self, question, filters, top_k):
        return {"documents": [], "context": f"Контекст за Crop Expert (Филтри: {filters})"}
retriever = DummyRetriever()

from core.llm import llm

def crop_specific_retrieve(state: SubgraphState):
    filters = {"course": state.get("culture", "general"), "topic": "cultivation"}
    data = retriever.get_context(state.get("question", ""), filters=filters, top_k=10)
    return {"documents": data["documents"], "context": data["context"]}

def crop_expert_generate(state: SubgraphState):
    prompt = f"""
    Ти си Crop Expert за {state.get("culture", "неизвестна култура")}.
    Отговаряй детайлно, практически и с фокус върху български условия.
    Контекст: {state.get("context", "")}
    """
    response = llm.invoke(prompt)
    return {"answer": response.content, "sources": []}

def build_crop_expert_subgraph():
    workflow = StateGraph(SubgraphState)
    workflow.add_node("retrieve", crop_specific_retrieve)
    workflow.add_node("generate", crop_expert_generate)
    
    workflow.set_entry_point("retrieve")
    workflow.add_edge("retrieve", "generate")
    workflow.add_edge("generate", END)
    
    return workflow.compile()
