import os, re

nav_template = """<nav>
    <a href="index.html" class="logo" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 20px;">
        <div class="logo-dot" style="width: 8px; height: 8px; background-color: var(--green, #2d5a27); border-radius: 50%;"></div>
        AgriNexus
    </a>
    <div style="display: flex; gap: 32px; align-items: center; font-size: 14px; font-weight: 500;">
        <a href="index.html" style="text-decoration: none; color: var(--text-muted, #666); transition: color 0.2s;" onmouseover="this.style.color='var(--text-main, #111)'" onmouseout="this.style.color='var(--text-muted, #666)'">Agents</a>
        <a href="platform.html" style="text-decoration: none; color: var(--text-muted, #666); transition: color 0.2s;" onmouseover="this.style.color='var(--text-main, #111)'" onmouseout="this.style.color='var(--text-muted, #666)'">Platform</a>
        <a href="market-intelligence.html" style="text-decoration: none; color: var(--text-muted, #666); transition: color 0.2s;" onmouseover="this.style.color='var(--text-main, #111)'" onmouseout="this.style.color='var(--text-muted, #666)'">Market</a>
        <a href="academy.html" style="text-decoration: none; color: var(--text-muted, #666); transition: color 0.2s;" onmouseover="this.style.color='var(--text-main, #111)'" onmouseout="this.style.color='var(--text-muted, #666)'">Academy</a>
    </div>
    <a href="dashboard.html" style="padding: 10px 24px; border-radius: 30px; font-size: 14px; text-decoration: none; background: var(--text-main, #1a1a1a); color: white; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Dashboard</a>
</nav>"""

nav_platform_template = """<nav class="container">
    <a href="index.html" class="logo" style="text-decoration: none; color: inherit;">
        <div class="logo-icon">
            <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
                <path d="M7 0C7 0 0 6 0 11C0 14.866 3.134 18 7 18C10.866 18 14 14.866 14 11C14 6 7 0 7 0Z" fill="white"/>
            </svg>
        </div>
        AgriNexus
    </a>
    <div style="display: flex; gap: 32px; align-items: center; font-size: 15px; font-weight: 500;">
        <a href="index.html" style="text-decoration: none; color: var(--text-muted, #777);">Agents</a>
        <a href="platform.html" style="text-decoration: none; color: var(--text-muted, #777);">Platform</a>
        <a href="market-intelligence.html" style="text-decoration: none; color: var(--text-muted, #777);">Market</a>
        <a href="academy.html" style="text-decoration: none; color: var(--text-muted, #777);">Academy</a>
    </div>
    <a href="dashboard.html" class="btn-join">Dashboard</a>
</nav>"""

files = ['index.html', 'agents.html', 'market-intelligence.html', 'academy.html']
for file in files:
    if os.path.exists(file):
        with open(file, 'r', encoding='utf-8') as f:
            c = f.read()
        c = re.sub(r'<nav>.*?</nav>', nav_template, c, flags=re.DOTALL)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(c)
        print(f"Updated {file}")

if os.path.exists('platform.html'):
    with open('platform.html', 'r', encoding='utf-8') as f:
        c = f.read()
    c = re.sub(r'<nav class="container">.*?</nav>', nav_platform_template, c, flags=re.DOTALL)
    with open('platform.html', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated platform.html")
