document.addEventListener('DOMContentLoaded', async () => {
    // Only run if the fields container exists
    const container = document.getElementById('fields-container');
    const form = document.getElementById('add-field-form');
    if (!container || !form) return;

    let sb = null;
    let currentUser = null;

    // Load initial data
    async function loadFields() {
        if (!sb) {
            // initSupabase is available from auth.js
            sb = await window.initSupabase();
        }
        if (!sb) return;

        // Get current session
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return;
        currentUser = session.user;

        try {
            // Fetch fields for this user
            const { data: fields, error } = await sb
                .from('fields')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            renderFields(fields);
        } catch (err) {
            console.error("Error fetching fields:", err);
            container.innerHTML = `<div style="color: var(--terracotta); font-size: 13px; text-align: center; padding: 10px;">Could not load fields. Did you run the SQL script?</div>`;
        }
    }

    function renderFields(fields) {
        if (!fields || fields.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px; background: rgba(0,0,0,0.02); border-radius: 8px;">No fields yet. Add one below.</div>`;
            return;
        }

        window.userFarmContext = fields;
        container.innerHTML = '';
        fields.forEach(field => {
            const el = document.createElement('div');
            el.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: #fff;';
            
            // Random color for crop tag
            const colors = ['#2d5a27', '#cc4e36', '#d4a32a', '#3273a8'];
            const color = colors[field.crop.length % colors.length];

            el.innerHTML = `
                <div>
                    <div style="font-weight: 500; font-size: 14px; color: var(--text-main); margin-bottom: 2px;">${field.name}</div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${color}15; color: ${color}; font-weight: 500;">${field.crop}</span>
                        <span style="font-size: 12px; color: var(--text-muted); font-family: monospace;">${field.hectares} ha</span>
                    </div>
                </div>
                <button onclick="deleteField('${field.id}')" style="background: none; border: none; cursor: pointer; padding: 4px; color: var(--text-muted); opacity: 0.5; transition: 0.2s;" onmouseover="this.style.opacity='1'; this.style.color='var(--terracotta)';" onmouseout="this.style.opacity='0.5'; this.style.color='var(--text-muted)';">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
            `;
            container.appendChild(el);
        });
    }

    // Expose delete to window so inline onclick works
    window.deleteField = async (id) => {
        if (!confirm("Are you sure you want to delete this field?")) return;
        
        try {
            const { error } = await sb.from('fields').delete().eq('id', id);
            if (error) throw error;
            await loadFields();
        } catch (err) {
            console.error("Error deleting:", err);
            alert("Failed to delete field.");
        }
    };

    // Handle form submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
            alert("Session error. Please refresh.");
            return;
        }

        const btn = document.getElementById('add-field-btn');
        const errDiv = document.getElementById('field-error');
        const name = document.getElementById('field-name').value;
        const crop = document.getElementById('field-crop').value;
        const hectares = parseFloat(document.getElementById('field-size').value);

        btn.disabled = true;
        btn.textContent = 'Saving...';
        errDiv.style.display = 'none';

        try {
            const { data, error } = await sb
                .from('fields')
                .insert([
                    { user_id: currentUser.id, name, crop, hectares }
                ]);
                
            if (error) throw error;

            // Success
            form.reset();
            await loadFields();
        } catch (err) {
            console.error("Error inserting:", err);
            errDiv.textContent = err.message || "Failed to save field.";
            errDiv.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Field';
        }
    });

    // Initial load
    loadFields();
});
