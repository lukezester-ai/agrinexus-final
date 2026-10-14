import os

def update_fields_js():
    filepath = 'scripts/fields.js'
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'window.userFarmContext = fields;' not in content:
        content = content.replace('container.innerHTML = \'\';\n        fields.forEach', 'window.userFarmContext = fields;\n        container.innerHTML = \'\';\n        fields.forEach')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Updated fields.js")

def update_dashboards():
    files = ['dashboard.html', 'ru/dashboard.html']
    for filepath in files:
        if not os.path.exists(filepath):
            continue
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        old_body = "body: JSON.stringify({ message: message })"
        new_body = "body: JSON.stringify({ message: message, farmContext: window.userFarmContext || [] })"
        if old_body in content:
            content = content.replace(old_body, new_body)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filepath}")

def update_chat_api():
    filepath = 'api/chat.ts'
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update the handler to receive farmContext
    if 'const { message, sessionId = "default_session" } = req.body;' in content:
        content = content.replace('const { message, sessionId = "default_session" } = req.body;', 'const { message, farmContext = [], sessionId = "default_session" } = req.body;')
    
    # 2. Add farmContext string generation
    context_string_logic = """
    console.log(`Processing message for session ${sessionId}: ${message}`);
    
    let contextString = "";
    if (farmContext && farmContext.length > 0) {
        const fieldsList = farmContext.map(f => `${f.hectares}ha of ${f.crop} (${f.name})`).join(', ');
        contextString = `\\n\\nIMPORTANT USER CONTEXT:\\nThe user currently has the following fields registered in their farm database: ${fieldsList}. \\nPlease use this information to provide highly personalized and specific advice when they ask general questions like 'what should I do?' or 'how are my crops?'. Do not mention that you were given this context explicitly, just act as if you remember their farm details.`;
    }
    """
    if 'console.log(`Processing message' in content and 'IMPORTANT USER CONTEXT' not in content:
        content = content.replace('    console.log(`Processing message for session ${sessionId}: ${message}`);', context_string_logic)
        
        # 3. Pass contextString to the orchestrator/agents via State?
        # A simpler way is to just append it to the message sent by the user for this turn, or prepend it.
        # But wait, it's better to inject it into the prompt.
        # Let's pass it via state! 
        # Wait, the simplest way without altering the complex LangGraph state is to append it to the HumanMessage (hidden to the user's UI, but seen by LLM).
        
        # Replace: const result = await app.invoke({ messages: [new HumanMessage(message)] }, config);
        old_invoke = "const result = await app.invoke(\n      { messages: [new HumanMessage(message)] },\n      config\n    );"
        new_invoke = "const enrichedMessage = message + contextString;\n    const result = await app.invoke(\n      { messages: [new HumanMessage(enrichedMessage)] },\n      config\n    );"
        
        if old_invoke in content:
            content = content.replace(old_invoke, new_invoke)
        else:
            # Maybe it's formatted differently
            content = content.replace('{ messages: [new HumanMessage(message)] }', '{ messages: [new HumanMessage(message + contextString)] }')
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Updated api/chat.ts")

if __name__ == "__main__":
    update_fields_js()
    update_dashboards()
    update_chat_api()
