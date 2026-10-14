import os
import psycopg2
from datetime import datetime
from build_academy_rag import main as build_rag

def delete_old_collection():
    # Изтриване на старата колекция
    conn = psycopg2.connect(os.getenv("POSTGRES_CONNECTION_STRING"))
    cur = conn.cursor()
    cur.execute("DELETE FROM academy_documents;")
    conn.commit()
    cur.close()
    conn.close()

def weekly_rag_update():
    print(f"🔄 Започва седмично обновяване на RAG - {datetime.now()}")
    
    try:
        # 1. Изтриване на старата колекция (или incremental update)
        delete_old_collection()
        
        # 2. Презареждане
        build_rag()
        
        # 3. Лог
        with open("logs/rag_updates.log", "a") as f:
            f.write(f"[{datetime.now()}] Успешно обновяване на Academy RAG\n")
            
        print("✅ RAG обновен успешно!")
        
    except Exception as e:
        print(f"❌ Грешка при обновяване: {e}")

# За cron job
if __name__ == "__main__":
    # За да работи, е нужно да съществува директорията logs/
    os.makedirs("logs", exist_ok=True)
    weekly_rag_update()
