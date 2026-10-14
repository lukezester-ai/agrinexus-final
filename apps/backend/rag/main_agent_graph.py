import os
from typing import Annotated, Sequence, TypedDict, Literal
from dotenv import load_dotenv

from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage
from langchain_mistralai import ChatMistralAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

# Import real tools
from .mcp_tools.real_tools import get_current_time, get_real_market_prices, search_local_documents, get_current_weather

load_dotenv()

# State Definition
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    next_agent: str
    farm_context: str
    handled_by: str

# Ensure Mistral API Key is available
api_key = os.getenv("MISTRAL_API_KEY")
if not api_key:
    # Use a dummy key to prevent crash during import/build if not set
    api_key = "dummy_key"

llm = ChatMistralAI(model="mistral-large-latest", mistral_api_key=api_key, temperature=0.2)

# --- SYSTEM PROMPTS ---
ORCHESTRATOR_SYSTEM = """Вие сте AgriNexus Orchestrator (Ръководител на мрежа от агенти).
Имате 5 специализирани агента на разположение:
- "market": За въпроси относно цени, борси (CBOT/MATIF), продажби, hedge.
- "weather": За въпроси относно прогноза за времето, подходящо време за пръскане или напояване.
- "field": За въпроси относно състоянието на полетата, сателитни снимки (NDVI).
- "academy": За въпроси, свързани с обучение, курсове, агрономически теории.
- "agronomy": За въпроси, свързани с болести, плевели, торове, третиране с препарати и агрономически съвети.

Ако потребителят задава въпрос, решете кой агент е най-подходящ да му отговори.
Ако въпросът е просто поздрав или не изисква специален агент, отговорете с "FINISH".
Връщайте САМО името на агента ("market", "weather", "field", "academy", "agronomy") или "FINISH". Няма нужда от обяснения.
"""

AGENTS_PROMPTS = {
    "market": "Вие сте AgriNexus Market Agent. Анализирайте пазарите и давайте прогнози. Задължително използвайте инструмента за пазарни цени (get_real_market_prices). Винаги проверявайте текущото време с get_current_time, за да знаете коя е днешната дата.",
    "weather": "Вие сте AgriNexus Weather Agent. Давайте съвети за пръскане или напояване въз основа на реални метеорологични данни. Задължително използвайте инструмента за времето (get_current_weather), за да проверите локацията. Ако потребителят не е посочил град, попитайте го. Винаги проверявайте текущото време с get_current_time.",
    "field": "Вие сте AgriNexus Field Agent. Задължително проверете текущото време с get_current_time.",
    "academy": "Вие сте AgriNexus Academy Agent. Отговаряйте на образователни въпроси и търсете информация в докладите с инструмента search_local_documents. Винаги проверявайте текущото време с get_current_time.",
    "agronomy": "Вие сте AgriNexus Agronomy Agent. Вие сте главен агроном. Давайте съвети за болести по културите, торене и третиране с препарати. Задължително проверявайте текущото време с get_current_time."
}

# --- NODES ---

def orchestrator_node(state: AgentState):
    """Router node that decides which agent to call next."""
    messages = state.get("messages", [])
    
    # If the last message is from an AI, it means an agent already answered, so we finish.
    if messages and messages[-1].type == "ai" and not messages[-1].tool_calls:
        return {"next_agent": "FINISH"}
        
    prompt = [SystemMessage(content=ORCHESTRATOR_SYSTEM)] + list(messages)
    
    # We force the LLM to output just the agent name
    response = llm.invoke(prompt)
    decision = response.content.strip().lower()
    
    # Clean up the output in case the LLM was chatty
    valid_agents = ["market", "weather", "field", "academy", "agronomy", "finish"]
    next_agent = "FINISH"
    for agent in valid_agents:
        if agent in decision:
            next_agent = agent
            break
            
    return {"next_agent": next_agent}

def create_agent_node(agent_name: str, tools: list):
    def agent_node(state: AgentState):
        sys_prompt = AGENTS_PROMPTS[agent_name]
        if state.get("farm_context"):
            sys_prompt += f"\n\nКонтекст за фермата: {state['farm_context']}"
            
        messages = [SystemMessage(content=sys_prompt)] + list(state.get("messages", []))
        
        if tools:
            model = llm.bind_tools(tools)
        else:
            model = llm
            
        response = model.invoke(messages)
        return {"messages": [response], "handled_by": agent_name.capitalize()}
    return agent_node

# Create specific agent nodes with their respective tools
market_node = create_agent_node("market", [get_real_market_prices, get_current_time, search_local_documents])
weather_node = create_agent_node("weather", [get_current_time, get_current_weather])
field_node = create_agent_node("field", [get_current_time])
academy_node = create_agent_node("academy", [get_current_time, search_local_documents])
agronomy_node = create_agent_node("agronomy", [get_current_time])

# --- EDGES ---
def route_from_orchestrator(state: AgentState) -> str:
    next_agent = state.get("next_agent", "FINISH")
    if next_agent == "FINISH":
        return END
    return next_agent

def route_after_agent(state: AgentState) -> str:
    # If the agent called a tool, go to the tool node
    messages = state.get("messages", [])
    if messages and messages[-1].tool_calls:
        return "tools"
    # Otherwise, return to orchestrator
    return "orchestrator"

# --- BUILD GRAPH ---
builder = StateGraph(AgentState)

builder.add_node("orchestrator", orchestrator_node)
builder.add_node("market", market_node)
builder.add_node("weather", weather_node)
builder.add_node("field", field_node)
builder.add_node("academy", academy_node)
builder.add_node("agronomy", agronomy_node)

# Tool Node handles all tools
all_tools = [get_real_market_prices, get_current_time, search_local_documents, get_current_weather]
builder.add_node("tools", ToolNode(all_tools))

builder.add_edge(START, "orchestrator")
builder.add_conditional_edges("orchestrator", route_from_orchestrator, {
    "market": "market",
    "weather": "weather",
    "field": "field",
    "academy": "academy",
    "agronomy": "agronomy",
    END: END
})

# Agents route to either tools or back to orchestrator
for agent in ["market", "weather", "field", "academy", "agronomy"]:
    builder.add_conditional_edges(agent, route_after_agent, {
        "tools": "tools",
        "orchestrator": "orchestrator"
    })

# Tools always return to the agent that called them
# But LangGraph ToolNode requires conditional edge back to the caller if we don't know who called it.
# Actually, a simpler way is to route tools back to orchestrator, and orchestrator will route back to the agent.
# Let's route tools to orchestrator.
builder.add_edge("tools", "orchestrator")

graph = builder.compile()

# Test execution locally if run directly
if __name__ == "__main__":
    initial_state = {
        "messages": [HumanMessage(content="Каква е цената на пшеницата днес?")],
        "farm_context": ""
    }
    result = graph.invoke(initial_state)
    print(result["messages"][-1].content)
    print(f"Handled by: {result.get('handled_by')}")
