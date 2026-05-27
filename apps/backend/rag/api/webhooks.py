from fastapi import APIRouter, Request, HTTPException, Depends
from core.supabase_client import get_supabase_client
from core.webhook_verifier import webhook_verifier

router = APIRouter()

@router.post("/webhooks/supabase-user-created")
async def handle_user_created(
    request: Request,
    _: bool = Depends(webhook_verifier.verify)   # ← Верификацията тук
):
    try:
        payload = await request.json()
        
        # Supabase връща "record" или "new" в зависимост от версията и типа на тригера
        user = payload.get("record") or payload.get("new")
        
        if not user or not user.get("id"):
            return {"status": "ignored", "detail": "Липсва потребителски запис"}

        supabase = get_supabase_client()
        
        # Проверка дали профилът вече съществува
        existing = supabase.table("farm_profiles").select("id").eq("user_id", user["id"]).execute()
        
        if not existing.data:
            # Парсваме метаданните
            full_name = user.get("user_metadata", {}).get("full_name") or user.get("raw_user_meta_data", {}).get("full_name")
            avatar_url = user.get("user_metadata", {}).get("avatar_url")
            provider = user.get("app_metadata", {}).get("provider", "email")
            
            # Създаване на farm_profile
            supabase.table("farm_profiles").insert({
                "user_id": user["id"],
                "email": user.get("email"),
                "full_name": full_name,
                "avatar_url": avatar_url,
                "cultures": [],
                "region": None,
                "total_ha": 0,
                "onboarding_completed": False,
                "provider": provider
            }).execute()
            
            print(f"✅ Създаден нов farm_profile за user: {user['id']}")
        
        return {"status": "success", "user_id": user["id"]}
        
    except HTTPException as http_e:
        # Re-raise HTTPException, за да не се заглуши от generic exception handler-а
        raise http_e
    except Exception as e:
        print(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail=f"Processing error: {str(e)}")
