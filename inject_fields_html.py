import os

def update_dashboard():
    files = ['dashboard.html', 'ru/dashboard.html']
    
    new_fields_html = """
                    <div id="fields-container" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
                        <!-- Fields will be dynamically loaded here -->
                        <div style="text-align: center; color: var(--text-muted); font-size: 14px; padding: 20px;">
                            Loading your fields...
                        </div>
                    </div>
                    
                    <div style="border-top: 1px solid var(--border); padding-top: 16px;">
                        <div style="font-weight: 500; font-size: 14px; margin-bottom: 12px;">Add New Field</div>
                        <form id="add-field-form" style="display: flex; flex-direction: column; gap: 8px;">
                            <input type="text" id="field-name" placeholder="Field Name (e.g. North Plot)" required style="padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;">
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="field-crop" placeholder="Crop (e.g. Wheat)" required style="flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;">
                                <input type="number" id="field-size" placeholder="Hectares" required min="0.1" step="0.1" style="flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;">
                            </div>
                            <button type="submit" id="add-field-btn" class="btn btn-primary" style="padding: 8px; font-size: 13px; border-radius: 6px; width: 100%; margin-top: 4px;">Save Field</button>
                        </form>
                        <div id="field-error" style="color: var(--terracotta); font-size: 12px; margin-top: 8px; display: none;"></div>
                    </div>
    """
    
    for filepath in files:
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Replace the field-map
        old_field_map = """<div class="field-map">
                        <div class="field-poly poly-1">Field 1 (Wheat)</div>
                        <div class="field-poly poly-2">Field 4 (Corn)</div>
                        <div class="field-poly poly-3">Field 2 (Sunflower)</div>
                    </div>"""
                    
        if old_field_map in content:
            content = content.replace(old_field_map, new_fields_html)
            
            # Change "Satellite (10m) ▾" button to something more appropriate or remove it
            old_sat_btn = '<button class="btn btn-outline" style="padding: 6px 12px; font-size: 12px;">Satellite (10m) ▾</button>'
            if old_sat_btn in content:
                content = content.replace(old_sat_btn, '')

            # Inject scripts/fields.js
            script_tag = '<script src="/scripts/fields.js"></script>'
            if script_tag not in content:
                content = content.replace('</body>', f'    {script_tag}\n</body>')

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filepath}")

if __name__ == "__main__":
    update_dashboard()
