import os
import glob

mobile_css = """
        /* Comprehensive Mobile Layout Fixes */
        html, body {
            max-width: 100vw;
            overflow-x: hidden;
            position: relative;
        }
        
        * {
            box-sizing: border-box;
        }

        @media (max-width: 768px) {
            /* General Typography & Hero */
            .hero { padding: 60px 0 30px !important; }
            .hero h1 { font-size: 36px !important; letter-spacing: -1px !important; }
            .hero p { font-size: 16px !important; }
            
            /* Index (Agents) specific */
            .stats-strip { 
                flex-wrap: wrap !important; 
                gap: 24px !important; 
                padding: 24px 0 !important; 
                margin-bottom: 40px !important;
            }
            .stat-item { width: 40%; }
            .mesh-container { height: 400px !important; margin-bottom: 60px !important; }
            .orbit { display: none; /* Hide orbits on mobile to avoid overflow and clutter */ }
            .ladder-grid { grid-template-columns: 1fr !important; }
            
            /* Platform specific */
            .arch-card { padding: 24px 16px !important; }
            .arch-row { 
                flex-direction: column !important; 
                align-items: center !important; 
                padding: 24px 16px !important;
                gap: 24px !important;
            }
            .row-label, .row-meta { 
                width: 100% !important; 
                text-align: center !important; 
            }
            .nodes-container { 
                flex-wrap: wrap !important; 
                justify-content: center !important; 
                gap: 24px !important; 
            }
            .integrations-grid { grid-template-columns: 1fr 1fr !important; gap: 16px !important; }
            .foundation-grid { grid-template-columns: 1fr !important; }
            
            /* Market Intelligence specific */
            .ticker-strip { width: 100vw; position: relative; left: 50%; right: 50%; margin-left: -50vw; margin-right: -50vw; }
            .engine-grid, .signal-grid { grid-template-columns: 1fr !important; }
            .split-hero { flex-direction: column !important; }
            
            /* Academy specific */
            .hero.split { flex-direction: column !important; }
            .reading-layout { flex-direction: column !important; }
            .paths-grid, .fresh-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
            
            /* Dashboard specific */
            .dashboard-layout { flex-direction: column !important; }
            .sidebar { width: 100% !important; border-right: none !important; border-bottom: 1px solid var(--border); padding: 16px !important; }
            .dash-grid { grid-template-columns: 1fr !important; }
        }
"""

def apply_fixes():
    files = glob.glob("*.html") + glob.glob("ru/*.html")
    for f in files:
        if not os.path.isfile(f): continue
        with open(f, 'r', encoding='utf-8') as file:
            c = file.read()
            
        if "Comprehensive Mobile Layout Fixes" not in c:
            c = c.replace('</style>', mobile_css + '\n    </style>')
            
            # Also add meta viewport if missing (should be there but just in case)
            if 'name="viewport"' not in c:
                c = c.replace('<head>', '<head>\n    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">')
            else:
                # Force maximum-scale=1.0 to prevent zoom bug on iOS which causes sideways dancing
                c = c.replace('content="width=device-width, initial-scale=1.0"', 'content="width=device-width, initial-scale=1.0, maximum-scale=1.0"')
                
            with open(f, 'w', encoding='utf-8') as file:
                file.write(c)

if __name__ == '__main__':
    apply_fixes()
    print("Mobile layout fixes injected.")
