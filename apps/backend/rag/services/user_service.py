from core.supabase_client import get_supabase_client

async def handle_user_signup(user_data):
    """Изпълнява се след успешен login (може да се trigger-не с Supabase Webhook)"""
    supabase = get_supabase_client()
    
    existing = supabase.table("farm_profiles").select("*").eq("user_id", user_data.id).execute()
    
    if not existing.data:
        supabase.table("farm_profiles").insert({
            "user_id": user_data.id,
            "full_name": user_data.user_metadata.get("full_name", ""),
            "email": user_data.email,
            "avatar_url": user_data.user_metadata.get("avatar_url"),
            "cultures": [],
            "region": None,
            "onboarding_completed": False
        }).execute()
