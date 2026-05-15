import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

interface Session {
  history: Message[];
  lastActivity: number;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

const sessions = new Map<string, Session>();
const SESSION_TIMEOUT = 30 * 60 * 1000;

let mcpClient: Client | null = null;
let mcpConnected = false;

async function connectMcp() {
  if (mcpConnected) return;

  const venvPythonPath = path.resolve(__dirname, '../../hacker-shop-server/.venv/Scripts/python.exe');
  const serverScriptPath = path.resolve(__dirname, '../../hacker-shop-server/mcp_server.py');

  const freshClient = new Client(
    { name: "hacker-shop-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: venvPythonPath,
    args: [serverScriptPath]
  });

  try {
    await freshClient.connect(transport);
    mcpClient = freshClient;
    mcpConnected = true;
    console.log("Connected to MCP Server via stdio");
  } catch (error) {
    console.error("Failed to connect to MCP Server", error);
  }
}

connectMcp();

const TOOLS = [
  {
    name: "list_products",
    description: "List all products in the shop. Returns array of products with id, name, price, stock, description.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "search_products",
    description: "Search for products by name or description. Takes a search query string.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query to match product name or description" }
      },
      required: ["query"]
    }
  },
  {
    name: "list_categories",
    description: "List all product categories. Returns array of categories with id and name.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "get_product",
    description: "Get details of a specific product by ID.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "The UUID of the product" }
      },
      required: ["product_id"]
    }
  }
];

const SYSTEM_PROMPT = `You are a helpful AI assistant for Hacker Shop, an online store. You have access to tools that can query the shop's database to get real-time product information.

When answering user questions about products:
- ALWAYS use the available tools to get current data
- Present products in a clear, organized way
- Include prices and availability

You can help with:
- Listing all products
- Searching products by name or description
- Getting product details by ID
- Listing categories

Be friendly, concise, and helpful.`;

function cleanupSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(sessionId);
    }
  }
}

setInterval(cleanupSessions, 5 * 60 * 1000);

async function callMCPTool(toolName: string, args: Record<string, any>): Promise<any> {
  try {
    if (!mcpConnected) await connectMcp();

    const result = await mcpClient!.callTool({
      name: toolName,
      arguments: args
    });

    return result.content;
  } catch (error: any) {
    console.error(`MCP tool call error (${toolName}):`, error.message);
    mcpConnected = false;
    mcpClient = null;
    return { error: `Failed to call ${toolName}: ${error.message}` };
  }
}

export async function chat(userMessage: string, sessionId?: string): Promise<{
  sessionId: string;
  response: string;
  history: Message[];
}> {
  let currentSessionId = sessionId;

  if (!currentSessionId || !sessions.has(currentSessionId)) {
    currentSessionId = uuidv4();
    sessions.set(currentSessionId, {
      history: [{ role: 'system', content: SYSTEM_PROMPT }],
      lastActivity: Date.now(),
    });
  }

  const session = sessions.get(currentSessionId)!;
  session.lastActivity = Date.now();

  session.history.push({ role: 'user', content: userMessage });

  try {
    const completion = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-v4-flash:free',
        messages: session.history,
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: 1000,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const message = completion.data.choices?.[0]?.message;

    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0] as ToolCall;
      const toolName = toolCall.function.name;
      let toolArgs = {};

      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error('Failed to parse tool arguments:', e);
      }

      session.history.push({
        role: 'assistant',
        content: message.content || '',
        tool_calls: message.tool_calls
      } as Message);

      const toolResult = await callMCPTool(toolName, toolArgs);

      let toolContentStr = "No result";
      if (Array.isArray(toolResult) && toolResult.length > 0 && toolResult[0].text) {
        toolContentStr = toolResult[0].text;
      } else if (typeof toolResult === "string") {
        toolContentStr = toolResult;
      } else {
        toolContentStr = JSON.stringify(toolResult);
      }

      const toolResultMessage: Message = {
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolName,
        content: toolContentStr
      };
      session.history.push(toolResultMessage);

      const finalCompletion = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'google/gemini-3.1-pro-preview',
          messages: session.history,
          tools: TOOLS,
          max_tokens: 1000,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const finalResponse = finalCompletion.data.choices?.[0]?.message?.content || 'I apologize, but I could not generate a response. Please try again.';
      
      session.history.push({ role: 'assistant', content: finalResponse });

      return {
        sessionId: currentSessionId,
        response: finalResponse,
        history: session.history.slice(1),
      };
    }

    const assistantResponse = message?.content || 'I apologize, but I could not generate a response. Please try again.';

    session.history.push({ role: 'assistant', content: assistantResponse });

    return {
      sessionId: currentSessionId,
      response: assistantResponse,
      history: session.history.slice(1),
    };
  } catch (error: any) {
    console.error('OpenRouter API error:', error.response?.data || error.message);
    throw new Error('Failed to get response from AI');
  }
}

export function clearSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}
