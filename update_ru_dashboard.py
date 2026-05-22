import os

def update_ru_dashboard():
    with open('ru/dashboard.html', 'r', encoding='utf-8') as f:
        content = f.read()

    chat_ui = """
                <div class="panel-header">
                    <span class="panel-title">Спросите Сеть Агентов</span>
                    <span class="time-badge" style="background: rgba(45,90,39,0.1); color: var(--green);" id="agent-status">В СЕТИ</span>
                </div>
                <div class="panel-content" style="display: flex; flex-direction: column; padding: 0;">
                    <div id="chat-messages" style="flex-grow: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; min-height: 250px; max-height: 400px;">
                        <div class="feed-item">
                            <div class="feed-icon" style="color: var(--text-main); border-color: var(--border);">ORC</div>
                            <div class="feed-content">
                                <div class="feed-meta">
                                    <span class="feed-agent">Оркестратор</span>
                                </div>
                                <div class="feed-text">
                                    Здравствуйте, Димитр. Сеть онлайн. Что бы вы хотели узнать о рынках или вашей ферме?
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style="padding: 16px; border-top: 1px solid var(--border); display: flex; gap: 12px; background: #fff;">
                        <input type="text" id="chat-input" placeholder="Спросите о ценах на пшеницу, погоде и т.д..." style="flex-grow: 1; padding: 12px 16px; border: 1px solid var(--border); border-radius: 30px; font-size: 14px; outline: none; font-family: inherit;">
                        <button id="chat-send" class="btn btn-primary" style="padding: 12px 24px;">Спросить</button>
                    </div>
                </div>
                
                <script>
                    const chatMessages = document.getElementById('chat-messages');
                    const chatInput = document.getElementById('chat-input');
                    const chatSend = document.getElementById('chat-send');
                    const agentStatus = document.getElementById('agent-status');

                    function appendMessage(sender, text, agentType) {
                        const isUser = sender === 'Вы';
                        
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

                        appendMessage('Вы', message);
                        chatInput.value = '';
                        
                        agentStatus.textContent = 'ДУМАЕТ...';
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
                                const agentName = data.handledBy === 'marketAgent' ? 'Агент Аналитики Рынка' : 'Общий Агент';
                                appendMessage(agentName, data.response, data.handledBy);
                            } else {
                                appendMessage('Системная Ошибка', data.error || 'Не удалось обработать запрос.');
                            }
                        } catch (err) {
                            appendMessage('Системная Ошибка', 'Ошибка сети. Проверьте, запущен ли бэкенд.');
                        } finally {
                            agentStatus.textContent = 'В СЕТИ';
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

    parts = content.split('<div class="panel-header">\n                    <span class="panel-title">Live Agent Mesh</span>')
    if len(parts) == 2:
        part1 = parts[0]
        part2 = parts[1]
        
        end_idx = part2.find('</main>')
        
        if end_idx != -1:
            new_content = part1 + chat_ui + "\n            </div>\n        " + part2[end_idx:]
            
            with open('ru/dashboard.html', 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("RU Dashboard updated.")
            return

    print("Could not find the target block in RU.")

if __name__ == "__main__":
    update_ru_dashboard()
