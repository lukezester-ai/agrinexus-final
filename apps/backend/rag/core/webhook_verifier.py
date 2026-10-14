import hashlib
import hmac
import os
from fastapi import Request, HTTPException
from typing import Optional

class SupabaseWebhookVerifier:
    def __init__(self, secret: str):
        # Подсигуряваме се, че secret е byte string
        self.secret = secret.encode('utf-8') if secret else b''

    async def verify(self, request: Request) -> bool:
        if not self.secret:
            # За локално тестване може да не е сетнат ключа, но е опасно за production!
            print("⚠️ ПРЕДУПРЕЖДЕНИЕ: SUPABASE_WEBHOOK_SECRET липсва. Пропуска се верификацията на webhook.")
            return True

        # Вземаме signature от header-а
        signature = request.headers.get("x-supabase-signature")
        if not signature:
            raise HTTPException(status_code=401, detail="Missing x-supabase-signature header")

        # Вземаме raw body (много важно за правилен HMAC хеш!)
        body = await request.body()
        
        # Изчисляваме HMAC SHA256
        computed_signature = hmac.new(
            self.secret,
            body,
            hashlib.sha256
        ).hexdigest()

        # Сравняваме безопасно (timing attack protection)
        if not hmac.compare_digest(computed_signature, signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
        
        return True

    async def verify_advanced(self, request: Request) -> bool:
        """По-сигурен вариант с timestamp, ако Supabase го подава"""
        if not self.secret:
            print("⚠️ ПРЕДУПРЕЖДЕНИЕ: SUPABASE_WEBHOOK_SECRET липсва.")
            return True
            
        signature = request.headers.get("x-supabase-signature")
        timestamp = request.headers.get("x-supabase-timestamp")
        
        if not signature or not timestamp:
            raise HTTPException(status_code=401, detail="Missing headers (signature/timestamp)")
        
        body = await request.body()
        payload = timestamp.encode() + body
        
        computed = hmac.new(self.secret, payload, hashlib.sha256).hexdigest()
        
        if not hmac.compare_digest(computed, signature):
            raise HTTPException(status_code=401, detail="Signature mismatch")
            
        return True


# Инициализираме глобално инстанцията
webhook_verifier = SupabaseWebhookVerifier(secret=os.getenv("SUPABASE_WEBHOOK_SECRET", ""))
