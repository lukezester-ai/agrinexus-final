import os
import re

def update_mobile_css(filepath):
    if not os.path.exists(filepath):
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to enhance the mobile @media (max-width: 768px) block.
    # In dashboard, we MUST fix the body { overflow: hidden; } which breaks scrolling on mobile.
    
    if 'dashboard.html' in filepath:
        # Replace body overflow logic for mobile
        mobile_dashboard_css = """
        @media (max-width: 768px) {
            body {
                flex-direction: column;
                height: auto;
                overflow-y: auto !important;
            }
            main {
                padding: 16px !important;
                overflow-y: visible !important;
            }
            aside {
                width: 100% !important;
                border-right: none !important;
                border-bottom: 1px solid var(--border);
                padding: 16px !important;
            }
            nav {
                flex-direction: row !important;
                overflow-x: auto;
                padding-bottom: 8px;
            }
            nav a {
                white-space: nowrap;
            }
            header {
                flex-direction: column;
                align-items: flex-start !important;
                gap: 16px;
            }
            .header-actions {
                width: 100%;
                display: flex;
            }
            .header-actions button {
                flex-grow: 1;
                justify-content: center;
            }
            .briefing-card {
                flex-direction: column;
                text-align: center;
                padding: 20px !important;
            }
            .metrics-grid {
                grid-template-columns: 1fr 1fr !important; /* 2 columns on mobile */
                gap: 12px !important;
            }
            .dashboard-split {
                grid-template-columns: 1fr !important;
                display: flex !important;
                flex-direction: column !important;
            }
            .panel {
                min-height: 350px;
            }
        }
        </style>"""
        
        # We will inject this right before </style>
        if "body {\n                flex-direction: column;" not in content:
            content = content.replace("</style>", mobile_dashboard_css)

    elif 'index.html' in filepath or 'platform.html' in filepath:
        # General mobile fixes for landing pages
        general_mobile_css = """
        @media (max-width: 768px) {
            .mesh-container { display: none !important; } /* Hide complex animations on mobile to save space */
            .stats-strip { flex-direction: column !important; align-items: center; }
            .stat-item { width: 100% !important; margin-bottom: 24px; }
            .split-hero { flex-direction: column !important; }
            .nodes-container { flex-direction: column !important; }
            .hero h1 { font-size: 28px !important; }
        }
        </style>"""
        
        if ".mesh-container { display: none !important; }" not in content:
            content = content.replace("</style>", general_mobile_css)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Updated mobile CSS in {filepath}")

if __name__ == "__main__":
    files_to_update = [
        'dashboard.html',
        'ru/dashboard.html',
        'index.html',
        'ru/index.html',
        'platform.html',
        'ru/platform.html'
    ]
    for f in files_to_update:
        update_mobile_css(f)
