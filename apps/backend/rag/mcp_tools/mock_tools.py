from langchain_core.tools import tool
import random

@tool
def get_current_weather(location: str) -> str:
    """Извлича симулирани данни за времето за дадена локация."""
    # Симулиран отговор
    temps = [12, 15, 18, 22, 25, 28]
    conditions = ["Слънчево", "Облачно", "Лек дъжд", "Проливен дъжд", "Ветровито"]
    
    t = random.choice(temps)
    c = random.choice(conditions)
    
    return f"В момента в {location} е {t}°C и {c}."

@tool
def get_market_prices(commodity: str) -> str:
    """Извлича симулирани пазарни цени (MATIF/CBOT) за дадена култура (напр. пшеница, царевица)."""
    prices = {
        "пшеница": "MATIF Пшеница (декември): 235 EUR/t",
        "царевица": "MATIF Царевица (ноември): 210 EUR/t",
        "слънчоглед": "Симулиран физически пазар: 850 BGN/t",
        "рапица": "MATIF Рапица (февруари): 460 EUR/t",
        "wheat": "MATIF Wheat: 235 EUR/t",
        "corn": "MATIF Corn: 210 EUR/t"
    }
    
    key = commodity.lower().strip()
    return prices.get(key, f"Нямам актуални данни за {commodity}.")

@tool
def get_field_ndvi(field_id: str) -> str:
    """Извлича симулирани сателитни данни (NDVI) за дадено поле."""
    return f"Поле {field_id}: Среден NDVI е 0.72. Забелязана е лека аномалия в североизточния край (възможен стрес или плевели)."
