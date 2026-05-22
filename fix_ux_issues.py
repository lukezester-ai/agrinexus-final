import os

def fix_academy():
    files = ['academy.html', 'ru/academy.html']
    for filepath in files:
        if not os.path.exists(filepath):
            continue
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        css_fix = """
            .featured-grid { grid-template-columns: 1fr !important; }
            .podcast-card { grid-template-columns: 1fr !important; padding: 24px !important; }
            .paths-grid { grid-template-columns: 1fr !important; }
            .fresh-grid { grid-template-columns: 1fr !important; }
        }
        </style>"""
        
        if ".featured-grid { grid-template-columns: 1fr !important; }" not in content:
            content = content.replace("}\n\n    </style>", css_fix)
            content = content.replace("}\n    </style>", css_fix)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")

def fix_dashboard_nav():
    files = ['dashboard.html', 'ru/dashboard.html']
    for filepath in files:
        if not os.path.exists(filepath):
            continue
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Update links in nav
        # We need to replace the generic <nav> block in dashboard.html
        
        # Command Center -> /dashboard.html
        content = content.replace('<a href="#" class="active">\n                <svg class="nav-icon', '<a href="/dashboard.html" class="active">\n                <svg class="nav-icon')
        
        # Fields & Crops -> Coming soon
        content = content.replace('<a href="#">\n                <svg class="nav-icon icon" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13h-13l6.5-13z"/></svg>\n                Fields & Crops\n            </a>', 
                                 '<a href="#" onclick="alert(\'This module is coming soon!\')">\n                <svg class="nav-icon icon" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13h-13l6.5-13z"/></svg>\n                Fields & Crops\n            </a>')

        # Market Intelligence -> /market-intelligence.html
        content = content.replace('<a href="#">\n                <svg class="nav-icon icon" viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>\n                Market Intelligence\n            </a>',
                                  '<a href="/market-intelligence.html">\n                <svg class="nav-icon icon" viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>\n                Market Intelligence\n            </a>')

        # Fleet & Logistics -> Coming soon
        content = content.replace('<a href="#">\n                <svg class="nav-icon icon" viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>\n                Fleet & Logistics\n            </a>',
                                  '<a href="#" onclick="alert(\'This module is coming soon!\')">\n                <svg class="nav-icon icon" viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>\n                Fleet & Logistics\n            </a>')

        # Agent Mesh -> /index.html (The Agents page)
        content = content.replace('<a href="#">\n                <svg class="nav-icon icon" viewBox="0 0 24 24"><path d="M19.8 10.7L4.2 5l-.7 1.9L17.6 12l-14.1 5.1.7 1.9 15.6-5.7c.6-.2 1.1-.9.9-1.5-.2-.5-.8-.9-1.4-.7z"/></svg>\n                Agent Mesh\n            </a>',
                                  '<a href="/index.html">\n                <svg class="nav-icon icon" viewBox="0 0 24 24"><path d="M19.8 10.7L4.2 5l-.7 1.9L17.6 12l-14.1 5.1.7 1.9 15.6-5.7c.6-.2 1.1-.9.9-1.5-.2-.5-.8-.9-1.4-.7z"/></svg>\n                Agent Mesh\n            </a>')

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")

if __name__ == "__main__":
    fix_academy()
    fix_dashboard_nav()
