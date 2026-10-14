from typing import TypedDict, Annotated, List, Dict, Optional
from operator import add
from langchain_core.messages import BaseMessage

class DebateState(TypedDict):
    question: str
    farm_profile: Dict
    culture: Optional[str]
    region: Optional[str]
    
    messages: Annotated[List[BaseMessage], add]
    agent_opinions: Dict[str, str]           # Мненията на специализираните агенти
    critic_feedback: Dict[str, str]          # Критиката на Critic Agent
    debate_rounds: int
    max_rounds: int
    
    final_answer: str
    consensus_level: str                     # full / partial / low
    key_risks: List[str]
    recommendations: List[Dict]
    debate_history: List[Dict[str, str]]
