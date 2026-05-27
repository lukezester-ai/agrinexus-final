from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from core.llm import llm

router_prompt = ChatPromptTemplate.from_template("""
Ти си Router Agent за AgriNexus Academy Tutor.

Въпрос: {question}
Култура: {culture}
Регион: {region}

Определи към кой специалист трябва да се насочи въпросът.
Възможни опции:
- general
- crop_expert
- market_intelligence
- risk_weather
- soil_nutrition
- subsidies

Отговори САМО с едно от горните ключови думи (lowercase).
""")

def llm_router(state) -> str:
    """Интелигентен LLM-based routing"""
    # Тук state е TutorState (речник)
    farm_profile = state.get("farm_profile", {})
    
    chain = router_prompt | llm | StrOutputParser()
    
    try:
        # В реалния случай llm е истински Chat модел, който връща стринг през StrOutputParser
        result = chain.invoke({
            "question": state.get("question", ""),
            "culture": farm_profile.get("main_culture", ""),
            "region": farm_profile.get("region", "")
        })
        route = str(result).strip().lower()
    except Exception as e:
        # Fallback при грешка с DummyLLM или истинския
        route = "general"
        
    valid_routes = ["general", "crop_expert", "market_intelligence", "risk_weather", "soil_nutrition", "subsidies"]
    return route if route in valid_routes else "general"
