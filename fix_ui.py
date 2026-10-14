import os, re

def fix_index_colors():
    files = ['index.html', 'agents.html']
    for file in files:
        if not os.path.exists(file): continue
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace the colors in :root
        new_colors = """        :root {
            --bg-color: #fcfcf9;
            --surface: #f5f4ed;
            --text-main: #1a1a1a;
            --text-muted: #666666;
            --border: rgba(0, 0, 0, 0.08);"""
            
        content = re.sub(r'        :root \{\s*--bg-color: #f8f6f1;\s*--surface: #ffffff;\s*--text-main: #1a1a1a;\s*--text-muted: #666666;\s*--border: rgba\(0, 0, 0, 0\.08\);', new_colors, content)
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated colors in {file}")

def fix_platform_svg():
    file = 'platform.html'
    if not os.path.exists(file): return
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Empty out the SVG hardcoded paths
    empty_svg = """            <!-- SVG Connections -->
            <svg class="svg-connections" preserveAspectRatio="none">
            </svg>"""
    content = re.sub(r'            <!-- SVG Connections -->\s*<svg class="svg-connections" preserveAspectRatio="none">.*?</svg>', empty_svg, content, flags=re.DOTALL)
    
    # Inject the script right before </body>
    script = """    <script>
        function drawConnections() {
            const svg = document.querySelector('.svg-connections');
            if (!svg) return;
            svg.innerHTML = '';
            
            const rows = document.querySelectorAll('.arch-row');
            if (rows.length < 3) return;
            
            const senseWrappers = rows[0].querySelectorAll('.node-icon-wrapper');
            const thinkWrappers = rows[1].querySelectorAll('.node-icon-wrapper');
            const actWrappers = rows[2].querySelectorAll('.node-icon-wrapper');
            
            if (!thinkWrappers[1]) return;
            const centerNode = thinkWrappers[1];
            
            const archCard = document.querySelector('.arch-card');
            const cardRect = archCard.getBoundingClientRect();
            
            function getCenter(el) {
                const rect = el.getBoundingClientRect();
                return {
                    x: rect.left + rect.width / 2 - cardRect.left,
                    y: rect.top + rect.height / 2 - cardRect.top
                };
            }
            
            const centerPos = getCenter(centerNode);
            
            function drawCurve(startEl, endEl) {
                const start = getCenter(startEl);
                const end = getCenter(endEl);
                
                const cp1x = start.x;
                const cp1y = start.y + (end.y - start.y) / 2;
                const cp2x = end.x;
                const cp2y = start.y + (end.y - start.y) / 2;
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${start.x},${start.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${end.x},${end.y}`);
                path.setAttribute('class', 'conn-line');
                svg.appendChild(path);
            }
            
            senseWrappers.forEach(node => drawCurve(node, centerNode));
            actWrappers.forEach(node => drawCurve(centerNode, node));
        }
        
        window.addEventListener('resize', drawConnections);
        window.addEventListener('load', drawConnections);
        // Sometimes fonts/layout shifts right after parse
        setTimeout(drawConnections, 100);
        drawConnections();
    </script>
</body>"""
    if '<script>' not in content:
        content = content.replace('</body>', script)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Added JS dynamic SVG lines to {file}")

if __name__ == "__main__":
    fix_index_colors()
    fix_platform_svg()
