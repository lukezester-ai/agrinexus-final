from fastapi import Depends, HTTPException
from core.supabase_client import get_supabase_client

async def get_current_user(token: str):
    try:
        supabase = get_supabase_client()
        user = supabase.auth.get_user(token)
        return user.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")
