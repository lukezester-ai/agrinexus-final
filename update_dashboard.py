import os

def update_dashboard():
    with open('dashboard.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the Live Agent Mesh panel and replace it
    start_tag = '<div class="panel-header">\n                    <span class="panel-title">Live Agent Mesh</span>'
    
    # We want to replace the whole panel, so we need to be careful.
    # It's easier to use a regex or string slicing to replace the specific panel content.
    
    chat_ui = """
                <div class="panel-header">
                    <span class="panel-title">Ask the Agent Mesh</span>
                    <span class="time-badge" style="background: rgba(45,90,39,0.1); color: var(--green);" id="agent-status">ONLINE</span>
                </div>
                <div class="panel-content" style="display: flex; flex-direction: column; padding: 0;">
                    <div id="chat-messages" style="flex-grow: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; min-height: 250px; max-height: 400px;">
                        <div class="feed-item">
                            <div class="feed-icon" style="color: var(--text-main); border-color: var(--border);">ORC</div>
                            <div class="feed-content">
                                <div class="feed-meta">
                                    <span class="feed-agent">Orchestrator</span>
                                </div>
                                <div class="feed-text">
                                    Hello Dimitar. The mesh is online. What would you like to know about the markets or your farm?
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style="padding: 16px; border-top: 1px solid var(--border); display: flex; gap: 12px; background: #fff;">
                        <input type="text" id="chat-input" placeholder="Ask about wheat prices, weather, etc..." style="flex-grow: 1; padding: 12px 16px; border: 1px solid var(--border); border-radius: 30px; font-size: 14px; outline: none; font-family: inherit;">
                        <button id="chat-send" class="btn btn-primary" style="padding: 12px 24px;">Ask</button>
                    </div>
                </div>
                
                <script>
                    const chatMessages = document.getElementById('chat-messages');
                    const chatInput = document.getElementById('chat-input');
                    const chatSend = document.getElementById('chat-send');
                    const agentStatus = document.getElementById('agent-status');

                    function appendMessage(sender, text, agentType) {
                        const isUser = sender === 'You';
                        
                        let iconText = isUser ? 'USR' : 'ORC';
                        let color = isUser ? 'var(--text-main)' : 'var(--green)';
                        let borderColor = isUser ? 'var(--border)' : 'rgba(45,90,39,0.3)';
                        
                        if (agentType === 'marketAgent') {
                            iconText = 'MKT';
                            color = 'var(--gold)';
                            borderColor = 'rgba(212,175,55,0.3)';
                        }
                        
                        const msgHtml = `
                            <div class="feed-item">
                                <div class="feed-icon" style="color: ${color}; border-color: ${borderColor};">${iconText}</div>
                                <div class="feed-content">
                                    <div class="feed-meta">
                                        <span class="feed-agent">${sender}</span>
                                    </div>
                                    <div class="feed-text">
                                        ${text.replace(/\\n/g, '<br>')}
                                    </div>
                                </div>
                            </div>
                        `;
                        chatMessages.innerHTML += msgHtml;
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }

                    async function sendMessage() {
                        const message = chatInput.value.trim();
                        if (!message) return;

                        // 1. Show user message
                        appendMessage('You', message);
                        chatInput.value = '';
                        
                        // 2. Set status to processing
                        agentStatus.textContent = 'THINKING...';
                        agentStatus.style.color = 'var(--terracotta)';
                        agentStatus.style.background = 'rgba(204,78,54,0.1)';

                        try {
                            const res = await fetch('/api/chat', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ message: message })
                            });
                            
                            const data = await res.json();
                            
                            if (res.ok) {
                                const agentName = data.handledBy === 'marketAgent' ? 'Market Intelligence Agent' : 'General Agent';
                                appendMessage(agentName, data.response, data.handledBy);
                            } else {
                                appendMessage('System Error', data.error || 'Failed to process request.');
                            }
                        } catch (err) {
                            appendMessage('System Error', 'Network error. Please check if backend is running.');
                        } finally {
                            agentStatus.textContent = 'ONLINE';
                            agentStatus.style.color = 'var(--green)';
                            agentStatus.style.background = 'rgba(45,90,39,0.1)';
                        }
                    }

                    chatSend.addEventListener('click', sendMessage);
                    chatInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') sendMessage();
                    });
                </script>
"""

    # We need to replace everything from <div class="panel-header"> up to the end of that panel's </div>
    # The panel we want to replace is the second panel in the dashboard-split
    
    import re
    # We find the specific block starting with `<span class="panel-title">Live Agent Mesh</span>`
    # and replace the parent panel contents.
    
    pattern = r'<div class="panel-header">\s*<span class="panel-title">Live Agent Mesh</span>.*?</div>\s*</div>\s*</div>'
    # Wait, the structure is:
    # <div class="panel-header"> ... </div>
    # <div class="panel-content">
    #     <div class="agent-feed">
    #        ...
    #     </div>
    # </div>
    
    # Let's do a safe manual string replace since regex on HTML can be tricky.
    
    parts = content.split('<div class="panel-header">\n                    <span class="panel-title">Live Agent Mesh</span>')
    if len(parts) == 2:
        part1 = parts[0]
        # find the end of the panel-content div
        # The next </div></div></div> usually closes it, but let's just find the end of main
        part2 = parts[1]
        
        # We need to replace up to the closing main
        end_idx = part2.find('</main>')
        
        if end_idx != -1:
            new_content = part1 + chat_ui + "\n            </div>\n        " + part2[end_idx:]
            
            with open('dashboard.html', 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Dashboard updated.")
            return

    print("Could not find the target block.")

if __name__ == "__main__":
    update_dashboard()
