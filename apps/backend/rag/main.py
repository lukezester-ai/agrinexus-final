from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Импортираме нашите рутери от модулите, които създадохме
from tutor_router import router as tutor_router
from voice_input import router as voice_router
from api.webhooks import router as webhook_router

# Инициализация на FastAPI приложението
app = FastAPI(
    title="AgriNexus Backend API",
    description="FastAPI пълна интеграция на всички RAG и Voice компоненти за Academy Tutor.",
    version="1.0.0",
    docs_url="/docs",       # Swagger UI
    redoc_url="/redoc"      # ReDoc UI
)

# Настройка на CORS - задължително, за да може Next.js frontend-ът да комуникира с бекенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # За production: замени с ["https://tvoia-domain.com", "http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Интегриране на всички отделни части (рутери) в основното приложение
app.include_router(tutor_router)
app.include_router(voice_router)
app.include_router(webhook_router, prefix="/api")

# --- Основни Endpoints за мониторинг ---

@app.get("/", tags=["General"])
async def root():
    """Начална точка на API-то"""
    return {
        "status": "online",
        "service": "AgriNexus Backend API",
        "endpoints": {
            "swagger_docs": "/docs",
            "tutor_chat": "/tutor/chat",
            "voice_transcribe": "/voice/voice"
        }
    }

@app.get("/health", tags=["General"])
async def health_check():
    """Проверка на състоянието на сървъра (полезно за Docker/Kubernetes)"""
    return {"status": "ok", "message": "Системата работи нормално"}


# --- Стартиране на сървъра ---
# Ако файлът се стартира директно (напр. `python main.py`)
if __name__ == "__main__":
    print("🚀 Стартиране на AgriNexus FastAPI сървъра...")
    # reload=True автоматично рестартира сървъра при промяна във файловете (удобно за dev)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
