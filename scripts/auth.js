// Supabase Client Initialization and Auth Helpers

let supabase = null;

// Initialize Supabase by fetching config from our Vercel endpoint
async function initSupabase() {
    if (supabase) return supabase;
    
    try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('Failed to load config');
        
        const config = await res.json();
        
        // Ensure the Supabase library is loaded
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase library not loaded. Ensure the CDN script is included.');
            return null;
        }

        // Initialize the client
        supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        return supabase;
    } catch (error) {
        console.error('Error initializing Supabase:', error);
        return null;
    }
}

// Function to handle protecting a route (e.g. Dashboard)
async function protectRoute() {
    const sb = await initSupabase();
    if (!sb) return;

    const { data: { session }, error } = await sb.auth.getSession();
    
    if (error || !session) {
        // Not logged in, redirect to login
        window.location.href = '/login.html';
    } else {
        // Update user profile in the UI if elements exist
        const userNameEl = document.querySelector('.user-name');
        if (userNameEl) {
            // Use name from metadata if available, else email
            const name = session.user.user_metadata?.full_name || session.user.email;
            userNameEl.textContent = name;
        }
    }
    
    return session;
}

// Function to sign out
async function signOutUser() {
    const sb = await initSupabase();
    if (sb) {
        await sb.auth.signOut();
        window.location.href = '/login.html';
    }
}
