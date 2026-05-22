import os

def update_file(filepath):
    if not os.path.exists(filepath):
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add ID to Wheat value and change text
    # Wheat value block
    old_wheat_val = '<div class="metric-value">€246.50</div>'
    new_wheat_val = '<div class="metric-value" id="wheat-price">Loading...</div>'
    content = content.replace(old_wheat_val, new_wheat_val)

    old_wheat_change = '<div class="metric-change change-positive">\n                    <svg class="icon" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>\n                    +2.4% (€5.80)\n                </div>'
    new_wheat_change = '<div class="metric-change" id="wheat-change">\n                    Syncing...\n                </div>'
    content = content.replace(old_wheat_change, new_wheat_change)

    # 2. Change Avg Soil Moisture to Corn (CBOT)
    old_soil_title = '<span class="metric-title">Avg Soil Moisture</span>'
    new_corn_title = '<span class="metric-title">Corn (CBOT)</span>'
    content = content.replace(old_soil_title, new_corn_title)

    old_soil_val = '<div class="metric-value">38%</div>'
    new_corn_val = '<div class="metric-value" id="corn-price">Loading...</div>'
    content = content.replace(old_soil_val, new_corn_val)

    old_soil_change = '<div class="metric-change change-warning">\n                    <svg class="icon" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>\n                    -4% vs yesterday\n                </div>'
    new_corn_change = '<div class="metric-change" id="corn-change">\n                    Syncing...\n                </div>'
    content = content.replace(old_soil_change, new_corn_change)

    # 3. Inject live-data.js script
    script_tag = '<script src="/scripts/live-data.js"></script>'
    if script_tag not in content:
        content = content.replace('</body>', f'    {script_tag}\n</body>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Updated {filepath}")

if __name__ == "__main__":
    update_file('dashboard.html')
    update_file('ru/dashboard.html')
