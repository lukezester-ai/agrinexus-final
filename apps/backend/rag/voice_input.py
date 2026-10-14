from fastapi import APIRouter, UploadFile, File
import whisper
from io import BytesIO
from .tutor_router import tutor_chat, TutorRequest

router = APIRouter(prefix="/voice", tags=["Voice Input"])

# За production препоръчвам faster-whisper или OpenAI Whisper API
try:
    model = whisper.load_model("base")        # или "small", "medium" за по-добър български
except Exception as e:
    print(f"Грешка при зареждане на Whisper: {e}")
    model = None

@router.post("/voice")
async def voice_to_text(file: UploadFile = File(...)):
    if model is None:
        return {"error": "Whisper моделът не е зареден."}
        
    contents = await file.read()
    
    # Запиши временно файла за транскрипция (тъй като Whisper очаква път до файл)
    with open("temp_audio.wav", "wb") as f:
        f.write(contents)
    
    # Whisper transcription
    result = model.transcribe(
        "temp_audio.wav",
        language="bg",           # важно!
        temperature=0.0,
        word_timestamps=False
    )
    
    text = result["text"].strip()
    
    # Директно подаваме към Tutor-а
    response = await tutor_chat(
        TutorRequest(
            question=text,
            user_id="voice_user",
            culture=None,
            region=None
        )
    )
    
    return {
        "transcribed_text": text,
        "answer": response.answer,
        "sources": response.sources
    }
