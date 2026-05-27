import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# Зареждане на ключовете от .env
load_dotenv()

def get_llm():
    """
    Инициализира реалния LLM модел.
    По подразбиране използва GPT-4o-mini заради оптималното съотношение цена/качество,
    но може лесно да бъде сменен с 'gpt-4o' или друг съвместим модел.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    
    if not api_key or api_key == "your_openai_api_key":
        print("WARNING: OPENAI_API_KEY is missing or invalid. Using placeholder.")
        class DummyLLM:
            def invoke(self, messages_or_prompt):
                return type('Obj', (object,), {'content': 'Плейсхолдър: Моля, добавете OPENAI_API_KEY в .env файла.'})()
        return DummyLLM()
        
    return ChatOpenAI(
        model="gpt-4o-mini",  
        temperature=0.2,      # Ниска температура (0.2) за консервативни, фактологични и точни агро-съвети
        api_key=api_key,
        max_tokens=1500
    )

# Глобална инстанция, която се импортира от агентите
llm = get_llm()
