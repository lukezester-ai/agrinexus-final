from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict, Annotated, List, Optional
from operator import add
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.documents import Document
from retriever import retriever
import json

from core.llm import llm

def generate_prompt(question, context, chat_history):
    return f"Въпрос: {question}\nКонтекст: {context}\nИстория: {chat_history}"

class TutorState(TypedDict):
    messages: Annotated[List, add]           # пълна история
    question: str
    rewritten_question: Optional[str]
    documents: List[Document]
    context: str
    answer: str
    sources: List[dict]
    user_id: str
    culture: Optional[str]
    region: Optional[str]

# Nodes
def rewrite_query(state: TutorState):
    """Подобряване на въпроса с контекст от историята"""
    recent_messages = state["messages"][-4:]  # последните 4 съобщения
    # Можеш да добавиш LLM-based rewrite тук
    return {"rewritten_question": state["question"]}

def retrieve_documents(state: TutorState):
    filters = {}
    if state.get("culture"):
        filters["course"] = state["culture"]
    if state.get("region"):
        filters["region"] = state["region"]

    data = retriever.get_context(state["rewritten_question"] or state["question"], filters)
    
    return {
        "documents": data["documents"],
        "context": data["context"],
        "sources": data["sources"]
    }

def generate_response(state: TutorState):
    prompt = generate_prompt(
        question=state["question"],
        context=state["context"],
        chat_history=state["messages"][-6:]   # последните няколко съобщения
    )
    
    response = llm.invoke([HumanMessage(content=prompt)])
    
    return {
        "answer": response.content,
        "messages": [HumanMessage(content=state["question"]), AIMessage(content=response.content)]
    }

# Graph Construction
def build_tutor_graph():
    workflow = StateGraph(TutorState)
    
    workflow.add_node("rewrite", rewrite_query)
    workflow.add_node("retrieve", retrieve_documents)
    workflow.add_node("generate", generate_response)
    
    workflow.set_entry_point("rewrite")
    workflow.add_edge("rewrite", "retrieve")
    workflow.add_edge("retrieve", "generate")
    workflow.add_edge("generate", END)
    
    # Memory
    memory = MemorySaver()
    
    return workflow.compile(checkpointer=memory)

# Инициализация
tutor_graph = build_tutor_graph()

# Използване
def chat_with_memory(user_id: str, question: str, culture=None, region=None, thread_id=None):
    config = {"configurable": {"thread_id": thread_id or user_id}}
    
    state = {
        "messages": [],
        "question": question,
        "user_id": user_id,
        "culture": culture,
        "region": region
    }
    
    result = tutor_graph.invoke(state, config)
    return result
