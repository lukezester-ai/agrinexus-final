import type { VercelRequest, VercelResponse } from '@vercel/node';
import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph';
import { ChatMistralAI } from '@langchain/mistralai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// Define the state interface for our graph
interface AgentState {
  messages: any[];
  currentTask: string | null;
  agentResponse: string | null;
}

// 1. Define the LLM (Mistral)
// It will automatically use process.env.MISTRAL_API_KEY
const getLLM = () => {
  return new ChatMistralAI({
    modelName: 'mistral-large-latest',
    temperature: 0.2,
  });
};

// 2. Define the Orchestrator Node
const orchestrator = async (state: AgentState) => {
  console.log("--> Orchestrator is analyzing the request");
  const llm = getLLM();
  
  const lastMessage = state.messages[state.messages.length - 1];
  const userQuery = lastMessage.content;
  
  // Decide which agent to call based on the query
  const prompt = new SystemMessage(
    `You are the AgriNexus Orchestrator. 
    Your job is to route the user's query to the right specialized agent.
    If the query is about markets, prices, or selling crops, output "MARKET_AGENT".
    If the query is about weather or agronomy, output "WEATHER_AGENT".
    Otherwise, output "GENERAL_RESPONSE".
    
    Output ONLY the routing key and nothing else.`
  );
  
  const response = await llm.invoke([prompt, new HumanMessage(userQuery)]);
  const decision = (response.content as string).trim();
  
  return { currentTask: decision };
};

// 3. Define the Market Intelligence Agent (FIN/MRK)
const marketAgent = async (state: AgentState) => {
  console.log("--> Market Agent is processing");
  const llm = getLLM();
  const lastMessage = state.messages[state.messages.length - 1];
  
  const prompt = new SystemMessage(
    `You are the AgriNexus Market Intelligence Agent (FIN/MRK).
    Analyze the user's query regarding crop prices, markets, or trading.
    Provide a professional, data-driven response with a hedge-fund tone.
    Invent some plausible current market data (e.g. Wheat at $220/ton) if needed for realism.`
  );
  
  const response = await llm.invoke([prompt, lastMessage]);
  return { agentResponse: response.content, currentTask: "DONE" };
};

// 4. Define the General Response Agent (Conversation Interface)
const generalAgent = async (state: AgentState) => {
  console.log("--> General Agent is processing");
  const llm = getLLM();
  const lastMessage = state.messages[state.messages.length - 1];
  
  const prompt = new SystemMessage(
    `You are the AgriNexus Conversation Interface (CNV).
    The user is asking a general question about their farm or the system.
    Respond politely, concisely, and professionally.`
  );
  
  const response = await llm.invoke([prompt, lastMessage]);
  return { agentResponse: response.content, currentTask: "DONE" };
};

// 5. Define Routing Function
const routeQuery = (state: AgentState) => {
  if (state.currentTask === "MARKET_AGENT") return "marketAgent";
  return "generalAgent";
};

// 6. Build the LangGraph
const workflow = new StateGraph<AgentState>({
  channels: {
    messages: {
      value: (x: any[], y: any[]) => x.concat(y),
      default: () => [],
    },
    currentTask: {
      value: (x: string | null, y: string | null) => y ?? x,
      default: () => null,
    },
    agentResponse: {
      value: (x: string | null, y: string | null) => y ?? x,
      default: () => null,
    }
  }
});

workflow.addNode("orchestrator", orchestrator);
workflow.addNode("marketAgent", marketAgent);
workflow.addNode("generalAgent", generalAgent);

// @ts-ignore
workflow.addEdge(START, "orchestrator");
// @ts-ignore
workflow.addConditionalEdges("orchestrator", routeQuery);
// @ts-ignore
workflow.addEdge("marketAgent", END);
// @ts-ignore
workflow.addEdge("generalAgent", END);

// Compile the graph
const checkpointer = new MemorySaver();
const app = workflow.compile({ checkpointer });


// The Vercel Serverless Handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, farmContext = [], sessionId = "default_session" } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.MISTRAL_API_KEY) {
      return res.status(500).json({ 
        error: 'Missing MISTRAL_API_KEY in environment variables. Please add it to your Vercel project or .env file.' 
      });
    }


    console.log(`Processing message for session ${sessionId}: ${message}`);
    
    let contextString = "";
    if (farmContext && farmContext.length > 0) {
        const fieldsList = farmContext.map((f: any) => `${f.hectares}ha of ${f.crop} (${f.name})`).join(', ');
        contextString = `\n\nIMPORTANT USER CONTEXT:\nThe user currently has the following fields registered in their farm database: ${fieldsList}. \nPlease use this information to provide highly personalized and specific advice when they ask general questions like 'what should I do?' or 'how are my crops?'. Do not mention that you were given this context explicitly, just act as if you remember their farm details.`;
    }
    

    const config = { configurable: { thread_id: sessionId } };
    
    // Run the agent mesh
    const enrichedMessage = message + contextString;
    const result = await app.invoke(
      { messages: [new HumanMessage(enrichedMessage)] },
      config
    );

    return res.status(200).json({
      response: result.agentResponse,
      handledBy: result.currentTask === "DONE" ? "Agent" : result.currentTask
    });

  } catch (error) {
    console.error("Error in Agent Mesh:", error);
    return res.status(500).json({ error: 'Internal server error processing the agent graph.' });
  }
}
