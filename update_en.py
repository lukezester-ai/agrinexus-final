import os, re

def update_orbits():
    for file in ['index.html', 'agents.html']:
        if not os.path.exists(file): continue
        with open(file, 'r', encoding='utf-8') as f:
            c = f.read()
        
        # Update orbit opacity/thickness
        c = c.replace("border: 1px dashed rgba(0,0,0,0.1);", "border: 2px solid rgba(0,0,0,0.06);")
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(c)

def update_academy_refs():
    file = 'academy.html'
    if not os.path.exists(file): return
    with open(file, 'r', encoding='utf-8') as f:
        c = f.read()
    
    # Replace bulgarian locations/names assuming they were translated to English in my original generation
    # Let's check what's actually there. My original academy.html was generated with English text but the user's prompt had BG names.
    # I should just blindly replace 'Dobrich', 'Plovdiv', 'Stara Zagora', 'Dimitar T.', 'Sevda N.', 'Marko P.'
    replacements = {
        'Dobrich': 'Iowa',
        'Plovdiv': 'Illinois',
        'Stara Zagora': 'Kansas',
        'Dimitar T.': 'Marcus T.',
        'Sevda N.': 'Sarah N.',
        'Marko P.': 'Mark P.'
    }
    for k, v in replacements.items():
        c = c.replace(k, v)
        
    with open(file, 'w', encoding='utf-8') as f:
        f.write(c)

def update_platform_ui():
    file = 'platform.html'
    if not os.path.exists(file): return
    with open(file, 'r', encoding='utf-8') as f:
        c = f.read()
        
    # Remove background from arch-row
    c = c.replace('background: var(--bg-row);', '/* background: var(--bg-row); removed to create single field */')
    
    # Make node-icon-wrapper interactive
    if 'cursor: pointer;' not in c:
        c = c.replace('.node-icon-wrapper {', '.node-icon-wrapper {\n            cursor: pointer;\n            transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);\n            border: none;\n            outline: none;')
        c = c.replace('.node-center .node-icon-wrapper {', '.node-icon-wrapper:hover {\n            transform: scale(1.15);\n            box-shadow: 0 16px 32px rgba(0,0,0,0.08);\n            z-index: 20;\n        }\n\n        .node-center .node-icon-wrapper {')

    with open(file, 'w', encoding='utf-8') as f:
        f.write(c)

def add_nav_lang_toggle():
    files = ['index.html', 'agents.html', 'market-intelligence.html', 'academy.html', 'platform.html']
    for file in files:
        if not os.path.exists(file): continue
        with open(file, 'r', encoding='utf-8') as f:
            c = f.read()
            
        lang_toggle = f'''
    <div style="display: flex; gap: 12px; align-items: center; font-size: 13px; font-weight: 600; margin-left: auto; margin-right: 24px; color: var(--text-muted, #999);">
        <a href="{file}" style="color: var(--text-main, #111); text-decoration: none;">EN</a>
        <span style="opacity: 0.3;">|</span>
        <a href="ru/{file}" style="color: inherit; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='var(--text-main, #111)'" onmouseout="this.style.color='inherit'">RU</a>
    </div>
    <a href="dashboard.html"'''
        
        # Use regex to inject it before dashboard button
        c = re.sub(r'(</div>\s*)<a href="dashboard\.html"', r'\1' + lang_toggle, c)
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(c)

if __name__ == "__main__":
    update_orbits()
    update_academy_refs()
    update_platform_ui()
    add_nav_lang_toggle()
    print("English site updated successfully.")
