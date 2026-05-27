from langchain_core.messages import AIMessage, HumanMessage
from subgraph_state import SubgraphState
from datetime import datetime

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.llm import llm

def ask_for_clarification(state: SubgraphState):
    """Node, който задава уточняващи въпроси на потребителя"""
    
    prompt = f"""
    Ти си AgriNexus Tutor. Потребителят зададе въпрос, но контекстът е недостатъчен.

    Оригинален въпрос: "{state.get('question', '')}"

    Задача:
    - Задай **1 или максимум 2** кратки и ясни въпроса за уточнение.
    - Бъди учтив и естествен.
    - Не давай финален отговор, а само уточняващи въпроси.
    - Използвай български език.
    
    Пример:
    "За да ти дам точен отговор, можеш ли да ми кажеш:
    1. Коя култура отглеждаш в това поле?
    2. В кой регион се намира?"
    """

    response = llm.invoke([HumanMessage(content=prompt)])
    
    return {
        "answer": response.content,
        "messages": [AIMessage(content=response.content)],
        "needs_clarification": True,
        "metadata": {
            "node": "ask_for_clarification",
            "timestamp": datetime.now().isoformat()
        }
    }
