import os
import re

def add_svg_animation():
    files = ['platform.html', 'ru/platform.html']
    for file in files:
        if not os.path.exists(file): continue
        with open(file, 'r', encoding='utf-8') as f:
            c = f.read()
            
        # The script we injected last time has:
        # const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        # path.setAttribute('d', `M ${start.x},${start.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${end.x},${end.y}`);
        # path.setAttribute('class', 'conn-line');
        # svg.appendChild(path);
        
        replacement = """
                const pathId = 'path-' + Math.random().toString(36).substr(2, 9);
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('id', pathId);
                path.setAttribute('d', `M ${start.x},${start.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${end.x},${end.y}`);
                path.setAttribute('class', 'conn-line');
                svg.appendChild(path);
                
                // Add animated particle
                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.setAttribute('r', '4');
                // Use a generic active color for the dot
                dot.setAttribute('fill', '#6b8e23');
                
                const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
                // Randomize duration slightly so they don't all move identically
                const dur = (Math.random() * 2 + 2).toFixed(1);
                animate.setAttribute('dur', dur + 's');
                animate.setAttribute('repeatCount', 'indefinite');
                
                const mpath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
                mpath.setAttribute('href', '#' + pathId);
                
                animate.appendChild(mpath);
                dot.appendChild(animate);
                svg.appendChild(dot);
"""
        # We need to replace the old path creation logic with the new one
        c = re.sub(r'const path = document\.createElementNS.*?svg\.appendChild\(path\);', replacement, c, flags=re.DOTALL)
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(c)

def fix_fonts():
    # Find all html files in root and ru/
    html_files = [f for f in os.listdir('.') if f.endswith('.html')]
    if os.path.exists('ru'):
        html_files += [os.path.join('ru', f) for f in os.listdir('ru') if f.endswith('.html')]
        
    for file in html_files:
        with open(file, 'r', encoding='utf-8') as f:
            c = f.read()
            
        # Replace the google fonts link with one explicitly asking for cyrillic, 
        # and fallback to system fonts if Inter fails.
        c = c.replace('family=Inter:wght@300;400;500;600', 'family=Inter:wght@300;400;500;600&subset=cyrillic')
        c = c.replace('family=Inter:wght@400;500;600;700', 'family=Inter:wght@400;500;600;700&subset=cyrillic')
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(c)

if __name__ == "__main__":
    add_svg_animation()
    fix_fonts()
    print("Animation and fonts updated.")
