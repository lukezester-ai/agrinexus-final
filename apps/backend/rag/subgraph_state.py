from typing import TypedDict, Annotated, List, Optional
from operator import add
from langchain_core.messages import BaseMessage
from langchain_core.documents import Document

class SubgraphState(TypedDict):
    messages: Annotated[List[BaseMessage], add]
    question: str
    context: str
    documents: List[Document]
    answer: str
    sources: List[dict]
    culture: Optional[str]          # пшеница, домати и т.н.
    region: Optional[str]
    metadata: dict
    farm_profile: dict              # Профил на фермата
    needs_clarification: bool       # Флаг за multi-turn разяснения
