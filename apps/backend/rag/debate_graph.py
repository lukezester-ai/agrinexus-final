from langgraph.graph import StateGraph, END
from .states.debate_state import DebateState
from .prompts import generate_prompt
from langchain_core.messages import AIMessage, HumanMessage

from .core.llm import llm

async def market_agent(state: DebateState):
    prompt = generate_prompt("market_intelligence", 
                           question=state.get("question", ""),
                           context="", 
                           culture=state.get("culture", ""))
    response = llm.invoke(prompt)
    
    opinions = state.get("agent_opinions", {})
    opinions["market"] = response.content
    
    return {
        "agent_opinions": opinions,
        "messages": [AIMessage(content=f"[Market Agent]: {response.content}")]
    }

async def risk_agent(state: DebateState):
    prompt = generate_prompt("risk_weather", 
                           question=state.get("question", ""),
                           context="",
                           culture=state.get("culture", ""),
                           region=state.get("region", ""))
    response = llm.invoke(prompt)
    
    opinions = state.get("agent_opinions", {})
    opinions["risk"] = response.content
    
    return {
        "agent_opinions": opinions,
        "messages": [AIMessage(content=f"[Risk Agent]: {response.content}")]
    }

async def crop_agent(state: DebateState):
    prompt = generate_prompt("crop_expert", 
                           question=state.get("question", ""),
                           context="",
                           culture=state.get("culture", ""),
                           region=state.get("region", ""))
    response = llm.invoke(prompt)
    
    opinions = state.get("agent_opinions", {})
    opinions["crop"] = response.content
    
    return {
        "agent_opinions": opinions,
        "messages": [AIMessage(content=f"[Crop Expert]: {response.content}")]
    }

async def critic_agent(state: DebateState):
    """Critic Agent – проверява слабости, противоречия и реалистичност"""
    
    opinions_text = "\n\n".join([
        f"{agent.upper()} AGENT:\n{opinion}" 
        for agent, opinion in state.get("agent_opinions", {}).items()
    ])
    
    prompt = f"""
    Ти си Critic Agent в AgriNexus — строг, но конструктивен критик.

    Въпрос: {state.get('question', '')}

    МНЕНИЯ НА СПЕЦИАЛИСТИТЕ:
    {opinions_text}

    Твоята задача:
    1. Намери **противоречия** между агентите
    2. Посочи **нереалистични** или **твърде рискови** препоръки
    3. Провери дали съветите са подходящи за **малки и средни фермери** в България
    4. Предложи как да се подобрят отговорите
    5. Оцени общата увереност (висока / средна / ниска)

    Бъди обективен, честен и практичен.
    """

    response = llm.invoke([HumanMessage(content=prompt)])
    
    critic_feedback = state.get("critic_feedback", {})
    critic_feedback["critic"] = response.content
    
    return {
        "critic_feedback": critic_feedback,
        "messages": [AIMessage(content=f"[Critic Agent]: {response.content}")]
    }

async def orchestrator(state: DebateState):
    critic_input = state.get("critic_feedback", {}).get("critic", "")
    
    opinions = "\n\n".join([
        f"{agent.upper()} AGENT:\n{opinion}" 
        for agent, opinion in state.get("agent_opinions", {}).items()
    ])
    
    prompt = f"""
    Ти си Orchestrator Agent.

    ВЪПРОС: {state.get('question', '')}

    МНЕНИЯ НА АГЕНТИТЕ:
    {opinions}

    КРИТИКА:
    {critic_input}

    Създай **финален практически отговор** за фермера:
    - Вземи предвид критиката
    - Балансирай мненията
    - Дай ясни, actionable препоръки
    - Посочи рисковете
    - Завърши с приоритетни стъпки
    """

    final_response = llm.invoke(prompt)
    
    return {
        "final_answer": final_response.content,
        "consensus_level": "high" if "висока" in critic_input.lower() else "medium",
        "debate_history": [
            {"agent": "Market", "content": state.get("agent_opinions", {}).get("market", "")},
            {"agent": "Risk", "content": state.get("agent_opinions", {}).get("risk", "")},
            {"agent": "Crop", "content": state.get("agent_opinions", {}).get("crop", "")},
            {"agent": "Critic", "content": critic_input},
        ]
    }

def build_debate_graph():
    workflow = StateGraph(DebateState)
    
    # Специализирани агенти
    workflow.add_node("market_agent", market_agent)
    workflow.add_node("risk_agent", risk_agent)
    workflow.add_node("crop_agent", crop_agent)
    
    # Critic Agent
    workflow.add_node("critic_agent", critic_agent)
    
    # Orchestrator (финален синтез)
    workflow.add_node("orchestrator", orchestrator)
    
    workflow.set_entry_point("market_agent")
    
    # Последователно изпълнение (Market -> Risk -> Crop -> Critic)
    workflow.add_edge("market_agent", "risk_agent")
    workflow.add_edge("risk_agent", "crop_agent")
    workflow.add_edge("crop_agent", "critic_agent")
    
    # След критиката → Orchestrator
    workflow.add_edge("critic_agent", "orchestrator")
    workflow.add_edge("orchestrator", END)
    
    return workflow.compile()

debate_graph = build_debate_graph()

async def ask_with_debate(question: str, user_id: str, farm_profile: dict):
    initial_state = {
        "question": question,
        "farm_profile": farm_profile,
        "culture": farm_profile.get("cultures", [""])[0] if farm_profile.get("cultures") else "",
        "region": farm_profile.get("region", ""),
        "debate_rounds": 1,
        "max_rounds": 2,
        "agent_opinions": {},
        "critic_feedback": {},
        "messages": []
    }
    
    config = {"configurable": {"thread_id": f"debate_{user_id}"}}
    
    result = await debate_graph.ainvoke(initial_state, config)
    return {
        "final_answer": result.get("final_answer", ""),
        "consensus_level": result.get("consensus_level", "medium"),
        "debate_history": result.get("debate_history", [])
    }
