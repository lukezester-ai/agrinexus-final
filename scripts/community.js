
document.addEventListener('DOMContentLoaded', async () => {
    const sb = await initSupabase();
    if (!sb) return;

    const threadsList = document.getElementById('live-threads-list');
    const postForm = document.getElementById('new-post-form');
    const loginPrompt = document.getElementById('login-prompt');
    const postBtn = document.getElementById('submit-post-btn');
    const postContent = document.getElementById('new-post-content');
    const postTag = document.getElementById('new-post-tag');

    // Check auth status
    const { data: { session }, error } = await sb.auth.getSession();
    
    if (session) {
        if (postForm) postForm.style.display = 'block';
        if (loginPrompt) loginPrompt.style.display = 'none';
    } else {
        if (postForm) postForm.style.display = 'none';
        if (loginPrompt) loginPrompt.style.display = 'block';
    }

    // Function to generate a random avatar class
    function getAvatarClass(id) {
        const hash = String(id).charCodeAt(0) || 0;
        const classes = ['ava-1', 'ava-2', 'ava-3'];
        return classes[hash % 3];
    }

    // Function to format time ago
    function timeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        let interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return Math.floor(seconds) + "s ago";
    }

    // Load Posts
    async function loadPosts() {
        const { data: posts, error } = await sb
            .from('community_posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching posts:', error);
            return;
        }

        if (threadsList) {
            threadsList.innerHTML = '';
            
            if (posts.length === 0) {
                threadsList.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No posts yet. Be the first to start a discussion!</div>';
                return;
            }

            posts.forEach(post => {
                const tagHtml = post.tag ? `<span style="background: rgba(212,163,42,0.1); color: var(--gold); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase;">${post.tag}</span>` : '';
                
                const html = `
                <div class="thread-item">
                    <div class="thread-avatar ${getAvatarClass(post.id)}"></div>
                    <div>
                        <div class="thread-meta">
                            <strong>${post.author_name}</strong> <span style="color: #ccc;">•</span> ${post.location} <span style="color: #ccc;">•</span> ${timeAgo(post.created_at)} ${tagHtml}
                        </div>
                        <div class="thread-title">${post.content}</div>
                    </div>
                    <div class="thread-eng">
                        <div class="eng-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            ${post.comments_count}
                        </div>
                        <div class="eng-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            ${post.likes_count}
                        </div>
                    </div>
                </div>`;
                threadsList.innerHTML += html;
            });
        }
    }

    // Submit new post
    if (postBtn) {
        postBtn.addEventListener('click', async () => {
            const content = postContent.value.trim();
            const tag = postTag.value;
            
            if (!content) return;
            
            postBtn.disabled = true;
            postBtn.textContent = 'Posting...';

            const userName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
            const location = "Global"; // Default for now, could be fetched from profile

            const { data, error } = await sb
                .from('community_posts')
                .insert([
                    {
                        user_id: session.user.id,
                        author_name: userName,
                        location: location,
                        content: content,
                        tag: tag || null
                    }
                ]);

            postBtn.disabled = false;
            postBtn.textContent = 'Post';

            if (error) {
                console.error('Error posting:', error);
                alert('Failed to post. Please try again.');
            } else {
                postContent.value = '';
                postTag.value = '';
                loadPosts(); // Reload feed
            }
        });
    }

    // Initial load
    loadPosts();
});
