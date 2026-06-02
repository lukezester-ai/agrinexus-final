import os
import glob
from datetime import datetime
from langchain_core.tools import tool

# Ensure yfinance is available
try:
    import yfinance as yf
except ImportError:
    yf = None

import requests

@tool
def get_current_time() -> str:
    """Връща точните текущи дата и час, както и деня от седмицата."""
    now = datetime.now()
    days = ["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"]
    day_name = days[now.weekday()]
    return now.strftime(f"Днес е {day_name}, %Y-%m-%d %H:%M:%S")

@tool
def get_current_weather(location: str) -> str:
    """Извлича реални метеорологични данни за даден град (напр. София, Плевен) чрез Open-Meteo API.
    Връща температура, влажност, вятър и валежи.
    """
    try:
        # 1. Geocoding
        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={location}&count=1&language=bg&format=json"
        geo_res = requests.get(geo_url, timeout=5)
        geo_data = geo_res.json()
        
        if not geo_data.get("results"):
            # Try english if native fails
            geo_url_en = f"https://geocoding-api.open-meteo.com/v1/search?name={location}&count=1&language=en&format=json"
            geo_data = requests.get(geo_url_en, timeout=5).json()
            if not geo_data.get("results"):
                return f"Не можах да намеря координати за локация '{location}'."
                
        city = geo_data["results"][0]
        lat, lon = city["latitude"], city["longitude"]
        name = city.get("name", location)
        
        # 2. Weather
        weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&timezone=auto"
        w_res = requests.get(weather_url, timeout=5)
        w_data = w_res.json()
        
        current = w_data.get("current", {})
        temp = current.get("temperature_2m", "?")
        humidity = current.get("relative_humidity_2m", "?")
        precip = current.get("precipitation", "?")
        wind = current.get("wind_speed_10m", "?")
        
        return f"Времето в {name} (Lat: {lat:.2f}, Lon: {lon:.2f}):\n- Температура: {temp}°C\n- Относителна влажност: {humidity}%\n- Валежи: {precip} mm\n- Скорост на вятъра: {wind} km/h"
    except Exception as e:
        return f"Грешка при извличане на времето за {location}: {e}"

@tool
def get_real_market_prices(commodity: str) -> str:
    """Извлича реални борсови цени (CBOT futures) в реално време за дадена култура.
    Поддържа: пшеница (wheat), царевица (corn), соя (soybean).
    """
    if not yf:
        return "Модулът yfinance не е инсталиран. Не мога да изтегля реални цени."
        
    tickers = {
        "wheat": "ZW=F",
        "пшеница": "ZW=F",
        "corn": "ZC=F",
        "царевица": "ZC=F",
        "soybeans": "ZS=F",
        "соя": "ZS=F",
        "soybean": "ZS=F"
    }
    
    ticker_symbol = tickers.get(commodity.lower().strip())
    if not ticker_symbol:
        return f"Нямам борсов тикер за '{commodity}'. Опитай с пшеница, царевица или соя."
        
    try:
        ticker = yf.Ticker(ticker_symbol)
        data = ticker.history(period="5d") # Get last 5 days to ensure we have data even on weekends
        if data.empty:
            return f"Няма налични данни за {commodity} ({ticker_symbol}) в момента."
            
        # Get the latest close price
        latest_close = data['Close'].iloc[-1]
        latest_date = data.index[-1].strftime('%Y-%m-%d')
        
        return f"Актуална борсова цена (CBOT) за {commodity} (Тикер: {ticker_symbol}): {latest_close:.2f} USD към дата {latest_date}."
    except Exception as e:
        return f"Грешка при извличане на цените за {commodity}: {e}"

@tool
def search_local_documents(query: str) -> str:
    """Търси информация в локалните доклади и документи (в agrinexus-mvp/доклади).
    Подава се ключова дума или фраза (query) и инструментът връща параграфите, които я съдържат.
    Ако няма ключова дума, може да се подаде "всички", за да се върне списък с документите.
    """
    # Path to the reports directory
    reports_dir = r"C:\Users\expre\OneDrive\Desktop\agrinexus-mvp\доклади"
    
    if not os.path.exists(reports_dir):
        return f"Папката с доклади не беше намерена на път: {reports_dir}"
        
    files = glob.glob(os.path.join(reports_dir, "*.md")) + glob.glob(os.path.join(reports_dir, "*.txt"))
    
    if not files:
        return "Не намерих никакви .md или .txt файлове в папката с доклади."
        
    if query.lower() == "всички" or query.lower() == "all":
        file_names = [os.path.basename(f) for f in files]
        return f"Намерени доклади: {', '.join(file_names)}. Моля, потърсете конкретна тема."
        
    results = []
    
    # Simple keyword search through paragraphs
    query_terms = query.lower().split()
    
    for file_path in files:
        file_name = os.path.basename(file_path)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            paragraphs = content.split('\n\n')
            for p in paragraphs:
                p_lower = p.lower()
                # If ANY of the query terms is in the paragraph, we count it as a match
                if any(term in p_lower for term in query_terms if len(term) > 3):
                    results.append(f"--- Откъс от {file_name} ---\n{p.strip()}")
        except Exception:
            continue
            
    if not results:
        return f"Не намерих нищо свързано с '{query}' в докладите."
        
    # Limit results so we don't overflow context window
    max_results = 5
    response = "\n\n".join(results[:max_results])
    
    if len(results) > max_results:
        response += f"\n\n(Показани са {max_results} от общо {len(results)} съвпадения. Бъдете по-конкретни в търсенето си.)"
        
    return response
