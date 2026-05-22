import os
import glob

mobile_css = """
        /* Mobile Nav & Layout Fix */
        @media (max-width: 992px) {
            nav {
                flex-wrap: wrap;
                gap: 16px;
                padding: 16px !important;
                justify-content: center !important;
                text-align: center;
            }
            nav > a.logo {
                width: 100%;
                justify-content: center;
                margin-bottom: 8px;
            }
            nav > div {
                flex-wrap: wrap;
                justify-content: center;
                gap: 12px !important;
                width: 100%;
            }
            nav > div[style*="margin-left: auto"] {
                margin: 12px 0 !important;
                width: 100%;
                justify-content: center;
            }
            body {
                overflow-x: hidden;
            }
            .container {
                max-width: 100%;
                padding: 0 16px;
            }
        }
"""

def fix_mobile():
    files = glob.glob("*.html") + glob.glob("ru/*.html")
    for file in files:
        if not os.path.isfile(file): continue
        with open(file, 'r', encoding='utf-8') as f:
            c = f.read()
        
        # Prevent double injection
        if "/* Mobile Nav & Layout Fix */" not in c:
            c = c.replace('</style>', mobile_css + '\n    </style>')
            
            with open(file, 'w', encoding='utf-8') as f:
                f.write(c)

if __name__ == '__main__':
    fix_mobile()
    print("Mobile fixes applied.")
