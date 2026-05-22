import os
import re

def update_dashboard():
    with open('dashboard.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add scripts to the bottom of body
    scripts_to_add = """
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="/scripts/auth.js"></script>
    <script>
        // Protect the route
        document.addEventListener('DOMContentLoaded', protectRoute);
    </script>
</body>"""
    
    if '<script src="/scripts/auth.js"></script>' not in content:
        content = content.replace('</body>', scripts_to_add)
    
    # 2. Add logout button to the user-profile div in the sidebar
    # Find the user profile section
    # <div class="user-profile">
    #     <div class="avatar"></div>
    #     <div class="user-info">
    #         <span class="user-name">Dimitar T.</span>
    #         <span class="user-farm">Dobrich Valley Farm</span>
    #     </div>
    # </div>
    
    logout_btn_html = """
        <div class="user-info" style="flex-grow: 1;">
            <span class="user-name" style="word-break: break-all;">Loading...</span>
            <span class="user-farm">AgriNexus User</span>
        </div>
        <button onclick="signOutUser()" title="Sign Out" style="background:none; border:none; cursor:pointer; color:var(--text-muted); padding:4px;">
            <svg class="icon" viewBox="0 0 24 24" style="width:20px; height:20px;"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
        </button>"""
        
    # Let's replace the inner HTML of the user-info div
    # Actually, let's just replace the whole user-profile div inner contents
    old_profile_start = content.find('<div class="user-profile">')
    if old_profile_start != -1:
        old_profile_end = content.find('</aside>', old_profile_start)
        
        if old_profile_end != -1:
            old_profile_block = content[old_profile_start:old_profile_end]
            
            new_profile_block = """<div class="user-profile">
            <div class="avatar"></div>
            """ + logout_btn_html + """
        </div>
    """
            content = content.replace(old_profile_block, new_profile_block)

    with open('dashboard.html', 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("dashboard.html updated.")

if __name__ == "__main__":
    update_dashboard()
